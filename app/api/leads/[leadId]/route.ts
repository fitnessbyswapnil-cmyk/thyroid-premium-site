/**
 * GET /api/leads/[leadId]
 *
 * Returns the non-sensitive lead data for a given leadId.
 * Used by /session-booked to personalise the greeting when localStorage
 * is unavailable (e.g. different browser/device after payment).
 *
 * Security: leadId acts as an unguessable token (random string).
 * Only name, phone, and email are returned — no intake/attribution data.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

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

    // Fetch columns A–E: Timestamp | Lead ID | Name | Phone | Email
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Leads!A:E",
    });

    const rows = response.data.values ?? [];
    // Skip header row; find row where column B (index 1) matches the leadId
    const row = rows.slice(1).find((r) => r[1] === leadId);

    if (!row) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      leadId: row[1] ?? "",
      name: row[2] ?? "",
      phone: row[3] ?? "",
      email: row[4] ?? "",
    });
  } catch (err) {
    console.error("[leads/[leadId]] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }
}
