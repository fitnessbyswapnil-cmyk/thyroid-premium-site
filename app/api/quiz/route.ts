/**
 * /api/quiz
 *
 * Persists a completed Blocker Score quiz lead into the SAME pipeline the
 * booking funnel uses, so quiz leads land in one place and enter email/WhatsApp
 * nurture:
 *   1. Append a row to the existing Google Sheets "Leads" tab. Quiz fields are
 *      mapped into the existing columns where they fit (Name/Phone/Email/Thyroid
 *      Condition/Biggest Frustration/Energy/Thyroid Duration) and quiz-specific
 *      columns (Blocker Score, Percent, Band, tags…) are APPENDED at the end —
 *      same append-extra-columns pattern already used by /api/leads.
 *   2. Fire the existing Make.com lead webhook with the quiz payload.
 *
 * Meta CAPI Lead is sent separately from the client via /api/events (shared
 * event_id) so it deduplicates with the browser Pixel.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_NAME = "Leads";

// Reuse the existing Make webhook (same scenario as on-site forms). Configurable
// via env; falls back to the URL the booking form already posts to.
const MAKE_WEBHOOK_URL =
  process.env.MAKE_WEBHOOK_URL ||
  "https://hook.us2.make.com/vafr1x6if1eehv2vxhyfw74ihh3b2nz8";

type QuizPayload = {
  leadId?: string;
  name?: string;
  email?: string;
  whatsapp?: string;
  totalScore?: number;
  maxScore?: number;
  percent?: number;
  band?: string;
  bandName?: string;
  frustration?: string;
  tags?: string[];
  answers?: Record<string, string[]>;
  attribution?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    fbclid?: string;
    visitor_id?: string;
    [key: string]: string | undefined;
  };
  eventId?: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

function answer(answers: QuizPayload["answers"], id: string): string {
  return answers?.[id]?.join(", ") ?? "";
}

async function appendToSheet(p: QuizPayload) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEETS_ID;

  if (!email || !key || !sheetId) {
    console.error("[quiz] Missing Google Sheets env vars — aborting sheet write");
    throw new Error("Missing Google Sheets env vars");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const { attribution = {}, answers = {} } = p;

  // Columns 1–18 mirror the existing /api/leads row exactly; 19+ are appended
  // quiz-specific columns.
  const row = [
    new Date().toISOString(), // 1  Timestamp
    str(p.leadId), // 2  Lead ID
    str(p.name), // 3  Name
    str(p.whatsapp), // 4  Phone (WhatsApp)
    str(p.email), // 5  Email
    "", // 6  Age (not collected in quiz)
    answer(answers, "diagnosis"), // 7  Thyroid Condition
    "", // 8  Weight Struggles
    answer(answers, "energy"), // 9  Energy Level
    answer(answers, "frustration"), // 10 Biggest Frustration
    "", // 11 Main Goal
    str(attribution.utm_source), // 12 UTM Source
    str(attribution.utm_medium), // 13 UTM Medium
    str(attribution.utm_campaign), // 14 UTM Campaign
    str(attribution.fbclid), // 15 FBclid
    str(attribution.visitor_id), // 16 Visitor ID
    "quiz_lead", // 17 Status
    answer(answers, "duration"), // 18 Thyroid Duration
    // ── Quiz-specific columns ──
    str(p.totalScore), // 19 Blocker Score (raw)
    p.percent != null ? `${p.percent}%` : "", // 20 Blocker Score (%)
    str(p.bandName || p.band), // 21 Band
    str(p.frustration), // 22 Frustration Tag
    (p.tags ?? []).join(", "), // 23 All Tags
    "blocker_quiz", // 24 Source
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

async function fireMakeWebhook(p: QuizPayload) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!str(p.name) || !EMAIL_RE.test(str(p.email))) {
    console.warn("[quiz] Make webhook skipped: name or email invalid");
    return;
  }
  const body = {
    name: str(p.name),
    email: str(p.email),
    phone: str(p.whatsapp),
    q1: answer(p.answers, "diagnosis"),
    q2: answer(p.answers, "duration"),
    q3: answer(p.answers, "frustration"),
    band: str(p.bandName || p.band),
    band_code: str(p.band),
    blocker_score: str(p.totalScore),
    blocker_percent: p.percent ?? "",
    frustration_tag: str(p.frustration),
    tags: (p.tags ?? []).join(", "),
    stage: "quiz_lead",
    source: "blocker_quiz",
    submitted_at: new Date().toISOString(),
  };
  try {
    const res = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error("[quiz] Make webhook non-OK:", res.status);
  } catch (err) {
    console.error("[quiz] Make webhook failed:", err instanceof Error ? err.message : String(err));
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as QuizPayload;
    // Run both in parallel; a Make failure must not fail the Sheets write.
    const results = await Promise.allSettled([
      appendToSheet(payload),
      fireMakeWebhook(payload),
    ]);
    const sheetOk = results[0].status === "fulfilled";
    if (!sheetOk) {
      console.error("[quiz] Sheet write failed:", (results[0] as PromiseRejectedResult).reason);
    }
    return NextResponse.json({ ok: sheetOk, leadId: payload.leadId ?? "" });
  } catch (err) {
    console.error("[quiz] FAILED:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to save quiz lead" }, { status: 500 });
  }
}
