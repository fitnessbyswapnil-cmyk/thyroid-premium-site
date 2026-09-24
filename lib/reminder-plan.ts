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
 *             5 minutes comfortably clears a normal UPI/card completion
 *             (typically 1-2 minutes) while still reaching her within minutes
 *             of actually abandoning, not hours.
 *   MAX AGE   A reminder about a decision from last week is spam, and Meta
 *             prices every template send. The window closes.
 *   ONCE      A "Reminder Sent" stamp in her row, scoped to THAT row — Sheets
 *             is the memory; the cron is stateless and may run twice on a
 *             retry. A stamp on one row no longer blocks a different row for
 *             the same phone (owner decision, 2026-08-18): a genuine retake
 *             is a fresh signal and earns its own reminder. Rows from the
 *             same batch still collapse to one send (see claimedPhones).
 *   PAID      Still permanent and cross-row, unlike ONCE above — a phone that
 *             paid on any row is settled everywhere, forever. Never a timing
 *             question.
 *   CAP       A bounded number per run. If a rule is ever wrong, the blast
 *             radius is one batch, not the whole list.
 */

export type ReminderCandidate = {
  /** 1-based sheet row, ready for an A1 range. */
  rowNumber: number;
  name: string;
  phone: string;
  ageMinutes: number;
  /** Quiz leadId, so the reminder can link her straight back to
   *  /complete-payment?leadId=... instead of the quiz intro. Only populated
   *  by planReminders — planBroadcast/planBookingNudges leave it "". */
  leadId?: string;
};

export type ReminderSkips = {
  paid: number;
  /** She is on the calendar. See the booking gate in planReminders. */
  booked: number;
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
  /** Column B — "Lead ID", written by the quiz on create. -1 reads as "". */
  leadId: number;
  /** "Paid At" — when a payment landed. Optional; -1/absent falls back to the
   *  paid row's own created time, and an unreadable stamp settles forever,
   *  which is exactly the behaviour this column replaced. */
  paidAt?: number;
  /** Column E — "Email". Only used to match Cal.com's booking state, which is
   *  keyed by email and has no phone in it. -1/absent disables that match and
   *  leaves the sheet columns below as the only evidence. */
  email?: number;
  /** Column R — "Booking Status", and column S — "Session Date". Both written
   *  by the Cal.com → Sheets Make scenario, and EITHER counts: live data has
   *  booked women with only one of the two stamped (see BookingNudgeColumns,
   *  which reads them the same way for the same reason). */
  bookingStatus?: number;
  sessionDate?: number;
};

// One minute. Five put the nudge inside the window where Meta caps a second
// marketing template to the same person, so it never arrived at all — the
// welcome message lands two seconds after the quiz. checkout_pending_v2 is
// UTILITY and uncapped, so it can go out immediately.
export const DEFAULT_MIN_AGE_MINUTES = 1;
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
 * Does this row show she is already on the calendar?
 *
 * TWO SOURCES, DELIBERATELY, and Cal.com is the one that matters.
 * `whatsapp-automation-session-2026-08.md` §4 records that bookings are NOT
 * reliably reaching the Leads sheet — Cal.com produces 3-4 bookings a day and
 * the sheet showed one, because the Make scenario drops most write-backs. §2
 * says it plainly: trust Cal.com for booking counts, not the sheet. A gate that
 * read only the sheet would therefore miss most real bookings, which for this
 * particular job means asking a woman who is already booked to pay for a
 * checkout she never abandoned.
 *
 * `bookedEmails` is Cal.com's set of people with a booking that is still ahead
 * of them (CalState.active — the "upcoming" page, and collect() drops anything
 * already in the past). Scoping it to upcoming bookings is what keeps this from
 * re-introducing the bug the paid-settle logic was rewritten to fix: a woman who
 * had a call in July and abandons a fresh checkout in September is reachable
 * again, because that July booking is no longer upcoming.
 *
 * The sheet columns are the fallback for when Cal.com is unreachable or the key
 * is unset, and they are read PER ROW rather than across her rows, for the same
 * reason — a stale booking on an old row must not silence a genuine new
 * checkout forever.
 */
