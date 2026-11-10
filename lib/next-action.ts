/**
 * lib/next-action.ts — PURE. One woman, one card: where she is in the sales
 * journey, and the ONE button for the next thing to do. No IO, no Date.now().
 *
 * WHY (owner, 10-Nov-2026): "from client coming to consultation call I want
 * everything one click button to automate, keep flow clean easy to
 * understand". Today showed the same woman in up to four places (Mark your
 * calls, Calls in the next 24 hours, Needs me now, Did she pay?), each with
 * its own buttons, so the screen answered "what is there" and he had to work
 * out "what do I do". A card answers the second question once per woman.
 *
 * WHAT THIS DOES NOT DECIDE
 *  - Her stage. lib/crm-stage derives it and lib/journey stores it; this reads
 *    `j.state` and never re-derives it.
 *  - Whether she needs him. lib/journey's needs-action list is the ONE list,
 *    with its kinds, labels and order; a card on it answers that item (or a
 *    step before it in the funnel, like her summary), and keeps its place.
 *  - Any business number. Counts on screens come from lib/metrics; the only
 *    counts made here are of the cards themselves and of the drop-off funnel's
 *    three new steps (Confirmed, Report, Summary), held to lib/journey's
 *    funnel by a test.
 *
 * THE STEPS ON THE CARD (the owner's approved strip, 10-Nov)
 *   Lead → Confirm → Report → Call → Summary → Paid (→ Onboard once she paid)
 * STEPS below is the list, data-driven: a step that slots in later is one
 * entry with a position between two others, and nothing else changes. The
 * finer steps (pre-call PDF, thank-you, notes, the price, follow-ups) are
 * shown in the hints and as the actions, not as more boxes on a phone.
 *
 * THE ONE BUTTON
 * ACTIONS below, in precedence order: the first that applies is the primary,
 * the rest are quiet. Each says why in `reason`. Every message action carries
 * a SendPlan, and sendPath() picks how his one click sends it: her 24-hour
 * window open → the business number (POST /api/admin/messages); shut and the
 * step's template approved → the template (POST /api/admin/send-template);
 * otherwise "Send from your phone" (wa.me). Nothing is ever sent without his
 * click.
 *
 * Times are the coach's clock, IST, wherever this runs.
 */
import {
  ACTION_LABEL,
  ACTION_WINDOW_DAYS,
  FUNNEL_STAGES,
  NAMED_PRICE_CHECK,
  waitLabel,
  type ActionItem,
  type ActionKind,
  type FunnelStage,
  type Journey,
  type Reached,
} from "./journey.ts";
import { STAGE_LABEL, type Stage, type Urgency } from "./crm-stage.ts";
import type { Window } from "./metrics.ts";
import { draftWaLink, firstName } from "./draft-message.ts";
import type { Mark, MarkKind, Marks } from "./journey-marks.ts";

// ── Owner-confirmable rules. One place each. ────────────────────────────────

/** A free consultation runs an hour. */
export const CALL_MINUTES = 60;
/** Her summary is due this long after the call ENDS (start + 60 min). */
export const SUMMARY_TARGET_MIN = 30;
/** Notes becomes the button this long before her call, and stays it to the end. */
export const NOTES_LEAD_MIN = 30;
/** After an attended call with no notes Doc, Notes stays the button this long. */
export const NOTES_AFTER_HOURS = 12;
/** The thank-you is offered for two days after the call. */
export const THANKS_WITHIN_HOURS = 48;
/** An unconfirmed booking this close to its slot is at risk: "Send reminder". */
export const REMINDER_WITHIN_HOURS = 24;
/** Follow-ups after a priced, unpaid call: day 1, 3 and 7, on his calendar (IST). */
export const FOLLOW_UP_DAYS = [1, 3, 7] as const;
/** Past this, an unsent summary or a follow-up is history, not a task (lib/journey's window). */
export const REVIEW_WINDOW_DAYS = ACTION_WINDOW_DAYS;
/** A sale is put in front of him for onboarding this long. Pipeline keeps the button after. */
export const ONBOARD_WINDOW_DAYS = 14;

/**
 * The templates a one-click send may use once her window is shut, and the
 * flag (lib/automation-flags) that says Meta approved each one. Until a flag
 * is on, that step falls back to "Send from your phone": an unapproved
 * template fails the whole send. Params are the template's {{1}}, {{2}}.
 */
export const TEMPLATE_FOR = {
  followup_1: { name: "followup_day1_v1", flag: "followup_templates_approved", params: "{{1}} first name, {{2}} his Cashfree link" },
  followup_2: { name: "followup_day3_v1", flag: "followup_templates_approved", params: "{{1}} first name, {{2}} his Cashfree link" },
  followup_3: { name: "followup_day7_v1", flag: "followup_templates_approved", params: "{{1}} first name, {{2}} his Cashfree link" },
  reminder: { name: "confirm_reminder_v1", flag: "confirm_reminder_template_approved", params: "{{1}} first name, {{2}} call day and time" },
} as const;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WINDOW_MS = 24 * HOUR;
const IST_OFFSET_MS = 330 * MIN;

// ── Types the kit renders (structurally the kit's own) ──────────────────────

export type StepState = "done" | "current" | "todo" | "missed";
export type JourneyStep = { key: string; label: string; state: StepState; hint?: string };
export type FunnelBar = { key: string; label: string; count: number };
/** The kit StatusPill's tones. "neutral": nothing owed, or an outcome that is history. */
export type PillTone = "ok" | "progress" | "attention" | "failed" | "neutral";

// ── Facts: everything a card is decided from ────────────────────────────────

/** Her WhatsApp thread, reduced to the times a card needs. 0 = never. */
export type InboxStats = {
  lastIn: number;
  /** Last message that reached her from the business number (failures excluded). */
  lastOut: number;
  /** Last message typed by a person (not a "[template]" line). */
  lastManualOut: number;
  /** Last "[delivery failed]" line. Only Today, which reads the texts, knows. */
  lastFailed: number;
  /** Last confirm_reminder template. */
  lastReminder: number;
};

export type InboxEvent = {
  phone: string;
  at: string;
  dir: "in" | "out";
  manual?: boolean;
  failed?: boolean;
  template?: string;
};

/** Today's "Did she pay?" entry for her: the sheet row /api/admin/mark writes. */
export type PaidAsk = { row: number; pitched: number; objection: string; daysSince: number; dmPresent: string };
export type Badge = { label: string; tone: string; prompt?: string };

export type CardFacts = {
  key: string;
  name: string;
  /** Last 10 digits, or "" when she gave none. */
  phone: string;
  email: string;
  stage: Stage;
  reached: Reached;
  firstLeadAt: string | null;
  booking: { uid: string; startAt: string; createdAt: string; cancelled: boolean } | null;
  call: {
    attended: boolean | null;
    occurredAt: string;
    pricePitched: number | null;
    amountAgreed: number | null;
    namedPrice: boolean;
  } | null;
  won: boolean;
  agreedButUnpaid: boolean;
  report: { url: string; count: number; savedAt: number; mediaId?: string } | null;
  marks: Marks;
  inbox: InboxStats;
  /** Her item on lib/journey's needs-action list, and its place on it. */
  action: ActionItem | null;
  queueIndex: number;
  /** The drafted words for her queue item (Today only: written from her quiz answers). */
  draft: { text: string; wa: string } | null;
  /** payLinkFor(her quoted amount), or null when there is no link for it. */
  payLink: string | null;
  templates: { followups: boolean; reminder: boolean };
  paidAsk: PaidAsk | null;
  badge: Badge | null;
};

