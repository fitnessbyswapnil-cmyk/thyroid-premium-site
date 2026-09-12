import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GATE_OUTCOME_HEADER,
  NURTURE_DESTINATION,
  gateOutcome,
  isNurtureGated,
  normalizeGateOutcome,
} from "./decode-gate.ts";

test("starting soon reaches the Rs 299 checkout, exactly as before", () => {
  assert.equal(gateOutcome("This week"), "eligible");
  assert.equal(gateOutcome("This month"), "eligible");
});

test("not starting yet is sent to the free masterclass instead", () => {
  assert.equal(gateOutcome("In a month or two"), "nurture_timing");
  assert.equal(gateOutcome("Just exploring for now"), "nurture_timing");
  assert.equal(NURTURE_DESTINATION, "/webinar");
});

test("an unanswered or unrecognised timing never gates", () => {
  // A gate that fires on missing data closes the checkout silently, for a
  // renamed option or a dropped field, and nobody sees it happen.
  assert.equal(gateOutcome(""), "eligible");
  assert.equal(gateOutcome("   "), "eligible");
  assert.equal(gateOutcome(undefined), "eligible");
  assert.equal(gateOutcome(null), "eligible");
  assert.equal(gateOutcome("Some option nobody has written yet"), "eligible");
});

test("the answer is matched whatever the sheet did to its casing or spacing", () => {
  assert.equal(gateOutcome("  just exploring for now  "), "nurture_timing");
  assert.equal(gateOutcome("THIS WEEK"), "eligible");
});

test("budget and the decision maker are not part of this decision at all", () => {
  // Both are answered before Q10 and neither is an input here. Stated plainly
  // so a future edit that adds one has to delete a test to do it.
  assert.equal(gateOutcome.length, 1);
  assert.equal(gateOutcome("This week"), "eligible");
});

test("a Gate Outcome cell reads back as what was written", () => {
  assert.equal(normalizeGateOutcome("eligible"), "eligible");
  assert.equal(normalizeGateOutcome("nurture_timing"), "nurture_timing");
  assert.equal(normalizeGateOutcome(" NURTURE_TIMING "), "nurture_timing");
});

test("a legacy row with no Gate Outcome column is not a gated row", () => {
  assert.equal(normalizeGateOutcome(""), "");
  assert.equal(normalizeGateOutcome(undefined), "");
  assert.equal(isNurtureGated(""), false);
  assert.equal(isNurtureGated(undefined), false);
  assert.equal(isNurtureGated(null), false);
  assert.equal(isNurtureGated("something else"), false);
});

test("only a row positively stamped nurture_timing is skipped by the cron", () => {
  assert.equal(isNurtureGated("nurture_timing"), true);
  assert.equal(isNurtureGated("eligible"), false);
  assert.equal(GATE_OUTCOME_HEADER, "Gate Outcome");
});
