import test from "node:test";
import assert from "node:assert/strict";
import { isConsultFee } from "./fee-flow.ts";
import { CONSULT_MAX_AMOUNT, PROGRAMME_MIN_AMOUNT } from "./metrics.ts";

test("the ₹299 fee and the ₹1 test charge still take the fee flow", () => {
  assert.equal(isConsultFee(299), true);
  assert.equal(isConsultFee(1), true);
  assert.equal(isConsultFee(CONSULT_MAX_AMOUNT), true);
});

test("programme payments from his Cashfree links never take the fee flow", () => {
  for (const amount of [15000, 20000, 25000, 30000, PROGRAMME_MIN_AMOUNT]) {
    assert.equal(isConsultFee(amount), false, `₹${amount}`);
  }
});

test("an instalment is not the fee either", () => {
  assert.equal(isConsultFee(6700), false);
  assert.equal(isConsultFee(CONSULT_MAX_AMOUNT + 1), false);
});

test("the line is lib/metrics' own, so the webhook and the dashboard agree", () => {
  assert.equal(CONSULT_MAX_AMOUNT, 299);
  assert.equal(PROGRAMME_MIN_AMOUNT, 15000);
});
