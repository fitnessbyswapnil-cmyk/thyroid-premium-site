/**
 * POST /api/admin/broadcast — send an approved template to unpaid, unbooked,
 * recent leads. One send per woman per template, ever.
 *
 * WhatsApp only allows free-form messages inside the 24-hour window a customer
 * opens by writing first. A campaign message to leads who never replied must
 * therefore be a pre-approved template — this route is the "send it to the
 * right people, once" half; registering the template in WhatsApp Manager is
 * the owner's half.
 *
 * Body: {
 *   template: string,       // exact approved template name, e.g. "blocker_video"
 *   dryRun?: boolean,       // preview the audience, send nothing
 *   maxAgeDays?: number,    // audience window, default 7
 *   limit?: number,         // cap per run, default 50
 * }
 *
 * The once-only guard is a per-template stamp column ("Tpl <name>") holding
 * the send timestamp — a new template name is a new campaign with its own
 * guarantee, and re-running the same one is always safe.
 *
 * Auth: x-admin-key (dashboard/curl) or Bearer CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { checkAdminKey } from "../_lib";
import { colLetter, RESERVED_INDEXES, ensureGridColumns } from "@/lib/lead-sheet";
import { sendWhatsAppTemplate, isWhatsAppConfigured } from "@/lib/whatsapp";
import {
  planBroadcast,
  firstNameOf,
  BROADCAST_LIMIT,
  BROADCAST_MAX_AGE_DAYS,
  type BroadcastColumns,
} from "@/lib/reminder-plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LEADS_SHEET = "Leads";
// Columns R/S — Booking Status / Session Date positional fallbacks (the
// Cal.com scenario's contract), same resolution as the cron.
const BOOKING_STATUS_FALLBACK = 17;
const SESSION_DATE_FALLBACK = 18;

function findCol(header: string[], title: string): number {
  const want = title.trim().toLowerCase();
  return header.findIndex((h) => String(h ?? "").trim().toLowerCase() === want);
}

function getSheets() {
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!client_email || !private_key || !spreadsheetId) {
    throw new Error("Missing Google Sheets env vars");
  }
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { sheets: google.sheets({ version: "v4", auth }), spreadsheetId };
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron && !checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    template?: string;
    dryRun?: boolean;
    minAgeHours?: number;
    maxAgeDays?: number;
    limit?: number;
    language?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const template = String(body.template ?? "").trim();
  // Meta template names are lowercase snake_case; a typo here would burn the
  // whole batch as failed sends, so reject anything that can't be a name.
  if (!/^[a-z0-9_]{3,60}$/.test(template)) {
    return NextResponse.json(
      { error: "bad_template", hint: "exact approved template name, lowercase snake_case" },
      { status: 400 },
    );
  }
  const dryRun = body.dryRun === true;
  // Optional language override — see sendWhatsAppTemplate. Meta reports a
  // language mismatch as "template does not exist", so being able to try a
  // code per request is the fastest way to identify the stored one.
  const language =
    typeof body.language === "string" && /^[a-z]{2}(_[A-Z]{2})?$/.test(body.language)
      ? body.language
      : undefined;
  // Hold back very recent leads so the daily cron and a same-day broadcast
  // can never both hit one woman.
  const minAgeHours =
    Number.isFinite(body.minAgeHours) && (body.minAgeHours as number) > 0 ? (body.minAgeHours as number) : 0;
  const maxAgeDays =
    Number.isFinite(body.maxAgeDays) && (body.maxAgeDays as number) > 0
      ? (body.maxAgeDays as number)
      : BROADCAST_MAX_AGE_DAYS;
  const limit =
    Number.isFinite(body.limit) && (body.limit as number) > 0 ? (body.limit as number) : BROADCAST_LIMIT;

  const stampTitle = `Tpl ${template}`;

  try {
    const { sheets, spreadsheetId } = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${LEADS_SHEET}!A1:CZ`,
    });
    const all: string[][] = (res.data.values as string[][]) ?? [];
    const header = (all[0] ?? []).map((h) => String(h ?? ""));
    const rows = all.slice(1);

    const byNameOr = (title: string, fallback: number): number => {
      const i = findCol(header, title);
      return i >= 0 ? i : fallback;
    };
    const cols: BroadcastColumns = {
      timestamp: 0,
      name: 2,
      phone: 3,
      paid: findCol(header, "Paid"),
      bookingStatus: byNameOr("Booking Status", BOOKING_STATUS_FALLBACK),
      sessionDate: byNameOr("Session Date", SESSION_DATE_FALLBACK),
      stamp: findCol(header, stampTitle),
    };

    const plan = planBroadcast({ rows, cols, now: Date.now(), minAgeHours, maxAgeDays, limit });

    const summary = {
      dryRun,
      template,
      window: { minAgeHours, maxAgeDays, limit },
      language: language ?? process.env.WHATSAPP_TEMPLATE_LANG ?? "en",
      scanned: plan.scanned,
      eligible: plan.candidates.length,
      skipped: plan.skipped,
      whatsappConfigured: isWhatsAppConfigured(),
    };

    if (dryRun) {
      return NextResponse.json({
        ...summary,
        wouldSend: plan.candidates.map((c) => ({
          row: c.rowNumber,
          name: c.name,
          firstName: firstNameOf(c.name),
          phone: `***${c.phone.slice(-4)}`,
          leadAgeHours: Math.round(c.ageMinutes / 60),
        })),
      });
    }

    if (!plan.candidates.length) {
      return NextResponse.json({ ...summary, sent: 0, failed: 0, results: [] });
    }

    // Stamp column must exist BEFORE any send — a send with nowhere to record
    // itself would repeat on the next run.
    let stampCol = cols.stamp;
    if (stampCol < 0 || RESERVED_INDEXES.has(stampCol)) {
      stampCol = header.length;
      // The Leads grid is a fixed width and is currently full — widen it or
      // the header write fails with "exceeds grid limits" and nothing sends.
      await ensureGridColumns(sheets, spreadsheetId, LEADS_SHEET, stampCol);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${LEADS_SHEET}!${colLetter(stampCol)}1`,
        valueInputOption: "RAW",
        requestBody: { values: [[stampTitle]] },
      });
    }

    const stampedAt = new Date().toISOString();
    const results: { row: number; phone: string; sent: boolean; detail?: string }[] = [];
    const updates: { range: string; values: string[][] }[] = [];

    // Sequential — Meta rate-limits per number, and a trickle lands better.
    for (const c of plan.candidates) {
      const r = await sendWhatsAppTemplate(c.phone, template, [firstNameOf(c.name)], language);
      results.push({ row: c.rowNumber, phone: `***${c.phone.slice(-4)}`, sent: r.sent, detail: r.error || r.skipped });
      // Only delivered sends are stamped; failures stay eligible for a retry run.
      if (r.sent) {
        updates.push({ range: `${LEADS_SHEET}!${colLetter(stampCol)}${c.rowNumber}`, values: [[stampedAt]] });
      }
    }

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data: updates },
      });
    }

    const sent = results.filter((r) => r.sent).length;
    console.log(
      `[broadcast] template=${template} sent=${sent} failed=${results.length - sent} skipped=${JSON.stringify(plan.skipped)}`,
    );
    return NextResponse.json({ ...summary, sent, failed: results.length - sent, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[broadcast] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
