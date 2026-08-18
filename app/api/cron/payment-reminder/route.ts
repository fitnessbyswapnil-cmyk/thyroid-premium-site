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
import { colLetter, RESERVED_INDEXES, ensureGridColumns } from "@/lib/lead-sheet";
import {
  sendWhatsAppTemplate,
  sendPaymentReminderWithLink,
  sendTryingLanguages,
  isTemplateMissing,
  isTemplateConfigError,
  isWhatsAppConfigured,
} from "@/lib/whatsapp";
import {
  planReminders,
  planBookingNudges,
  planCallReminders,
  formatSessionTimeIST,
  firstNameOf,
  BOOKING_NUDGE_STAGE1_MAX_DAYS,
  BOOKING_NUDGE_STAGE2_MIN_HOURS,
  REMINDER2_MIN_AGE_MINUTES,
  REMINDER2_MAX_AGE_HOURS,
  DEFAULT_LIMIT,
  DEFAULT_MAX_AGE_HOURS,
  DEFAULT_MIN_AGE_MINUTES,
  type ReminderColumns,
  type BookingNudgeColumns,
  type CallReminderColumns,
  type ReminderCandidate,
} from "@/lib/reminder-plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LEADS_SHEET = "Leads";
// payment_reminder_link: same copy as the original payment_reminder, but its
// button deep-links to /complete-payment?leadId=... instead of the quiz
// intro (Meta 2026-08-18 approval). Submitted as a SEPARATE template so the
// original keeps sending, untouched, while this one clears review.
const TEMPLATE = "payment_reminder_link";

const SENT_TITLE = "Reminder Sent";
const AT_TITLE = "Reminder At";
// Touch two of the payment sequence. Its own stamp columns, so touch one's
// "Reminder Sent" can never suppress it and vice versa.
const TEMPLATE2 = "payment_reminder_day2";
const SENT2_TITLE = "Reminder 2 Sent";
const AT2_TITLE = "Reminder 2 At";

// ── Second job in the same daily run: paid but never booked ──────────────────
// She paid ₹299, got ONE booking_confirmation at payment time, and if she
// missed it nothing ever followed up — the money was spent with no call behind
// it (two of three payers ended there). The day after payment she gets the
// same UTILITY template once more, with its booking button.
// Stage 1 now uses a purpose-written template rather than re-sending the
// payment receipt. booking_confirmation stays as the fallback so this is safe
// to deploy before Meta approves booking_nudge_1h.
const BOOKING_TEMPLATE = "booking_nudge_1h";
const BOOKING_TEMPLATE_FALLBACK = "booking_confirmation";
const NUDGE_SENT_TITLE = "Booking Nudge Sent";
const NUDGE_AT_TITLE = "Booking Nudge At";

// Stage 2, three days after payment, for anyone stage 1 did not move.
const BOOKING_TEMPLATE2 = "booking_nudge_day3";
const NUDGE2_SENT_TITLE = "Booking Nudge 2 Sent";
const NUDGE2_AT_TITLE = "Booking Nudge 2 At";

