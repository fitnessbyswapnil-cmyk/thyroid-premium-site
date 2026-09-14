/**
 * lib/metrics.ts — THE ONLY PLACE A BUSINESS METRIC IS DEFINED. PURE.
 *
 * WHY THIS EXISTS. On 13-Sep two screenshots of /admin taken four minutes
 * apart disagreed on everything: Closed 0 vs Won 9, revenue ₹36,485 vs ₹22,897,
 * leads 59 vs 103. Each tab computed its own truth, and neither was right:
 *  - Pipeline called anyone with Paid = Y "won" — three of its nine wins were
 *    ₹299 consultation fees and four had no amount at all.
 *  - Analytics counted every paid row as a ₹299 consultation, including 23 rows
 *    that had paid ₹1, and never saw the ₹20,000 and ₹30,000 programme payments
 *    because nobody had marked them in Today.
 *  - Pipeline read 50 bookings, Today read 100.
 * Today, Pipeline, Analytics and the digest now read these numbers from here
 * and nowhere else. A tab may lay a number out; it may not compute one.
 *
 * ── THE OWNER'S DECISIONS (Swapnil, 14-Sep-2026). Change them only with him. ──
 *
 *  1. REVENUE is programme payments only. ₹299 consultation fees are reported
 *     on their own line and never added into revenue.
 *  2. WON means one payment of ₹15,000 or more, OR a sale marked in Today
 *     ("Closed ₹"). ₹299 fees and ₹2,000-style payments are not wins.
 *  3. DATES are when each thing happened: a lead by her sign-up time, a booking
 *     by when it was MADE, attendance by when the call was, and a win and its
 *     revenue by the date the money changed hands.
 *  4. TEST DATA is his own identity — the addresses in lib/owner-filter, any
 *     name containing "Swapnil", and phone 79878 80954 — and it is excluded
 *     from every number here, not just from one screen.
 *
 * ── DEFINITIONS ─────────────────────────────────────────────────────────────
 *  lead               a distinct woman (by phone, else email) whose FIRST
 *                     Leads-sheet row falls in the window. One woman on three
 *                     rows is one lead.
 *  booked             a Cal.com booking created in the window, whatever became
 *                     of it later.
 *  cancelled          of those bookings, the ones cancelled or rejected.
 *  attended           a call whose slot is in the window and whose recording
 *                     shows her speaking (source: Fathom → Calls sheet).
 *  noShow             a slot in the window, not cancelled, past its grace
 *                     period, inside the dates the recording ingest covers,
 *                     with no attended recording.
 *  attendanceUnknown  the same, but BEFORE the earliest ingested call — nobody
 *                     looked, so it is unknown. NEVER counted as a no-show.
 *  showUpRate         attended ÷ (attended + noShow). Cancelled, upcoming and
 *                     unknown calls are in neither half: a cancellation is not
 *                     a no-show and an unsearched call is not a miss.
 *  won                distinct women with a programme payment dated in window.
 *  revenue            the sum of those programme payments.
 *  consultFees        consultation payments dated in window (₹299, or ₹1 charged
 *                     to a real client during a test-mode window), count + ₹.
 *  otherPayments      anything between ₹300 and ₹14,999 — reported, not revenue.
 */
import { canonicalEmail, isOwnerTest } from "./owner-filter.ts";
import { SCORECARD_KEYS, labelFor } from "./scorecard.ts";

export const PROGRAMME_MIN_AMOUNT = 15000;
export const CONSULT_MAX_AMOUNT = 299;
/** A slot this many minutes past its start, with no recording, may be judged. */
export const NO_SHOW_GRACE_MIN = 90;

/** His own test phone(s). Extra ones via OWNER_TEST_PHONES, comma-separated. */
const BUILT_IN_OWNER_PHONES = ["7987880954"];

// ── Inputs ──────────────────────────────────────────────────────────────────

/** One row of the Leads sheet, already read by header name. */
export type LeadRecord = {
  row: number;
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  paid: boolean;
  paidAmount: number | null;
  paidAt: string;
  /** "Closed ₹" — a programme sale marked in Today. */
  closedAmt: number | null;
  /** "Programme Closed At" — when that sale's money moved. */
  closedAt: string;
};

export type BookingRecord = {
  uid: string;
  createdAt: string;
  startAt: string;
  cancelled: boolean;
  name: string;
  email: string;
  phone: string;
};

export type CallRecord = {
  bookingUid: string;
  occurredAt: string;
  /** null when the recording has not been judged. */
  attended: boolean | null;
  /** check key → passed. null when the call was never scored. */
  scorecard: Record<string, boolean> | null;
};

export type Dataset = { leads: LeadRecord[]; bookings: BookingRecord[]; calls: CallRecord[] };

/** Half-open [from, to). from = null means all time. */
export type Window = { from: number | null; to: number };

// ── Identity ────────────────────────────────────────────────────────────────

export const phoneKey = (p: string): string => String(p ?? "").replace(/\D/g, "").slice(-10);

