/**
 * lib/crm-milestones.ts — PURE. What has and has not happened to one woman.
 *
 * The pipeline already answers two questions: `stage` says WHERE she is, and the
 * timeline says WHAT happened. Neither answers the third and most operational
 * one — WHAT HASN'T happened yet. A woman can sit in "pitched" for four days
 * with nobody having followed up, and both existing views show that as normal.
 *
 * THREE STATES, NOT TWO. This is the whole design of this module.
 *
 *   done          it happened; carries the value (₹30,000, a time, "attended")
 *   not_applicable it was never expected of her, and showing it as a failure is
 *                 a lie. His own ads say "reports or no reports, both are fine",
 *                 so a woman who sent none has not missed anything. A checklist
 *                 that reds those cells is one he stops trusting within a week.
 *   missing       it genuinely should have happened and did not. ONLY this state
 *                 is allowed to look urgent.
 *
 * A milestone that cannot yet be judged — attendance before the call has
 * happened — is `not_applicable`, not `missing`. Nothing is a failure before its
 * time has come.
 */

export type MilestoneState = "done" | "not_applicable" | "missing";

export type MilestoneId =
  | "scheduled"
  | "message_sent"
  | "confirmed"
  | "report_received"
  | "attended"
  | "price_pitched"
  | "closed"
  | "followup_taken"
  | "followup_needed";

export type Milestone = {
  id: MilestoneId;
  label: string;
  state: MilestoneState;
  /** What to show in the cell — an amount, a time, a word. "" when there is none. */
  value: string;
  /** Why it is missing / not applicable, for the tooltip. */
  note?: string;
};

export const MILESTONE_ORDER: { id: MilestoneId; label: string }[] = [
  { id: "scheduled", label: "Scheduled" },
  { id: "message_sent", label: "Msg sent" },
  { id: "confirmed", label: "Confirmed" },
  { id: "report_received", label: "Report" },
  { id: "attended", label: "Attended" },
  { id: "price_pitched", label: "Pitched" },
  { id: "closed", label: "Closed" },
  { id: "followup_taken", label: "Follow-up" },
  { id: "followup_needed", label: "Needs f/u" },
];

/** Minimal event shape — matches the timeline feed. */
export type MsEvent = {
  at: string;
  kind: string;
  /** For messages: the media type, when the message carried an attachment. */
  mediaType?: string;
};

export type MilestoneInput = {
  /** Cal.com. */
  hasBooking: boolean;
  cancelled: boolean;
  sessionStart: string | null;
  /** From the Calls tab — null when the call has not been ingested yet. */
  call: {
    attended: boolean;
    pricePitched: number | null;
    lowestPriceSaid: number | null;
    occurredAt: string;
  } | null;
  /** Cashfree. */
  paid: boolean;
  paidAmount: number | null;
  /** Her whole story, chronological. */
  events: MsEvent[];
  /** See crm-stage: false means nothing has ever looked for a recording. */
  callDataAvailable?: boolean;
  now: Date;
};

const t = (iso: string): number => {
  const n = new Date(iso).getTime();
  return Number.isNaN(n) ? NaN : n;
};

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
};

const rupee = (n: number): string => `₹${n.toLocaleString("en-IN")}`;

/** Grace before a booking whose slot has passed can be judged at all. */
const CALL_GRACE_MIN = 90;
/** How long after a pitch silence becomes a missing follow-up. */
export const FOLLOWUP_DUE_HOURS = 24;

