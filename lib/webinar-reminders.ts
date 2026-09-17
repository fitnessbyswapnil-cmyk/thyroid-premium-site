/**
 * lib/webinar-reminders.ts — PURE decision logic for the masterclass reminders.
 *
 * The route (/api/cron/webinar-reminders, every 15 minutes) reads the Leads
 * tab and sends; this file decides who gets what. No imports: node --test
 * loads it directly.
 *
 * The rules, and why:
 *
 *   WINDOWS   Each reminder has a window relative to the class start, wide
 *             enough that at least two 15-minute runs fall inside it, and
 *             placed at a decent hour for an 8 PM class: the day-before note
 *             between 5 and 8 PM the day before, the replay the next morning,
 *             never at night.
 *   COHORT    Only rows whose "Webinar Date" is exactly this class's cohort
 *             key (cohortKey below). A woman who registered for last week's
 *             class does not get this week's reminders. The key is not a
 *             plain ISO date on purpose: the register route appends with
 *             USER_ENTERED, and Sheets may turn a date-looking string into a
 *             date value that then reads back formatted and never matches.
 *   ONCE      A "Tpl <template>" stamp in her row. The cron is stateless and
 *             may run twice; the sheet is the memory.
 *   APPROVED  Only templates the owner has listed as approved are sent. A send
 *             to a template Meta has not approved fails and is still billed as
 *             an attempt, so an unlisted one is skipped by name.
 *   BOTS      A registration marked unverified by the bot check never gets a
 *             paid WhatsApp, the same rule as the confirmation.
 *   ONE WOMAN One send per phone per run, even if she registered twice.
 *   CAP       A bounded number per run, so a wrong rule hits one batch.
 */

export type ReminderKind = "day" | "hour" | "live" | "replay";

export const REMINDER_TEMPLATES: Record<ReminderKind, string> = {
  day: "webinar_reminder_day",
  hour: "webinar_reminder_1h",
  live: "webinar_live_now",
  replay: "webinar_replay",
};

const H = 60;
/** Minutes relative to the class start: [from, to). */
export const REMINDER_WINDOWS: Record<ReminderKind, [number, number]> = {
  day: [-27 * H, -24 * H],
  hour: [-75, -45],
  live: [0, 20],
  replay: [12.5 * H, 16 * H],
};

export const WEBINAR_REMINDER_CAP = 150;

export const WEBINAR_DATE_HEADER = "Webinar Date";
/** Where a registration came from when it was not an ad: "decode_nurture", "whatsapp_share". */
export const SOURCE_PATH_HEADER = "Source Path";
export const REGISTERED_STATUS = "webinar_registered";

/** "2026-09-24T14:30:00.000Z" → "mc-20260924T143000Z". Stable and never parsed as a date. */
export function cohortKey(startIso: string): string {
  return "mc-" + startIso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function stampHeader(template: string): string {
  return `Tpl ${template}`;
}

/** Which reminder is due at this moment, or null. Windows never overlap. */
export function dueReminder(nowMs: number, startIso: string): ReminderKind | null {
  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return null;
  const minutes = (nowMs - start) / 60000;
  for (const kind of Object.keys(REMINDER_WINDOWS) as ReminderKind[]) {
    const [from, to] = REMINDER_WINDOWS[kind];
    if (minutes >= from && minutes < to) return kind;
  }
  return null;
}

/** "webinar_reminder_1h, webinar_live_now" → a set of names. */
export function parseApprovedTemplates(raw: string | undefined): Set<string> {
  return new Set(
    String(raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[a-z0-9_]{3,60}$/.test(s)),
  );
}

export type WebinarReminderRow = {
  /** 1-based sheet row. */
  rowNumber: number;
  phone: string;
  status: string;
  webinarDate: string;
  botCheck: string;
  /** Value already in this template's stamp column, "" when never sent. */
  stamp: string;
};

export type WebinarReminderSkips = {
  otherStatus: number;
  otherDate: number;
  unverified: number;
  alreadySent: number;
  noPhone: number;
  duplicatePhone: number;
  overCap: number;
};

export type WebinarReminderPlan =
  | { due: null; reason: "no_window" }
  | { due: ReminderKind; template: string; reason: "not_approved" }
  | {
      due: ReminderKind;
      template: string;
      reason: "ok";
      candidates: { rowNumber: number; phone: string }[];
      skipped: WebinarReminderSkips;
      scanned: number;
    };

export function planWebinarReminders(opts: {
  rows: WebinarReminderRow[];
  nowMs: number;
  startIso: string;
  approved: Set<string>;
  limit?: number;
}): WebinarReminderPlan {
  const due = dueReminder(opts.nowMs, opts.startIso);
  if (!due) return { due: null, reason: "no_window" };
  const template = REMINDER_TEMPLATES[due];
  if (!opts.approved.has(template)) return { due, template, reason: "not_approved" };

  const limit = opts.limit ?? WEBINAR_REMINDER_CAP;
  const skipped: WebinarReminderSkips = {
    otherStatus: 0, otherDate: 0, unverified: 0, alreadySent: 0, noPhone: 0, duplicatePhone: 0, overCap: 0,
  };
  const candidates: { rowNumber: number; phone: string }[] = [];
  const cohort = cohortKey(opts.startIso);
  const digitsOf = (phone: string) => phone.replace(/\D/g, "").slice(-10);
  // Phones already sent this template in this cohort, from ANY row, so a
  // second registration row never earns a second message.
  const seen = new Set(
    opts.rows
      .filter((r) => r.stamp.trim() && r.webinarDate.trim() === cohort)
      .map((r) => digitsOf(r.phone)),
  );

  for (const r of opts.rows) {
    if (r.status.trim() !== REGISTERED_STATUS) { skipped.otherStatus++; continue; }
    if (r.webinarDate.trim() !== cohort) { skipped.otherDate++; continue; }
    if (r.botCheck.trim().toLowerCase() === "unverified") { skipped.unverified++; continue; }
    const digits = digitsOf(r.phone);
    if (!/^[6-9]\d{9}$/.test(digits)) { skipped.noPhone++; continue; }
    if (r.stamp.trim()) { skipped.alreadySent++; continue; }
    if (seen.has(digits)) { skipped.duplicatePhone++; continue; }
    if (candidates.length >= limit) { skipped.overCap++; continue; }
    seen.add(digits);
    candidates.push({ rowNumber: r.rowNumber, phone: digits });
  }

  return { due, template, reason: "ok", candidates, skipped, scanned: opts.rows.length };
}
