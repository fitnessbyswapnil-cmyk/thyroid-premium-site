/**
 * lib/decode-gate.ts
 *
 * The /decode timing gate. It no longer shuts anything.
 *
 * Q10 asks when she would want to start. "This week" and "This month" are
 * "eligible": her score, then the free booking. "In a month or two" and "Just
 * exploring for now" are "nurture_timing" ("not now"), and since 28-Nov-2026
 * (decision D7 in audit/intended-flow.md) she sees exactly the same score and
 * exactly the same free booking. What changes is the framing and the follow-up:
 *
 *   - the page says there is no rush, and offers an Instagram follow for the
 *     woman who is not booking today (NURTURE_INSTAGRAM_URL below);
 *   - WhatsApp sends her only the day-3 free nudge, never the next-morning one
 *     (lib/reminder-plan.ts, FREE_NUDGE_STAGE1 / FREE_NUDGE_STAGE2). Asking a
 *     woman who just said "a month or two" to book again the next morning
 *     reads as not having listened.
 *
 * It used to send her to the free masterclass at /webinar instead of a slot.
 * The webinar is retired, and nothing in this flow links to it any more.
 *
 * WHAT IS DELIBERATELY NOT AN INPUT: budget (Q8) and the decision-maker (Q9).
 * A woman who says Rs 15,000 is usually saying "I do not want to over-commit
 * before we have spoken", and a woman who needs to ask her husband is
 * describing a delay, not a refusal.
 *
 * The outcome is still written to the sheet as "Gate Outcome", by header name,
 * so the cron and the CRM can tell the two apart.
 *
 * Pure and side-effect free: the quiz, the sheet writer and the reminder cron
 * all read the same functions rather than three copies of a string list.
 */

/** Sheet header for the outcome. Appended by header name, never by index. */
export const GATE_OUTCOME_HEADER = "Gate Outcome";

/**
 * Where a "not now" woman can follow along while she is not booking. Shown
 * under the booking, never instead of it.
 */
export const NURTURE_INSTAGRAM_URL = "https://www.instagram.com/heal_thyroid_with_swapnil/";

export type GateOutcome = "eligible" | "nurture_timing";

/** The two Q10 answers that mean "not now". Verbatim from the quiz. */
export const NURTURE_TIMING_ANSWERS: readonly string[] = [
  "In a month or two",
  "Just exploring for now",
];

/**
 * Only the two answers above gate. Anything else, INCLUDING an unanswered or
 * unrecognised Q10, is eligible: a gate that fires on missing data would take
 * the next-morning nudge away from a legacy lead, a renamed option or a
 * dropped field, and nobody would see it happen.
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
 * did, which is what stops the cron from treating the whole back catalogue as
 * "not now" the first time it runs after a deploy.
 */
export function isNurtureGated(cell: string | null | undefined): boolean {
  return normalizeGateOutcome(cell) === "nurture_timing";
}