function ownerPhones(): Set<string> {
  const extra = (typeof process !== "undefined" ? process.env.OWNER_TEST_PHONES : "") ?? "";
  return new Set([...BUILT_IN_OWNER_PHONES, ...extra.split(",").map(phoneKey)].filter((p) => p.length === 10));
}

/** The one test rule. Every metric, every tab, the queue. */
export function isTestIdentity(who: { name?: string; email?: string; phone?: string }): boolean {
  if (isOwnerTest({ name: who.name ?? "", email: who.email ?? "" })) return true;
  const p = phoneKey(who.phone ?? "");
  return p.length === 10 && ownerPhones().has(p);
}

/** Who a row or booking belongs to: phone first, then email. "" if neither. */
export function personKey(who: { phone?: string; email?: string }): string {
  const p = phoneKey(who.phone ?? "");
  if (p.length === 10) return `p:${p}`;
  const e = canonicalEmail(who.email ?? "");
  return e ? `e:${e}` : "";
}

// ── Money ───────────────────────────────────────────────────────────────────

export type PaymentKind = "programme" | "consult" | "other";

export function paymentKind(amount: number | null): PaymentKind {
  // "Paid = Y" with no amount predates the Paid Amount column: those were ₹299.
  if (amount === null) return "consult";
  if (amount >= PROGRAMME_MIN_AMOUNT) return "programme";
  if (amount <= CONSULT_MAX_AMOUNT) return "consult";
  return "other";
}

/** Is THIS row a won programme sale? The card-level twin of `won`. */
export function isWonRow(r: { closedAmt: number | null; paidAmount: number | null }): boolean {
  return (r.closedAmt ?? 0) > 0 || (r.paidAmount ?? 0) >= PROGRAMME_MIN_AMOUNT;
}

export type Payment = { person: string; kind: PaymentKind; amount: number | null; at: string; marked: boolean };

