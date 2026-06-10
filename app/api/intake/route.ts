/**
 * POST /api/intake
 *
 * Saves the post-payment "Deep Intake" answers (from /session-booked) onto the
 * lead's EXISTING row in the "Leads" tab, in columns V..AD (one per question)
 * plus AE = Intake Submitted At. Columns Q–U are reserved for automations and
 * are never touched.
 *
 * Row matching: by Lead ID (column B) first, then by email (column E),
 * case-insensitive. If neither matches, a new row is appended (answers still
 * land in V..AE) so the data is never dropped.
 *
 * Body: { leadId?, email?, answers: { ...Step2_5 fields } }
 * Uses the same Google Sheets service-account env vars as /api/leads.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_NAME = "Leads";

// V..AD = the 9 intake questions, AE = submit timestamp.
const INTAKE_HEADERS = [
  "Weight Struggles (Intake)",   // V
  "Biggest Frustration (Intake)",// W
  "Energy Level (Intake)",       // X
  "On Medication",               // Y
  "Specialist History",          // Z
  "Energy Lowest Time",          // AA
  "Tried Before",                // AB
  "Transformation Goal",         // AC
  "Eating Approach",             // AD
  "Intake Submitted At",         // AE
] as const;

// A..AE spans 31 columns; V is preceded by 21 (A..U).
const PRE_V_COLS = 21;
const TOTAL_COLS = 31;

type Answers = {
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

// Partial answers are fine — missing fields become empty cells.
function buildIntakeValues(a: Answers): string[] {
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

function getSheetsClient() {
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

  return { sheets: google.sheets({ version: "v4", auth }), sheetId };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      leadId?: string;
      email?: string;
      answers?: Answers;
    };
    const { leadId, email, answers } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "answers object is required" }, { status: 400 });
    }

    const { sheets, sheetId } = getSheetsClient();

    // Ensure row-1 headers exist for the new columns (idempotent).
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

    // Find the lead's row: Lead ID lives in column B, email in column E.
    // Keep the LAST match so a re-submitted lead updates its newest row.
    const lookup = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!B1:E`,
    });
    const rows = lookup.data.values ?? [];
    let rowNumber = -1;

    if (leadId) {
      for (let i = 1; i < rows.length; i++) {
        if (rows[i]?.[0] === leadId) rowNumber = i + 1;
      }
    }
    if (rowNumber === -1 && email) {
      const emailNorm = email.trim().toLowerCase();
      for (let i = 1; i < rows.length; i++) {
        if ((rows[i]?.[3] || "").trim().toLowerCase() === emailNorm) rowNumber = i + 1;
      }
    }

    const values = buildIntakeValues(answers);

    if (rowNumber !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!V${rowNumber}:AE${rowNumber}`,
        valueInputOption: "RAW",
        requestBody: { values: [values] },
      });
      console.log(`[intake] Answers written to row ${rowNumber} (leadId: ${leadId || "-"}, email: ${email || "-"})`);
      return NextResponse.json({ ok: true, matched: true, row: rowNumber });
    }

    // No matching lead row — append a new one rather than dropping the data.
    // Identity goes in the usual columns (B Lead ID, E Email), answers in V..AE.
    const fullRow: string[] = new Array(TOTAL_COLS).fill("");
    fullRow[0] = new Date().toISOString(); // A Timestamp
    fullRow[1] = str(leadId);              // B Lead ID
    fullRow[4] = str(email);               // E Email
    fullRow[16] = "intake_no_lead_match";  // Q Status — flags the orphan for review
    for (let j = 0; j < values.length; j++) fullRow[PRE_V_COLS + j] = values[j];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [fullRow] },
    });
    console.warn(`[intake] No lead row matched (leadId: ${leadId || "-"}, email: ${email || "-"}) — appended new row`);
    return NextResponse.json({ ok: true, matched: false, appended: true });
  } catch (err) {
    console.error("[intake] FAILED:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to save intake" }, { status: 500 });
  }
}
