/**
 * lib/journey.ts — PURE. One woman's path through the business, and the three
 * things every admin tab reads off it: how far she got, where she is now, and
 * whether she needs the coach. No IO, no Date.now().
 *
 * WHY (CRM brief, 14-Sep-2026, Tasks 7-9). Pipeline showed "1 Attended, 0
 * Pitched" beside "Won 9". A win needs a call and a price, so the stage counts
 * were not a funnel — just whoever sat in each bucket, with wins marked
 * straight from "booked". And "needs action" was counted three different ways:
 * Pipeline said 14 and "nothing overdue", Analytics said 8 (it was capped at 8)
 * while listing a 32-hour wait.
 *
 * ── Stages: how far she got (furthest_stage_reached) ─────────────────────────
 *   new → booked → attended → pitched → won
 * Monotonic. Each stage is OBSERVED from evidence —
 *   new       her first sheet row or booking
 *   booked    any booking, whatever happened to it later
 *   attended  a call marked or recorded as attended
 *   pitched   a price said on a call, OR the checklist's "Named the price
 *             cleanly" ticked Did (owner's definition: a price was named)
 *   won       a programme payment (lib/metrics)
 * — or INFERRED: a later stage proves every earlier one, so a sale marked from
 * "booked" fills attended and pitched with `inferred: true`, dated at the step
 * that proved them. The funnel reads these, so Attended can never be below Won.
 * The daily job stores them (lib/journey-store) and a stored stage is never
 * lost: `ratchet` keeps the union of stored and derived.
 *
 * ── State: where she is now (current_state) ──────────────────────────────────
 * crm-stage's deriveStage on her latest booking, plus `nurture`. It drives the
 * working list. Outcomes (won, lost, no-show, cancelled, nurture) are states,
 * not steps.
 *
 * ── Nurture ──────────────────────────────────────────────────────────────────
 * Due when ALL hold: no activity from her for 30 days (no sheet row, payment,
 * booking or inbound WhatsApp), no call on the calendar, not won. The daily job
 * moves her (stores the date); she comes straight back the moment any of those
 * happens. Nothing is ever deleted.
 *
 * ── Needs action: one definition for every tab and the digest ───────────────
 * At most one item per woman, from her state:
 *   cancelled (slot ≤14 days ago or ahead)  → win the slot back
 *   no-show (≤14 days)                      → reschedule
 *   attendance unknown (≤14 days)           → mark whether she joined
 *   attended, no price (≤14 days)           → send the price
 *   pitched                                 → get a decision
 *   said yes on the call, no payment        → check the payment
 *   new, paid (₹299 or any non-programme
 *   amount, ≤30 days), no booking           → get her to pick a slot
 *   new, no WhatsApp at all (≤3 days)       → first message
 *   new, score ≥57, unpaid (≤3 days)        → abandoned-checkout nudge
 * An item is DONE — and leaves every list at once — when the thing it asks for
 * happens: a WhatsApp typed by hand after it became due (any message, automated
 * included, for the first-message item), or her state changing (a call marked,
 * a booking, a payment). Upcoming calls are not items; they are the calendar.
 * OVERDUE = waiting more than 6 hours. Wait is measured from when the action
 * became due. Colour by age: under 1 hr neutral, 1-6 hr amber, over 6 hr red.
 *
 * The earlier follow-up queue (lib/follow-up-queue, 14-Sep) is folded in here.
 * Its diagnosis still stands: the old queue read the hand-ticked "Msg1 Sent"
 * box, so women the automation HAD messaged looked untouched; it kept his test
 * rows; and it sorted "urgent" above age.
 */
import {
  clusterPeople,
  coverageOf,
  paymentsOf,
  NO_SHOW_GRACE_MIN,
  type BookingRecord,
  type CallRecord,
  type Dataset,
  type MessageEvent,
  type Person,
  type Window,
} from "./metrics.ts";
import { deriveStage, type Stage } from "./crm-stage.ts";

