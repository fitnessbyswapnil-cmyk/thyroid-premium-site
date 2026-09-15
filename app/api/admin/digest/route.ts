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
import { IST_OFFSET_MS, parseIstSession } from "@/lib/unmarked-outcomes";
import { dmPresenceRate, formatDmPresence, type PresenceRecord } from "@/lib/dm-presence";
import { IS_TEST_MODE } from "../../create-cashfree-order/route";
import { summarize } from "@/lib/metrics";
import { loadJourneys } from "@/lib/journey-source";
import { staleDecisionsOf, STALE_AFTER_DAYS } from "@/lib/journey";

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

    const todaySessions: { time: string; name: string; risk: string }[] = [];
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
      const sd = cell(r, C.sessionDate);
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

    }
    // Headline numbers from lib/metrics — the same definitions as every tab.
    // Yesterday is the IST calendar day; the week is the last seven days.
    const istMidnightUtc = Date.parse(`${today}T00:00:00Z`) - IST_OFFSET_MS;
    let numberLines: string[];
    // The same journeys every tab reads (lib/journey): numbers, pipeline, and
    // the one needs-action list.
    const J = await loadJourneys();
    try {
      const { data } = J.loaded;
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

    // The one needs-action list, same count as every tab. Overdue (over six
    // hours) gets its own line.
    const na = J.needsAction;
    const overSixHours = na.overdue;
    const unsent = na.items.filter((i) => i.kind === "first_message").length;
    // Counting sheet rows directly once reported 95 — mostly his own test bookings.
    const cancelledOpen = na.items.filter((i) => i.kind === "rebook_cancelled").length;
    const stale = staleDecisionsOf(J.journeys, nowMs);

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
      `Needs you: ${na.count} item(s) · in pipeline ${J.pipeline.inPipeline} · nurture ${J.pipeline.nurture}.`,
      unsent > 0 ? `ACTION: ${unsent} recent lead(s) with no WhatsApp sent yet.` : `Every recent lead has had a WhatsApp.`,
      overSixHours > 0
        ? `ACTION: ${overSixHours} item(s) OVERDUE — waiting over 6 hours. Oldest first on every tab.`
        : `Nothing has waited over 6 hours.`,
      // A paid lead with no call on the calendar is the most perishable thing
      // in the funnel, so it gets its own line rather than hiding in a count.
      ...(cancelledOpen > 0
        ? [``, `ACTION: ${cancelledOpen} lead(s) cancelled their call and have NOT rebooked — win the slot back today.`]
        : []),
      // Calls with no outcome, from the same journeys as every tab (lib/journey
      // staleDecisionsOf). The old line counted the Leads sheet's Showed/Closed
      // columns, which Today no longer writes, so it never went down. Counts
      // only — this text leaves the building through Make and Gmail.
      ...(stale.unmarked > 0
        ? [``, `ACTION: ${stale.unmarked} call(s) from ${STALE_AFTER_DAYS}+ days ago not marked yet — joined or not? Mark them on Today.`]
        : []),
      ...(stale.undecided > 0
        ? [`ACTION: ${stale.undecided} held call(s) from ${STALE_AFTER_DAYS}+ days ago with no sale decision. If she paid, mark it on Today — Meta stops accepting a sale after 7 days.`]
        : []),
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
