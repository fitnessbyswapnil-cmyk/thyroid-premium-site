/**
 * GET /api/admin/digest
 *
 * Composes the daily Morning Brief (plain text): yesterday's numbers, today's
 * sessions with risk flags, the action-queue counts, and consultations whose
 * outcome is still unmarked days later — that last one because an unmarked
 * close never reaches Meta and expires after seven days. Two callers:
 *
 *  1. The dashboard / owner (x-admin-key header) — returns { text }.
 *  2. Vercel Cron at 8:00 AM IST (02:30 UTC, vercel.json) — authorized via
 *     the standard CRON_SECRET Bearer header. If MAKE_DIGEST_WEBHOOK is set,
 *     the brief is POSTed there as { text } so a 3-module Make scenario
 *     (Webhook → Gmail) can email/WhatsApp it to the owner. If the webhook
 *     env is unset the cron is a harmless no-op that still returns the text.
 *
 * Read-only on the sheet; sends nothing to leads — the brief goes to the
 * OWNER only.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, fetchCalBookingState, SHEET_NAME } from "../_lib";
import { isOwnerTest } from "@/lib/owner-filter";
import {
  IST_OFFSET_MS,
  parseIstSession,
  selectUnmarkedOutcomes,
  formatUnmarkedOutcomes,
  type ConsultationRecord,
} from "@/lib/unmarked-outcomes";
import { dmPresenceRate, formatDmPresence, type PresenceRecord } from "@/lib/dm-presence";
import { IS_TEST_MODE } from "../../create-cashfree-order/route";
import { summarize, isTestIdentity, isWonRow } from "@/lib/metrics";
import { loadMetricsDataset } from "@/lib/metrics-source";
import { buildQueue, type QueueLead } from "@/lib/follow-up-queue";
import { readMessages } from "@/lib/wa-messages";

export const dynamic = "force-dynamic";

function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}
function istDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The session slot as a Date whose UTC fields ARE the IST wall clock — which
 *  is what every caller below already assumes. parseIstSession does the zone
 *  arithmetic so the answer no longer depends on the runtime's timezone. */
