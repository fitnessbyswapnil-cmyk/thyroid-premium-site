/**
 * The ten call-checklist items — keys and the words the coach reads.
 *
 * ONE place for the wording. Pipeline carried its own copy with different
 * phrasing from the extractor's, so the same check read two ways depending on
 * the screen. The keys are fixed: they are the field names in every stored
 * scorecard (Calls sheet "Scorecard JSON"), whether the AI wrote it or the
 * coach ticked it by hand, so a key must never be renamed.
 *
 * lib/call-extract keeps its own, longer definitions: those are instructions to
 * the model, not labels for a person, and are deliberately not merged.
 */
export const SCORECARD_KEYS = [
  "past_spend_totalled",
  "range_tested",
  "proof_shown_before_price",
  "decision_maker_found",
  "price_said_cleanly",
  "silence_after_ask",
  "total_held",
  "results_gate_used",
  "payment_on_screen",
  "ended_with_clock_time",
] as const;

export type ScorecardKey = (typeof SCORECARD_KEYS)[number];

export const SCORECARD_LABEL: Record<ScorecardKey, string> = {
  past_spend_totalled: "Totalled her past spend before naming the price",
  range_tested: "Asked what she had tried and why it stopped",
  proof_shown_before_price: "Showed proof before the number",
  decision_maker_found: "Handled the husband objection with her, not for her",
  price_said_cleanly: "Named the price cleanly, with the guarantee",
  silence_after_ask: "Held the price in silence for ten seconds",
  total_held: "The total never went down",
  results_gate_used: "Used the results gate, not a discount",
  payment_on_screen: "Asked for payment while she was still on the call",
  ended_with_clock_time: "Set a decision date before ending the call",
};

export const labelFor = (key: string): string =>
  (SCORECARD_LABEL as Record<string, string>)[key] ?? key.replace(/_/g, " ");
