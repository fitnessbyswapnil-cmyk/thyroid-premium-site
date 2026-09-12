/**
 * lib/decode-gate.ts
 *
 * The ONE hard gate in the /decode funnel, and the only one there should be.
 *
 * Q10 asks when she would want to start. "This week" and "This month" reach the
 * Rs 299 checkout exactly as before. "In a month or two" and "Just exploring
 * for now" never see it: the paid consultation reads a blood report and hands
 * back a plan to act on, and selling that to a woman who is not starting yet
 * buys her a refund request and buys the calendar a no-show.
 *
 * She is sent to the free masterclass at /webinar instead. That is a nurture
 * destination, not a consolation prize, and the screen that offers it carries
 * no shame and no countdown.
 *
 * WHAT IS DELIBERATELY NOT GATED: budget (Q8) and the decision-maker (Q9).
 * Every answer to both still reaches checkout. A woman who says Rs 15,000 is
 * usually saying "I do not want to over-commit before we have spoken", and a
 * woman who needs to ask her husband is describing a delay, not a refusal.
 * Gating on either would cost real buyers.
 *
 * Pure and side-effect free: the quiz, the sheet writer and the reminder cron
 * all read the same two functions rather than three copies of a string list.
 */

/** Sheet header for the outcome. Appended by header name, never by index. */
export const GATE_OUTCOME_HEADER = "Gate Outcome";

/** The live free masterclass. Already built, already running. */
export const NURTURE_DESTINATION = "/webinar";

export type GateOutcome = "eligible" | "nurture_timing";

/** The two Q10 answers that mean "not now". Verbatim from the quiz. */
export const NURTURE_TIMING_ANSWERS: readonly string[] = [
  "In a month or two",
  "Just exploring for now",
];

/**
 * Only the two answers above gate. Anything else, INCLUDING an unanswered or
 * unrecognised Q10, is eligible: a gate that fires on missing data would shut
 * the checkout for a legacy lead, a renamed option or a dropped field, and
 * nobody would see it happen.
 */
export function gateOutcome(timing: string | null | undefined): GateOutcome {
  const t = (timing ?? "").toString().trim().toLowerCase();
  if (!t) return "eligible";
  return NURTURE_TIMING_ANSWERS.some((a) => a.toLowerCase() === t) ? "nurture_timing" : "eligible";
}

/** Parse a Gate Outcome cell. "" for a legacy row that predates the column. */
export function normalizeGateOutcome(v: string | null | undefined): GateOutcome | "" {
  const s = (v ?? "").toString().trim().toLowerCase();
  if (s === "nurture_timing") return "nurture_timing";
  if (s === "eligible") return "eligible";
  return "";
}

/**
 * True only for a row positively stamped nurture_timing. A blank cell is a
 * lead from before the column existed, and must keep behaving exactly as it
 * did — which is what stops this from silencing the whole back catalogue the
 * first time the cron runs after deploy.
 */
export function isNurtureGated(cell: string | null | undefined): boolean {
  return normalizeGateOutcome(cell) === "nurture_timing";
}
