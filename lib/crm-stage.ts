/**
 * lib/crm-stage.ts — PURE pipeline logic. No IO, no network, no Date.now().
 *
 * Every stage in this CRM is DERIVED, never typed by a human. That is the whole
 * point: a stage someone has to remember to update is a stage that is wrong
 * within a week, and a close rate measured off wrong stages is worse than no
 * close rate at all.
 *
 * The inputs come from four systems that each own exactly one truth:
 *   Cal.com   → is there a booking, and when is it
 *   Fathom    → did the call actually happen, and what was said on it
 *   Claude    → what was pitched, what she objected to (read off the transcript)
 *   Cashfree  → whether money actually arrived
 *
 * The last one matters more than it looks. A transcript can show a woman
 * agreeing to pay, saying the amount out loud, and reading her UPI PIN — and the
 * gateway can still decline. That happened on a real call: the payment died to a
 * "UPI risk policy error" at 1:37:03 after she had said yes. A CRM that trusts
 * the transcript marks her Won and stops following up. So `paid` here comes from
 * the Cashfree webhook ONLY, and the transcript's opinion about money is kept in
 * `moneyMovedOnCall` as a signal — useful for spotting exactly this failure
 * (agreed on the call, no payment recorded) and never as proof.
 */

export type Stage =
  | "new" // qualified lead, no booking on the calendar
  | "booked" // call scheduled and still in the future
  | "cancelled" // she cancelled and has not rebooked
  | "no_show" // call time passed, she never joined
  | "attended" // call happened, no price was said
  | "pitched" // price said, decision outstanding
  | "won" // Cashfree confirmed money
  | "lost"; // pitched, no money, follow-up window expired

export const STAGE_ORDER: Stage[] = [
  "new",
  "booked",
  "cancelled",
  "no_show",
  "attended",
  "pitched",
  "won",
  "lost",
];

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New lead",
  booked: "Call booked",
  cancelled: "Cancelled",
  no_show: "No-show",
  attended: "Attended",
  pitched: "Pitched",
  won: "Won",
  lost: "Lost",
};

/**
 * Fathom needs a few minutes after a call ends before a transcript exists, and
 * the call itself runs 60 minutes. Until this much time has passed we must not
 * call a booking a no-show — the recording may simply not be ready yet.
 * 60 (call) + 30 (processing + overrun) is deliberately generous: wrongly
 * marking a woman who DID show as a no-show sends her the wrong WhatsApp
 * message, which is far more expensive than showing "booked" for an extra hour.
 */
export const NO_SHOW_GRACE_MIN = 90;

/**
 * How long a pitched-but-unpaid call stays live before it counts as lost.
 * Seven days matches the real pattern in the recordings: the women who paid
 * either paid on the call or within a couple of days of it. Nobody in the data
 * came back after a week.
 */
export const LOST_AFTER_DAYS = 7;

export type CallFacts = {
  /** Fathom recorded the meeting AND she is audible on it. */
  attended: boolean;
  /** Rupee figure actually said out loud. 0 / null = no price was named. */
  pricePitched: number | null;
  /** Transcript SIGNAL that money moved. Never proof — Cashfree is proof. */
  moneyMovedOnCall: boolean;
  /** ISO timestamp of the call itself. */
  occurredAt: string;
};

export type StageInput = {
  hasBooking: boolean;
  bookingCancelled: boolean;
  /** ISO start time of the Cal.com booking, if any. */
  sessionStart: string | null;
  call: CallFacts | null;
  /**
   * The EARLIEST call the ingest has produced, as an ISO timestamp — the point
   * back to which recordings have actually been looked for. Absence of a
   * recording only means "she did not join" for bookings at or after it.
   *
   * A plain boolean was not enough. Once three recent calls were ingested, the
   * flag flipped true and 28 women with older bookings were immediately declared
   * no-shows — including four whose transcripts had been read on this very
   * account. Three calls covered does not mean thirty calls judged.
   *
   * Undefined or empty means nothing has been ingested at all, and no booking
   * can be called a no-show.
   */
  callDataSince?: string;
  /** Cashfree truth. */
  paid: boolean;
  now: Date;
};

