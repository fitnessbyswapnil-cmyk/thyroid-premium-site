/**
 * Unit tests for the lead-scoring model. Run: `npm test`
 * (node:test + type-stripping — no extra deps, no network, no Google creds.)
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  scoreLead,
  tierFor,
  scoreCommitment,
  scoreSeverity,
  scoreTried,
  type Answers,
} from "./lead-scoring.ts";

test("tier boundaries", () => {
  assert.equal(tierFor(100), "Best");
  assert.equal(tierFor(70), "Best");
  assert.equal(tierFor(69), "Average");
  assert.equal(tierFor(45), "Average");
  assert.equal(tierFor(44), "Worst");
  assert.equal(tierFor(0), "Worst");
});

test("commitment scale buckets", () => {
  assert.equal(scoreCommitment({ commitment: 10 }), 15);
  assert.equal(scoreCommitment({ commitment: 8 }), 15);
  assert.equal(scoreCommitment({ commitment: 7 }), 8);
  assert.equal(scoreCommitment({ commitment: 5 }), 8);
  assert.equal(scoreCommitment({ commitment: 4 }), 2);
  assert.equal(scoreCommitment({ commitment: 1 }), 2);
  assert.equal(scoreCommitment({}), 0);
});

test("tried & failed counts real attempts only", () => {
  assert.equal(scoreTried({ tried: ["Multiple diets / nutritionists", "Gym / personal trainer"] }), 10);
  assert.equal(scoreTried({ tried: ["Gym / personal trainer"] }), 6);
  assert.equal(scoreTried({ tried: ["Nothing structured yet"] }), 3);
  assert.equal(scoreTried({}), 3);
});

test("severity: diagnosed + weight goal + long struggle = full", () => {
  const full: Answers = {
    diagnosis: "Yes — hypothyroidism",
    goal: "Lose the stubborn weight",
    duration: "Over a year",
  };
  assert.equal(scoreSeverity(full), 15);
  // one strong signal → mild
  assert.equal(scoreSeverity({ diagnosis: "Yes — Hashimoto's" }), 8);
  // nothing → none
  assert.equal(scoreSeverity({ diagnosis: "No, not diagnosed" }), 3);
});

test("perfect lead → 100 / Best", () => {
  const a: Answers = {
    investment: "I can invest ₹50,000",
    timing: "This week",
    commitment: 9,
    diagnosis: "Yes — hypothyroidism",
    goal: "Lose the stubborn weight",
    duration: "Over a year",
    tried: ["Multiple diets / nutritionists", "Online programs / YouTube"],
    profession: "Corporate / IT professional",
  };
  const r = scoreLead(a);
  assert.equal(r.score, 100);
  assert.equal(r.tier, "Best");
});

test("mid lead → Average band", () => {
  const a: Answers = {
    investment: "I can invest ₹15,000", // 15
    timing: "In a month or two", // 12
    commitment: 6, // 8
    diagnosis: "Yes — Hashimoto's", // severity mild = 8
    tried: ["Gym / personal trainer"], // 6
    profession: "Teacher / educator", // 5
  };
  const r = scoreLead(a);
  assert.equal(r.score, 54);
  assert.equal(r.tier, "Average");
});

test("cold lead → Worst band", () => {
  const a: Answers = {
    timing: "Just exploring for now", // 4
    commitment: 2, // 2
    diagnosis: "No, not diagnosed", // 3
    tried: ["Nothing structured yet"], // 3
    profession: "Something else", // 5
    // no investment → 0
  };
  const r = scoreLead(a);
  assert.equal(r.score, 17);
  assert.equal(r.tier, "Worst");
});

test("score is clamped to 0..100", () => {
  const r = scoreLead({});
  assert.ok(r.score >= 0 && r.score <= 100);
});
