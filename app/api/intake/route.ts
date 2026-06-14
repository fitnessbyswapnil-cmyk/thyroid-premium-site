/**
 * POST /api/intake
 *
 * Persists the (OPTIONAL, post-booking) Deep Intake answers onto the lead's
 * EXISTING row in the "Leads" tab — matched by Lead ID (column B). Update-in-place,
 * no duplicate row.
 *
 * COLUMN SAFETY: the intake columns are NOT hardcoded. We find them by header
 * name; if they don't exist yet, we APPEND them to the right of every existing
 * column (so we can never overwrite Lead Score / Lead Tier or anything else,
 * wherever they sit). Subsequent writes reuse the same columns.
 *
 * Body: { leadId, step2_5: { ...9 answers } }
 * Reuses the same Google Sheets service-account env vars as /api/leads.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_NAME = "Leads";

// The intake answer columns, in order. The first is used as the block anchor.
const INTAKE_HEADERS = [
  "Weight Struggles (Intake)",
  "Biggest Frustration (Intake)",
  "Energy Level (Intake)",
  "On Medication",
  "Specialist History",
  "Energy Lowest Time",
  "Tried Before",
  "Transformation Goal",
  "Eating Approach",
  "Intake Submitted At",
] as const;

type Step2_5 = {
  weightStruggles?: string | string[];
  biggestFrustration?: string;
  energyLevel?: string;
  onMedication?: string;
  specialistHistory?: string;
  energyLow?: string;
  triedBefore?: string | string[];
  transformationGoal?: string;
  eatingApproach?: string;
};

function arr(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? v.join(", ") : v;
}
function str(v: string | undefined): string {
  return v?.trim() || "";
}

// 0-indexed column number → A1 letter (handles AA, AB, …).
function colA1(n: number): string {
  let s = "";
  let x = n + 1;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function intakeValues(a: Step2_5): string[] {
  return [
    arr(a.weightStruggles),
    str(a.biggestFrustration),
    str(a.energyLevel),
    str(a.onMedication),
    str(a.specialistHistory),
    str(a.energyLow),
    arr(a.triedBefore),
    str(a.transformationGoal),
    str(a.eatingApproach),
    new Date().toISOString(),
  ];
}

export async function POST(req: NextRequest) {
  try {
    const { leadId, step2_5 } = (await req.json()) as { leadId?: string; step2_5?: Step2_5 };
    if (!leadId || !step2_5) {
      return NextResponse.json({ error: "leadId and step2_5 are required" }, { status: 400 });
    }

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!email || !key || !sheetId) throw new Error("Missing Google Sheets env vars");

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: key },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // 1) Read the header row to locate (or place) the intake block — never hardcode.
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!1:1`,
    });
    const headers: string[] = (headerRes.data.values?.[0] as string[]) ?? [];

    let startCol = headers.indexOf(INTAKE_HEADERS[0]);
    if (startCol === -1) {
      // Not present yet → append the block to the RIGHT of every existing column,
      // so nothing (Lead Score / Lead Tier / etc.) can be overwritten.
      startCol = headers.length;
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!${colA1(startCol)}1:${colA1(startCol + INTAKE_HEADERS.length - 1)}1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...INTAKE_HEADERS]] },
      });
    }

    // 2) Find the lead's row by Lead ID (column B); first match.
    const lookup = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!B2:B`,
    });
    const rows = lookup.data.values ?? [];
    let rowNumber = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.[0] === leadId) { rowNumber = i + 2; break; }
    }
    if (rowNumber === -1) {
      console.warn(`[intake] leadId ${leadId} not found — skipping`);
      return NextResponse.json({ ok: true, matched: false });
    }

    // 3) Write the answers into the located block for that row.
    const from = colA1(startCol);
    const to = colA1(startCol + INTAKE_HEADERS.length - 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!${from}${rowNumber}:${to}${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [intakeValues(step2_5)] },
    });
    console.log(`[intake] Updated row ${rowNumber} (cols ${from}:${to}) for lead ${leadId}`);
    return NextResponse.json({ ok: true, matched: true, row: rowNumber, cols: `${from}:${to}` });
  } catch (err) {
    console.error("[intake] FAILED:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to save intake" }, { status: 500 });
  }
}