// ── Definitions ─────────────────────────────────────────────────────────────

export const FUNNEL_STAGES = ["new", "booked", "attended", "pitched", "won"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];
export const FUNNEL_LABEL: Record<FunnelStage, string> = {
  new: "Leads",
  booked: "Booked",
  attended: "Attended",
  pitched: "Pitched",
  won: "Won",
};

/** Owner-confirmable thresholds. One place each. */
export const NURTURE_AFTER_DAYS = 30;
export const OVERDUE_AFTER_MIN = 6 * 60;
/** Past this, a missed call or an unpriced call is history, not a task. */
export const ACTION_WINDOW_DAYS = 14;
export const PAID_NOT_BOOKED_WINDOW_DAYS = 30;
export const NEW_LEAD_WINDOW_DAYS = 3;
export const HOT_LEAD_SCORE = 57;

/** The checklist item that means "a price was named". */
export const NAMED_PRICE_CHECK = "price_said_cleanly";

const DAY = 86_400_000;

export type StageMark = { at: string; inferred: boolean };
export type Reached = Partial<Record<FunnelStage, StageMark>>;

/** What the daily job stored for one identity key. */
export type StoredJourney = { reached: Reached; nurtureSince: number | null };

export type AgeTone = "neutral" | "amber" | "red";

export function ageTone(waitMin: number): AgeTone {
  if (waitMin < 60) return "neutral";
  if (waitMin <= OVERDUE_AFTER_MIN) return "amber";
  return "red";
}

export const waitLabel = (mins: number) =>
  mins >= 120 ? `${Math.round(mins / 60)} hr` : `${Math.max(0, Math.round(mins))} min`;

const ms = (iso: string | null | undefined): number => {
  const t = Date.parse(String(iso ?? ""));
  return Number.isFinite(t) ? t : NaN;
};

const earliest = (isos: (string | null | undefined)[]): string | undefined =>
  isos
    .filter((x): x is string => Number.isFinite(ms(x)))
    .sort((a, b) => ms(a) - ms(b))[0];

// ── Stages ──────────────────────────────────────────────────────────────────

export function isPitchedCall(c: Pick<CallRecord, "pricePitched" | "scorecard">): boolean {
  return (c.pricePitched ?? 0) > 0 || c.scorecard?.[NAMED_PRICE_CHECK] === true;
}

/** Fill every stage below a reached one, flagged inferred and dated at the step that proved it. */
export function fillInferred(observed: Partial<Record<FunnelStage, string>>): Reached {
  const out: Reached = {};
  let proof: string | undefined;
  for (let i = FUNNEL_STAGES.length - 1; i >= 0; i--) {
    const s = FUNNEL_STAGES[i];
    const seen = observed[s];
    if (seen !== undefined) {
      out[s] = { at: seen, inferred: false };
      proof = seen;
    } else if (proof !== undefined) {
      out[s] = { at: proof, inferred: true };
    }
  }
  return out;
}

/** Stored ∪ derived, per stage: observed beats inferred, then the earlier date. */
export function ratchet(derived: Reached, stored: Reached | undefined): Reached {
  if (!stored) return derived;
  const merged: Reached = {};
  for (const s of FUNNEL_STAGES) {
    const a = derived[s];
    const b = stored[s];
    const pick = !a ? b : !b ? a : a.inferred !== b.inferred ? (a.inferred ? b : a) : ms(b.at) < ms(a.at) ? b : a;
    if (pick) merged[s] = pick;
  }
  // A stage reached is reached: fill anything below the furthest mark.
  let proof: string | undefined;
  for (let i = FUNNEL_STAGES.length - 1; i >= 0; i--) {
    const s = FUNNEL_STAGES[i];
    if (merged[s]) proof = merged[s]!.at;
    else if (proof !== undefined) merged[s] = { at: proof, inferred: true };
  }
  return merged;
}