function parse(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const minutesBetween = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 60000;
const daysBetween = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 86400000;

/**
 * The single source of stage truth. Order of the checks IS the business logic:
 * money first (it outranks everything), then what the call told us, then what
 * the calendar told us.
 */
export function deriveStage(input: StageInput): Stage {
  // 1. Money outranks every other signal. A woman who paid is Won even if the
  //    transcript never mentioned payment and even if Fathom missed the call.
  if (input.paid) return "won";

  // 2. The call, if it happened, is the next most informative thing we have.
  const call = input.call;
  if (call) {
    if (!call.attended) return "no_show";

    const pitched = (call.pricePitched ?? 0) > 0;
    if (!pitched) return "attended";

    const occurred = parse(call.occurredAt);
    if (occurred && daysBetween(input.now, occurred) > LOST_AFTER_DAYS) return "lost";
    return "pitched";
  }

  // 3. No call record yet — the calendar decides.
  if (!input.hasBooking) return input.bookingCancelled ? "cancelled" : "new";
  if (input.bookingCancelled) return "cancelled";

  const start = parse(input.sessionStart);
  if (!start) return "booked";

  // Past its slot with no recording: a no-show only once Fathom has had time,
  // AND only if the ingest has actually covered this booking's date. Absence of
  // evidence is not evidence of absence outside the window that was searched.
  const since = parse(input.callDataSince ?? null);
  const covered = !!since && start.getTime() >= since.getTime();
  if (covered && minutesBetween(input.now, start) > NO_SHOW_GRACE_MIN) return "no_show";
  return "booked";
}

export type Urgency = "now" | "today" | "soon" | "none";

export type NextAction = {
  label: string;
  urgency: Urgency;
  /** Why this action, in the coach's own terms. Shown under the label. */
  reason: string;
};

/**
 * What to do next, derived from the same facts.
 *
 * The wording is deliberately imperative and specific — "call her at 6.30" beats
 * "follow up", because the recordings show every vague ending ("ping me anytime",
 * "let me know") produced nothing, and every ending with a named time produced
 * either a payment or a clean no.
 */
export function nextAction(
  stage: Stage,
  input: StageInput,
  extras: { objection?: string | null; excuse?: string | null; agreedCallbackAt?: string | null } = {},
): NextAction {
  const objection = (extras.objection ?? "").trim();

  switch (stage) {
    case "won":
      return { label: "Onboard her", urgency: "today", reason: "Payment received — send the agreement and book the consultation call." };

    case "new":
      return { label: "Get her on the calendar", urgency: "today", reason: "Qualified but never booked. One WhatsApp with two slot options." };

    case "booked":
      return { label: "Hold the slot", urgency: "none", reason: "Call is scheduled. Send the reminder the evening before." };

    case "cancelled":
      return { label: "Rebook her", urgency: "now", reason: "She cancelled and has no call on the calendar. This is the most perishable state in the pipeline." };

    case "no_show":
      return { label: "Reschedule — one message, two times", urgency: "now", reason: "She did not join. Offer two specific slots rather than asking when suits her." };

    case "attended":
      return {
        label: "Send the price today",
        urgency: "now",
        reason: "The call happened and no number was ever said. She cannot say yes to something she was never quoted.",
      };

    case "pitched": {
      if (extras.agreedCallbackAt) {
        return { label: `Call her back at ${extras.agreedCallbackAt}`, urgency: "now", reason: "She named this time herself on the call. Missing it is the whole deal." };
      }
      if (/spouse|husband|family|partner/i.test(objection)) {
        return {
          label: "Send him the recording + one-page PDF",
          urgency: "today",
          reason: "The blocker is a person who was not on the call. Arm her with something he can read himself instead of a two-minute retelling.",
        };
      }
      if (/proof|trust|evidence|result|doubt|blind/i.test(objection)) {
        return {
          label: "Send one real client report — screen, not words",
          urgency: "now",
          reason: "She asked for proof. In this account, four deals died on exactly this gap. Show it, do not describe it.",
        };
      }
      if (/money|price|cost|afford|budget|expensive|instal/i.test(objection)) {
        return {
          label: "Offer the results gate — never a discount",
          urgency: "today",
          reason: "Same total, split calendar: pay the rest only after 4-5 kg is gone. No discount in this account has ever produced a yes.",
        };
      }
      return { label: "Get a clock time out of her", urgency: "now", reason: "Pitched and undecided. Ask what time TODAY she will decide — not whether." };
    }

    case "lost":
      return {
        label: "Move to nurture",
        urgency: "none",
        reason: objection ? `Closed out on: ${objection}. Re-approach in 30 days with proof, not a discount.` : "No movement in a week. Re-approach in 30 days.",
      };
  }
}

/**
 * Flags a specific, expensive failure: she said yes on the call and no money
 * ever arrived. That is almost always a gateway problem, not a decision — and
 * it is invisible to a CRM that reads either system on its own.
 */
export function agreedButUnpaid(input: StageInput): boolean {
  return !!input.call?.moneyMovedOnCall && !input.paid;
}
