/**
 * GET /api/leads/[leadId]
 *
 * Returns the non-sensitive lead data for a given leadId.
 * Used by /session-booked to personalise the greeting when localStorage
 * is unavailable (e.g. different browser/device after payment).
 *
 * Also returns her CURRENT paid/booked state so /complete-payment can refuse
 * to charge someone who has already paid — the guard against one person
 * paying twice via two different entry points (site checkout vs a WhatsApp
 * button). Both are resolved per PHONE, not per row.
 *
 * Security: leadId acts as an unguessable token (random string).
 * Only name, phone, email and her own paid/booked booleans are returned —
 * no intake, scoring or attribution data.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { phoneKey } from "@/lib/reminder-plan";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;

  if (!leadId) {
    return NextResponse.json({ error: "Missing leadId" }, { status: 400 });
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const key = rawKey?.replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEETS_ID;

  if (!email || !key || !sheetId) {
    console.error("[leads/[leadId]] Missing Google Sheets env vars");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: key },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Full width, not just A–E: the caller also needs her CURRENT paid and
    // booked state so a resume page can refuse to charge someone twice.
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Leads!A:BZ",
    });

    const all = response.data.values ?? [];
    const header = (all[0] ?? []).map((h) => String(h ?? ""));
    const rows = all.slice(1);
    // Skip header row; find row where column B (index 1) matches the leadId
    const row = rows.find((r) => r[1] === leadId);

    if (!row) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const findCol = (title: string): number => {
      const want = title.trim().toLowerCase();
      return header.findIndex((h) => String(h ?? "").trim().toLowerCase() === want);
    };
    const cell = (r: string[], i: number): string => (i < 0 ? "" : String(r?.[i] ?? "").trim());

    // Columns R/S are written by the Cal.com → Sheets scenario; resolve by
    // header name first and fall back to the positional contract, exactly as
    // the payment-reminder cron does.
    const paidCol = findCol("Paid");
    const bookingStatusCol = findCol("Booking Status") >= 0 ? findCol("Booking Status") : 17;
    const sessionDateCol = findCol("Session Date") >= 0 ? findCol("Session Date") : 18;

    // Status is settled per PERSON, not per row. She can pay on one row and
    // resume from a different one (retook the quiz, partial submission), so a
    // paid/booked marker on ANY row carrying her number counts — the same
    // phone-level rule lib/reminder-plan.ts applies. Without this, a resume
    // link would happily charge an existing payer a second time.
    const her = phoneKey(cell(row, 3));
    const hers = her ? rows.filter((r) => phoneKey(cell(r, 3)) === her) : [row];

    const paid = hers.some((r) => cell(r, paidCol).toUpperCase() === "Y");
    const booked = hers.some((r) => !!cell(r, bookingStatusCol) || !!cell(r, sessionDateCol));

    return NextResponse.json({
      leadId: row[1] ?? "",
      name: row[2] ?? "",
      phone: row[3] ?? "",
      email: row[4] ?? "",
      paid,
      booked,
    });
  } catch (err) {
    console.error("[leads/[leadId]] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }
}