export function furthestOf(r: Reached): FunnelStage {
  for (let i = FUNNEL_STAGES.length - 1; i >= 0; i--) if (r[FUNNEL_STAGES[i]]) return FUNNEL_STAGES[i];
  return "new";
}

// ── The journey ─────────────────────────────────────────────────────────────

export type Journey = {
  id: string;
  keys: string[];
  name: string;
  email: string;
  phone: string;
  /** Her newest sheet row — where the tabs find her answers. null = booking only. */
  leadRow: number | null;
  /** Her first sheet row; null when she exists only as a booking. The funnel cohort. */
  firstLeadAt: string | null;
  reached: Reached;
  furthest: FunnelStage;
  inferredStages: FunnelStage[];
  state: Stage;
  /** The booking her state is about: an upcoming one, else her latest. */
  booking: BookingRecord | null;
  call: CallRecord | null;
  won: boolean;
  /** Latest payment that is not a programme sale — the ₹299 fee, or another amount. */
  consultPaidAt: string | null;
  leadScore: number | null;
  city: string;
  lastActivityAt: string | null;
  /** When the daily job moved her to nurture; null = never, or released. */
  nurtureSince: number | null;
  /** The rule says she belongs in nurture right now. */
  nurtureDue: boolean;
  agreedButUnpaid: boolean;
  person: Person;
};

export type JourneyContext = {
  now: number;
  /** Stored journeys by identity key (p:… / e:…). */
  stored?: Map<string, StoredJourney>;
};

