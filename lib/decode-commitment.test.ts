import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DECIDES_ALONE,
  PARTNER_ON_CALL_OPTIONS,
  needsPartnerQuestion,
  normalizePartnerOnCall,
  partnerOnCallValue,
} from "./decode-commitment.ts";

const SHARED = "No, I need to discuss it with my spouse or family";

test("the follow-up is shown only when the decision is shared", () => {
  assert.equal(needsPartnerQuestion(SHARED), true);
  assert.equal(needsPartnerQuestion(DECIDES_ALONE), false);
});

test("an unanswered Q9 shows nothing, because she has not said the decision is shared", () => {
  assert.equal(needsPartnerQuestion(""), false);
  assert.equal(needsPartnerQuestion("   "), false);
  assert.equal(needsPartnerQuestion(undefined), false);
  assert.equal(needsPartnerQuestion(null), false);
});

test("each option label maps to the short value the sheet stores", () => {
  assert.deepEqual(
    PARTNER_ON_CALL_OPTIONS.map((o) => o.value),
    ["yes", "unsure", "no"],
  );
  assert.equal(normalizePartnerOnCall("Yes, I can bring them"), "yes");
  assert.equal(normalizePartnerOnCall("Not sure, I will try"), "unsure");
  assert.equal(normalizePartnerOnCall("No, I will come alone"), "no");
});

test("a value already in short form reads back unchanged, in any casing", () => {
  assert.equal(normalizePartnerOnCall("yes"), "yes");
  assert.equal(normalizePartnerOnCall("UNSURE"), "unsure");
  assert.equal(normalizePartnerOnCall(" No "), "no");
});

test("anything unrecognised becomes empty rather than being guessed at", () => {
  assert.equal(normalizePartnerOnCall("maybe later"), "");
  assert.equal(normalizePartnerOnCall(""), "");
  assert.equal(normalizePartnerOnCall(undefined), "");
});

test("a woman who decides alone stores nothing, even if an answer somehow arrives", () => {
  assert.equal(partnerOnCallValue(DECIDES_ALONE, "Yes, I can bring them"), "");
  assert.equal(partnerOnCallValue(DECIDES_ALONE, ""), "");
  // An empty Q9 is the legacy lead: the question did not exist when she answered.
  assert.equal(partnerOnCallValue("", "Yes, I can bring them"), "");
});

test("a shared decision stores whichever of the three she tapped", () => {
  assert.equal(partnerOnCallValue(SHARED, "Yes, I can bring them"), "yes");
  assert.equal(partnerOnCallValue(SHARED, "Not sure, I will try"), "unsure");
  assert.equal(partnerOnCallValue(SHARED, "No, I will come alone"), "no");
});