function parseSession(sessionDate: string): Date | null {
  const ms = parseIstSession(sessionDate);
  return ms === null ? null : new Date(ms + IST_OFFSET_MS);
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron && !checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { sheets, sheetId } = await getSheetsClient();
    // Same live Cal.com read the dashboard uses, so the brief never tells the
    // coach to prepare for a call the attendee already cancelled.
    const [res, cal] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        // BZ, not BG: the outcome columns (Showed, Closed ₹, Programme Value)
        // are APPENDED by /api/admin/mark, and the payment webhook's own columns
        // have since pushed them past BG. Reading to BG left them all empty, so
        // every row looked unmarked. Same range the Today feed reads.
        // ZZ since the CRM consolidation: Paid Amount and Programme Value, which
        // decide "won", can sit past BZ too.
        range: `${SHEET_NAME}!A1:ZZ`,
      }),
      fetchCalBookingState(),
    ]);
    // The WhatsApp log, grouped by number — the follow-up queue's definition of
    // "a message has gone out" (lib/follow-up-queue). Empty on failure, which
    // only makes the queue line more cautious.
    const lastOutbound = new Map<string, string>();
    try {
      for (const m of await readMessages()) {
        if (m.direction !== "out") continue;
        const k = String(m.phone ?? "").replace(/\D/g, "").slice(-10);
        if (k && (lastOutbound.get(k) ?? "") < m.ts) lastOutbound.set(k, m.ts);
      }
    } catch (msgErr) {
      console.error("[admin/digest] message log unavailable:", msgErr instanceof Error ? msgErr.message : String(msgErr));
    }
    const rows: string[][] = (res.data.values as string[][]) ?? [];
    const hdr = (rows[0] ?? []).map((h) => (h ?? "").trim());
    const col = (name: string, fallback: number) => {
      const i = hdr.lastIndexOf(name);
      return i >= 0 ? i : fallback;
    };
    const C = {
      ts: 0,
      name: col("Name", 2),
      email: col("Email", 4),
      bookingStatus: col("Booking Status", 18),
      sessionDate: col("Session Date", 19),
      commitment: col("Commitment (1-10)", 46),
      phone: col("Phone", 3),
      score: col("Lead Score", 52),
      showed: col("Showed", -1),
      msg1: col("Msg1 Sent", -1),
      msg2: col("Msg2 Sent", -1),
      msg3: col("Msg3 Sent", -1),
      paidAmount: col("Paid Amount", -1),
      closed: col("Closed ₹", -1),
      programmeValue: col("Programme Value", -1),
      // Written by /api/admin/mark under a fixed title; -1 until the first call
      // is marked, and cell() reads -1 as an empty string.
      dmPresent: col("DM Present", -1),
    };
    const cell = (r: string[], i: number) => (r[i] ?? "").toString().trim();

    // One clock for the whole brief, so the 3-day cutoff and the "held yet?"
    // test cannot land on opposite sides of a tick.
    const nowMs = Date.now();
    const nowIst = istNow();
    const today = istDayString(nowIst);

    let cancelledOpen = 0;
    // Every row as the follow-up queue sees it — same fields the Analytics tab
    // builds, so the brief and the tab count the same waiting women.
    const queueLeads: QueueLead[] = [];
    const todaySessions: { time: string; name: string; risk: string }[] = [];
    // Consultations already held, for the unmarked-outcome nudge below.
    const held: ConsultationRecord[] = [];
    // Every row, unfiltered, for the rolling presence figure — it does its own
    // held-and-in-window test, and it is the one number on this brief that is
    // about the coach's habit rather than about a particular woman.
    const presenceRows: PresenceRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const ts = cell(r, C.ts);
      if (!/^\d{4}-\d{2}-\d{2}T/.test(ts)) continue;
      const emailKey = cell(r, C.email).toLowerCase();
      const calCancelled = !!emailKey && cal.state.cancelled.has(emailKey);
      const calActive = !!emailKey && cal.state.active.has(emailKey);
      // Cal.com wins over the sheet, which only ever records "Booked".
      const booked = calActive || (cell(r, C.bookingStatus) === "Booked" && !calCancelled);
      if (calCancelled && !calActive && cell(r, C.showed) === "") cancelledOpen++;
      const sd = cell(r, C.sessionDate);
      const num = (v: string) => {
        const n = parseFloat(v.replace(/[^\d.]/g, ""));
        return Number.isFinite(n) ? n : null;
      };
      queueLeads.push({
        ts,
        name: cell(r, C.name),
        phone: cell(r, C.phone),
        booked,
        cancelled: calCancelled && !calActive,
        showed: cell(r, C.showed).toUpperCase(),
        won: isWonRow({
          closedAmt: num(cell(r, C.closed)),
          programmeValue: num(cell(r, C.programmeValue)),
          paidAmount: num(cell(r, C.paidAmount)),
        }),
        isTest: isTestIdentity({ name: cell(r, C.name), email: cell(r, C.email), phone: cell(r, C.phone) }),
        sessionAtMs: sd ? parseIstSession(sd) : null,
        msg1: cell(r, C.msg1).toUpperCase(),
        msg2: cell(r, C.msg2).toUpperCase(),
        msg3: cell(r, C.msg3).toUpperCase(),
        lastOutboundAt: lastOutbound.get(cell(r, C.phone).replace(/\D/g, "").slice(-10)) ?? "",
      });

      presenceRows.push({ sessionDate: sd, showed: cell(r, C.showed), dmPresent: cell(r, C.dmPresent) });
      const sess = sd ? parseSession(sd) : null;
      if (booked && sess && istDayString(new Date(sess.getTime() + IST_OFFSET_MS - IST_OFFSET_MS)) === today) {
        // session date string is already in IST wall-clock terms
        const commitment = parseFloat(cell(r, C.commitment));
        const phone = cell(r, C.phone);
        const risk =
          !phone || (Number.isFinite(commitment) && commitment <= 3)
            ? "HIGH no-show risk"
            : Number.isFinite(commitment) && commitment <= 6
            ? "medium risk"
            : "likely to show";
        todaySessions.push({
          time: sd.match(/\d{1,2}:\d{2} [AP]M/)?.[0] ?? sd,
          name: cell(r, C.name) || "(no name)",
          risk,
        });
      }

      // Consultations already held. cal.state.active only lists UPCOMING
      // bookings, so a past call is "held" per the sheet's own Booked status
      // minus whatever Cal.com says was cancelled. The coach's own test rows are
      // dropped — nearly half the pipeline is his, and a nudge list he learns to
      // scroll past is a nudge list he stops reading.
      const sessAt = sd ? parseIstSession(sd) : null;
      if (
        booked && sessAt !== null && sessAt < nowMs &&
        !isOwnerTest({ name: cell(r, C.name), email: cell(r, C.email) })
      ) {
        held.push({
          name: cell(r, C.name),
          sessionAtMs: sessAt,
          showed: cell(r, C.showed),
          closedAmount: cell(r, C.closed),
          programmeValue: cell(r, C.programmeValue),
        });
      }
    }
    // Headline numbers from lib/metrics — the same definitions as every tab.
    // Yesterday is the IST calendar day; the week is the last seven days.
    const istMidnightUtc = Date.parse(`${today}T00:00:00Z`) - IST_OFFSET_MS;
    let numberLines: string[];
    try {
      const { data } = await loadMetricsDataset();
      const y = summarize(data, { from: istMidnightUtc - 86400000, to: istMidnightUtc }, nowMs);
      const w = summarize(data, { from: nowMs - 7 * 86400000, to: nowMs + 1 }, nowMs);
      const inr = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;
      numberLines = [
        `Yesterday: ${y.leads} leads, ${y.booked} booked, ${y.won} won${y.revenue ? ` (${inr(y.revenue)})` : ""}.`,
        `Last 7 days: ${w.leads} leads, ${w.booked} booked, ${w.won} won, ${inr(w.revenue)} programme revenue.`,
      ];
    } catch (mErr) {
      console.error("[admin/digest] metrics unavailable:", mErr instanceof Error ? mErr.message : String(mErr));
      numberLines = [`Numbers unavailable this morning — open the dashboard.`];
    }

    // The follow-up queue, same rule as the Analytics tab. Anything waiting
    // over six hours is red there, and gets its own line here.
    const queue = buildQueue(queueLeads, nowMs);
    const overSixHours = queue.filter((q) => q.waitMin > 360).length;
    const unsent = queue.filter((q) => q.label.includes("no WhatsApp") || q.label.startsWith("New lead")).length;

    todaySessions.sort((a, b) => (parseSession(`05 Aug 2026 ${a.time}`)?.getTime() ?? 0) - (parseSession(`05 Aug 2026 ${b.time}`)?.getTime() ?? 0));

    // Same warning as the dashboard banner: a forgotten test mode is invisible

    // until the money is gone.

    const testModeLine = IS_TEST_MODE ? ["⚠️ TEST MODE IS ON — Cashfree is charging Rs 1, not Rs 299."] : [];

    const lines = [
      ...testModeLine,
      `MORNING BRIEF — ${nowIst.toISOString().slice(0, 10)}`,
      ``,
      ...numberLines,
      ``,
      todaySessions.length
        ? `Today's sessions (${todaySessions.length}):\n${todaySessions.map((s) => `  ${s.time} — ${s.name} (${s.risk})`).join("\n")}`
        : `No sessions booked for today.`,
      ``,
      unsent > 0 ? `ACTION: ${unsent} recent lead(s) with no WhatsApp sent yet.` : `Every recent lead has had a WhatsApp.`,
      overSixHours > 0
        ? `ACTION: ${overSixHours} follow-up item(s) waiting over 6 hours — oldest first in the queue.`
        : `Nothing in the follow-up queue has waited over 6 hours.`,
      // A paid lead with no call on the calendar is the most perishable thing
      // in the funnel, so it gets its own line rather than hiding in a count.
      ...(cancelledOpen > 0
        ? [``, `ACTION: ${cancelledOpen} paid lead(s) cancelled and have NOT rebooked — win the slot back today.`]
        : []),
      // An outcome that never gets marked is a sale Meta is never told about,
      // and Meta stops accepting it after seven days. Names and dates only —
      // this text leaves the building through Make and Gmail.
      ...formatUnmarkedOutcomes(selectUnmarkedOutcomes(held, nowMs), IST_OFFSET_MS),
      ``,
      // The habit number, in the same words the dashboard uses so the two can
      // never quietly disagree about the same fortnight. A count, no names.
      formatDmPresence(dmPresenceRate(presenceRows, nowMs)),
      ``,
      `Dashboard: https://www.swapnilumbarkarfitness.in/admin`,
    ];
    const text = lines.join("\n");

    // Cron leg: forward to Make (Webhook → Gmail) when configured.
    const webhook = process.env.MAKE_DIGEST_WEBHOOK;
    let forwarded = false;
    if (isCron && webhook) {
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        forwarded = true;
      } catch (err) {
        console.error("[admin/digest] webhook forward failed", err);
      }
    }
    return NextResponse.json({ text, forwarded });
  } catch (err) {
    console.error("[admin/digest]", err);
    return NextResponse.json({ error: "digest_failed" }, { status: 500 });
  }
}
