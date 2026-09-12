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
        range: `${SHEET_NAME}!A1:BZ`,
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
    const yesterday = istDayString(new Date(nowIst.getTime() - 86400000));

    let yLeads = 0, yBooked = 0, unconfirmed = 0, cancelledOpen = 0;
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
      const leadDayIst = istDayString(new Date(new Date(ts).getTime() + IST_OFFSET_MS));
      const emailKey = cell(r, C.email).toLowerCase();
      const calCancelled = !!emailKey && cal.state.cancelled.has(emailKey);
      const calActive = !!emailKey && cal.state.active.has(emailKey);
      // Cal.com wins over the sheet, which only ever records "Booked".
      const booked = calActive || (cell(r, C.bookingStatus) === "Booked" && !calCancelled);
      if (calCancelled && !calActive && cell(r, C.showed) === "") cancelledOpen++;
      if (leadDayIst === yesterday) {
        yLeads++;
        if (booked) yBooked++;
      }
      // unconfirmed = recent lead (last 3 days) with no sequence msg yet
      const ageMs = Date.now() - new Date(ts).getTime();
      if (ageMs < 3 * 86400000 && !cell(r, C.msg1) && cell(r, C.showed) === "") unconfirmed++;

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
    todaySessions.sort((a, b) => (parseSession(`05 Aug 2026 ${a.time}`)?.getTime() ?? 0) - (parseSession(`05 Aug 2026 ${b.time}`)?.getTime() ?? 0));

    const lines = [
      `MORNING BRIEF — ${nowIst.toISOString().slice(0, 10)}`,
      ``,
      `Yesterday: ${yLeads} leads, ${yBooked} booked.`,
      ``,
      todaySessions.length
        ? `Today's sessions (${todaySessions.length}):\n${todaySessions.map((s) => `  ${s.time} — ${s.name} (${s.risk})`).join("\n")}`
        : `No sessions booked for today.`,
      ``,
      unconfirmed > 0 ? `ACTION: ${unconfirmed} recent lead(s) still waiting for their first WhatsApp.` : `All recent leads contacted.`,
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
