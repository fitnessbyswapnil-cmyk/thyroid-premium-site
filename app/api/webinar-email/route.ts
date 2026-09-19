/**
 * POST /api/webinar-email — her email, offered on the thank-you page AFTER she
 * has registered.
 *
 * The registration form asks for two fields and nothing else, because every
 * extra field on a cold-traffic phone form costs registrations. The email is
 * collected here instead, from a woman who has already converted, so it costs
 * nothing. What it buys:
 *   - attendance matching, because the meeting platform's export carries
 *     emails and often no phone (lib/webinar-attendance.ts);
 *   - better Meta matching on future events.
 *
 * SENDS NOTHING TO META. CompleteRegistration already fired for this woman; a
 * second event carrying the email would be counted as a second registration.
 *
 * WRITES ONE CELL. It updates the Email column on the row her registration
 * created, found by lead id alone. It never creates a row, never touches
 * another column, and never matches by phone — a phone match could write her
 * address onto a different woman's row.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient, SHEET_NAME } from "../admin/_lib";
import { colLetter } from "@/lib/lead-sheet";
import { checkEmail, isRegistrationEventId } from "@/lib/webinar";
import { getClientIp } from "@/lib/server-tracking";
import { checkTurnstile, turnstileConfig } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

/** Lead ID is column B and Email is column E in the Leads tab. */
const LEAD_ID_COL = 1;
const EMAIL_COL = 4;

export async function POST(req: NextRequest) {
  let body: { eventId?: string; email?: string; turnstileToken?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  // The same id the thank-you page uses to fire the pixel. It proves she came
  // from a real registration; without it this route would let anyone write an
  // address onto any row.
  const eventId = String(body.eventId ?? "").trim();
  if (!isRegistrationEventId(eventId)) {
    return NextResponse.json({ error: "bad_registration" }, { status: 400 });
  }
  const leadId = eventId.replace(/^CompleteRegistration_/, "");

  const checked = checkEmail(String(body.email ?? ""));
  if (!checked.ok) {
    return NextResponse.json({ error: "invalid_email", message: checked.error }, { status: 400 });
  }

  const bot = await checkTurnstile({
    config: turnstileConfig(),
    token: body.turnstileToken,
    remoteIp: getClientIp(req),
  });
  if (bot.verdict === "reject") {
    console.warn("[webinar-email] bot check REJECTED: nothing written");
    return NextResponse.json({ error: "bot_check_failed" }, { status: 403 });
  }

  try {
    const { sheets, sheetId } = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!${colLetter(LEAD_ID_COL)}:${colLetter(LEAD_ID_COL)}`,
    });
    const ids = (res.data.values ?? []).map((r) => String(r?.[0] ?? "").trim());
    // Her newest row wins: a woman who registered twice has two, and the later
    // one is the registration she is looking at right now.
    const rowIndex = ids.lastIndexOf(leadId);
    if (rowIndex < 0) {
      console.warn(`[webinar-email] no row for leadId=${leadId}; nothing written`);
      return NextResponse.json({ error: "row_not_found" }, { status: 404 });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!${colLetter(EMAIL_COL)}${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[checked.email]] },
    });
    console.log(`[webinar-email] email saved for leadId=${leadId} row=${rowIndex + 1}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webinar-email] write failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
}
