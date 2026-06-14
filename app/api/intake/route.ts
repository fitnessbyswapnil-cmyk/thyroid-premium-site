/**
 * POST /api/intake
 *
 * Persists the (now OPTIONAL, post-booking) Deep Intake answers onto the lead's
 * EXISTING row in the "Leads" tab — matched by Lead ID (column B) — written into
 * columns V..AD (one per question) + AE = Intake Submitted At. Columns A..U are
 * left untouched (Q..U are used by automations). Update-in-place: no duplicate row.
 *
 * Body: { leadId, step2_5: { ...9 answers } }
 * Reuses the same Google Sheets service-account env vars as /api/leads.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_NAME = "Leads";

const INTAKE_HEADERS = [
  "Weight Struggles (Intake)",    // V
  "Biggest Frustration (Intake)", // W
  "Energy Level (Intake)",        // X
  "On Medication",                // Y
  "Specialist History",           // Z
  "Energy Lowest Time",           // AA
  "Tried Before",                 // AB
  "Transformation Goal",          // AC
  "Eating Approach",              // AD
  "Intake Submitted At",          // AE
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

function intakeRow(a: Step2_5): string[] {
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
    if (!email || !key || !sheetId) {
      throw new Error("Missing Google Sheets env vars");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: key },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // Ensure the V..AE headers exist (idempotent).
    const head = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!V1:AE1`,
    });
    if (!head.data.values?.[0]?.[0]) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!V1:AE1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...INTAKE_HEADERS]] },
      });
    }

    // Find the lead's row by Lead ID (column B); first match (the lead_captured row).
    const lookup = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!B2:B`,
    });
    const rows = lookup.data.values ?? [];
    let rowNumber = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.[0] === leadId) { rowNumber = i + 2; break; } // +2: header + 0-index
    }
    if (rowNumber === -1) {
      console.warn(`[intake] leadId ${leadId} not found — skipping`);
      return NextResponse.json({ ok: true, matched: false });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!V${rowNumber}:AE${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [intakeRow(step2_5)] },
    });
    console.log(`[intake] Updated row ${rowNumber} for lead ${leadId}`);
    return NextResponse.json({ ok: true, matched: true, row: rowNumber });
  } catch (err) {
    console.error("[intake] FAILED:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to save intake" }, { status: 500 });
  }
}
