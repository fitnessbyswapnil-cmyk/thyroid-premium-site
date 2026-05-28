/**
 * /api/booking
 *
 * Receives the unified booking payload after Calendly confirmation and
 * writes one row to Google Sheets.
 *
 * ENV VARS REQUIRED:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   – service account client_email
 *   GOOGLE_PRIVATE_KEY             – service account private_key (with \n escaped)
 *   GOOGLE_SHEETS_ID               – the spreadsheet ID from the URL
 *
 * SHEET SETUP — "Bookings" tab, row 1 headers (exact order):
 *   Timestamp | Name | Phone | Email | Age | Thyroid Condition | Weight Struggles |
 *   Energy Level | Biggest Frustration | Main Goal |
 *   Thyroid Duration | On Medication | Frustrations | Energy Low |
 *   Tried Before | Transformation Goal | Food Relationship | Session Goal |
 *   Booking Date | Booking Time | Booking Status | Submitted At |
 *   Lead ID | UTM Source | UTM Campaign | FBclid | Visitor ID
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_NAME = "Leads"; // must match the exact tab name in your spreadsheet

type Step1Data = {
  name?: string;
  phone?: string;
  email?: string;
  age?: string;
  thyroidCondition?: string;
  thyroidDuration?: string;
  weightStruggles?: string | string[];
  energyLevel?: string;
  biggestFrustration?: string;
  mainGoal?: string;
};

type Step2_5Data = {
  weightStruggles?: string | string[];
  biggestFrustration?: string;
  energyLevel?: string;
  thyroidDuration?: string;
  onMedication?: string;
  specialistHistory?: string;
  frustrations?: string;
  energyLow?: string;
  triedBefore?: string | string[];
  transformationGoal?: string;
  eatingApproach?: string;
  foodRelationship?: string;
  sessionGoal?: string;
};

type Step3Data = {
  bookingDate?: string;
  bookingTime?: string;
  bookingStatus?: string;
};

type BookingPayload = {
  step1?: Step1Data;
  step2_5?: Step2_5Data;
  step3?: Step3Data;
  submittedAt?: string;
  leadId?: string;
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

async function appendToSheet(payload: BookingPayload) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const key = rawKey?.replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEETS_ID;

  console.log("[booking] env check:", {
    hasEmail: !!email,
    hasKey: !!key,
    keyLength: key?.length ?? 0,
    keyValid: key?.startsWith("-----BEGIN") ?? false,
    hasSheetId: !!sheetId,
    sheetName: SHEET_NAME,
  });

  if (!email || !key || !sheetId) {
    console.error("[booking] Missing Google Sheets env vars — aborting sheet write");
    throw new Error("Missing Google Sheets env vars");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const { step1 = {}, step2_5 = {}, step3 = {}, attribution = {} } = payload;

  const row = [
    new Date().toISOString(),                                                     // Timestamp
    str(step1.name),                                                              // Name
    str(step1.phone),                                                             // Phone
    str(step1.email),                                                             // Email
    str(step1.age),                                                               // Age
    str(step1.thyroidCondition),                                                  // Thyroid Condition
    arr(step2_5.weightStruggles || step1.weightStruggles),                       // Weight Struggles
    str(step2_5.energyLevel || step1.energyLevel),                               // Energy Level
    str(step2_5.biggestFrustration || step1.biggestFrustration || step2_5.frustrations), // Biggest Frustration
    str(step1.mainGoal),                                                          // Main Goal
    str(step1.thyroidDuration || step2_5.thyroidDuration),                       // Thyroid Duration
    str(step2_5.onMedication),                                                    // On Medication
    str(step2_5.specialistHistory),                                               // Specialist History
    str(step2_5.energyLow),                                                       // Energy Low
    arr(step2_5.triedBefore),                                                     // Tried Before
    str(step2_5.transformationGoal),                                              // Transformation Goal
    str(step2_5.eatingApproach || step2_5.foodRelationship),                     // Food Relationship
    str(step2_5.sessionGoal),                                                     // Session Goal
    str(step3.bookingDate),                                                       // Booking Date
    str(step3.bookingTime),                                                       // Booking Time
    str(step3.bookingStatus),                                                     // Booking Status
    str(payload.submittedAt),                                                     // Submitted At
    str(payload.leadId),                                                          // Lead ID
    str(attribution.utm_source),                                                  // UTM Source
    str(attribution.utm_campaign),                                                // UTM Campaign
    str(attribution.fbclid),                                                      // FBclid
    str(attribution.visitor_id),                                                  // Visitor ID
  ];

  console.log("[booking] Appending row to sheet, range:", `${SHEET_NAME}!A1`);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  console.log("[booking] Append response status:", response.status, response.data?.updates);
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as BookingPayload;

    console.log("[booking] Received payload for:", payload.step1?.name || "unknown", "leadId:", payload.leadId);

    await appendToSheet(payload);

    console.log("[booking] Row appended successfully for:", payload.step1?.name || "unknown");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[booking] FAILED:", err instanceof Error ? err.message : String(err));
    console.error("[booking] Full error:", err);
    return NextResponse.json({ error: "Failed to save booking" }, { status: 500 });
  }
}