export type CardContext = {
  now: number;
  marks?: Map<string, Marks>;
  reports?: Map<string, { url: string; count: number; savedAt: number; mediaId?: string }>;
  inbox?: Map<string, InboxStats>;
  queue?: Map<string, { item: ActionItem; index: number }>;
  drafts?: Map<string, { text: string; wa: string }>;
  payLink?: (amount: number) => string | null;
  templates?: { followups: boolean; reminder: boolean };
  paidAsk?: Map<string, PaidAsk>;
  badges?: Map<string, Badge>;
};

// ── The card ────────────────────────────────────────────────────────────────

export type SendPlan = {
  /** The drafted words: what a business-number send sends and the wa.me link carries. */
  text: string;
  /** wa.me, prefilled with `text` when there is one. "" when she has no number. */
  wa: string;
  /** Her 24-hour window, measured when the card was built. */
  windowOpen: boolean;
  /** The approved template for this step, or null. */
  template: { name: string; params: string[] } | null;
  /** Never from the business number: the owner chose "from your phone" for this one. */
  phoneOnly?: boolean;
};
export type SendPath = "session" | "template" | "phone";

export type CardActionKind = "message" | "mark_call" | "notes" | "summary" | "precall" | "thanks" | "paid" | "onboard" | "link";

export type CardAction = {
  /** Stable: which ACTIONS entry made it. */
  id: string;
  kind: CardActionKind;
  /** Button text. */
  label: string;
  step: StepKey;
  /** Why this, in his terms. */
  reason: string;
  send?: SendPlan;
  /** Recorded (POST /api/admin/journey-mark) when his click succeeds, on any path. */
  mark?: MarkKind;
  href?: string;
  /** summary: the PDF made earlier, to review before sending. */
  pdfUrl?: string;
  /** A line under the button. */
  note?: string;
  /** The kit's danger variant: overdue. */
  danger?: boolean;
  /** The lib/journey item this answers. */
  queueKind?: ActionKind;
};

export type ClientCard = {
  key: string;
  name: string;
  phone: string;
  email: string;
  stage: Stage;
  stageLabel: string;
  /** One line under her name: "Call today, 7:00 pm", "Attended yesterday". */
  context: string;
  status: { tone: PillTone; label: string };
  steps: JourneyStep[];
  primary: CardAction | null;
  secondary: CardAction[];
  urgency: Urgency;
  /** Sort key, lower first. See rankOf. */
  rank: number;
  reason: string;
  /** The call this card is about, ISO. Dates her notes Doc and her summary. "" without one. */
  callAt: string;
  bookingUid: string;
  /** The 30-minute target for her summary, from the END of her call. */
  summaryDue: { at: string; overdue: boolean } | null;
  report: { url: string; count: number; mediaId?: string } | null;
  /** wa.me for the quiet WhatsApp link. */
  wa: string;
  /** The drop-off funnel (Today): the furthest of Lead … Paid she reached. */
  drop: DropKey;
  /** The journey funnel (Pipeline): lib/journey's stages she reached. */
  reached: FunnelStage[];
  /** Her first sheet row: the funnel cohort. */
  firstLeadAt: string | null;
  paidAsk: PaidAsk | null;
  badge: Badge | null;
};

// ── Small pure helpers ──────────────────────────────────────────────────────

const ms = (iso: string | null | undefined): number => {
  const t = Date.parse(String(iso ?? ""));
  return Number.isFinite(t) ? t : NaN;
};
const finite = (n: number) => Number.isFinite(n);
const firstFinite = (...xs: number[]) => xs.find(finite) ?? NaN;
const digits10 = (s: string) => String(s ?? "").replace(/\D/g, "").slice(-10);

const istDay = (t: number) => Math.floor((t + IST_OFFSET_MS) / DAY);
/** IST midnight starting the day `t` falls on. */
const istDayStart = (t: number) => istDay(t) * DAY - IST_OFFSET_MS;
/** Both on the same day of his calendar. */
export const sameIstDay = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && istDay(a) === istDay(b);

// Built once per isolate: constructing a formatter costs far more than using
// one, and the crm feed builds a card for every woman (Workers Free: 10 ms CPU).
let timeFmt: Intl.DateTimeFormat | null = null;
let dateFmt: Intl.DateTimeFormat | null = null;
let rupeeFmt: Intl.NumberFormat | null = null;
// And each answer is kept: a screen has a few dozen distinct days and minutes,
// asked about several times per card. Bounded, so an isolate never grows them.
const clockSeen = new Map<number, string>();
const daySeen = new Map<number, string>();
const remember = (seen: Map<number, string>, key: number, make: () => string) => {
  let v = seen.get(key);
  if (v === undefined) {
    if (seen.size > 2000) seen.clear();
    v = make();
    seen.set(key, v);
  }
  return v;
};
const clock = (t: number) =>
  remember(clockSeen, Math.floor(t / MIN), () =>
    (timeFmt ??= new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }))
      .format(t)
      .toLowerCase(),
  );
