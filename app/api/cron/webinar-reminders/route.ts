/**
 * GET /api/cron/webinar-reminders
 *
 * Sends the masterclass reminders from the WhatsApp Business API number. Runs
 * every 15 minutes beside meta-retry ("*\/15 * * * *" in CRON_ROUTES,
 * custom-worker.js). Who gets what is decided in lib/webinar-reminders.ts:
 *
 *   webinar_reminder_day  5–8 PM the day before   {{1}} = date and time
 *   webinar_reminder_1h   75–45 min before        {{1}} = "8:00 PM IST"
 *   webinar_live_now      0–20 min after start    {{1}} = date and time
 *   webinar_replay        8:30 AM–12 PM next day  {{1}} = date, {{2}} = replay hours
 *
 * OFF UNTIL APPROVED: only templates listed in the Worker variable
 * WEBINAR_REMINDER_TEMPLATES (comma-separated, exact names) are sent. Add each
 * one after Meta approves it. Every button in these templates points at our
 * own /webinar/join etc., so the template text never carries a link.
 *
 * AUTHORIZATION (same as the other crons):
 *   Authorization: Bearer <CRON_SECRET>   (the worker cron)
 *   x-admin-key: <admin key>              (you, by hand)
 *
 * ?dryRun=1          reports who would get what, sends and writes nothing
 * ?at=<ISO time>     admin only, with dryRun: pretend it is that moment, to
 *                    check a window before it arrives
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../../admin/_lib";
import { colLetter, ensureGridColumns, RESERVED_INDEXES } from "@/lib/lead-sheet";
import { sendWhatsAppTemplate, isWhatsAppConfigured } from "@/lib/whatsapp";
import { BOT_CHECK_HEADER } from "@/lib/turnstile";
import { REPLAY_HOURS, WEBINAR_START_ISO, WEBINAR_WHEN_LONG, WEBINAR_WHEN_SHORT } from "@/lib/webinar";
import {
  WEBINAR_DATE_HEADER,
  parseApprovedTemplates,
  planWebinarReminders,
  reminderCap,
  reminderParams,
  stampHeader,
  type ReminderKind,
  type WebinarReminderRow,
} from "@/lib/webinar-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Body parameters per template; the contract is in lib/webinar-reminders. */
function paramsFor(kind: ReminderKind): string[] {
  return reminderParams(kind, {
    whenLong: WEBINAR_WHEN_LONG,
    // "Thursday, 8:00 PM IST" → "8:00 PM IST"
    time: WEBINAR_WHEN_SHORT.split(", ").pop() ?? WEBINAR_WHEN_SHORT,
    replayHours: REPLAY_HOURS,
  });
}

