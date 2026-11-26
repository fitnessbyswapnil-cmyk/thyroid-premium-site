/**
 * The quiz's first question, in a plain module so /decode can show it as a
 * one-tap start (Cialdini's commitment and consistency: a small first yes) and
 * the quiz can accept that answer, from ONE source. Every option label is a
 * stored value and a scoring weight (lib/lead-score.ts), so this copy must not
 * drift from the quiz's: lib/decode-landing.test.ts holds this copy identical
 * to the first entry of QUESTIONS in DecodeQuiz.tsx.
 */
export const FIRST_QUESTION = {
  id: "stuck",
  q: "How long has your weight been stuck?",
  options: ["Less than 6 months", "6 months to 1 year", "1 to 3 years", "More than 3 years"],
};