// ── Call reminders ──────────────────────────────────────────────────────────
// Anchored to her session time rather than elapsed time. call_reminder_24h
// takes TWO body params (name, session time); call_reminder_1h takes one.
const CALL_TEMPLATE_24H = "call_reminder_24h";
const CALL24_SENT_TITLE = "Call Reminder 24h Sent";
const CALL24_AT_TITLE = "Call Reminder 24h At";
const CALL_TEMPLATE_1H = "call_reminder_1h";
const CALL1_SENT_TITLE = "Call Reminder 1h Sent";
const CALL1_AT_TITLE = "Call Reminder 1h At";
// Columns R (17) / S (18) — Booking Status and Session Date, written by the
// Cal.com → Sheets scenario. Resolved by header name first in case the live
// sheet has drifted; the positional contract is the fallback.
const BOOKING_STATUS_FALLBACK = 17;
const SESSION_DATE_FALLBACK = 18;

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
      leadId: 1, // pinned column B, written by the quiz on create
      name: 2,
      phone: 3,
      paid: findCol(header, "Paid"),
      reminderSent: findCol(header, SENT_TITLE),
    };

    const plan = planReminders({ rows, cols, now: Date.now(), minAgeMinutes, maxAgeHours, limit });

    // Second payment touch, a day later, stamped in its OWN column so it can
    // never be confused with touch one. Everything else — phone dedup, paid
    // exclusion, per-row stamping — is the same tested planner.
    const plan2 = planReminders({
      rows,
      cols: { ...cols, reminderSent: findCol(header, SENT2_TITLE) },
      now: Date.now(),
      minAgeMinutes: REMINDER2_MIN_AGE_MINUTES,
      maxAgeHours: REMINDER2_MAX_AGE_HOURS,
      limit,
    });

    const byNameOr = (title: string, fallback: number): number => {
      const i = findCol(header, title);
      return i >= 0 ? i : fallback;
    };
    const nudgeColsBase = {
      name: 2,
      phone: 3,
      paid: findCol(header, "Paid"),
      paidAt: findCol(header, "Paid At"),
      bookingStatus: byNameOr("Booking Status", BOOKING_STATUS_FALLBACK),
      sessionDate: byNameOr("Session Date", SESSION_DATE_FALLBACK),
    };
    const nudgeCols: BookingNudgeColumns = {
      ...nudgeColsBase,
      nudgeSent: findCol(header, NUDGE_SENT_TITLE),
    };
    // Stage 1: one hour after payment, capped at 24h so it can never overlap
    // stage 2's window.
    const nudgePlan = planBookingNudges({
      rows,
      cols: nudgeCols,
      now: Date.now(),
      maxAgeDays: BOOKING_NUDGE_STAGE1_MAX_DAYS,
    });

    // Stage 2: three days later, separate stamp column. A woman who booked
    // after stage 1 is excluded here by bookedEvidence, exactly as before.
    const nudge2Cols: BookingNudgeColumns = {
      ...nudgeColsBase,
      nudgeSent: findCol(header, NUDGE2_SENT_TITLE),
    };
    const nudge2Plan = planBookingNudges({
      rows,
      cols: nudge2Cols,
      now: Date.now(),
      minAgeHours: BOOKING_NUDGE_STAGE2_MIN_HOURS,
    });

    // Call reminders. Windows are deliberately disjoint: the 24h stage stops
    // at 2h out, the 1h stage runs from 1h to 0. Neither can ever fire after
    // the call has started.
    const callColsBase = {
      name: 2,
      phone: 3,
      sessionDate: byNameOr("Session Date", SESSION_DATE_FALLBACK),
      bookingStatus: byNameOr("Booking Status", BOOKING_STATUS_FALLBACK),
    };
    const call24Cols: CallReminderColumns = { ...callColsBase, reminderSent: findCol(header, CALL24_SENT_TITLE) };
    const call24Plan = planCallReminders({
      rows, cols: call24Cols, now: Date.now(), withinHours: 24, notWithinHours: 2,
    });
    const call1Cols: CallReminderColumns = { ...callColsBase, reminderSent: findCol(header, CALL1_SENT_TITLE) };
    const call1Plan = planCallReminders({
      rows, cols: call1Cols, now: Date.now(), withinHours: 1, notWithinHours: 0,
    });

    const summary = {
      dryRun,
      template: TEMPLATE,
      bookingTemplate: BOOKING_TEMPLATE,
      window: { minAgeMinutes, maxAgeHours, limit },
      scanned: plan.scanned,
      eligible: plan.candidates.length,
      bookingNudgeEligible: nudgePlan.candidates.length,
      skipped: plan.skipped,
      bookingNudgeSkipped: nudgePlan.skipped,
      whatsappConfigured: isWhatsAppConfigured(),
    };

    const describe = (c: ReminderCandidate) => ({
      row: c.rowNumber,
      name: c.name,
      firstName: firstNameOf(c.name),
      phone: `***${c.phone.slice(-4)}`,
      ageMinutes: c.ageMinutes,
      // A row with no leadId can only ever get the OLD template, whose button
      // points back at the quiz. Surfacing it here means a dry run answers
      // "why did she get a quiz link?" without spending a send to find out.
      leadId: c.leadId || "(none — would send old quiz-linked template)",
      wouldUseTemplate: c.leadId ? TEMPLATE : "payment_reminder",
    });

    if (dryRun) {
      // Full detail, because the whole point of a dry run is to let you check
      // the list against the sheet by eye before any money is spent.
      return NextResponse.json({
        ...summary,
        wouldSend: plan.candidates.map(describe),
        wouldSendDay2: plan2.candidates.map(describe),
        wouldNudgeBooking: nudgePlan.candidates.map(describe),
        wouldNudgeBookingDay3: nudge2Plan.candidates.map(describe),
        wouldRemindCall24h: call24Plan.candidates.map((c) => ({
          row: c.rowNumber, name: c.name, phone: `***${c.phone.slice(-4)}`,
          sessionAt: new Date(c.sessionAt).toISOString(),
          sessionTimeIST: formatSessionTimeIST(c.sessionAt),
          hoursUntil: Math.round(c.hoursUntil * 10) / 10,
        })),
        wouldRemindCall1h: call1Plan.candidates.map((c) => ({
          row: c.rowNumber, name: c.name, phone: `***${c.phone.slice(-4)}`,
          sessionTimeIST: formatSessionTimeIST(c.sessionAt),
          hoursUntil: Math.round(c.hoursUntil * 10) / 10,
        })),
        callReminderSkipped: { h24: call24Plan.skipped, h1: call1Plan.skipped },
      });
    }

    const nothingToDo =
      !plan.candidates.length &&
      !plan2.candidates.length &&
      !nudgePlan.candidates.length &&
      !nudge2Plan.candidates.length &&
      !call24Plan.candidates.length &&
      !call1Plan.candidates.length;
    if (nothingToDo) {
      console.log(
        `[payment-reminder] nothing to send — reminders=${JSON.stringify(plan.skipped)} ` +
          `reminders2=${JSON.stringify(plan2.skipped)} nudges=${JSON.stringify(nudgePlan.skipped)} ` +
          `nudges2=${JSON.stringify(nudge2Plan.skipped)}`,
      );
      return NextResponse.json({ ...summary, sent: 0, failed: 0, results: [] });
    }

    // Create every bookkeeping column before any send, so a send can never
    // happen with nowhere to record that it happened — that would re-nudge her
    // on every future run.
    let sentCol = cols.reminderSent;
    let atCol = findCol(header, AT_TITLE);
    let sent2Col = findCol(header, SENT2_TITLE);
    let at2Col = findCol(header, AT2_TITLE);
    let nudgeSentCol = nudgeCols.nudgeSent;
    let nudgeAtCol = findCol(header, NUDGE_AT_TITLE);
    let nudge2SentCol = nudge2Cols.nudgeSent;
    let nudge2AtCol = findCol(header, NUDGE2_AT_TITLE);
    let call24SentCol = call24Cols.reminderSent;
    let call24AtCol = findCol(header, CALL24_AT_TITLE);
    let call1SentCol = call1Cols.reminderSent;
    let call1AtCol = findCol(header, CALL1_AT_TITLE);
    {
      const next = [...header];
      const claim = (idx: number, title: string): number => {
        if (idx >= 0 && !RESERVED_INDEXES.has(idx)) return idx;
        const at = next.length;
        next.push(title);
        return at;
      };
      sentCol = claim(sentCol, SENT_TITLE);
      atCol = claim(atCol, AT_TITLE);
      sent2Col = claim(sent2Col, SENT2_TITLE);
      at2Col = claim(at2Col, AT2_TITLE);
      nudgeSentCol = claim(nudgeSentCol, NUDGE_SENT_TITLE);
      nudgeAtCol = claim(nudgeAtCol, NUDGE_AT_TITLE);
      nudge2SentCol = claim(nudge2SentCol, NUDGE2_SENT_TITLE);
      nudge2AtCol = claim(nudge2AtCol, NUDGE2_AT_TITLE);
      call24SentCol = claim(call24SentCol, CALL24_SENT_TITLE);
      call24AtCol = claim(call24AtCol, CALL24_AT_TITLE);
      call1SentCol = claim(call1SentCol, CALL1_SENT_TITLE);
      call1AtCol = claim(call1AtCol, CALL1_AT_TITLE);
      if (next.length > header.length) {
        // Widen the fixed-width grid before writing past its last column.
        await ensureGridColumns(sheets, spreadsheetId, LEADS_SHEET, next.length - 1);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${LEADS_SHEET}!1:1`,
          valueInputOption: "RAW",
          requestBody: { values: [next] },
        });
        console.log(`[payment-reminder] appended ${next.length - header.length} bookkeeping column(s)`);
      }
    }

    const stampedAt = new Date().toISOString();
    // `template` records which one ACTUALLY went out. Without it, a run that
    // silently fell back to the old quiz-linked template looks identical to a
    // healthy one in the response — the exact ambiguity that made "she got a
    // link back to the quiz" impossible to diagnose from the outside.
    const results: { job: string; row: number; phone: string; sent: boolean; template?: string; detail?: string }[] = [];
    const updates: { range: string; values: string[][] }[] = [];

    // Sequential, not parallel. Meta rate-limits template sends per number, and
    // a batch arriving all at once is also a worse experience than a trickle.
    for (const c of plan.candidates) {
      let usedTemplate = c.leadId ? TEMPLATE : "payment_reminder";
      let r = c.leadId
        ? await sendTryingLanguages((language) => sendPaymentReminderWithLink(c.phone, c.name, c.leadId!, language))
        // No leadId on this row (older data predating the column) — fall back
        // to the original template rather than sending a dead/empty button.
        : await sendWhatsAppTemplate(c.phone, "payment_reminder", [firstNameOf(c.name)]);

      // Self-healing: payment_reminder_link may still not be Meta-approved, or
      // approved under some language variant sendTryingLanguages didn't cover.
      // Rather than let every send fail silently until someone notices and
      // redeploys, fall back to the original payment_reminder — no dynamic
      // link, but she still gets reminded today. Once the new template
      // resolves, this stops firing on its own.
      //
      // NOTE: this fallback is what sends a button pointing back at the QUIZ,
      // since the original payment_reminder's button is a static /assessment
      // link. It is the lesser evil versus sending nothing, but every time it
      // fires it is a signal that payment_reminder_link is not resolving —
      // which is why `template` is reported per row below.
      if (!r.sent && isTemplateMissing(r.error)) {
        usedTemplate = "payment_reminder (fallback)";
        r = await sendWhatsAppTemplate(c.phone, "payment_reminder", [firstNameOf(c.name)]);
      }
      results.push({
        job: "payment_reminder",
        row: c.rowNumber,
        phone: `***${c.phone.slice(-4)}`,
        sent: r.sent,
        template: usedTemplate,
        detail: r.error || r.skipped,
      });

      // Only a delivered send is stamped. A failure must stay eligible so the
      // next run retries it rather than writing her off permanently.
      if (r.sent) {
        updates.push({ range: `${LEADS_SHEET}!${colLetter(sentCol)}${c.rowNumber}`, values: [["Y"]] });
        updates.push({ range: `${LEADS_SHEET}!${colLetter(atCol)}${c.rowNumber}`, values: [[stampedAt]] });
      }
    }

    // Payment touch two, a day later. Unlike touch one there is NO fallback:
    // if payment_reminder_day2 is not approved yet, she simply does not get a
    // second message. Falling back to payment_reminder here would re-send her
    // the identical text she already ignored, and stamp it as a new touch.
    for (const c of plan2.candidates) {
      const r = await sendTryingLanguages((language) =>
        c.leadId
          ? sendWhatsAppTemplate(c.phone, TEMPLATE2, [firstNameOf(c.name)], language, c.leadId)
          : sendWhatsAppTemplate(c.phone, TEMPLATE2, [firstNameOf(c.name)], language),
      );
      results.push({
        job: "payment_reminder_day2",
        row: c.rowNumber,
        phone: `***${c.phone.slice(-4)}`,
        sent: r.sent,
        template: TEMPLATE2,
        detail: r.error || r.skipped,
      });
      if (r.sent) {
        updates.push({ range: `${LEADS_SHEET}!${colLetter(sent2Col)}${c.rowNumber}`, values: [["Y"]] });
        updates.push({ range: `${LEADS_SHEET}!${colLetter(at2Col)}${c.rowNumber}`, values: [[stampedAt]] });
      }
    }

    // Paid-but-unbooked, stage 1: ONE HOUR after payment, while the decision
    // is still warm. Falls back to booking_confirmation so this is safe to
    // deploy before booking_nudge_1h clears Meta review — she still gets the
    // Cal.com button either way.
    for (const c of nudgePlan.candidates) {
      let usedTemplate: string = BOOKING_TEMPLATE;
      let r = await sendTryingLanguages((language) =>
        c.leadId
          ? sendWhatsAppTemplate(c.phone, BOOKING_TEMPLATE, [firstNameOf(c.name)], language, c.leadId)
          : sendWhatsAppTemplate(c.phone, BOOKING_TEMPLATE, [firstNameOf(c.name)], language),
      );
      if (!r.sent && isTemplateConfigError(r.error)) {
        usedTemplate = `${BOOKING_TEMPLATE_FALLBACK} (fallback)`;
        r = await sendWhatsAppTemplate(c.phone, BOOKING_TEMPLATE_FALLBACK, [firstNameOf(c.name)]);
      }
      results.push({
        job: "booking_nudge_1h",
        row: c.rowNumber,
        phone: `***${c.phone.slice(-4)}`,
        sent: r.sent,
        template: usedTemplate,
        detail: r.error || r.skipped,
      });
      if (r.sent) {
        updates.push({ range: `${LEADS_SHEET}!${colLetter(nudgeSentCol)}${c.rowNumber}`, values: [["Y"]] });
        updates.push({ range: `${LEADS_SHEET}!${colLetter(nudgeAtCol)}${c.rowNumber}`, values: [[stampedAt]] });
      }
    }

    // Stage 2, three days after payment. No fallback: re-sending stage 1's
    // text as a "second" nudge would just repeat herself back at her, and
    // stamp it as new contact.
    for (const c of nudge2Plan.candidates) {
      const r = await sendTryingLanguages((language) =>
        c.leadId
          ? sendWhatsAppTemplate(c.phone, BOOKING_TEMPLATE2, [firstNameOf(c.name)], language, c.leadId)
          : sendWhatsAppTemplate(c.phone, BOOKING_TEMPLATE2, [firstNameOf(c.name)], language),
      );
      results.push({
        job: "booking_nudge_day3",
        row: c.rowNumber,
        phone: `***${c.phone.slice(-4)}`,
        sent: r.sent,
        template: BOOKING_TEMPLATE2,
        detail: r.error || r.skipped,
      });
      if (r.sent) {
        updates.push({ range: `${LEADS_SHEET}!${colLetter(nudge2SentCol)}${c.rowNumber}`, values: [["Y"]] });
        updates.push({ range: `${LEADS_SHEET}!${colLetter(nudge2AtCol)}${c.rowNumber}`, values: [[stampedAt]] });
      }
    }

    // Call reminder, 24h out. TWO body params: her name and her session time,
    // rendered in IST because that is how she will read it.
    for (const c of call24Plan.candidates) {
      const r = await sendTryingLanguages((language) =>
        sendWhatsAppTemplate(c.phone, CALL_TEMPLATE_24H, [firstNameOf(c.name), formatSessionTimeIST(c.sessionAt)], language),
      );
      results.push({
        job: "call_reminder_24h", row: c.rowNumber, phone: `***${c.phone.slice(-4)}`,
        sent: r.sent, template: CALL_TEMPLATE_24H, detail: r.error || r.skipped,
      });
      if (r.sent) {
        updates.push({ range: `${LEADS_SHEET}!${colLetter(call24SentCol)}${c.rowNumber}`, values: [["Y"]] });
        updates.push({ range: `${LEADS_SHEET}!${colLetter(call24AtCol)}${c.rowNumber}`, values: [[stampedAt]] });
      }
    }

    // Call reminder, 1h out. One body param.
    for (const c of call1Plan.candidates) {
      const r = await sendTryingLanguages((language) =>
        sendWhatsAppTemplate(c.phone, CALL_TEMPLATE_1H, [firstNameOf(c.name)], language),
      );
      results.push({
        job: "call_reminder_1h", row: c.rowNumber, phone: `***${c.phone.slice(-4)}`,
        sent: r.sent, template: CALL_TEMPLATE_1H, detail: r.error || r.skipped,
      });
      if (r.sent) {
        updates.push({ range: `${LEADS_SHEET}!${colLetter(call1SentCol)}${c.rowNumber}`, values: [["Y"]] });
        updates.push({ range: `${LEADS_SHEET}!${colLetter(call1AtCol)}${c.rowNumber}`, values: [[stampedAt]] });
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
        `reminders=${plan.candidates.length} bookingNudges=${nudgePlan.candidates.length} ` +
        `skipped=${JSON.stringify(plan.skipped)} nudgeSkipped=${JSON.stringify(nudgePlan.skipped)}`,
    );

    return NextResponse.json({ ...summary, sent, failed: results.length - sent, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[payment-reminder] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