const findCol = (header: string[], title: string) =>
  header.findIndex((h) => String(h ?? "").trim().toLowerCase() === title.toLowerCase());

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  const isAdmin = checkAdminKey(req);
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams;
  const dryRun = q.get("dryRun") === "1" || q.get("dryRun") === "true";
  const atParam = q.get("at");
  const simulated = isAdmin && dryRun && atParam ? Date.parse(atParam) : NaN;
  const nowMs = Number.isFinite(simulated) ? simulated : Date.now();
  const approved = parseApprovedTemplates(process.env.WEBINAR_REMINDER_TEMPLATES);
  const limit = reminderCap(process.env.WEBINAR_REMINDER_CAP);

  // Cheap exit for the 95 of 96 daily runs with nothing due: no sheet read.
  const early = planWebinarReminders({ rows: [], nowMs, startIso: WEBINAR_START_ISO, approved, limit });
  if (early.reason !== "ok") {
    // A due reminder with no approved template is the silent failure mode:
    // 200 OK, nothing sent, nothing in the logs. Say it out loud.
    if (early.reason === "not_approved") {
      console.warn(`[webinar-reminders] ${early.due} is due but ${early.template} is not in WEBINAR_REMINDER_TEMPLATES — nothing sent`);
    }
    return NextResponse.json({
      dryRun,
      now: new Date(nowMs).toISOString(),
      classStart: WEBINAR_START_ISO,
      ...early,
      approved: [...approved],
    });
  }

  try {
    const { sheets, sheetId } = await getSheetsClient();
    // The whole tab, not a fixed A:CZ: a stamp column added past CZ must still
    // be found, or header.length would land on a column that already exists.
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: SHEET_NAME });
    const all: string[][] = (res.data.values as string[][]) ?? [];
    const header = (all[0] ?? []).map((h) => String(h ?? ""));
    const body = all.slice(1);

    const statusCol = findCol(header, "Status");
    const dateCol = findCol(header, WEBINAR_DATE_HEADER);
    const botCol = findCol(header, BOT_CHECK_HEADER);
    const stampTitle = stampHeader(early.template);
    let stampCol = findCol(header, stampTitle);
    const cell = (r: string[], i: number) => (i >= 0 ? String(r?.[i] ?? "") : "");

    if (statusCol < 0 || dateCol < 0) {
      return NextResponse.json({ error: "missing_columns", statusCol, dateCol }, { status: 500 });
    }

    const rows: WebinarReminderRow[] = body.map((r, i) => ({
      rowNumber: i + 2,
      phone: cell(r, 3),
      status: cell(r, statusCol),
      webinarDate: cell(r, dateCol),
      botCheck: cell(r, botCol),
      stamp: cell(r, stampCol),
    }));

    const plan = planWebinarReminders({ rows, nowMs, startIso: WEBINAR_START_ISO, approved, limit });
    if (plan.reason !== "ok") return NextResponse.json({ dryRun, ...plan });

    const summary = {
      dryRun,
      now: new Date(nowMs).toISOString(),
      due: plan.due,
      template: plan.template,
      params: paramsFor(plan.due),
      scanned: plan.scanned,
      cap: limit,
      eligible: plan.candidates.length,
      skipped: plan.skipped,
      whatsappConfigured: isWhatsAppConfigured(),
    };

    if (dryRun) {
      return NextResponse.json({
        ...summary,
        wouldSend: plan.candidates.map((c) => ({ row: c.rowNumber, phone: `***${c.phone.slice(-4)}` })),
      });
    }
    if (!plan.candidates.length) return NextResponse.json({ ...summary, sent: 0, failed: 0 });

    // The stamp column must exist BEFORE any send, or a send has nowhere to
    // record itself and repeats on the next run.
    if (stampCol < 0 || RESERVED_INDEXES.has(stampCol)) {
      stampCol = header.length;
      await ensureGridColumns(sheets, sheetId, SHEET_NAME, stampCol);
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!${colLetter(stampCol)}1`,
        valueInputOption: "RAW",
        requestBody: { values: [[stampTitle]] },
      });
    }

    const stampedAt = new Date().toISOString();
    const params = paramsFor(plan.due);
    let pending: { range: string; values: string[][] }[] = [];
    let stamped = 0;
    let failed = 0;

    // Stamps are flushed DURING the loop, not after it. The sheet is the only
    // memory this cron has; if the worker dies with the stamps unwritten, every
    // woman already messaged is messaged again on the next run. Flushing every
    // 20 caps that at 19 duplicates instead of the whole batch.
    const flush = async () => {
      if (!pending.length) return;
      const data = pending;
      pending = [];
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { valueInputOption: "RAW", data },
      });
      stamped += data.length;
    };

    // Sequential: Meta rate-limits per number. logToInbox=false — the inbox
    // mirror costs three subrequests a message, and a free-plan invocation has
    // 50 in total. The coach sees these in the reminder log, not the inbox.
    for (const c of plan.candidates) {
      const r = await sendWhatsAppTemplate(c.phone, plan.template, params, undefined, undefined, false);
      if (r.sent) {
        pending.push({ range: `${SHEET_NAME}!${colLetter(stampCol)}${c.rowNumber}`, values: [[stampedAt]] });
        if (pending.length >= 20) await flush();
      } else {
        failed++;
        console.warn(`[webinar-reminders] ${plan.template} row ${c.rowNumber} not sent: ${r.error || r.skipped}`);
      }
    }
    await flush();

    console.log(`[webinar-reminders] ${plan.template} sent=${stamped} failed=${failed} cap=${limit} skipped=${JSON.stringify(plan.skipped)}`);
    return NextResponse.json({ ...summary, sent: stamped, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webinar-reminders] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
