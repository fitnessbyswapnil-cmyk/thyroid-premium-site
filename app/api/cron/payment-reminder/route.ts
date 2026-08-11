/**
 * GET /api/cron/payment-reminder
 *
 * Sends the approved `payment_reminder` template to women who completed the
 * quiz, saw their Thyroid Score, and never finished the Rs299 payment.
 *
 * This template has been approved and idle since the WhatsApp number was set
 * up — welcome_lead and booking_confirmation both had callers, this one had
 * none. Meanwhile the abandoning path is roughly twice the size of the paying
 * path, so the single largest recoverable group in the funnel was the one group
 * nothing ever spoke to.
 *
 * AUTHORIZATION — one of:
 *   Authorization: Bearer <CRON_SECRET>     (Vercel Cron, and any external
 *                                            scheduler such as Make.com)
 *   x-admin-key: <admin key>                (you, from the dashboard or curl)
 *
 * TESTING WITHOUT SPENDING ANYTHING
 *   ?dryRun=1   Runs every rule, returns exactly who WOULD be messaged and why
 *               everyone else was skipped, then sends nothing and writes
 *               nothing. No WhatsApp conversation is opened, no Meta event is
 *               involved at any point — this job never touches the Pixel or the
 *               Conversions API, so it cannot affect the running ad's learning.
 *   ?limit=1    Cap a live run to a single send while you watch one arrive.
 *   ?minAge=0   Ignore the "give her a chance to pay" delay so a lead you just
 *               created is immediately eligible.
 *
 * IDEMPOTENCY: a "Reminder Sent" stamp is written into her row. The cron is
 * stateless and Vercel may retry it; the sheet is what remembers.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { checkAdminKey } from "../../admin/_lib";
import { colLetter, RESERVED_INDEXES } from "@/lib/lead-sheet";
import { sendWhatsAppTemplate, isWhatsAppConfigured } from "@/lib/whatsapp";
import {
  planReminders,
  firstNameOf,
  DEFAULT_LIMIT,
  DEFAULT_MAX_AGE_HOURS,
  DEFAULT_MIN_AGE_MINUTES,
  type ReminderColumns,
} from "@/lib/reminder-plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LEADS_SHEET = "Leads";
const TEMPLATE = "payment_reminder";

const SENT_TITLE = "Reminder Sent";
const AT_TITLE = "Reminder At";

/** Case/space-insensitive header lookup. Returns -1 when the column does not
 *  exist yet, which every caller treats as "empty for every row". */
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

function num(v: string | null, fallback: number): number {
  if (v == null || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron && !checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams;
  const dryRun = q.get("dryRun") === "1" || q.get("dryRun") === "true";
  const limit = num(q.get("limit"), DEFAULT_LIMIT);
  const minAgeMinutes = num(q.get("minAge"), DEFAULT_MIN_AGE_MINUTES);
  const maxAgeHours = num(q.get("maxAge"), DEFAULT_MAX_AGE_HOURS);

  try {
    const { sheets, spreadsheetId } = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${LEADS_SHEET}!A1:BZ`,
    });
    const all: string[][] = (res.data.values as string[][]) ?? [];
    const header = (all[0] ?? []).map((h) => String(h ?? ""));
    const rows = all.slice(1);

    const cols: ReminderColumns = {
      timestamp: 0, // pinned column A, written by the quiz on create
      name: 2,
      phone: 3,
      paid: findCol(header, "Paid"),
      reminderSent: findCol(header, SENT_TITLE),
    };

    const plan = planReminders({ rows, cols, now: Date.now(), minAgeMinutes, maxAgeHours, limit });

    const summary = {
      dryRun,
      template: TEMPLATE,
      window: { minAgeMinutes, maxAgeHours, limit },
      scanned: plan.scanned,
      eligible: plan.candidates.length,
      skipped: plan.skipped,
      whatsappConfigured: isWhatsAppConfigured(),
    };

    if (dryRun) {
      // Full detail, because the whole point of a dry run is to let you check
      // the list against the sheet by eye before any money is spent.
      return NextResponse.json({
        ...summary,
        wouldSend: plan.candidates.map((c) => ({
          row: c.rowNumber,
          name: c.name,
          firstName: firstNameOf(c.name),
          phone: `***${c.phone.slice(-4)}`,
          abandonedMinutesAgo: c.ageMinutes,
        })),
      });
    }

    if (!plan.candidates.length) {
      console.log(`[payment-reminder] nothing to send — ${JSON.stringify(plan.skipped)}`);
      return NextResponse.json({ ...summary, sent: 0, failed: 0, results: [] });
    }

    // Create the bookkeeping columns before sending, so a send can never happen
    // with nowhere to record that it happened — that would re-nudge her hourly.
    let sentCol = cols.reminderSent;
    let atCol = findCol(header, AT_TITLE);
    if (sentCol < 0 || atCol < 0 || RESERVED_INDEXES.has(sentCol) || RESERVED_INDEXES.has(atCol)) {
      const next = [...header];
      if (sentCol < 0 || RESERVED_INDEXES.has(sentCol)) {
        sentCol = next.length;
        next.push(SENT_TITLE);
      }
      if (atCol < 0 || RESERVED_INDEXES.has(atCol)) {
        atCol = next.length;
        next.push(AT_TITLE);
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${LEADS_SHEET}!1:1`,
        valueInputOption: "RAW",
        requestBody: { values: [next] },
      });
      console.log(`[payment-reminder] added columns ${SENT_TITLE}/${AT_TITLE} at ${sentCol}/${atCol}`);
    }

    const stampedAt = new Date().toISOString();
    const results: { row: number; phone: string; sent: boolean; detail?: string }[] = [];
    const updates: { range: string; values: string[][] }[] = [];

    // Sequential, not parallel. Meta rate-limits template sends per number, and
    // a batch of 25 arriving at once is also a worse experience than a trickle.
    for (const c of plan.candidates) {
      const r = await sendWhatsAppTemplate(c.phone, TEMPLATE, [firstNameOf(c.name)]);
      const detail = r.error || r.skipped;
      results.push({ row: c.rowNumber, phone: `***${c.phone.slice(-4)}`, sent: r.sent, detail });

      // Only a delivered send is stamped. A failure must stay eligible so the
      // next run retries it rather than writing her off permanently.
      if (r.sent) {
        updates.push({ range: `${LEADS_SHEET}!${colLetter(sentCol)}${c.rowNumber}`, values: [["Y"]] });
        updates.push({ range: `${LEADS_SHEET}!${colLetter(atCol)}${c.rowNumber}`, values: [[stampedAt]] });
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
      `[payment-reminder] sent=${sent} failed=${results.length - sent} scanned=${plan.scanned} ` +
        `skipped=${JSON.stringify(plan.skipped)}`,
    );

    return NextResponse.json({ ...summary, sent, failed: results.length - sent, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[payment-reminder] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
