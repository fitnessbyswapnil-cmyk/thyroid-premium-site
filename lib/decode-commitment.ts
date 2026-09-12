/**
 * lib/decode-commitment.ts
 *
 * The /decode quiz's commitment follow-up. Q9 asks whether the money decision
 * is hers. When it is not, ONE more question appears in place underneath it:
 * "Can you bring them onto the call for 15 minutes?"
 *
 * WHY IT EXISTS: the point is not the data, it is that reading the question
 * sets the expectation that the decision-maker joins the call. "I need to
 * discuss it with my spouse" is the commonest way a good call dies, and the
 * cheapest thing that can be done about it is to raise the idea before she
 * ever reaches the call, in her own words, at the moment she has just admitted
 * the decision is shared.
 *
 * It GATES NOTHING. All three answers continue to the Rs 299 checkout exactly
 * as before, and a woman who decides alone never sees the question at all.
 *
 * Pure and side-effect free, so the quiz, the sheet writer and the lead score
 * all agree on one set of strings rather than three copies that can drift.
 */

/** Q9's "the decision is mine" option, verbatim from the quiz. */
export const DECIDES_ALONE = "Yes, I decide on my own";

/** Sheet header for the answer. Appended by header name, never by index. */
export const PARTNER_ON_CALL_HEADER = "Partner On Call";

/** The follow-up, asked inline under Q9 so the question count does not rise. */
export const PARTNER_ON_CALL_QUESTION = "Can you bring them onto the call for 15 minutes?";

/**
 * The three answers, with the short value each is stored as. The sheet holds
 * yes / unsure / no (or empty when she decides alone) rather than the full
 * sentence, so a later wording change cannot orphan the column.
 */
export const PARTNER_ON_CALL_OPTIONS = [
  { value: "yes", label: "Yes, I can bring them" },
  { value: "unsure", label: "Not sure, I will try" },
  { value: "no", label: "No, I will come alone" },
] as const;

export type PartnerOnCall = (typeof PARTNER_ON_CALL_OPTIONS)[number]["value"];

/**
 * Show the follow-up only when she has answered Q9 with something other than
 * "I decide on my own". An unanswered Q9 shows nothing: she has not said the
 * decision is shared, so there is nobody to ask about yet.
 */
export function needsPartnerQuestion(decision: string | null | undefined): boolean {
  const d = (decision ?? "").toString().trim();
  return d !== "" && d !== DECIDES_ALONE;
}

/**
 * Accepts either the stored value or the full option label, in any casing, so
 * a row written by an older build still reads back. Anything unrecognised
 * becomes "" rather than being guessed at.
 */
export function normalizePartnerOnCall(v: string | null | undefined): PartnerOnCall | "" {
  const s = (v ?? "").toString().trim().toLowerCase();
  if (!s) return "";
  const byValue = PARTNER_ON_CALL_OPTIONS.find((o) => o.value === s);
  if (byValue) return byValue.value;
  const byLabel = PARTNER_ON_CALL_OPTIONS.find((o) => o.label.toLowerCase() === s);
  return byLabel ? byLabel.value : "";
}

/**
 * What belongs in the Partner On Call column for one lead. Empty when she
 * decides alone, because she was never shown the question and a "no" there
 * would read as a refusal she never made.
 */
export function partnerOnCallValue(
  decision: string | null | undefined,
  answer: string | null | undefined,
): PartnerOnCall | "" {
  if (!needsPartnerQuestion(decision)) return "";
  return normalizePartnerOnCall(answer);
}