/** Every payment in the sheet, de-duplicated per woman. */
export function paymentsOf(leads: LeadRecord[]): Payment[] {
  const seen = new Set<string>();
  const out: Payment[] = [];
  for (const r of leads) {
    if (isTestIdentity(r)) continue;
    const person = personKey(r) || `row:${r.row}`;
    let p: Payment | null = null;
    if ((r.closedAmt ?? 0) > 0) {
      p = { person, kind: "programme", amount: r.closedAmt, at: r.closedAt || r.paidAt || r.createdAt, marked: true };
    } else if (r.paid || (r.paidAmount ?? 0) > 0) {
      p = { person, kind: paymentKind(r.paidAmount), amount: r.paidAmount, at: r.paidAt || r.createdAt, marked: false };
    }
    if (!p) continue;
    // The same payment is copied onto each of her duplicate rows, and a sale
    // marked in Today rewrites Paid Amount/Paid At to match "Closed ₹". Same
    // woman, same kind, same amount, same minute → one payment.
    const id = `${person}|${p.kind}|${p.amount ?? "?"}|${p.at.slice(0, 16)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
}

// ── Attendance ──────────────────────────────────────────────────────────────

export type AttendanceState = "attended" | "no_show" | "unknown" | "upcoming" | "cancelled";

export function attendanceOf(
  b: { cancelled: boolean; startAt: string },
  call: { attended: boolean | null } | undefined,
  callDataSince: string | null,
  now: number,
): AttendanceState {
  if (b.cancelled) return "cancelled";
  if (call && call.attended !== null) return call.attended ? "attended" : "no_show";
  const start = Date.parse(b.startAt);
  if (!Number.isFinite(start) || now - start <= NO_SHOW_GRACE_MIN * 60000) return "upcoming";
  const since = callDataSince ? Date.parse(callDataSince) : NaN;
  return Number.isFinite(since) && start >= since ? "no_show" : "unknown";
}

/** The earliest recording the ingest holds — the edge of "we looked". */
export function callDataSinceOf(calls: CallRecord[]): string | null {
  let min = Infinity;
  for (const c of calls) {
    const t = Date.parse(c.occurredAt);
    if (Number.isFinite(t) && t < min) min = t;
  }
  return Number.isFinite(min) ? new Date(min).toISOString() : null;
}

// ── The summary every tab renders ───────────────────────────────────────────

export type Summary = {
  window: { from: string | null; to: string };
  leads: number;
  booked: number;
  cancelled: number;
  attended: number;
  noShow: number;
  attendanceUnknown: number;
  upcoming: number;
  showUpRate: number | null;
  leadToBooked: number | null;
  won: number;
  revenue: number;
  consultFees: { count: number; amount: number };
  otherPayments: { count: number; amount: number };
  excludedTestRows: { leads: number; bookings: number };
  callDataSince: string | null;
};

const inWindow = (iso: string, w: Window): boolean => {
  const t = Date.parse(iso);
  return Number.isFinite(t) && (w.from === null || t >= w.from) && t < w.to;
};

export function summarize(data: Dataset, w: Window, now: number = w.to): Summary {
  const testLeads = data.leads.filter((r) => isTestIdentity(r)).length;
  const testBookings = data.bookings.filter((b) => isTestIdentity(b)).length;
  const leads = data.leads.filter((r) => !isTestIdentity(r));
  const bookings = data.bookings.filter((b) => !isTestIdentity(b));

  // Leads: each woman once, dated by her FIRST row.
  const firstSeen = new Map<string, number>();
  for (const r of leads) {
    const key = personKey(r) || `row:${r.row}`;
    const t = Date.parse(r.createdAt);
    if (!Number.isFinite(t)) continue;
    const prev = firstSeen.get(key);
    if (prev === undefined || t < prev) firstSeen.set(key, t);
  }
  let leadCount = 0;
  for (const t of firstSeen.values()) if ((w.from === null || t >= w.from) && t < w.to) leadCount++;

  // Bookings made in the window.
  const made = bookings.filter((b) => inWindow(b.createdAt || b.startAt, w));
  const bookedPeople = new Set(made.map((b) => personKey(b) || `b:${b.uid}`));

  // Attendance for calls whose slot is in the window.
  const since = callDataSinceOf(data.calls);
  const callByUid = new Map(data.calls.map((c) => [c.bookingUid, c]));
  const att = { attended: 0, noShow: 0, unknown: 0, upcoming: 0 };
  for (const b of bookings) {
    if (b.cancelled || !inWindow(b.startAt, w)) continue;
    const s = attendanceOf(b, callByUid.get(b.uid), since, now);
    if (s === "attended") att.attended++;
    else if (s === "no_show") att.noShow++;
    else if (s === "unknown") att.unknown++;
    else if (s === "upcoming") att.upcoming++;
  }

  // Money, by payment date.
  const pays = paymentsOf(leads).filter((p) => inWindow(p.at, w));
  const programme = pays.filter((p) => p.kind === "programme");
  const consult = pays.filter((p) => p.kind === "consult");
  const other = pays.filter((p) => p.kind === "other");
  const sum = (xs: Payment[]) => xs.reduce((s, p) => s + (p.amount ?? 0), 0);

  return {
    window: { from: w.from === null ? null : new Date(w.from).toISOString(), to: new Date(w.to).toISOString() },
    leads: leadCount,
    booked: made.length,
    cancelled: made.filter((b) => b.cancelled).length,
    attended: att.attended,
    noShow: att.noShow,
    attendanceUnknown: att.unknown,
    upcoming: att.upcoming,
    showUpRate: att.attended + att.noShow > 0 ? att.attended / (att.attended + att.noShow) : null,
    leadToBooked: leadCount > 0 ? bookedPeople.size / leadCount : null,
    won: new Set(programme.map((p) => p.person)).size,
    revenue: sum(programme),
    consultFees: { count: consult.length, amount: sum(consult) },
    otherPayments: { count: other.length, amount: sum(other) },
    excludedTestRows: { leads: testLeads, bookings: testBookings },
    callDataSince: since,
  };
}

// ── The call checklist ──────────────────────────────────────────────────────

export type ChecklistSummary = {
  callsScored: number;
  /** Average checks missed per scored call, out of 10. */
  avgMisses: number | null;
  /** Most-missed first. */
  checks: { key: string; label: string; missed: number; total: number }[];
};

export function checklistSummary(calls: CallRecord[]): ChecklistSummary {
  const scored = calls.filter((c) => c.scorecard && Object.keys(c.scorecard).length > 0);
  const tally = new Map<string, { missed: number; total: number }>();
  let misses = 0;
  for (const c of scored) {
    for (const [k, passed] of Object.entries(c.scorecard!)) {
      const e = tally.get(k) ?? { missed: 0, total: 0 };
      e.total++;
      if (!passed) {
        e.missed++;
        misses++;
      }
      tally.set(k, e);
    }
  }
  const order = new Map(SCORECARD_KEYS.map((k, i) => [k as string, i]));
  const checks = [...tally.entries()]
    .map(([key, v]) => ({ key, label: labelFor(key), ...v }))
    .sort((a, b) => b.missed / b.total - a.missed / a.total || b.missed - a.missed || (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
  return {
    callsScored: scored.length,
    avgMisses: scored.length ? Math.round((misses / scored.length) * 10) / 10 : null,
    checks,
  };
}

// ── Windows ─────────────────────────────────────────────────────────────────

export const RANGE_OPTIONS = [7, 14, 30, 90, 0] as const; // 0 = all time
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export function windowFor(days: number, now: number): Window {
  return { from: days > 0 ? now - days * 86400000 : null, to: now + 1 };
}

// ── What each tab shows — built here so no tab can re-derive them ───────────

export type HeadlineTiles = { leads: number; booked: number; won: number; revenue: number };

/** Every tab's headline numbers come through here. Tested for equality. */
export function headlineTiles(s: Summary): HeadlineTiles {
  return { leads: s.leads, booked: s.booked, won: s.won, revenue: s.revenue };
}
