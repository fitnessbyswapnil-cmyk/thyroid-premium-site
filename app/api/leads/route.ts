/**
 * /api/leads
 *
 * Writes a partial lead row to Google Sheets the moment the user
 * completes the qualification form — BEFORE payment. This ensures
 * every lead is recorded even if they abandon at checkout.
 *
 * SHEET SETUP — "Leads" tab, row 1 headers (exact order):
 * Timestamp | Lead ID | Name | Phone | Email | Age | Thyroid Condition |
 * Weight Struggles | Energy Level | Biggest Frustration | Main Goal |
 * UTM Source | UTM Medium | UTM Campaign | FBclid | Visitor ID | Status
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_NAME = "Leads";

type LeadPayload = {
  leadId?: string;
  step1?: {
    name?: string;
    phone?: string;
    email?: string;
    age?: string;
    thyroidCondition?: string;
    weightStruggles?: string | string[];
    energyLevel?: string;
    biggestFrustration?: string;
    mainGoal?: string;
  };
  attribution?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    fbclid?: string;
    visitor_id?: string;
    [key: string]: string | undefined;
  };
};

function arr(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? v.join(", ") : v;
}

function str(v: string | undefined): string {
  return v?.trim() || "";
}

async function appendLeadToSheet(payload: LeadPayload) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEETS_ID;

  if (!email || !key || !sheetId) {
    console.warn("[leads] Google Sheets env vars missing — skipping sheet write");
    return;
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const { step1 = {}, attribution = {}, leadId = "" } = payload;

  const row = [
    new Date().toISOString(),               // Timestamp
    str(leadId),                             // Lead ID
    str(step1.name),                         // Name
    str(step1.phone),                        // Phone
    str(step1.email),                        // Email
    str(step1.age),                          // Age
    str(step1.thyroidCondition),             // Thyroid Condition
    arr(step1.weightStruggles),              // Weight Struggles
    str(step1.energyLevel),                  // Energy Level
    str(step1.biggestFrustration),           // Biggest Frustration
    str(step1.mainGoal),                     // Main Goal
    str(attribution.utm_source),             // UTM Source
    str(attribution.utm_medium),             // UTM Medium
    str(attribution.utm_campaign),           // UTM Campaign
    str(attribution.fbclid),                 // FBclid
    str(attribution.visitor_id),             // Visitor ID
    "lead_captured",                         // Status
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as LeadPayload;
    await appendLeadToSheet(payload);
    console.log("[leads] Row appended for:", payload.step1?.name || "unknown", "id:", payload.leadId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[leads]", err);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }
}