export function journeysOf(data: Dataset, ctx: JourneyContext): Journey[] {
  const { now } = ctx;
  const people = clusterPeople(data);
  const idByKey = new Map<string, string>();
  for (const p of people) for (const k of p.keys) idByKey.set(k, p.id);

  const callsByUid = new Map(data.calls.map((c) => [c.bookingUid, c]));
  const coverage = coverageOf(data.calls);

  // Payments, per person.
  const programmeAt = new Map<string, string>();
  const consultAt = new Map<string, string>();
  for (const pay of paymentsOf(data.leads)) {
    const id = idByKey.get(pay.person);
    if (!id || !Number.isFinite(ms(pay.at))) continue;
    if (pay.kind === "programme") {
      const prev = programmeAt.get(id);
      if (!prev || ms(pay.at) < ms(prev)) programmeAt.set(id, pay.at);
    } else {
      // The ₹299 fee, or any other non-programme payment (a ₹2,000 deposit on
      // 31 Aug): money from a woman with no call booked is the same task.
      const prev = consultAt.get(id);
      if (!prev || ms(pay.at) > ms(prev)) consultAt.set(id, pay.at);
    }
  }

  // Her last inbound WhatsApp.
  const lastInbound = new Map<string, number>();
  for (const m of data.messages ?? []) {
    if (m.dir !== "in") continue;
    const t = ms(m.at);
    if (Number.isFinite(t) && t > (lastInbound.get(m.phone) ?? -Infinity)) lastInbound.set(m.phone, t);
  }

  const out: Journey[] = [];
  for (const p of people) {
    const bookings = p.bookings;
    const calls = bookings.map((b) => callsByUid.get(b.uid)).filter((c): c is CallRecord => !!c);

    const wonAt = programmeAt.get(p.id);
    const observed: Partial<Record<FunnelStage, string>> = {};
    const firstSeen = earliest([...p.rows.map((r) => r.createdAt), ...bookings.map((b) => b.createdAt || b.startAt)]);
    if (firstSeen) observed.new = firstSeen;
    const bookedAt = earliest(bookings.map((b) => b.createdAt || b.startAt));
    if (bookedAt) observed.booked = bookedAt;
    const attendedAt = earliest(calls.filter((c) => c.attended === true).map((c) => c.occurredAt));
    if (attendedAt) observed.attended = attendedAt;
    const pitchedAt = earliest(calls.filter((c) => isPitchedCall(c)).map((c) => c.occurredAt));
    if (pitchedAt) observed.pitched = pitchedAt;
    if (wonAt) observed.won = wonAt;

    let derived = fillInferred(observed);
    if (!derived.new) derived = { ...derived, new: { at: "", inferred: true } };

    // Stored marks and nurture, across every key she has ever had.
    let storedReached: Reached | undefined;
    let nurtureSince: number | null = null;
    for (const k of p.keys) {
      const s = ctx.stored?.get(k);
      if (!s) continue;
      storedReached = storedReached ? ratchet(storedReached, s.reached) : s.reached;
      if (s.nurtureSince !== null && (nurtureSince === null || s.nurtureSince > nurtureSince)) nurtureSince = s.nurtureSince;
    }
    const reached = ratchet(derived, storedReached);

    // The booking her state is about.
    const upcoming = bookings.filter((b) => !b.cancelled && ms(b.startAt) + NO_SHOW_GRACE_MIN * 60_000 > now);
    const booking = upcoming[0] ?? bookings[bookings.length - 1] ?? null;
    const call = booking ? callsByUid.get(booking.uid) ?? null : null;
    const judgedCall = call && call.attended !== null ? call : null;

    const won = !!wonAt;
    const consultPaidAt = consultAt.get(p.id) ?? null;
    const facts = judgedCall
      ? {
          attended: judgedCall.attended === true,
          pricePitched: judgedCall.pricePitched ?? null,
          moneyMovedOnCall: !!judgedCall.moneyMovedOnCall,
          occurredAt: judgedCall.occurredAt || booking!.startAt,
          namedPrice: judgedCall.scorecard?.[NAMED_PRICE_CHECK] === true,
        }
      : null;
    let state = deriveStage({
      hasBooking: !!booking && !booking.cancelled,
      bookingCancelled: !!booking?.cancelled,
      sessionStart: booking?.startAt || null,
      call: facts,
      callDataSince: coverage.since ?? undefined,
      callDataUntil: coverage.until ?? undefined,
      paid: won || !!consultPaidAt,
      won,
      now: new Date(now),
    });

    // Activity from HER side — what nurture is measured against.
    const phones = p.keys.filter((k) => k.startsWith("p:")).map((k) => k.slice(2));
    // Future bookings count as activity only from when they were made.
    const activity = [
      ...p.rows.flatMap((r) => [ms(r.createdAt), ms(r.paidAt), ms(r.closedAt)]),
      ...bookings.flatMap((b) => [ms(b.createdAt), Math.min(ms(b.startAt), now)]),
      ...phones.map((ph) => lastInbound.get(ph) ?? NaN),
    ].filter(Number.isFinite);
    const lastActivity = activity.length ? Math.max(...activity) : NaN;
    const nurtureDue =
      !won &&
      upcoming.length === 0 &&
      Number.isFinite(lastActivity) &&
      now - lastActivity > NURTURE_AFTER_DAYS * DAY;
    if (nurtureSince !== null && nurtureDue) state = "nurture";

    const newestRow = p.rows[p.rows.length - 1];
    const scores = p.rows.map((r) => r.leadScore ?? null).filter((x): x is number => x !== null);
    out.push({
      id: p.id,
      keys: p.keys,
      name: p.name,
      email: p.email,
      phone: p.phone,
      leadRow: newestRow ? newestRow.row : null,
      firstLeadAt: earliest(p.rows.map((r) => r.createdAt)) ?? null,
      reached,
      furthest: furthestOf(reached),
      inferredStages: FUNNEL_STAGES.filter((s) => reached[s]?.inferred),
      state,
      booking,
      call,
      won,
      consultPaidAt,
      leadScore: scores.length ? scores[scores.length - 1] : null,
      city: [...p.rows].reverse().find((r) => r.city)?.city ?? "",
      lastActivityAt: Number.isFinite(lastActivity) ? new Date(lastActivity).toISOString() : null,
      nurtureSince,
      nurtureDue,
      agreedButUnpaid: !!judgedCall?.moneyMovedOnCall && !won,
      person: p,
    });
  }
  return out;
}