export function milestonesFor(input: MilestoneInput): Milestone[] {
  const { events, call, now } = input;
  const nowMs = now.getTime();

  const inbound = events.filter((e) => e.kind === "message_in");
  const outbound = events.filter((e) => e.kind === "message_out");
  const firstOut = outbound[0];
  const callAt = call?.occurredAt || input.sessionStart || "";
  const callMs = t(callAt);

  // The slot has passed by enough that Fathom would have produced a recording.
  const callJudgeable = !Number.isNaN(callMs) && nowMs - callMs > CALL_GRACE_MIN * 60000;

  const mk = (id: MilestoneId, state: MilestoneState, value = "", note?: string): Milestone => ({
    id,
    label: MILESTONE_ORDER.find((m) => m.id === id)!.label,
    state,
    value,
    ...(note ? { note } : {}),
  });

  const out: Milestone[] = [];

  // 1 ── Scheduled
  out.push(
    input.hasBooking || input.cancelled
      ? input.cancelled
        ? mk("scheduled", "missing", "cancelled", "She cancelled and has not rebooked")
        : mk("scheduled", "done", input.sessionStart ? fmtTime(input.sessionStart) : "booked")
      : mk("scheduled", "missing", "", "Qualified lead with no call on the calendar"),
  );

  // 2 ── Message sent
  out.push(
    firstOut
      ? mk("message_sent", "done", fmtTime(firstOut.at))
      : mk("message_sent", "missing", "", "Nothing has been sent to her on WhatsApp"),
  );

  // 3 ── Confirmation received.
  //     Defined as: she replied at all AFTER the first thing we sent her. Any
  //     reply is engagement; demanding the literal word "confirmed" would mark
  //     half of a real inbox as missing.
  const firstOutMs = firstOut ? t(firstOut.at) : NaN;
  const replyAfter = inbound.find((e) => {
    const m = t(e.at);
    return !Number.isNaN(m) && (Number.isNaN(firstOutMs) || m > firstOutMs);
  });
  out.push(
    replyAfter
      ? mk("confirmed", "done", fmtTime(replyAfter.at))
      : firstOut
        ? mk("confirmed", "missing", "", "She has not replied since you messaged her")
        : mk("confirmed", "not_applicable", "", "Nothing sent yet, so nothing to reply to"),
  );

  // 4 ── Report received. Documents AND images — most women photograph the page
  //     rather than attaching a PDF. Never "missing": his own ads promise
  //     reports are optional, so absence is not a failure.
  const report = inbound.find((e) => e.mediaType === "document" || e.mediaType === "image");
  out.push(
    report
      ? mk("report_received", "done", fmtTime(report.at))
      : mk("report_received", "not_applicable", "", "Reports are optional — not every client sends one"),
  );

  // 5 ── Attended / no-show
  if (call) {
    out.push(call.attended ? mk("attended", "done", "attended") : mk("attended", "missing", "no-show", "She did not join the call"));
  } else if (!input.hasBooking && !input.cancelled) {
    out.push(mk("attended", "not_applicable", "", "No call booked yet"));
  } else if (callJudgeable && input.callDataAvailable !== false) {
    out.push(mk("attended", "missing", "", "The slot has passed and no recording has been ingested"));
  } else if (callJudgeable) {
    out.push(mk("attended", "not_applicable", "", "Call ingestion has not run yet — attendance is unknown, not missed"));
  } else {
    out.push(mk("attended", "not_applicable", "", "The call has not happened yet"));
  }

  // 6 ── Price pitched. The DROP is the story, so it rides in the value.
  const pitched = call?.pricePitched ?? null;
  const low = call?.lowestPriceSaid ?? null;
  if (pitched && pitched > 0) {
    const dropped = low != null && low < pitched;
    out.push(mk("price_pitched", "done", dropped ? `${rupee(pitched)} → ${rupee(low)}` : rupee(pitched), dropped ? "You came down from your quote" : undefined));
  } else if (call?.attended) {
    out.push(mk("price_pitched", "missing", "", "The call happened and no number was ever said"));
  } else {
    out.push(mk("price_pitched", "not_applicable", "", "No attended call yet"));
  }

  // 7 ── Closed
  if (input.paid) {
    out.push(mk("closed", "done", input.paidAmount ? rupee(input.paidAmount) : "paid"));
  } else if (pitched && pitched > 0) {
    out.push(mk("closed", "missing", "", "Priced and not yet paid"));
  } else {
    out.push(mk("closed", "not_applicable", "", "Nothing has been pitched yet"));
  }

  // 8 ── Follow-up taken: anything sent AFTER the call.
  const afterCall = Number.isNaN(callMs) ? [] : outbound.filter((e) => t(e.at) > callMs);
  const lastFollow = afterCall[afterCall.length - 1];
  if (!call?.attended) {
    out.push(mk("followup_taken", "not_applicable", "", "No attended call to follow up on"));
  } else if (lastFollow) {
    out.push(mk("followup_taken", "done", fmtTime(lastFollow.at)));
  } else {
    out.push(mk("followup_taken", "missing", "", "Nothing has been sent since the call"));
  }

  // 9 ── Follow-up NEEDED. Deliberately inverted: "done" means nothing is owed.
  //     A won deal never needs chasing; a priced-and-silent one does.
  if (input.paid) {
    out.push(mk("followup_needed", "done", "closed", "She has paid — nothing owed"));
  } else if (!pitched) {
    out.push(mk("followup_needed", "not_applicable", "", "Nothing pitched yet"));
  } else {
    const since = lastFollow ? t(lastFollow.at) : callMs;
    const hours = Number.isNaN(since) ? Infinity : (nowMs - since) / 3600000;
    out.push(
      hours > FOLLOWUP_DUE_HOURS
        ? mk("followup_needed", "missing", `${Math.floor(hours / 24) || 1}d silent`, "Priced, unpaid, and nobody has spoken to her")
        : mk("followup_needed", "done", "up to date"),
    );
  }

  return out;
}

/** Count of milestones that genuinely need action. Drives the row's urgency. */
export function missingCount(ms: Milestone[]): number {
  return ms.filter((m) => m.state === "missing").length;
}

/** True when this lead falls inside the board's window. */
export function withinDays(input: { sessionStart: string | null; events: MsEvent[]; now: Date }, days: number): boolean {
  const cutoff = input.now.getTime() - days * 86400000;
  const stamps = [input.sessionStart ?? "", ...input.events.map((e) => e.at)]
    .map(t)
    .filter((n) => !Number.isNaN(n));
  if (!stamps.length) return false;
  return Math.max(...stamps) >= cutoff;
}
