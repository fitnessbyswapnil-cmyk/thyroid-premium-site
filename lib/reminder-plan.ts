/**
 * lib/reminder-plan.ts — PURE decision logic for the payment_reminder nudge.
 *
 * The funnel's largest leak is not failed payments, it is women who finish the
 * quiz, see their Thyroid Score, tap through to Cashfree and then close the
 * tab. Roughly two thirds of leads end there and, until now, heard nothing.
 * payment_reminder was approved by Meta months ago and had no caller.
 *
 * Everything here is pure so the rules can be tested without touching Google
 * Sheets or spending a WhatsApp conversation. The route does IO; this decides.
 *
 * The rules, and why each one exists:
 *
 *   MIN AGE   She must be given a genuine chance to pay. Nudging someone who is
 *             mid-checkout is worse than not nudging at all — it reads as
 *             pushy and can make her abandon a payment she was completing.
 *   MAX AGE   A reminder about a decision from last week is spam, and Meta
 *             prices every template send. The window closes.
 *   ONCE      A "Reminder Sent" stamp in her row. Sheets is the memory; the
 *             cron is stateless and may run twice on a retry.
 *   CAP       A bounded number per run. If a rule is ever wrong, the blast
 *             radius is one batch, not the whole list.
 */

export type ReminderCandidate = {
  /** 1-based sheet row, ready for an A1 range. */
  rowNumber: number;
  name: string;
  phone: string;
  ageMinutes: number;
};

export type ReminderSkips = {
  paid: number;
  alreadyReminded: number;
  tooNew: number;
  tooOld: number;
  noPhone: number;
  unparseableTime: number;
  /** Another row carries the same phone number and was paid, already reminded,
   *  or already picked in this batch. One woman, one message. */
  duplicatePhone: number;
  overCap: number;
};

export type ReminderPlan = {
  candidates: ReminderCandidate[];
  skipped: ReminderSkips;
  scanned: number;
};

export type ReminderColumns = {
  timestamp: number;
  name: number;
  phone: number;
  paid: number;
  reminderSent: number;
};

export const DEFAULT_MIN_AGE_MINUTES = 45;
export const DEFAULT_MAX_AGE_HOURS = 24;
export const DEFAULT_LIMIT = 25;

const cell = (row: string[], i: number): string =>
  i < 0 ? "" : String(row?.[i] ?? "").trim();

/**
 * Identity key for a person. The same woman appears as 9876543210,
 * 919876543210, +91 98765 43210 and "9876543210.0" depending on which part of
 * the funnel wrote the row, so compare the last ten digits and nothing else.
 * Returns "" when there aren't ten digits to compare.
 */
export function phoneKey(raw: string): string {
  const d = String(raw ?? "").replace(/\.0$/, "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
}

/**
 * Sheets is not disciplined about time. The funnel writes an ISO string, but a
 * USER_ENTERED write can be coerced into a date serial, and a human editing the
 * sheet leaves a locale string behind. Parse all three rather than silently
 * treating a whole column as unreadable — an unparsed timestamp means a lead
 * never gets nudged, which is the exact failure this job exists to fix.
 */
export function parseSheetTime(raw: string): number | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;

  // Google Sheets date serial: days since 1899-12-30. Bare integers below that
  // range are far more likely to be junk than a date, so require a plausible
  // window (roughly 1990 → 2100).
  if (/^\d+(\.\d+)?$/.test(v)) {
    const serial = Number(v);
    if (serial > 32000 && serial < 74000) {
      return Date.UTC(1899, 11, 30) + serial * 86400000;
    }
    return null;
  }

  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

/** "Priya Sharma" → "Priya". Templates take one variable and a full name in a
 *  greeting reads like a mail merge, which is what we are trying not to be. */
export function firstNameOf(fullName: string): string {
  return String(fullName ?? "").trim().split(/\s+/)[0] || "there";
}

/**
 * Decide who gets a payment_reminder right now.
 *
 * @param rows data rows only, header excluded. rows[0] is sheet row 2.
 */
export function planReminders(opts: {
  rows: string[][];
  cols: ReminderColumns;
  now: number;
  minAgeMinutes?: number;
  maxAgeHours?: number;
  limit?: number;
}): ReminderPlan {
  const {
    rows,
    cols,
    now,
    minAgeMinutes = DEFAULT_MIN_AGE_MINUTES,
    maxAgeHours = DEFAULT_MAX_AGE_HOURS,
    limit = DEFAULT_LIMIT,
  } = opts;

  const skipped: ReminderSkips = {
    paid: 0,
    alreadyReminded: 0,
    tooNew: 0,
    tooOld: 0,
    noPhone: 0,
    unparseableTime: 0,
    duplicatePhone: 0,
    overCap: 0,
  };

  // One woman can occupy several rows — she retook the quiz, or the funnel
  // wrote a partial row first. The sheet's unit is a row; hers is a phone
  // number. Deduplicating only within this batch is not enough: if she has
  // three rows and we message and stamp one, the other two stay unstamped and
  // she gets nudged again on every future run. So a phone that is settled on
  // ANY row — paid, or already reminded — disqualifies all of her rows.
  const settledPhones = new Set<string>();
  for (const r of rows) {
    const p = phoneKey(cell(r ?? [], cols.phone));
    if (!p) continue;
    const isPaid = cell(r ?? [], cols.paid).toUpperCase() === "Y";
    const isReminded = !!cell(r ?? [], cols.reminderSent);
    if (isPaid || isReminded) settledPhones.add(p);
  }

  // Phones picked so far in this run, so three rows for one woman yield one
  // message rather than three.
  const claimedPhones = new Set<string>();

  const eligible: ReminderCandidate[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row

    // Paid wins over everything. Checked first so a paying customer can never
    // be nudged for money she has already sent, whatever else the row says.
    if (cell(row, cols.paid).toUpperCase() === "Y") {
      skipped.paid++;
      continue;
    }
    if (cell(row, cols.reminderSent)) {
      skipped.alreadyReminded++;
      continue;
    }

    const phone = cell(row, cols.phone).replace(/\.0$/, "").replace(/\D/g, "");
    if (phone.length < 10) {
      skipped.noPhone++;
      continue;
    }

    // She may be settled on a different row than this one.
    if (settledPhones.has(phoneKey(phone))) {
      skipped.duplicatePhone++;
      continue;
    }

    const created = parseSheetTime(cell(row, cols.timestamp));
    if (created === null) {
      skipped.unparseableTime++;
      continue;
    }

    const ageMinutes = (now - created) / 60000;
    if (ageMinutes < minAgeMinutes) {
      skipped.tooNew++;
      continue;
    }
    if (ageMinutes > maxAgeHours * 60) {
      skipped.tooOld++;
      continue;
    }

    eligible.push({
      rowNumber,
      name: cell(row, cols.name),
      phone,
      ageMinutes: Math.round(ageMinutes),
    });
  }

  // Oldest first: her window is closing soonest, so if the cap bites she is the
  // one who still gets reached.
  eligible.sort((a, b) => b.ageMinutes - a.ageMinutes);

  // Collapse her remaining rows AFTER the sort, so the row we keep is her
  // oldest one — the closest to falling out of the window.
  const unique: ReminderCandidate[] = [];
  for (const c of eligible) {
    const key = phoneKey(c.phone);
    if (claimedPhones.has(key)) {
      skipped.duplicatePhone++;
      continue;
    }
    claimedPhones.add(key);
    unique.push(c);
  }

  const candidates = unique.slice(0, limit);
  skipped.overCap = unique.length - candidates.length;

  return { candidates, skipped, scanned: rows.length };
}