// ── Funnel: furthest stage reached, for a cohort ─────────────────────────────

export type FunnelStep = { stage: FunnelStage; label: string; n: number; inferred: number };

/**
 * Of the women whose first sheet row falls in the window, how many reached each
 * stage. Built from `reached`, which is filled downward, so every step is ≤ the
 * one before it. "Leads" here equals Leads on every tab (both count people by
 * first row, lib/metrics clusterPeople).
 */
export function funnelOf(journeys: Journey[], w: Window): FunnelStep[] {
  const cohort = journeys.filter((j) => {
    const t = ms(j.firstLeadAt);
    return Number.isFinite(t) && (w.from === null || t >= w.from) && t < w.to;
  });
  return FUNNEL_STAGES.map((stage) => ({
    stage,
    label: FUNNEL_LABEL[stage],
    n: cohort.filter((j) => j.reached[stage]).length,
    inferred: cohort.filter((j) => j.reached[stage]?.inferred).length,
  }));
}

// ── Pipeline counters ───────────────────────────────────────────────────────

export type PipelineCounts = {
  /** Still open: not won, lost or in nurture. */
  inPipeline: number;
  nurture: number;
  byState: Partial<Record<Stage, number>>;
};

export function pipelineCounts(journeys: Journey[]): PipelineCounts {
  const byState: Partial<Record<Stage, number>> = {};
  for (const j of journeys) byState[j.state] = (byState[j.state] ?? 0) + 1;
  return {
    inPipeline: journeys.filter((j) => !["won", "lost", "nurture"].includes(j.state)).length,
    nurture: byState.nurture ?? 0,
    byState,
  };
}

// ── Needs action ────────────────────────────────────────────────────────────

export type ActionKind =
  | "rebook_cancelled"
  | "rebook_no_show"
  | "mark_call"
  | "send_price"
  | "follow_up"
  | "agreed_unpaid"
  | "paid_not_booked"
  | "first_message"
  | "hot_abandon";

export const ACTION_LABEL: Record<ActionKind, string> = {
  rebook_cancelled: "Cancelled her call — win the slot back",
  rebook_no_show: "No-show — offer two new times",
  mark_call: "Mark whether she joined the call",
  // Transcript-only calls record no price, so this does not claim none was said.
  send_price: "Call held, no price recorded — follow up",
  follow_up: "Pitched — get her decision",
  agreed_unpaid: "Said yes on the call — no payment arrived",
  paid_not_booked: "Paid, no slot chosen",
  first_message: "New lead — no WhatsApp has gone out",
  hot_abandon: "High score, didn't pay — nudge her",
};

export type ActionItem = {
  personId: string;
  name: string;
  phone: string;
  leadRow: number | null;
  bookingUid: string;
  kind: ActionKind;
  label: string;
  /** When the action became due. */
  since: string;
  waitMin: number;
  overdue: boolean;
  tone: AgeTone;
};

export type NeedsAction = { count: number; overdue: number; items: ActionItem[] };

