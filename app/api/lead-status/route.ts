/**
 * GET /api/lead-status?leadId=dq_…
 *
 * Answers one question for the page: has this lead already paid, and has she
 * already chosen a slot?
 *
 * Without it the resume link is stateless. A woman who paid and booked in the
 * browser, then tapped "Book My Consultation" in WhatsApp, was shown the
 * checkout again — same price, same button — with nothing on screen saying she
 * was already done. Best case she is confused; worst case she pays twice.
 *
 * No auth: it is keyed on an unguessable lead id and returns no contact
 * details, only booleans and the session time she already holds.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient } from "../admin/_lib";
import { GATE_OUTCOME_HEADER, isNurtureGated } from "@/lib/decode-gate";
import { mergeLeadRows } from "@/lib/lead-row-merge";

export const dynamic = "force-dynamic";

const SHEET_NAME = "Leads";
const LEAD_ID_COL = 1; // column B, pinned by the quiz on create

function findCol(header: string[], title: string): number {
  const i = header.lastIndexOf(title);
  return i >= 0 ? i : -1;
}

export async function GET(req: NextRequest) {
  const leadId = (req.nextUrl.searchParams.get("leadId") ?? "").trim();
  if (!leadId) return NextResponse.json({ error: "missing_leadId" }, { status: 400 });

  try {
    const { sheets, sheetId } = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A1:BZ`,
    });
    const all = (res.data.values as string[][]) ?? [];
    const header = (all[0] ?? []).map((h) => String(h ?? "").trim());

    const cPaid = findCol(header, "Paid");
    const cBookingStatus = findCol(header, "Booking Status");
    const cSessionDate = findCol(header, "Session Date");
    const cName = findCol(header, "Name");
    const cGate = findCol(header, GATE_OUTCOME_HEADER);
    const cScore = findCol(header, "Lead Score");

    // Her state is assembled from EVERY row carrying her lead id, not just the
    // newest one. This used to take the last match, on the reasoning that the
    // newest row is her newest state. It is not — the newest row is the newest
    // WRITER, and the Cal.com Make scenario appends a booking row that knows
    // nothing about her score or her payment. On 12-Sep that returned
    // `score: null, paid: false` for a woman who had scored Best, paid Rs 1 and
    // booked, which is exactly why QualifiedSchedule has never fired: no score
    // here means no qscore into Cal, means the webhook scores the booking 0.
    const merged = mergeLeadRows(all, leadId, LEAD_ID_COL);
    if (!merged) return NextResponse.json({ found: false, paid: false, booked: false });
    const row: string[] = merged.cells;

    const cell = (i: number) => (i >= 0 ? String(row?.[i] ?? "").trim() : "");
    const paid = cell(cPaid).toUpperCase() === "Y";
    const sessionDate = cell(cSessionDate);
    const bookingStatus = cell(cBookingStatus);
    // A slot exists if either the Make scenario stamped a session date or the
    // booking status says so. Cancellations must not read as booked.
    const booked =
      (!!sessionDate || /confirm|booked|scheduled/i.test(bookingStatus)) &&
      !/cancel/i.test(bookingStatus);

    return NextResponse.json({
      found: true,
      paid,
      booked,
      sessionDate: booked ? sessionDate : "",
      // The durable record of the timing gate. Her device may not remember it
      // (new phone, cleared storage, husband's handset), but the sheet does, and
      // the resume link must not reopen a checkout she was never offered.
      gate: isNurtureGated(cell(cGate)) ? "nurture_timing" : "",
      // Her intent score. The booking page sends it to Cal.com as `qscore`,
      // which is the only thing that can turn a Schedule into a
      // QualifiedSchedule — and it otherwise rides only in this browser's
      // storage, so a new phone or cleared storage silently kills the signal.
      score: Number.parseInt(cell(cScore), 10) || null,
      firstName: cell(cName).split(/\s+/)[0] ?? "",
    });
  } catch (err) {
    // Never block the page on this — an error reads as "unknown", and the page
    // falls back to its normal checkout rather than showing a wrong state.
    console.error("[lead-status] lookup failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ found: false, paid: false, booked: false });
  }
}