const dateLabel = (t: number) =>
  remember(daySeen, istDay(t), () =>
    (dateFmt ??= new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" })).format(t),
  );
export const inr = (n: number) => "₹" + (rupeeFmt ??= new Intl.NumberFormat("en-IN")).format(Math.round(n));

/** "today", "yesterday", "tomorrow", or "Thu 13 Nov". */
export function dayWord(t: number, now: number): string {
  const d = istDay(t) - istDay(now);
  if (d === 0) return "today";
  if (d === -1) return "yesterday";
  if (d === 1) return "tomorrow";
  return dateLabel(t);
}

/** "12 min", "2 hr", "3 days". */
export function span(msLeft: number): string {
  const m = Math.max(0, Math.round(msLeft / MIN));
  if (m < 120) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hr`;
  return `${Math.round(h / 24)} days`;
}

/** Her 24-hour reply window in minutes, the way lib/summary replyWindow and the inbox measure it. */
export function windowMinutesLeft(lastIn: number, now: number): number {
  if (!lastIn || !finite(lastIn)) return 0;
  return Math.round(Math.max(0, lastIn + WINDOW_MS - now) / MIN);
}

const EMPTY_INBOX: InboxStats = { lastIn: 0, lastOut: 0, lastManualOut: 0, lastFailed: 0, lastReminder: 0 };

/** Every phone's thread times, in one pass. Keyed by the last 10 digits. */
export function inboxStats(events: InboxEvent[]): Map<string, InboxStats> {
  const out = new Map<string, InboxStats>();
  for (const e of events) {
    const phone = digits10(e.phone);
    const t = ms(e.at);
    if (phone.length !== 10 || !finite(t)) continue;
    const s = out.get(phone) ?? { ...EMPTY_INBOX };
    if (e.dir === "in") s.lastIn = Math.max(s.lastIn, t);
    else if (e.failed) s.lastFailed = Math.max(s.lastFailed, t);
    else {
      s.lastOut = Math.max(s.lastOut, t);
      if (e.manual) s.lastManualOut = Math.max(s.lastManualOut, t);
      if (e.template === TEMPLATE_FOR.reminder.name) s.lastReminder = Math.max(s.lastReminder, t);
    }
    out.set(phone, s);
  }
  return out;
}

// ── From a journey to the facts ─────────────────────────────────────────────

const num = (s: string | undefined): number | null => {
  const n = Number(String(s ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** lib/journey's Reached as a list, furthest last. */
export const reachedList = (r: Reached): FunnelStage[] => FUNNEL_STAGES.filter((s) => !!r[s]);

export function factsOf(j: Journey, ctx: CardContext): CardFacts {
  const phone = digits10(j.phone);
  const b = j.booking;
  const c = j.call;
  const q = ctx.queue?.get(j.id) ?? null;
  const call = c
    ? {
        attended: c.attended,
        occurredAt: c.occurredAt,
        pricePitched: c.pricePitched ?? null,
        amountAgreed: num(c.detail?.amountAgreed),
        namedPrice: c.scorecard?.[NAMED_PRICE_CHECK] === true,
      }
    : null;
  const quoted = call?.amountAgreed ?? call?.pricePitched ?? null;
  const report = phone ? ctx.reports?.get(phone) ?? null : null;
  return {
    key: j.id,
    name: j.name,
    phone: phone.length === 10 ? phone : "",
    email: j.email,
    stage: j.state,
    reached: j.reached,
    firstLeadAt: j.firstLeadAt,
    booking: b ? { uid: b.uid, startAt: b.startAt, createdAt: b.createdAt, cancelled: b.cancelled } : null,
    call,
    won: j.won,
    agreedButUnpaid: j.agreedButUnpaid,
    report: report ? { url: report.url, count: report.count, savedAt: report.savedAt, mediaId: report.mediaId } : null,
    marks: (phone && ctx.marks?.get(phone)) || {},
    inbox: (phone && ctx.inbox?.get(phone)) || EMPTY_INBOX,
    action: q?.item ?? null,
    queueIndex: q ? q.index : -1,
    draft: ctx.drafts?.get(j.id) ?? null,
    payLink: quoted && ctx.payLink ? ctx.payLink(quoted) : null,
    templates: ctx.templates ?? { followups: false, reminder: false },
    paidAsk: ctx.paidAsk?.get(j.id) ?? null,
    badge: ctx.badges?.get(j.id) ?? null,
  };
}

// ── Times every rule reads ──────────────────────────────────────────────────

/** Her call's start: the booking's slot, else when the call was recorded. */
export function callStartOf(f: Pick<CardFacts, "booking" | "call">): number {
  return firstFinite(ms(f.booking?.startAt), ms(f.call?.occurredAt));
}
export const callEndOf = (start: number) => start + CALL_MINUTES * MIN;
export const summaryDueAt = (start: number) => callEndOf(start) + SUMMARY_TARGET_MIN * MIN;
/** IST midnight of day N after the day of her call. */
export const followUpDueAt = (callStart: number, n: 1 | 2 | 3) => istDayStart(callStart) + FOLLOW_UP_DAYS[n - 1] * DAY;

/**
 * A mark counts for THIS call only from this point on. One row per woman and
 * kind is kept, so a summary sent for her first call must not tick the
 * summary of her second.
 */
function markFor(f: CardFacts, kind: MarkKind, start: number): Mark | undefined {
  const m = f.marks[kind];
  if (!m || !finite(m.at)) return undefined;
  switch (kind) {
    case "onboarded":
      return m;
    case "notes_made":
      // He may open the Doc the day before, to read her answers.
      return finite(start) && m.at >= start - DAY ? m : undefined;
    case "precall_made":
    case "precall_sent": {
      const from = firstFinite(ms(f.booking?.createdAt), start - 14 * DAY);
      return finite(from) && m.at >= from ? m : undefined;
    }
    default:
      return finite(start) && m.at >= start ? m : undefined;
  }
}

/** She replied on WhatsApp after her booking was made (the confirmation goes then). */
function confirmed(f: CardFacts): boolean {
  const made = ms(f.booking?.createdAt);
  return finite(made) && f.inbox.lastIn > made;
}

/**
 * She joined THIS call: the booking her card is about. Not lib/journey's
 * furthest stage, which a first call she attended keeps true while her second
 * booking is still ahead of her, and which must not make a summary due for a
 * call that has not happened.
 */
const heldThisCall = (f: CardFacts) => f.call?.attended === true;
const POST_CALL: readonly Stage[] = ["attended", "pitched", "lost", "won", "nurture"];
/** The Call step on the strip: this call held, or she is past calls and one was held. */
const callDone = (f: CardFacts) => heldThisCall(f) || (POST_CALL.includes(f.stage) && !!f.reached.attended);
/** A price was named on this call (lib/crm-stage's own test for "pitched"). */
const priced = (f: CardFacts) =>
  (f.call?.pricePitched ?? 0) > 0 || !!f.call?.namedPrice || f.stage === "pitched" || f.stage === "lost";
const quotedOf = (f: CardFacts) => f.call?.amountAgreed ?? f.call?.pricePitched ?? null;
/** Booked, not cancelled, and `t` still ahead. */
const upcoming = (f: CardFacts, t: number, now: number) =>
  f.stage === "booked" && !!f.booking && !f.booking.cancelled && finite(t) && now < t;

/**
 * His notes exist for this call. A summary can only be made from them, so a
 * summary made or sent proves them too.
 */
const notesDone = (f: CardFacts, start: number) =>
  !!(markFor(f, "notes_made", start) || markFor(f, "summary_made", start) || markFor(f, "summary_sent", start));

/**
 * In the review queue: attended, his notes Doc made for this call, her summary
 * not sent, and recent. The notes mark is the gate on purpose: marks start the
 * day this ships, so a call from before then (summary sent the old way, no
 * mark) never turns up overdue.
 */
// Every rule below asks these two questions of the same facts several times
// per card; the crm feed builds a card for every woman (Workers Free: 10 ms CPU).
const reviewMemo = new WeakMap<CardFacts, { now: number; value: ReturnType<typeof reviewOf> }>();
const followMemo = new WeakMap<CardFacts, { now: number; value: FollowUpState | null }>();

function reviewState(f: CardFacts, now: number) {
  const hit = reviewMemo.get(f);
  if (hit && hit.now === now) return hit.value;
  const value = reviewOf(f, now);
  reviewMemo.set(f, { now, value });
  return value;
}

function reviewOf(f: CardFacts, now: number) {
  const start = callStartOf(f);
  if (!finite(start) || !heldThisCall(f) || !notesDone(f, start)) return null;
  if (markFor(f, "summary_sent", start)) return null;
  if (now - callEndOf(start) > REVIEW_WINDOW_DAYS * DAY) return null;
  const due = summaryDueAt(start);
  return { due, overdue: now > due, made: markFor(f, "summary_made", start) };
}

type FollowUpState = {
  due: { n: 1 | 2 | 3; at: number } | null;
  next: { n: 1 | 2 | 3; at: number } | null;
  sent: number;
  stopped: "" | "replied" | "paid";
};

/**
 * Day 1, 3 and 7 after a priced, unpaid call. Only the newest one that is due
 * is offered: two follow-ups the same morning, because one was missed, read as
 * a blast. A follow-up is sent when its mark is recorded, or when he wrote to
 * her by hand after it fell due. They stop the moment she replies after the
 * pitch, or pays.
 */
export function followUpsOf(f: CardFacts, now: number): FollowUpState | null {
  const hit = followMemo.get(f);
  if (hit && hit.now === now) return hit.value;
  const value = followUpsFor(f, now);
  followMemo.set(f, { now, value });
  return value;
}

function followUpsFor(f: CardFacts, now: number): FollowUpState | null {
  const start = callStartOf(f);
  if (f.won) return { due: null, next: null, sent: 0, stopped: "paid" };
  if (!finite(start) || !heldThisCall(f) || !priced(f)) return null;
  // Lost is lib/crm-stage's seven days, and the day-7 follow-up falls on that
  // edge: it stays offered on a lost card until the action window closes.
  if (f.stage !== "pitched" && f.stage !== "lost") return null;
  if (now - start > REVIEW_WINDOW_DAYS * DAY) return null;
  const ns = [1, 2, 3] as const;
  const at = ns.map((n) => followUpDueAt(start, n));
  const sentN = ns.map((n, i) => !!markFor(f, `followup_${n}`, start) || f.inbox.lastManualOut >= at[i]);
  const sent = sentN.filter(Boolean).length;
  if (f.inbox.lastIn > callEndOf(start)) return { due: null, next: null, sent, stopped: "replied" };
  let due: FollowUpState["due"] = null;
  for (let i = ns.length - 1; i >= 0; i--) {
    if (at[i] > now) continue;
    // A later one already sent makes the earlier ones stale, not due.
    if (!sentN[i] && !sentN.slice(i + 1).some(Boolean)) due = { n: ns[i], at: at[i] };
    break;
  }
  const nextI = at.findIndex((t, i) => t > now && !sentN[i]);
  return { due, next: nextI >= 0 ? { n: ns[nextI], at: at[nextI] } : null, sent, stopped: "" };
}

// ── Drafts. Plain, short, nothing she did not tell him. ─────────────────────

export function followUpText(n: 1 | 2 | 3, o: { name: string; amount: number | null; link: string | null; summarySent: boolean }): string {
  const hi = `Hi ${firstName(o.name)},`;
  const price = o.amount ? inr(o.amount) : "";
  const pay = (lead: string) =>
    price ? (o.link ? `${lead} ${price}, and you can pay here: ${o.link}` : `${lead} ${price}. Reply here and I will send you the payment link.`) : "";
  if (n === 1) {
    return [
      `${hi} thank you for our call.`,
      o.summarySent ? "Your summary has the plan we made for you." : "",
      price ? pay("When you are ready to start, the programme is") : "Reply here when you are ready to start, or with any question.",
    ].filter(Boolean).join(" ");
  }
  if (n === 2) {
    return [
      `${hi} checking in about the programme. If anything is holding you back, tell me and I will answer it honestly.`,
      price ? pay("To start, it is") : "",
    ].filter(Boolean).join(" ");
  }
  return [
    `${hi} this is my last check-in about the programme. If now is not the right time, that is completely fine.`,
    price ? pay("If you want to start, it is") : "Reply here whenever you want to start.",
  ].join(" ");
}

export function payLinkText(o: { name: string; amount: number | null; link: string | null }): string {
  const hi = `Hi ${firstName(o.name)},`;
  if (o.amount && o.link) return `${hi} thank you for saying yes on our call. Here is the link to start the programme, ${inr(o.amount)}: ${o.link}`;
  if (o.amount) return `${hi} thank you for saying yes on our call. Reply here and I will send the payment link for the programme, ${inr(o.amount)}.`;
  return `${hi} thank you for saying yes on our call. Reply here and I will send the payment link.`;
}

export function welcomeText(name: string): string {
  return `Hi ${firstName(name)}, welcome to the programme. I am setting up your plan and will send your start details here.`;
}

export function reminderText(name: string, start: number): string {
  return `Hi ${firstName(name)}, a reminder of your free call with me on ${dateLabel(start)} at ${clock(start)}. Please reply here to confirm, and send your blood report if you have one.`;
}

/** How his one click sends this. */
export function sendPath(p: SendPlan): SendPath {
  if (p.phoneOnly) return "phone";
  if (p.windowOpen && p.text) return "session";
  if (p.template) return "template";
  return "phone";
}

// ── The steps on the card ───────────────────────────────────────────────────

export type StepKey = "lead" | "confirm" | "report" | "call" | "summary" | "paid" | "onboard";

/** `passed`: not done, but its moment has gone, so the strip does not point at it. */
type Eval = { done?: boolean; missed?: boolean; passed?: boolean; hint?: string };
type Ctx = { now: number; start: number };

export type StepDef = {
  key: StepKey;
  label: string;
  /** Order on the strip. Gaps of 10 so a new step slots between two without renumbering. */
  position: number;
  /** Skipped when computing "current": she can pass it without doing it. */
  optional?: boolean;
  /** Absent = always shown. */
  show?: (f: CardFacts) => boolean;
  evaluate: (f: CardFacts, c: Ctx) => Eval;
};

export const STEPS: readonly StepDef[] = [
  {
    key: "lead",
    label: "Lead",
    position: 10,
    evaluate: (f, c) => {
      const t = ms(f.firstLeadAt);
      return { done: true, hint: finite(t) ? `Came in ${dayWord(t, c.now)}` : "Booked directly" };
    },
  },
  {
    key: "confirm",
    label: "Confirm",
    position: 20,
    evaluate: (f, c) => {
      if (!f.booking) return { hint: f.action?.kind === "paid_not_booked" ? "Paid, no slot yet" : "Not booked yet" };
      if (confirmed(f)) return { done: true, hint: `Replied ${dayWord(f.inbox.lastIn, c.now)}` };
      // Coming to the call is the strongest confirmation there is.
      if (callDone(f) || f.won) return { done: true, hint: "Came to the call" };
      if (f.booking.cancelled) return { passed: true, hint: "Cancelled" };
      // Once her slot has started, the call itself is the question, not the reply.
      if (finite(c.start) && c.now >= c.start) return { passed: true, hint: "No reply" };
      return { hint: "No reply yet" };
    },
  },
  {
    key: "report",
    label: "Report",
    position: 30,
    // His own ads say reports are optional (lib/crm-milestones): never "missed".
    optional: true,
    evaluate: (f, c) => {
      const pre = markFor(f, "precall_sent", c.start) ? " · pre-call sent" : markFor(f, "precall_made", c.start) ? " · pre-call made" : "";
      if (f.report) return { done: true, hint: `In Drive${f.report.count > 1 ? ` (${f.report.count})` : ""}${pre}` };
      return { hint: callDone(f) ? "None sent" : "Not in yet" };
    },
  },
  {
    key: "call",
    label: "Call",
    position: 40,
    evaluate: (f, c) => {
      const s = c.start;
      // Her latest booking decides: a no-show on a second call is a no-show,
      // whatever happened on the first.
      if (f.stage === "no_show") return { missed: true, hint: finite(s) ? `No-show ${dayWord(s, c.now)}` : "No-show" };
      if (f.stage === "cancelled") return { missed: true, hint: "Cancelled" };
      if (callDone(f)) {
        const thanks = markFor(f, "thank_you_sent", s) ? " · thanked" : "";
        return { done: true, hint: `${finite(s) ? `Attended ${dayWord(s, c.now)}` : "Attended"}${thanks}` };
      }
      if (!f.booking || !finite(s)) return {};
      if (c.now < s) return { hint: `${dayWord(s, c.now)}, ${clock(s)}` };
      if (c.now < callEndOf(s)) return { hint: "Now" };
      return { hint: "Mark if she joined" };
    },
  },
  {
    key: "summary",
    label: "Summary",
    position: 50,
    evaluate: (f, c) => {
      const sent = markFor(f, "summary_sent", c.start);
      if (sent) return { done: true, hint: `Sent ${dayWord(sent.at, c.now)}, ${clock(sent.at)}` };
      const r = reviewState(f, c.now);
      if (r) {
        const made = r.made ? "Made, not sent · " : "";
        return r.overdue
          ? { missed: true, hint: `${made}Overdue ${span(c.now - r.due)}` }
          : { hint: `${made}Due in ${span(r.due - c.now)}` };
      }
      return heldThisCall(f) && !notesDone(f, c.start) && c.now - callEndOf(c.start) <= NOTES_AFTER_HOURS * HOUR
        ? { hint: "Notes first" }
        : {};
    },
  },
  {
    key: "paid",
    label: "Paid",
    position: 60,
    evaluate: (f, c) => {
      if (f.won) {
        const t = ms(f.reached.won?.at);
        return { done: true, hint: finite(t) ? `Paid ${dayWord(t, c.now)}` : "Paid" };
      }
      if (f.agreedButUnpaid) return { hint: "Said yes, no payment" };
      if (f.stage === "lost") return { hint: "No payment" };
      const fu = followUpsOf(f, c.now);
      if (fu && fu.sent > 0) return { hint: `Follow-up ${fu.sent} of 3 sent` };
      const q = quotedOf(f);
      return q ? { hint: `Quoted ${inr(q)}` } : priced(f) ? { hint: "Priced" } : {};
    },
  },
  {
    key: "onboard",
    label: "Onboard",
    position: 70,
    show: (f) => f.won,
    evaluate: (f, c) => {
      const m = f.marks.onboarded;
      return m ? { done: true, hint: `Onboarded ${dayWord(m.at, c.now)}` } : { hint: "Not yet" };
    },
  },
];

/** STEPS in strip order, sorted once. */
const ORDERED_STEPS: readonly StepDef[] = [...STEPS].sort((a, b) => a.position - b.position);

/**
 * The strip. A step is done or missed on its own evidence, and "current" is
 * where she is now: the first required step after the furthest one she has
 * done. When that furthest step is a miss (a no-show, a summary past its 30
 * minutes) the miss IS where she is, so it is the current step, its hint says
 * what went wrong, and the strip never points past it ("Next: Report" on a
 * no-show sent him the wrong way). "missed" is left for a miss she has moved
 * beyond: paid, and her summary never went. Anything optional she skipped,
 * like a report, stays todo.
 */
export function stepsOf(f: CardFacts, now: number): JourneyStep[] {
  const c: Ctx = { now, start: callStartOf(f) };
  const defs = ORDERED_STEPS.filter((s) => !s.show || s.show(f));
  const evals = defs.map((d) => d.evaluate(f, c));
  let frontier = -1;
  evals.forEach((e, i) => {
    if (e.done || e.missed) frontier = i;
  });
  let current = -1;
  if (frontier >= 0 && evals[frontier].missed) current = frontier;
  else {
    for (let i = frontier + 1; i < defs.length; i++) {
      if (defs[i].optional || evals[i].done || evals[i].passed) continue;
      current = i;
      break;
    }
  }
  return defs.map((d, i) => {
    const e = evals[i];
    const state: StepState = i === current ? "current" : e.done ? "done" : e.missed ? "missed" : "todo";
    return { key: d.key, label: d.label, state, ...(e.hint ? { hint: e.hint } : {}) };
  });
}

// ── The actions, in precedence order ────────────────────────────────────────

/** The verb on a lib/journey item's button: what to DO, not which app opens. */
export const ACTION_VERB: Record<ActionKind, string> = {
  rebook_cancelled: "Offer new times",
  rebook_no_show: "Offer new times",
  mark_call: "Did she join?",
  send_price: "Send the price",
  follow_up: "Ask for her decision",
  agreed_unpaid: "Send payment link",
  paid_not_booked: "Send booking link",
  first_message: "Send first message",
  hot_abandon: "Nudge her",
};

type ActionDef = {
  id: string;
  /** Never the primary: the owner wants it one tap away, not in front. */
  secondaryOnly?: boolean;
  build: (f: CardFacts, now: number) => CardAction | null;
};

const waPlain = (phone: string) => (phone ? `https://wa.me/91${phone}` : "");

function plan(f: CardFacts, now: number, text: string, template: SendPlan["template"] = null, phoneOnly = false): SendPlan {
  return {
    text,
    wa: f.phone ? (text ? draftWaLink(f.phone, text) || waPlain(f.phone) : waPlain(f.phone)) : "",
    windowOpen: windowMinutesLeft(f.inbox.lastIn, now) > 0,
    template,
    ...(phoneOnly ? { phoneOnly: true } : {}),
  };
}

const noLinkNote = (f: CardFacts) => {
  const q = quotedOf(f);
  return q && !f.payLink ? `Add your Cashfree link for ${inr(q)} under Payment links, and it goes in this message.` : undefined;
};

/** Her lib/journey item's words: drafted from her quiz on Today, none on Pipeline (then wa.me opens empty). */
const queueSend = (f: CardFacts, now: number) => plan(f, now, f.draft?.text ?? "");

export const ACTIONS: readonly ActionDef[] = [
  {
    id: "summary",
    build: (f, now) => {
      const r = reviewState(f, now);
      if (!r) return null;
      return {
        id: "summary",
        kind: "summary",
        label: "Review and send summary",
        step: "summary",
        reason: r.made
          ? `Her summary is made${r.overdue ? ` and was due ${span(now - r.due)} ago` : ""}. Look it over, then send it.`
          : r.overdue
            ? `Her call ended ${span(now - callEndOf(callStartOf(f)))} ago. The summary was due ${span(now - r.due)} ago.`
            : `Her notes are in. The summary is due in ${span(r.due - now)}.`,
        ...(r.made?.url ? { pdfUrl: r.made.url } : {}),
        send: plan(f, now, ""),
        mark: "summary_sent",
        ...(r.overdue ? { danger: true } : {}),
      };
    },
  },
  {
    id: "mark_call",
    build: (f, now) => {
      if (!f.booking || f.booking.cancelled) return null;
      const start = callStartOf(f);
      const onList = f.action?.kind === "mark_call";
      const justEnded = f.stage === "booked" && finite(start) && now >= callEndOf(start) && f.call?.attended == null;
      if (!onList && !justEnded) return null;
      return {
        id: "mark_call",
        kind: "mark_call",
        label: "Did she join?",
        step: "call",
        reason: onList ? ACTION_LABEL.mark_call : "Her call has ended. Say whether she joined, and her summary comes next.",
        ...(onList ? { queueKind: "mark_call" as const } : {}),
      };
    },
  },
  {
    id: "notes_live",
    build: (f, now) => {
      const start = callStartOf(f);
      if (!upcoming(f, start + CALL_MINUTES * MIN, now) || now < start - NOTES_LEAD_MIN * MIN) return null;
      return {
        id: "notes_live",
        kind: "notes",
        label: "Open notes",
        step: "call",
        reason: now < start ? `Her call is at ${clock(start)}. Type into the Doc as you talk.` : "She is on the call now. Type into the Doc as you talk.",
      };
    },
  },
  {
    id: "rebook",
    build: (f, now) => {
      const k = f.action?.kind;
      if (k !== "rebook_cancelled" && k !== "rebook_no_show") return null;
      return { id: "rebook", kind: "message", label: ACTION_VERB[k], step: "call", reason: ACTION_LABEL[k], send: queueSend(f, now), queueKind: k };
    },
  },
  {
    id: "notes_after",
    build: (f, now) => {
      const start = callStartOf(f);
      if (!finite(start) || !heldThisCall(f) || notesDone(f, start)) return null;
      if (now - callEndOf(start) > NOTES_AFTER_HOURS * HOUR) return null;
      return { id: "notes_after", kind: "notes", label: "Open notes", step: "summary", reason: "Fill in her notes Doc, and her summary can be made from it." };
    },
  },
  {
    id: "pay_link",
    build: (f, now) => {
      if (f.action?.kind !== "agreed_unpaid" || markFor(f, "followup_1", callStartOf(f))) return null;
      const note = noLinkNote(f);
      return {
        id: "pay_link",
        kind: "message",
        label: ACTION_VERB.agreed_unpaid,
        step: "paid",
        reason: ACTION_LABEL.agreed_unpaid,
        // Her first follow-up, sent straight away rather than on day 1.
        send: plan(f, now, payLinkText({ name: f.name, amount: quotedOf(f), link: f.payLink })),
        mark: "followup_1",
        queueKind: "agreed_unpaid",
        ...(note ? { note } : {}),
      };
    },
  },
  {
    id: "send_price",
    build: (f, now) =>
      f.action?.kind === "send_price"
        ? { id: "send_price", kind: "message", label: ACTION_VERB.send_price, step: "paid", reason: ACTION_LABEL.send_price, send: queueSend(f, now), queueKind: "send_price" }
        : null,
  },
  {
    id: "followup",
    build: (f, now) => {
      if (f.agreedButUnpaid && !markFor(f, "followup_1", callStartOf(f))) return null;
      const fu = followUpsOf(f, now);
      if (!fu?.due) return null;
      const n = fu.due.n;
      const day = FOLLOW_UP_DAYS[n - 1];
      const kind = `followup_${n}` as const;
      const tpl = TEMPLATE_FOR[kind];
      const text = followUpText(n, {
        name: f.name,
        amount: quotedOf(f),
        link: f.payLink,
        summarySent: !!markFor(f, "summary_sent", callStartOf(f)),
      });
      // The template carries the link in {{2}}: without one there is nothing to send it with.
      const template = f.templates.followups && f.payLink ? { name: tpl.name, params: [firstName(f.name), f.payLink] } : null;
      const note = noLinkNote(f);
      return {
        id: "followup",
        kind: "message",
        label: `Send follow-up (day ${day})`,
        step: "paid",
        reason: `Follow-up ${n} of 3, day ${day} after her call. She has not replied or paid.`,
        send: plan(f, now, text, template),
        mark: kind,
        ...(f.action?.kind === "follow_up" ? { queueKind: "follow_up" as const } : {}),
        ...(note ? { note } : {}),
      };
    },
  },
  {
    id: "replied",
    build: (f, now) => {
      const fu = followUpsOf(f, now);
      if (fu?.stopped !== "replied" || windowMinutesLeft(f.inbox.lastIn, now) <= 0) return null;
      return { id: "replied", kind: "link", label: "Reply in the inbox", step: "paid", href: "/inbox", reason: "She wrote back after the call. Her window is open, so answer her from the business number." };
    },
  },
  {
    id: "precall",
    build: (f, now) => {
      const start = callStartOf(f);
      if (!upcoming(f, start, now) || now >= start - NOTES_LEAD_MIN * MIN || !f.report) return null;
      if (markFor(f, "precall_sent", start)) return null;
      return { id: "precall", kind: "precall", label: "Make pre-call PDF", step: "report", reason: `Her report is in. Make her pre-call PDF before the call ${dayWord(start, now)}.` };
    },
  },
  {
    id: "reminder",
    build: (f, now) => {
      const start = callStartOf(f);
      if (!upcoming(f, start, now) || confirmed(f) || start - now > REMINDER_WITHIN_HOURS * HOUR) return null;
      const made = ms(f.booking?.createdAt);
      if (finite(made) && (f.inbox.lastManualOut > made || f.inbox.lastReminder > made)) return null;
      const tpl = TEMPLATE_FOR.reminder;
      const template = f.templates.reminder ? { name: tpl.name, params: [firstName(f.name), `${dateLabel(start)}, ${clock(start)}`] } : null;
      return {
        id: "reminder",
        kind: "message",
        label: "Send reminder",
        step: "confirm",
        reason: `She has not replied since she booked, and her call is in ${span(start - now)}.`,
        send: plan(f, now, reminderText(f.name, start), template),
      };
    },
  },
  {
    id: "notes_today",
    build: (f, now) => {
      const start = callStartOf(f);
      if (!upcoming(f, start, now) || istDay(start) !== istDay(now)) return null;
      return { id: "notes_today", kind: "notes", label: "Open notes", step: "call", reason: `Her call is today at ${clock(start)}. Her notes Doc is ready when you are.` };
    },
  },
  {
    id: "lead_nudge",
    build: (f, now) => {
      const k = f.action?.kind;
      if (k !== "first_message" && k !== "hot_abandon" && k !== "paid_not_booked") return null;
      return { id: "lead_nudge", kind: "message", label: ACTION_VERB[k], step: k === "paid_not_booked" ? "confirm" : "lead", reason: ACTION_LABEL[k], send: queueSend(f, now), queueKind: k };
    },
  },
  {
    id: "onboard",
    build: (f) =>
      f.won && !f.marks.onboarded
        ? { id: "onboard", kind: "onboard", label: "Mark onboarded", step: "onboard", reason: "She paid. Mark her onboarded once she has her start details.", mark: "onboarded" }
        : null,
  },
  {
    id: "paid_ask",
    build: (f) =>
      f.paidAsk && !f.won
        ? { id: "paid_ask", kind: "paid", label: "Did she pay?", step: "paid", reason: "No programme payment is recorded since her call. If it came by UPI or bank transfer, mark it here." }
        : null,
  },
  {
    id: "thanks",
    secondaryOnly: true,
    build: (f, now) => {
      const start = callStartOf(f);
      if (!finite(start) || !heldThisCall(f) || markFor(f, "thank_you_sent", start)) return null;
      if (now - callEndOf(start) > THANKS_WITHIN_HOURS * HOUR) return null;
      return { id: "thanks", kind: "thanks", label: "Say thanks", step: "call", reason: "A thank-you for her time on the call.", mark: "thank_you_sent" };
    },
  },
  {
    id: "welcome",
    secondaryOnly: true,
    // Onboarding sends nothing by itself (owner, 10-Nov): this only opens his phone.
    build: (f, now) =>
      f.won && !f.marks.onboarded && f.phone
        ? { id: "welcome", kind: "message", label: "Welcome from your phone", step: "onboard", reason: "A welcome in your own words.", send: plan(f, now, welcomeText(f.name), null, true) }
        : null,
  },
];

// ── Rank, urgency, status, context ──────────────────────────────────────────

/**
 * Lower first. 0 an overdue summary; 1 what is happening around a call right
 * now; 2 lib/journey's list, in ITS order (oldest wait first), so the card
 * order and every tab's list agree; 3 the other things due today; 4 calls
 * still to come; 5 only the payment question open; 6 nothing to do yet.
 */
function rankOf(f: CardFacts, primary: CardAction | null, now: number): { rank: number; urgency: Urgency } {
  const id = primary?.id ?? "";
  if (id === "summary") return primary?.danger ? { rank: 0, urgency: "now" } : { rank: 1, urgency: "now" };
  if (id === "notes_live" || (id === "mark_call" && f.stage === "booked")) return { rank: 1, urgency: "now" };
  if (f.queueIndex >= 0 && primary) {
    return { rank: 2 + Math.min(f.queueIndex, 999) / 1000, urgency: f.action?.overdue ? "now" : "today" };
  }
  if (id === "paid_ask") return { rank: 5, urgency: "soon" };
  if (primary) return { rank: 3, urgency: "today" };
  if (upcoming(f, callStartOf(f), now)) return { rank: 4, urgency: "soon" };
  return { rank: 6, urgency: "none" };
}

function statusOf(f: CardFacts, primary: CardAction | null, now: number): { tone: PillTone; label: string } {
  const start = callStartOf(f);
  if (f.inbox.lastFailed && f.inbox.lastFailed > f.inbox.lastOut) return { tone: "failed", label: "Message not delivered" };
  const r = reviewState(f, now);
  if (r?.overdue) return { tone: "attention", label: `Summary overdue ${span(now - r.due)}` };
  // Nothing for him to do until a follow-up falls due: say when, rather than
  // an amber "waiting" over a card with no button on it.
  const fu = primary ? null : followUpsOf(f, now);
  if (fu?.next) return { tone: "progress", label: `Follow-up ${fu.next.n} ${dayWord(fu.next.at, now)}` };
  if (f.action?.overdue) return { tone: "attention", label: `Waiting ${waitLabel(f.action.waitMin)}` };
  if (f.agreedButUnpaid && !f.won) return { tone: "attention", label: "Agreed, not paid" };
  if (f.stage === "no_show") return { tone: "attention", label: "No-show" };
  if (f.stage === "cancelled") return { tone: "attention", label: "Cancelled" };
  if (upcoming(f, start, now) && !confirmed(f) && start - now <= REMINDER_WITHIN_HOURS * HOUR) return { tone: "attention", label: "Not confirmed" };
  if (r) return { tone: "progress", label: `Summary due in ${span(r.due - now)}` };
  if (f.stage === "booked" && finite(start) && now >= start && now < callEndOf(start)) return { tone: "progress", label: "On the call" };
  if (upcoming(f, start, now) && start - now <= NOTES_LEAD_MIN * MIN) return { tone: "progress", label: `Starts in ${span(start - now)}` };
  switch (primary?.id) {
    case "mark_call":
      return { tone: "progress", label: "Mark the call" };
    case "followup":
      return { tone: "progress", label: "Follow-up due" };
    case "notes_after":
      return { tone: "progress", label: "Notes first" };
    case "precall":
      return { tone: "progress", label: "Report in" };
    case "replied":
      return { tone: "progress", label: "She replied" };
    case "paid_ask":
      return { tone: "progress", label: "Payment not marked" };
    case "notes_today":
      return { tone: "progress", label: `Call ${clock(start)}` };
    default:
      break;
  }
  if (f.action) return { tone: "progress", label: `Waiting ${waitLabel(f.action.waitMin)}` };
  if (f.won) return { tone: "ok", label: f.marks.onboarded ? "Onboarded" : "Paid" };
  if (upcoming(f, start, now)) return confirmed(f) ? { tone: "ok", label: "Confirmed" } : { tone: "progress", label: `Call ${dayWord(start, now)}` };
  // Lost and nurture are outcomes, not faults: neutral, the way tokens.ts keeps every outcome but Won.
  if (f.stage === "lost" || f.stage === "nurture") return { tone: "neutral", label: STAGE_LABEL[f.stage] };
  return primary ? { tone: "progress", label: "To do" } : { tone: "neutral", label: "Nothing owed" };
}

/** The one line under her name. */
export function contextLine(f: CardFacts, now: number): string {
  const s = callStartOf(f);
  const when = finite(s) ? `${dayWord(s, now)}, ${clock(s)}` : "";
  const q = quotedOf(f);
  switch (f.stage) {
    case "booked": {
      if (!finite(s)) return "Call booked";
      if (now >= callEndOf(s)) return `Call ended ${span(now - callEndOf(s))} ago`;
      if (now >= s) return `On the call now, since ${clock(s)}`;
      const rep = f.report && f.report.savedAt && now - f.report.savedAt < DAY ? `Report arrived ${span(now - f.report.savedAt)} ago · ` : "";
      return `${rep}Call ${when}`;
    }
    case "unknown":
      return when ? `Call was ${when}` : "Call slot passed";
    case "attended":
      return finite(s) ? `Attended ${dayWord(s, now)}` : "Attended";
    case "pitched":
      return `${q ? `Pitched ${inr(q)}` : "Pitched"}${finite(s) ? `, ${dayWord(s, now)}` : ""}`;
    case "lost": {
      const day = finite(s) ? dayWord(s, now) : "";
      const on = !day ? "" : /^(today|yesterday)$/.test(day) ? ` ${day}` : ` on ${day}`;
      return `${q ? `Pitched ${inr(q)}` : "Pitched"}${on}, no payment`;
    }
    case "no_show":
      return when ? `Missed her call ${when}` : "Missed her call";
    case "cancelled":
      return when ? `Cancelled her call for ${when}` : "Cancelled her call";
    case "won": {
      const t = ms(f.reached.won?.at);
      return finite(t) ? `Paid ${dayWord(t, now)}` : "Paid";
    }
    case "nurture":
      return "Quiet for 30 days";
    case "new":
    default: {
      const t = firstFinite(ms(f.action?.since), ms(f.firstLeadAt));
      return finite(t) ? `Came in ${dayWord(t, now)}, ${clock(t)}` : "New lead";
    }
  }
}

function waitingReason(f: CardFacts, now: number): string {
  const fu = followUpsOf(f, now);
  if (fu?.next) return `Follow-up ${fu.next.n} is due ${dayWord(fu.next.at, now)}.`;
  if (fu?.stopped === "replied") return "She wrote back after the call.";
  const s = callStartOf(f);
  if (upcoming(f, s, now)) return `Her call is ${dayWord(s, now)} at ${clock(s)}. Nothing to do before it yet.`;
  if (f.action) return f.action.label;
  if (f.won) return f.marks.onboarded ? "Paid and onboarded." : "Paid.";
  return STAGE_LABEL[f.stage];
}

/** Everything the card shows, from the facts. */
export function buildCard(f: CardFacts, now: number): ClientCard {
  const built: { action: CardAction; secondaryOnly: boolean }[] = [];
  for (const def of ACTIONS) {
    const a = def.build(f, now);
    if (a) built.push({ action: a, secondaryOnly: !!def.secondaryOnly });
  }
  const primary = built.find((b) => !b.secondaryOnly)?.action ?? null;
  // One button per job: a second Notes, or a second message to her, is noise.
  // The welcome is its own job (onboarding), not a second sales message.
  const job = (a: CardAction) => (a.kind === "message" && a.id !== "welcome" ? "message" : a.kind === "notes" ? "notes" : a.id);
  const seen = new Set<string>(primary ? [job(primary)] : []);
  const secondary: CardAction[] = [];
  for (const b of built) {
    if (b.action === primary) continue;
    const k = job(b.action);
    if (seen.has(k)) continue;
    seen.add(k);
    secondary.push(b.action);
    if (secondary.length >= 3) break;
  }
  const { rank, urgency } = rankOf(f, primary, now);
  const start = callStartOf(f);
  const r = reviewState(f, now);
  return {
    key: f.key,
    name: f.name,
    phone: f.phone,
    email: f.email,
    stage: f.stage,
    stageLabel: STAGE_LABEL[f.stage],
    context: contextLine(f, now),
    status: statusOf(f, primary, now),
    steps: stepsOf(f, now),
    primary,
    secondary,
    urgency,
    rank,
    reason: primary?.reason ?? waitingReason(f, now),
    callAt: finite(start) && (f.booking || f.call) ? new Date(start).toISOString() : "",
    bookingUid: f.booking?.uid ?? "",
    summaryDue: r ? { at: new Date(r.due).toISOString(), overdue: r.overdue } : null,
    report: f.report ? { url: f.report.url, count: f.report.count, mediaId: f.report.mediaId } : null,
    wa: f.draft?.wa || waPlain(f.phone),
    drop: dropStepOf(f),
    reached: reachedList(f.reached),
    firstLeadAt: f.firstLeadAt,
    paidAsk: f.paidAsk,
    badge: f.badge,
  };
}

/** Rank, then the clock: the sooner thing first inside a rank. */
export function sortCards(cards: ClientCard[]): ClientCard[] {
  const at = (c: ClientCard) => firstFinite(ms(c.summaryDue?.at), ms(c.callAt), Infinity);
  return [...cards].sort((a, b) => a.rank - b.rank || at(a) - at(b) || a.name.localeCompare(b.name));
}

/** The Today tiles that are counts of the cards themselves (lib/metrics owns the rest). */
export function cardCounts(cards: ClientCard[], now: number): { callsToday: number; summariesToSend: number; followUpsDue: number } {
  const has = (c: ClientCard, id: string) => c.primary?.id === id || c.secondary.some((a) => a.id === id);
  return {
    callsToday: cards.filter((c) => c.callAt && c.stage !== "cancelled" && istDay(ms(c.callAt)) === istDay(now)).length,
    summariesToSend: cards.filter((c) => has(c, "summary")).length,
    followUpsDue: cards.filter((c) => has(c, "followup") || has(c, "pay_link")).length,
  };
}

// ── The drop-off funnel (Today: "This week: where clients drop off") ────────

export type DropKey = "lead" | "confirmed" | "report" | "call" | "summary" | "paid";
export const DROP_STEPS: readonly { key: DropKey; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "confirmed", label: "Confirmed" },
  { key: "report", label: "Report" },
  { key: "call", label: "Call" },
  { key: "summary", label: "Summary" },
  { key: "paid", label: "Paid" },
];
const DROP_RANK: Record<DropKey, number> = { lead: 0, confirmed: 1, report: 2, call: 3, summary: 4, paid: 5 };

/**
 * The furthest of the six she reached. Like lib/journey's funnel, a later step
 * counts every earlier one, so each bar is at most the one before it: the
 * chart shows where women stop, and Call and Paid are lib/journey's Attended
 * and Won, never a second definition of either.
 */
export function dropStepOf(f: CardFacts): DropKey {
  if (f.won || f.reached.won) return "paid";
  const start = callStartOf(f);
  if (f.marks.summary_sent && (!finite(start) || f.marks.summary_sent.at >= start)) return "summary";
  if (f.reached.attended || heldThisCall(f)) return "call";
  if (f.report) return "report";
  if (f.booking && confirmed(f)) return "confirmed";
  return "lead";
}

const inWindow = (iso: string | null, w: Window) => {
  const t = ms(iso);
  return finite(t) && (w.from === null || t >= w.from) && t < w.to;
};

/** In the bar for `key`: in the cohort (first sheet row in the window) and at or past it. */
export function inDropBar(card: { drop: DropKey; firstLeadAt: string | null }, key: DropKey, w: Window): boolean {
  return inWindow(card.firstLeadAt, w) && DROP_RANK[card.drop] >= DROP_RANK[key];
}

/** Lead → Paid for the women whose first sheet row falls in `w` — lib/journey's cohort. */
export function dropOffFunnel(rows: { drop: DropKey; firstLeadAt: string | null }[], w: Window): FunnelBar[] {
  return DROP_STEPS.map((s) => ({ key: s.key, label: s.label, count: rows.filter((r) => inDropBar(r, s.key, w)).length }));
}

/** The same test for lib/journey's own funnel bars (Pipeline): cohort, and reached that stage. */
export function inJourneyBar(card: { reached: FunnelStage[]; firstLeadAt: string | null }, stage: FunnelStage, w: Window): boolean {
  return inWindow(card.firstLeadAt, w) && card.reached.includes(stage);
}
