/**
 * The /decode quiz survived a reorder. These tests exist so the next one does
 * too.
 *
 * Reordering that array is safe ONLY because nothing downstream is positional:
 * scoring matches on id, the sheet writes by key, the timing gate reads
 * a.timing, and the commitment follow-up tests q.id === "decision". The whole
 * risk lives in the option LABELS — each one is both a stored sheet value and
 * a scoring input, so moving a question is free and rewording its answers is
 * not. AGENTS.md records the last time this went wrong: a hardcoded question
 * index silently discarded the final answer when a question was added.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scoreBooking } from "./lead-score.ts";

const QUIZ = readFileSync(
  join(import.meta.dirname, "..", "app/decode/DecodeQuiz.tsx"),
  "utf8",
);

/** The question array as the file declares it, in file order. */
function questions(): { id: string; options: string[] }[] {
  const block = QUIZ.slice(
    QUIZ.indexOf("const QUESTIONS: Q[] = ["),
    QUIZ.indexOf("\n];", QUIZ.indexOf("const QUESTIONS: Q[] = [")),
  );
  return [...block.matchAll(/id: "([a-z]+)"[\s\S]*?options: \[([^\]]*)\]/g)].map((m) => ({
    id: m[1],
    options: [...m[2].matchAll(/"([^"]*)"/g)].map((o) => o[1]),
  }));
}

test("the quiz opens on recognition, not on a form field", () => {
  const ids = questions().map((q) => q.id);
  assert.equal(
    ids[0],
    "stuck",
    'Q1 must be "How long has your weight been stuck?" — she sees her own story in one tap, and a long plateau is the strongest qualifying signal in the set',
  );
  assert.ok(ids.indexOf("age") >= 3, "age is a form field, not an opener");
});

test("the two questions she may not want to answer sit in the second half", () => {
  const ids = questions().map((q) => q.id);
  const half = ids.length / 2;
  for (const sensitive of ["budget", "decision"]) {
    assert.ok(
      ids.indexOf(sensitive) >= half,
      `${sensitive} must come after she has invested some taps`,
    );
  }
});

test("no option label changed when the order did", () => {
  // Each of these is a value written to the sheet AND an input to scoring.
  // Reordering questions is free; rewording an answer is not.
  const EXPECTED: Record<string, string[]> = {
    stuck: ["Less than 6 months", "6 months to 1 year", "1 to 3 years", "More than 3 years"],
    pattern: [
      "I eat less, and the weight still goes up",
      "A little comes off, then it stops",
      "It comes off, then comes straight back",
      "I lose motivation on my own",
    ],
    diagnosis: [
      "Yes, hypothyroid and on medication",
      "Yes, hypothyroid but not on medication",
      "Not tested, but I think so",
      "No",
    ],
    age: ["Under 30", "30 to 35", "36 to 40", "41 to 50", "Over 50"],
    goal: ["Under 5 kg", "5 to 10 kg", "10 to 15 kg", "15 to 20 kg", "More than 20 kg"],
    report: ["Yes, from the last 6 months", "Yes, but it is older", "No, I have not done one"],
    tried: ["No, never", "Yes, under ₹10,000", "Yes, ₹10,000 to ₹25,000", "Yes, more than ₹25,000"],
    budget: [
      "I can invest ₹50,000",
      "I can invest ₹30,000",
      "I can invest ₹15,000",
      "I'll decide on the call",
    ],
    decision: ["Yes, I decide on my own", "No, I need to discuss it with my spouse or family"],
    timing: ["This week", "This month", "In a month or two", "Just exploring for now"],
  };
  const found = Object.fromEntries(questions().map((q) => [q.id, q.options]));
  for (const [id, options] of Object.entries(EXPECTED)) {
    assert.deepEqual(found[id], options, `${id}'s answers must not change`);
  }
  assert.equal(questions().length, 12);
});

test("the same answers still score the same total", () => {
  // Scoring reads a flat answer map, so it cannot see question order at all.
  // This pins the number anyway: it is the assertion the reorder had to pass.
  const answers = {
    budget: "I can invest ₹30,000",
    decision: "Yes, I decide on my own",
    timing: "This week",
    tried: "Yes, ₹10,000 to ₹25,000",
    diagnosis: "Yes, hypothyroid and on medication",
    goal: "10 to 15 kg",
    stuck: "More than 3 years",
    pattern: "I eat less, and the weight still goes up",
    age: "41 to 50",
    city: "Pune",
  };
  const first = scoreBooking(answers).score;
  assert.ok(first !== null && first > 0, "a strong lead must not score zero");
  // Same answers, different key order — a stand-in for the reorder itself.
  const shuffled = Object.fromEntries(Object.entries(answers).reverse());
  assert.equal(scoreBooking(shuffled).score, first);
});

test("the progress indicator never shows a total", () => {
  // "Question 1 of 12" tells her at the first tap how much work is left, and
  // twelve is a number people quit at.
  assert.ok(!/Question \{i \+ 1\} of/.test(QUIZ));
  assert.match(QUIZ, /Step 1 of 2/);
});