export function needsActionOf(journeys: Journey[], data: Pick<Dataset, "messages">, now: number): NeedsAction {
  const outs = new Map<string, MessageEvent[]>();
  for (const m of data.messages ?? []) {
    if (m.dir !== "out") continue;
    const list = outs.get(m.phone) ?? [];
    list.push(m);
    outs.set(m.phone, list);
  }
  const sentAfter = (j: Journey, sinceMs: number, manualOnly: boolean) => {
    for (const k of j.keys) {
      if (!k.startsWith("p:")) continue;
      for (const m of outs.get(k.slice(2)) ?? []) {
        if (manualOnly && !m.manual) continue;
        // A minute of slack: the welcome template can land a beat before the row.
        if (ms(m.at) >= sinceMs - 60_000) return true;
      }
    }
    return false;
  };

  const items: ActionItem[] = [];
  const push = (j: Journey, kind: ActionKind, sinceMs: number) => {
    if (!Number.isFinite(sinceMs)) return;
    const waitMin = Math.max(0, (now - sinceMs) / 60_000);
    items.push({
      personId: j.id,
      name: j.name,
      phone: j.phone,
      leadRow: j.leadRow,
      bookingUid: j.booking?.uid ?? "",
      kind,
      label: ACTION_LABEL[kind],
      since: new Date(sinceMs).toISOString(),
      waitMin,
      overdue: waitMin > OVERDUE_AFTER_MIN,
      tone: ageTone(waitMin),
    });
  };
  const within = (t: number, days: number) => Number.isFinite(t) && now - t <= days * DAY;

  for (const j of journeys) {
    const b = j.booking;
    const start = ms(b?.startAt);
    // Every item but "mark the call" is a WhatsApp. With no number there is
    // nothing to do, so she is not on the list (she still counts as a lead).
    const reachable = j.phone.length === 10;
    const slotDue = start + NO_SHOW_GRACE_MIN * 60_000;
    const callAt = ms(j.call?.occurredAt) || start;

    switch (j.state) {
      case "cancelled": {
        if (!reachable || !(start > now || within(start, ACTION_WINDOW_DAYS))) break;
        // Cal.com does not say when she cancelled. A slot already passed dates
        // it by the slot; a future one by when she booked it.
        const since = start <= now ? start : ms(b?.createdAt) || start;
        if (!sentAfter(j, since, true)) push(j, "rebook_cancelled", since);
        break;
      }
      case "no_show":
        if (reachable && within(start, ACTION_WINDOW_DAYS) && !sentAfter(j, slotDue, true)) push(j, "rebook_no_show", slotDue);
        break;
      case "unknown":
        if (within(start, ACTION_WINDOW_DAYS)) push(j, "mark_call", slotDue);
        break;
      case "attended":
        if (j.agreedButUnpaid) push(j, "agreed_unpaid", callAt);
        else if (reachable && within(callAt, ACTION_WINDOW_DAYS) && !sentAfter(j, callAt, true)) push(j, "send_price", callAt);
        break;
      case "pitched":
        if (j.agreedButUnpaid) push(j, "agreed_unpaid", callAt);
        else if (reachable && !sentAfter(j, callAt, true)) push(j, "follow_up", callAt);
        break;
      case "new": {
        if (!reachable) break;
        const paidAt = ms(j.consultPaidAt);
        const newest = ms(j.person.rows[j.person.rows.length - 1]?.createdAt);
        if (within(paidAt, PAID_NOT_BOOKED_WINDOW_DAYS)) {
          if (!sentAfter(j, paidAt, true)) push(j, "paid_not_booked", paidAt);
        } else if (within(newest, NEW_LEAD_WINDOW_DAYS)) {
          if (!sentAfter(j, newest, false)) push(j, "first_message", newest);
          else if ((j.leadScore ?? 0) >= HOT_LEAD_SCORE && !sentAfter(j, newest, true)) push(j, "hot_abandon", newest);
        }
        break;
      }
      default:
        break; // booked (the calendar has it), won, lost, nurture
    }
  }

  // Oldest wait first — a 35-minute item never sits above a 32-hour one.
  items.sort((a, b) => b.waitMin - a.waitMin);
  return { count: items.length, overdue: items.filter((i) => i.overdue).length, items };
}

/** What the daily job changes. Pure, so the retroactive run can be dry-run. */
export function nurtureMoves(journeys: Journey[]): { move: Journey[]; release: Journey[] } {
  return {
    move: journeys.filter((j) => j.nurtureDue && j.nurtureSince === null),
    // She messaged, booked or paid since she was moved: back into the pipeline.
    release: journeys.filter((j) => j.nurtureSince !== null && !j.nurtureDue),
  };
}