function hasBookingEvidence(
  row: string[],
  cols: ReminderColumns,
  bookedEmails?: Set<string>,
): boolean {
  if (bookedEmails?.size) {
    const email = cell(row, cols.email ?? -1).toLowerCase();
    if (email && bookedEmails.has(email)) return true;
  }
  return (
    !!cell(row, cols.bookingStatus ?? -1) || !!cell(row, cols.sessionDate ?? -1)
  );
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
  /** Lowercased emails with a booking still ahead of them, from Cal.com. The
   *  route fetches it; this stays pure. Omitted or empty falls back to the
   *  sheet columns alone. See hasBookingEvidence. */
  bookedEmails?: Set<string>;
}): ReminderPlan {
  const {
    rows,
    cols,
    now,
    minAgeMinutes = DEFAULT_MIN_AGE_MINUTES,
    maxAgeHours = DEFAULT_MAX_AGE_HOURS,
    limit = DEFAULT_LIMIT,
    bookedEmails,
  } = opts;

  const skipped: ReminderSkips = {
    paid: 0,
    booked: 0,
    alreadyReminded: 0,
    tooNew: 0,
    tooOld: 0,
    noPhone: 0,
    unparseableTime: 0,
    duplicatePhone: 0,
    overCap: 0,
  };

  // One woman can occupy several rows — she retook the quiz, or the funnel
  // wrote a partial row first. PAID is a permanent, cross-row fact: if any
  // row shows she paid, every row for that phone is settled forever — asking
  // a payer to pay again is simply wrong, whenever it happens.
  //
  // REMINDED is deliberately NOT cross-row anymore (owner decision,
  // 2026-08-18): a genuine retake — she submits the quiz again, even minutes
  // after the first attempt — is a fresh signal of real intent and earns its
  // own reminder cycle, not a permanent "already handled" block just because
  // an older, unrelated row for the same phone was reminded once before.
  // Rows from the SAME batch still collapse to one send via claimedPhones
  // below, so a literal double-submit in one sitting still isn't double
  // messaged — only reminders from genuinely separate cron runs are exempt
  // from blocking each other now.
  // A payment settles the attempts she had made UP TO THAT MOMENT — not every
  // attempt she will ever make. Keyed as a Set this was time-blind, so one
  // payment disqualified that phone forever: the owner could not receive a test
  // reminder on a number he had once paid with, and a woman who bought a session
  // in July and abandoned a fresh checkout in September was unreachable for good.
  // Keep the latest settle per phone, so a second payment re-settles her.
  const settledAt = new Map<string, number>();
  for (const r of rows) {
    const p = phoneKey(cell(r ?? [], cols.phone));
    if (!p) continue;
    if (cell(r ?? [], cols.paid).toUpperCase() !== "Y") continue;
    const when =
      parseSheetTime(cell(r ?? [], cols.paidAt ?? -1)) ??
      parseSheetTime(cell(r ?? [], cols.timestamp)) ??
      Number.POSITIVE_INFINITY;
    settledAt.set(p, Math.max(settledAt.get(p) ?? Number.NEGATIVE_INFINITY, when));
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
    // Booked wins for the same reason paid does, and it is checked here rather
    // than later so it cannot be reached by any other rule. Today this is a
    // no-op safety net, because paying is the only way to reach the calendar,
    // so anyone booked is already paid. It stops being a no-op the moment the
    // consultation is free: every free booking is then a row with Paid != Y and
    // a fresh timestamp, which matches every remaining rule, and the message
    // this job sends asks her for money she does not owe.
    if (hasBookingEvidence(row, cols, bookedEmails)) {
      skipped.booked++;
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

    const created = parseSheetTime(cell(row, cols.timestamp));
    if (created === null) {
      skipped.unparseableTime++;
      continue;
    }

    // She may be settled on a different row than this one — but a payment only
    // settles what came before it. A checkout abandoned AFTER she paid for an
    // earlier session is new, unpaid intent and earns its nudge. Equal stamps
    // still count as settled, so a payment recorded in the same minute as the
    // row it belongs to can never nudge her.
    const settled = settledAt.get(phoneKey(phone));
    if (settled !== undefined && settled >= created) {
      skipped.duplicatePhone++;
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
      leadId: cell(row, cols.leadId),
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

// ── One-off template broadcast: unpaid, unbooked, recent ─────────────────────
//
// For campaign-style sends (e.g. the Rashmi blocker-video message): every lead
// who has NOT paid and has NO booking, created within the window, once per
// template ever. The stamp column is per-template, so a new template name is a
// new campaign with its own once-only guarantee.

export type BroadcastColumns = {
  timestamp: number;
  name: number;
  phone: number;
  paid: number;
  bookingStatus: number;
  sessionDate: number;
  /** Per-template stamp column; -1 when it doesn't exist yet. */
  stamp: number;
};

export type BroadcastSkips = {
  paid: number;
  booked: number;
  alreadySent: number;
  /** Younger than minAgeHours — used to hold back leads messaged very recently. */
  tooNew: number;
  tooOld: number;
  noPhone: number;
  unparseableTime: number;
  duplicatePhone: number;
  overCap: number;
};

export type BroadcastPlan = {
  candidates: ReminderCandidate[];
  skipped: BroadcastSkips;
  scanned: number;
};

export const BROADCAST_MAX_AGE_DAYS = 7;
export const BROADCAST_LIMIT = 50;

export function planBroadcast(opts: {
  rows: string[][];
  cols: BroadcastColumns;
  now: number;
  /** Hold back leads younger than this — e.g. 24 to skip anyone messaged today
   *  by the daily cron, so one woman never gets two templates in one day. */
  minAgeHours?: number;
  maxAgeDays?: number;
  limit?: number;
}): BroadcastPlan {
  const {
    rows,
    cols,
    now,
    minAgeHours = 0,
    maxAgeDays = BROADCAST_MAX_AGE_DAYS,
    limit = BROADCAST_LIMIT,
  } = opts;

  const skipped: BroadcastSkips = {
    paid: 0,
    booked: 0,
    alreadySent: 0,
    tooNew: 0,
    tooOld: 0,
    noPhone: 0,
    unparseableTime: 0,
    duplicatePhone: 0,
    overCap: 0,
  };

  const bookedEvidence = (r: string[]): boolean =>
    !!cell(r, cols.bookingStatus) || !!cell(r, cols.sessionDate);

  // A phone settled on ANY row — paid, booked, or already sent this template —
  // disqualifies all of that woman's rows.
  const settledPhones = new Set<string>();
  for (const r of rows) {
    const p = phoneKey(cell(r ?? [], cols.phone));
    if (!p) continue;
    const isPaid = cell(r ?? [], cols.paid).toUpperCase() === "Y";
    if (isPaid || bookedEvidence(r ?? []) || !!cell(r ?? [], cols.stamp)) settledPhones.add(p);
  }

  const claimedPhones = new Set<string>();
  const eligible: ReminderCandidate[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = i + 2;

    if (cell(row, cols.paid).toUpperCase() === "Y") {
      skipped.paid++;
      continue;
    }
    if (bookedEvidence(row)) {
      skipped.booked++;
      continue;
    }
    if (cell(row, cols.stamp)) {
      skipped.alreadySent++;
      continue;
    }

    const phone = cell(row, cols.phone).replace(/\.0$/, "").replace(/\D/g, "");
    if (phone.length < 10) {
      skipped.noPhone++;
      continue;
    }
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
    if (ageMinutes < minAgeHours * 60) {
      skipped.tooNew++;
      continue;
    }
    if (ageMinutes > maxAgeDays * 24 * 60) {
      skipped.tooOld++;
      continue;
    }

    eligible.push({ rowNumber, name: cell(row, cols.name), phone, ageMinutes: Math.round(ageMinutes) });
  }

  // Newest first — the freshest lead is the most likely to convert.
  eligible.sort((a, b) => a.ageMinutes - b.ageMinutes);

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

// ── Booking nudge: paid but never picked a slot ──────────────────────────────
//
// The funnel's SECOND leak, downstream of the first: she paid ₹299 and never
// booked her call. booking_confirmation fires once at the moment of payment —
// if she misses that single message, nothing ever speaks to her again, and the
// money is spent with no consultation behind it. Two of every three payers were
// ending here. This planner gives each paid-unbooked woman exactly one more
// booking_confirmation (UTILITY template, booking button included), the day
// after she paid.
//
// Rules mirror planReminders where the reasons carry over; where they differ:
//
//   MIN AGE  measured from Paid At, not lead creation — she got the instant
//            confirmation at payment; the nudge waits ~20h so it reads as a
//            courteous follow-up, not a duplicate.
//   MAX AGE  7 days. Beyond that a template nudge is stale — she belongs to
//            personal outreach, not automation.
//   BOOKED   any row of hers with a Booking Status disqualifies all her rows —
//            the Cal.com → Sheets scenario writes that column on booking.

export type BookingNudgeColumns = {
  name: number;
  phone: number;
  paid: number;
  /** "Paid At" ISO stamp written by the payment webhook. */
  paidAt: number;
  /** Column R — "Booked"/"Cancelled", owned by the Cal.com Make scenario. */
  bookingStatus: number;
  /** Column S — "Session Date". The Make scenario sometimes stamps only one of
   *  the two booking columns, and live data shows booked women with an empty
   *  Booking Status. EITHER column counts as "she booked" — nudging a woman
   *  who already sat her consultation is the worst message this job can send. */
  sessionDate: number;
  nudgeSent: number;
};

export type BookingNudgeSkips = {
  notPaid: number;
  alreadyBooked: number;
  alreadyNudged: number;
  tooNew: number;
  tooOld: number;
  noPhone: number;
  unparseableTime: number;
  duplicatePhone: number;
  overCap: number;
};

export type BookingNudgePlan = {
  candidates: ReminderCandidate[];
  skipped: BookingNudgeSkips;
  scanned: number;
};

// Stage 1 fires ONE HOUR after payment, not 20. She paid because she was
// ready in that moment; by the next morning that moment has passed. 15 of the
// funnel's payers booked only 4 calls, and a nudge that arrives a day late is
// the single most expensive thing in the funnel — the money is already
// collected and the ₹20k conversation never happens without the call.
export const BOOKING_NUDGE_MIN_AGE_HOURS = 1;
export const BOOKING_NUDGE_STAGE1_MAX_DAYS = 1;

// Stage 2, three days later, for anyone stage 1 did not move. Separate stamp
// column, so it can never re-send stage 1's message.
export const BOOKING_NUDGE_STAGE2_MIN_HOURS = 72;
export const BOOKING_NUDGE_MAX_AGE_DAYS = 7;
export const BOOKING_NUDGE_LIMIT = 15;

// Second payment reminder, a day after the first. Different angle, not a
// repeat: touch one says the slot is open, touch two answers the actual
// objection with the refund guarantee.
export const REMINDER2_MIN_AGE_MINUTES = 24 * 60;
export const REMINDER2_MAX_AGE_HOURS = 72;

export function planBookingNudges(opts: {
  rows: string[][];
  cols: BookingNudgeColumns;
  now: number;
  minAgeHours?: number;
  maxAgeDays?: number;
  limit?: number;
}): BookingNudgePlan {
  const {
    rows,
    cols,
    now,
    minAgeHours = BOOKING_NUDGE_MIN_AGE_HOURS,
    maxAgeDays = BOOKING_NUDGE_MAX_AGE_DAYS,
    limit = BOOKING_NUDGE_LIMIT,
  } = opts;

  const skipped: BookingNudgeSkips = {
    notPaid: 0,
    alreadyBooked: 0,
    alreadyNudged: 0,
    tooNew: 0,
    tooOld: 0,
    noPhone: 0,
    unparseableTime: 0,
    duplicatePhone: 0,
    overCap: 0,
  };

  // Same one-woman-many-rows reality as planReminders: her booking or an
  // earlier nudge may live on a different row than her payment. A phone that
  // is booked or nudged ANYWHERE settles every row it appears on.
  const bookedEvidence = (r: string[]): boolean =>
    !!cell(r, cols.bookingStatus) || !!cell(r, cols.sessionDate);

  const settledPhones = new Set<string>();
  for (const r of rows) {
    const p = phoneKey(cell(r ?? [], cols.phone));
    if (!p) continue;
    const nudged = !!cell(r ?? [], cols.nudgeSent);
    if (bookedEvidence(r ?? []) || nudged) settledPhones.add(p);
  }

  const claimedPhones = new Set<string>();
  const eligible: ReminderCandidate[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = i + 2;

    if (cell(row, cols.paid).toUpperCase() !== "Y") {
      skipped.notPaid++;
      continue;
    }
    // Any booking state — Booked, Cancelled, a session date, rescheduled
    // prose — means the booking pipeline already owns her; a "pick your slot"
    // nudge would be wrong for every one of those states.
    if (bookedEvidence(row)) {
      skipped.alreadyBooked++;
      continue;
    }
    if (cell(row, cols.nudgeSent)) {
      skipped.alreadyNudged++;
      continue;
    }

    const phone = cell(row, cols.phone).replace(/\.0$/, "").replace(/\D/g, "");
    if (phone.length < 10) {
      skipped.noPhone++;
      continue;
    }
    if (settledPhones.has(phoneKey(phone))) {
      skipped.duplicatePhone++;
      continue;
    }

    const paidAt = parseSheetTime(cell(row, cols.paidAt));
    if (paidAt === null) {
      skipped.unparseableTime++;
      continue;
    }

    const ageMinutes = (now - paidAt) / 60000;
    if (ageMinutes < minAgeHours * 60) {
      skipped.tooNew++;
      continue;
    }
    if (ageMinutes > maxAgeDays * 24 * 60) {
      skipped.tooOld++;
      continue;
    }

    eligible.push({ rowNumber, name: cell(row, cols.name), phone, ageMinutes: Math.round(ageMinutes) });
  }

  // Newest payment first — the opposite of planReminders. A booking nudge
  // converts best while the payment is still fresh in her mind; the 7-day
  // max-age already protects the tail.
  eligible.sort((a, b) => a.ageMinutes - b.ageMinutes);

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

// ── Free-funnel booking nudges: quiz done, slot never picked ────────────────
//
// The consultation went free on 23-Sep-2026, and the four paid jobs above were
// switched off the same day because every one of them asks for money. Nothing
// replaced them, which left the funnel's LARGEST group — she answered the
// quiz, saw her score, and never picked a slot — hearing from us exactly once,
// ever, in the welcome message.
//
// This is that replacement, and it is deliberately a different shape from
// planBookingNudges: there is no payment to anchor to any more, so the anchor
// is her quiz Timestamp, and "did she pay" stops being a gate at all.
//
// One thing it does NOT do: nudge a woman who has paid. A ₹299 payer from the
// old funnel who never booked is a real and stranded case, but telling her the
// call is free reads as an insult to the money she already sent. She is worth
// a personal message from the CRM, not a broadcast, so Paid = Y is skipped
// here and surfaced in the dry run instead.

export type FreeBookingNudgeColumns = {
  name: number;
  phone: number;
  /** "Timestamp" — when she finished the quiz. Her age anchor. */
  createdAt: number;
  /** Paid women are handled by hand; see the note above. */
  paid: number;
  /** Column R — "Booked"/"Cancelled", owned by the Cal.com Make scenario. */
  bookingStatus: number;
  /** Column S — "Session Date". Live data shows booked women with an empty
   *  Booking Status, so EITHER column counts as "she booked". Nudging a woman
   *  who already has a call in the diary is the worst message this job can
   *  send, so the test for it is deliberately generous. */
  sessionDate: number;
  /** "Email". Blank for most free-funnel leads — the /decode gate asks only
   *  for name and phone — but present the moment she books, which is exactly
   *  when it is needed to match her against Cal.com. */
  email: number;
  /** Per-stage stamp, so stage 1 and stage 2 can never suppress each other. */
  nudgeSent: number;
};

export type FreeBookingNudgeSkips = {
  alreadyBooked: number;
  alreadyNudged: number;
  paid: number;
  tooNew: number;
  tooOld: number;
  noPhone: number;
  unparseableTime: number;
  duplicatePhone: number;
  overCap: number;
};

export type FreeBookingNudgePlan = {
  candidates: ReminderCandidate[];
  skipped: FreeBookingNudgeSkips;
  scanned: number;
};

// Stage 1 waits until the next day, NOT an hour. She has just been sent
// welcome_lead_score with a booking button on it; a second message an hour
// later is nagging, not helping. Twenty hours puts it in the next morning for
// a woman who took the quiz in the evening, which is when most of them do.
export const FREE_NUDGE_STAGE1_MIN_HOURS = 20;
export const FREE_NUDGE_STAGE1_MAX_DAYS = 3;

// Stage 2 answers the objection rather than repeating the offer, so it is
// worth sending to someone stage 1 did not move. Its window starts where
// stage 1's ends, so the two can never both fire on the same day.
export const FREE_NUDGE_STAGE2_MIN_HOURS = FREE_NUDGE_STAGE1_MAX_DAYS * 24;
export const FREE_NUDGE_MAX_AGE_DAYS = 10;
export const FREE_NUDGE_LIMIT = 25;

/**
 * Is it a civil hour to send a marketing nudge in India?
 *
 * Every other job in this cron is anchored to something SHE chose — her
 * payment, or her session time. The free nudge is anchored to "twenty hours
 * after her quiz", which lands wherever her quiz landed, and this route is
 * polled every five minutes. Without this guard a woman who took the quiz at
 * 7 a.m. is messaged at 3 a.m. the next morning.
 *
 * 09:00 to 21:00 IST. Deliberately not applied to the call reminders: a
 * "starts in one hour" message at 8 a.m. is wanted, because she booked 9 a.m.
 */
export const SENDING_HOURS_IST = { from: 9, to: 21 } as const;

export function isWithinSendingHoursIST(now: Date | number = Date.now()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(now)),
  );
  return hour >= SENDING_HOURS_IST.from && hour < SENDING_HOURS_IST.to;
}

export function planFreeBookingNudges(opts: {
  rows: string[][];
  cols: FreeBookingNudgeColumns;
  now: number;
  minAgeHours?: number;
  maxAgeDays?: number;
  limit?: number;
  /** Cal.com's upcoming-booking emails (CalState.active). The Make Cal.com →
   *  Sheets scenario drops most booking write-backs, so the sheet's own two
   *  columns miss real bookings; without this, the worst message this job can
   *  send is also its most likely one. */
  bookedEmails?: Set<string>;
}): FreeBookingNudgePlan {
  const {
    rows,
    cols,
    now,
    minAgeHours = FREE_NUDGE_STAGE1_MIN_HOURS,
    maxAgeDays = FREE_NUDGE_STAGE1_MAX_DAYS,
    limit = FREE_NUDGE_LIMIT,
    bookedEmails,
  } = opts;

  const skipped: FreeBookingNudgeSkips = {
    alreadyBooked: 0,
    alreadyNudged: 0,
    paid: 0,
    tooNew: 0,
    tooOld: 0,
    noPhone: 0,
    unparseableTime: 0,
    duplicatePhone: 0,
    overCap: 0,
  };

  // One woman, many rows: she can retake the quiz, and her booking or an
  // earlier nudge may land on a different row than the one being scanned. A
  // phone that is booked, paid or nudged ANYWHERE settles every row it
  // appears on — the same rule planBookingNudges uses, and the reason a
  // re-taken quiz cannot produce a second nudge.
  const bookedEvidence = (r: string[]): boolean => {
    if (bookedEmails?.size) {
      const email = cell(r, cols.email).toLowerCase();
      if (email && bookedEmails.has(email)) return true;
    }
    return !!cell(r, cols.bookingStatus) || !!cell(r, cols.sessionDate);
  };

  const settledPhones = new Set<string>();
  for (const r of rows) {
    const row = r ?? [];
    const p = phoneKey(cell(row, cols.phone));
    if (!p) continue;
    if (bookedEvidence(row) || !!cell(row, cols.nudgeSent) || cell(row, cols.paid).toUpperCase() === "Y") {
      settledPhones.add(p);
    }
  }

  const claimedPhones = new Set<string>();
  const eligible: ReminderCandidate[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = i + 2;

    // Any booking state at all — Booked, Cancelled, a session date,
    // rescheduled prose — means the booking pipeline owns her already.
    if (bookedEvidence(row)) {
      skipped.alreadyBooked++;
      continue;
    }
    if (cell(row, cols.nudgeSent)) {
      skipped.alreadyNudged++;
      continue;
    }
    if (cell(row, cols.paid).toUpperCase() === "Y") {
      skipped.paid++;
      continue;
    }

    const phone = cell(row, cols.phone).replace(/\.0$/, "").replace(/\D/g, "");
    if (phone.length < 10) {
      skipped.noPhone++;
      continue;
    }
    if (settledPhones.has(phoneKey(phone))) {
      skipped.duplicatePhone++;
      continue;
    }

    const createdAt = parseSheetTime(cell(row, cols.createdAt));
    if (createdAt === null) {
      skipped.unparseableTime++;
      continue;
    }

    const ageMinutes = (now - createdAt) / 60000;
    if (ageMinutes < minAgeHours * 60) {
      skipped.tooNew++;
      continue;
    }
    if (ageMinutes > maxAgeDays * 24 * 60) {
      skipped.tooOld++;
      continue;
    }

    eligible.push({ rowNumber, name: cell(row, cols.name), phone, ageMinutes: Math.round(ageMinutes) });
  }

  // Freshest quiz first. Interest decays fast, and the max-age window already
  // protects the tail from being forgotten.
  eligible.sort((a, b) => a.ageMinutes - b.ageMinutes);

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

// ── Call reminders: fire relative to her SESSION time, not elapsed time ──────
//
// Every other planner here answers "how long since X happened". These answer
// "how long until the call starts", which is a different shape: the anchor is
// in the FUTURE and moves past us, so a job that misses its window must never
// fire late — a "starts in one hour" message arriving after the call is worse
// than no message at all.
//
// Session Date is written by the Cal.com → Sheets scenario, whose exact format
// is not controlled by this codebase. parseSheetTime already tolerates ISO
// strings, Sheets date serials and locale strings; anything it cannot read is
// COUNTED and skipped rather than guessed at, so a format drift shows up as a
// number in the dry run instead of as silently missing reminders.

export type CallReminderColumns = {
  name: number;
  phone: number;
  sessionDate: number;
  /** Cancelled bookings must never be reminded. */
  bookingStatus: number;
  /** Per-stage stamp column, so 24h and 1h can never suppress each other. */
  reminderSent: number;
};

export type CallReminderSkips = {
  noSession: number;
  unparseableTime: number;
  cancelled: number;
  alreadySent: number;
  /** The call is further away than this stage's window. */
  notYetDue: number;
  /** The call is already too close, or has started. Never remind late. */
  tooLate: number;
  noPhone: number;
  duplicatePhone: number;
  overCap: number;
};

export type CallReminderCandidate = {
  rowNumber: number;
  name: string;
  phone: string;
  /** Epoch ms of her session, for formatting the time into the template. */
  sessionAt: number;
  hoursUntil: number;
};

export type CallReminderPlan = {
  candidates: CallReminderCandidate[];
  skipped: CallReminderSkips;
  scanned: number;
};

export const CALL_REMINDER_LIMIT = 25;

export function planCallReminders(opts: {
  rows: string[][];
  cols: CallReminderColumns;
  now: number;
  /** Fire once the call is this many hours away or nearer. */
  withinHours: number;
  /** Never fire once it is THIS near (or past). Stops the 24h stage firing
   *  minutes before the call if its stamp somehow never landed. */
  notWithinHours: number;
  limit?: number;
}): CallReminderPlan {
  const { rows, cols, now, withinHours, notWithinHours, limit = CALL_REMINDER_LIMIT } = opts;

  const skipped: CallReminderSkips = {
    noSession: 0,
    unparseableTime: 0,
    cancelled: 0,
    alreadySent: 0,
    notYetDue: 0,
    tooLate: 0,
    noPhone: 0,
    duplicatePhone: 0,
    overCap: 0,
  };

  const claimedPhones = new Set<string>();
  const eligible: CallReminderCandidate[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = i + 2;

    if (cell(row, cols.reminderSent)) {
      skipped.alreadySent++;
      continue;
    }

    // Any cancellation wording disqualifies her. Reminding someone about a
    // call she cancelled reads as though nobody is paying attention.
    if (/cancel/i.test(cell(row, cols.bookingStatus))) {
      skipped.cancelled++;
      continue;
    }

    const raw = cell(row, cols.sessionDate);
    if (!raw) {
      skipped.noSession++;
      continue;
    }
    const sessionAt = parseSheetTime(raw);
    if (sessionAt === null) {
      skipped.unparseableTime++;
      continue;
    }

    const phone = cell(row, cols.phone).replace(/\.0$/, "").replace(/\D/g, "");
    if (phone.length < 10) {
      skipped.noPhone++;
      continue;
    }

    const hoursUntil = (sessionAt - now) / 3600000;
    if (hoursUntil > withinHours) {
      skipped.notYetDue++;
      continue;
    }
    if (hoursUntil <= notWithinHours) {
      skipped.tooLate++;
      continue;
    }

    eligible.push({ rowNumber, name: cell(row, cols.name), phone, sessionAt, hoursUntil });
  }

  // Soonest call first: if the cap bites, the most urgent reminder still goes.
  eligible.sort((a, b) => a.hoursUntil - b.hoursUntil);

  const unique: CallReminderCandidate[] = [];
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

/** Her session time as she would read it, in IST. Templates take a display
 *  string, not a timestamp. */
export function formatSessionTimeIST(sessionAt: number): string {
  return new Date(sessionAt).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}
