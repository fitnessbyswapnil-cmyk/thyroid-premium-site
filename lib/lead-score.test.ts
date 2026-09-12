import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreBooking, budgetAnswer } from "./lead-score.ts";

// Three answers is the minimum scoreBooking will rank on, so every fixture
// carries two neutral ones alongside the field under test.
const BASE = {
  "investment-level": "I can invest ₹30,000",
  "decision-maker": "No, I need to discuss it with my spouse or family",
};

const earnedFor = (answers: Record<string, unknown>, id: string) =>
  scoreBooking(answers).breakdown.find((b) => b.id === id);

test("bringing the decision maker onto the call is worth 4 of the new 104", () => {
  const yes = earnedFor({ ...BASE, "partner-on-call": "yes" }, "partnerOnCall");
  assert.equal(yes?.earned, 4);
  assert.equal(yes?.max, 4);
});

test("unsure is worth 1, and coming alone costs nothing rather than being punished", () => {
  assert.equal(earnedFor({ ...BASE, "partner-on-call": "unsure" }, "partnerOnCall")?.earned, 1);
  assert.equal(earnedFor({ ...BASE, "partner-on-call": "no" }, "partnerOnCall")?.earned, 0);
});

test("the full option labels score the same as the stored short values", () => {
  assert.equal(
    earnedFor({ ...BASE, "Partner On Call": "Yes, I can bring them" }, "partnerOnCall")?.earned,
    4,
  );
  // "Not sure, I will try" contains the letters of "no"; it must still be 1.
  assert.equal(
    earnedFor({ ...BASE, "Partner On Call": "Not sure, I will try" }, "partnerOnCall")?.earned,
    1,
  );
  assert.equal(
    earnedFor({ ...BASE, "Partner On Call": "No, I will come alone" }, "partnerOnCall")?.earned,
    0,
  );
});

test("a legacy lead with no Partner On Call answer scores exactly as before", () => {
  const legacy = { ...BASE, "how-long-stuck": "more than 2 years" };
  const before = scoreBooking(legacy);
  const after = scoreBooking({ ...legacy, "partner-on-call": "" });
  assert.equal(before.score, after.score);
  // Absent means excluded from both sides of the ratio, not scored zero.
  assert.equal(before.breakdown.some((b) => b.id === "partnerOnCall"), false);
  assert.equal(after.breakdown.some((b) => b.id === "partnerOnCall"), false);
});

test("no existing weight moved when the new input was added", () => {
  const b = scoreBooking({
    "investment-level": "I can invest ₹50,000",
    "decision-maker": "I am the sole decision maker",
    "when-would-you-start": "immediately",
    "previously-paid": "more than ₹25,000",
    "diagnosis": "yes, on medication",
    "weight-to-lose": "10 to 15 kg",
    "how-long-stuck": "more than 2 years",
    "what-happens-when-you-try": "x".repeat(60),
    "age": "41 to 50",
    "city": "pune",
  }).breakdown;
  const max = Object.fromEntries(b.map((x) => [x.id, x.max]));
  assert.deepEqual(max, {
    budget: 26, decision: 18, urgency: 16, priorSpend: 16,
    diagnosis: 8, weight: 6, stuck: 4, story: 3, age: 2, city: 1,
  });
  // Every existing weight earned its top value, so this is still a 100.
  assert.equal(scoreBooking({
    "investment-level": "I can invest ₹50,000",
    "decision-maker": "I am the sole decision maker",
    "when-would-you-start": "immediately",
    "previously-paid": "more than ₹25,000",
    "diagnosis": "yes, on medication",
    "weight-to-lose": "10 to 15 kg",
    "how-long-stuck": "more than 2 years",
    "what-happens-when-you-try": "x".repeat(60),
    "age": "41 to 50",
    "city": "pune",
  }).score, 100);
});

test("the raw ceiling is 104 and the reported score is still capped at 100", () => {
  const perfect = {
    "investment-level": "I can invest ₹50,000",
    "decision-maker": "I am the sole decision maker",
    "partner-on-call": "yes",
    "when-would-you-start": "immediately",
    "previously-paid": "more than ₹25,000",
    "diagnosis": "yes, on medication",
    "weight-to-lose": "10 to 15 kg",
    "how-long-stuck": "more than 2 years",
    "what-happens-when-you-try": "x".repeat(60),
    "age": "41 to 50",
    "city": "pune",
  };
  const s = scoreBooking(perfect);
  assert.equal(s.breakdown.reduce((t, x) => t + x.max, 0), 104);
  assert.equal(s.breakdown.reduce((t, x) => t + x.earned, 0), 104);
  assert.equal(s.score, 100);
});

test("the new rule did not displace the budget answer the dashboard filters on", () => {
  assert.equal(
    budgetAnswer({ "investment-level": "I can invest ₹30,000", "partner-on-call": "yes" }),
    "I can invest ₹30,000",
  );
});
