/**
 * lib/payment-row: what a Cashfree payment does to a Leads row that may
 * already hold one. The dashboard consequences (C8, both orders) are pinned in
 * lib/cashfree-webhook.test.ts; this file pins each decision.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_REFS_PER_ROW, SECOND_CHANNEL_WINDOW_MS, parseAmountCell, planPaidRow, refCellValue, refsIn,
  type StoredPayment,
} from "./payment-row.ts";

const NOW = Date.parse("2026-12-01T12:00:00Z");
const HOUR = 3_600_000;
const blank: StoredPayment = { paid: "", ref: "", amount: "", at: "", status: "" };
const paid = (over: Partial<StoredPayment> = {}): StoredPayment => ({
  paid: "Y", ref: "CFPay_PersonalizThyroid_Fat_Lo_test1", amount: "15000",
  at: new Date(NOW - HOUR).toISOString(), status: "payment_received|15000INR", ...over,
});

test("a fresh row takes the payment as it is, whatever the amount", () => {
  for (const amount of [1, 299, 5000, 20000]) {
    assert.deepEqual(planPaidRow(blank, { refId: "r1", amount }, NOW), {
      action: "write", paidAmount: amount, paymentRef: "r1", reason: "first",
    });
  }
});

test("a row not marked Paid = Y is a fresh row, whatever its cells hold", () => {
  const plan = planPaidRow(paid({ paid: "" }), { refId: "r2", amount: 5000 }, NOW);
  assert.deepEqual(plan, { action: "write", paidAmount: 5000, paymentRef: "r2", reason: "first" });
});

test("a second payment on a new reference is added, and its reference listed", () => {
  const plan = planPaidRow(paid(), { refId: "CFPay_thyroid_test2", amount: 5000 }, NOW);
  assert.deepEqual(plan, {
    action: "write", paidAmount: 20000,
    paymentRef: "CFPay_PersonalizThyroid_Fat_Lo_test1, CFPay_thyroid_test2", reason: "added",
  });
});

test("a replay of ANY reference on the row is a duplicate, not just the latest", () => {
  const row = paid({ ref: "a1, b2", amount: "20000", status: "payment_received|5000INR" });
  assert.deepEqual(planPaidRow(row, { refId: "b2", amount: 5000 }, NOW), { action: "duplicate", reason: "same_ref" });
  assert.deepEqual(planPaidRow(row, { refId: "a1", amount: 15000 }, NOW), { action: "duplicate", reason: "same_ref" });
  assert.equal(planPaidRow(row, { refId: "a", amount: 15000 }, NOW).action, "write", "a prefix is a different reference");
});

test("a paid row with no stored reference stays cautious: duplicate", () => {
  assert.deepEqual(planPaidRow(paid({ ref: "  " }), { refId: "r9", amount: 15000 }, NOW), { action: "duplicate", reason: "no_stored_ref" });
});

test("the same amount on another reference seconds later is one payment on two channels", () => {
  const row = paid({ at: new Date(NOW - 20_000).toISOString() });
  assert.deepEqual(planPaidRow(row, { refId: "link_test1", amount: 15000 }, NOW), { action: "duplicate", reason: "second_channel" });
  // A different amount inside the window is a different payment.
  assert.equal(planPaidRow(row, { refId: "CFPay_thyroid_test2", amount: 5000 }, NOW).action, "write");
  // The same amount after the window is a second real payment (₹15,000 twice = ₹30,000).
  const later = paid({ at: new Date(NOW - SECOND_CHANNEL_WINDOW_MS - 1).toISOString() });
  assert.deepEqual(planPaidRow(later, { refId: "CFPay_PersonalizThyroid_Fat_Lo_test3", amount: 15000 }, NOW), {
    action: "write", paidAmount: 30000,
    paymentRef: "CFPay_PersonalizThyroid_Fat_Lo_test1, CFPay_PersonalizThyroid_Fat_Lo_test3", reason: "added",
  });
});

test("the second-channel check compares the LATEST payment (Status), not her total", () => {
  // ₹15,000 + ₹5,000 = ₹20,000 on the row; the ₹5,000 arrives again on its link id.
  const row = paid({ ref: "a1, b2", amount: "20000", at: new Date(NOW - 15_000).toISOString(), status: "payment_received|5000INR" });
  assert.deepEqual(planPaidRow(row, { refId: "link_b2", amount: 5000 }, NOW), { action: "duplicate", reason: "second_channel" });
  // Status overwritten or unreadable: no copy can be recognised, so the payment is recorded.
  assert.equal(planPaidRow({ ...row, status: "lead_captured" }, { refId: "link_b2", amount: 5000 }, NOW).action, "write");
  // Unparseable Paid At: likewise.
  assert.equal(planPaidRow({ ...row, at: "" }, { refId: "link_b2", amount: 5000 }, NOW).action, "write");
});

test("an old consultation fee (₹299 or less) is replaced, never added into programme money", () => {
  for (const amount of ["299", "1", "₹299.00"]) {
    const plan = planPaidRow(paid({ ref: "fee1", amount, status: "payment_received|299INR" }), { refId: "p1", amount: 15000 }, NOW);
    assert.deepEqual(plan, { action: "write", paidAmount: 15000, paymentRef: "fee1, p1", reason: "replaces_fee" }, amount);
  }
  // ₹300 is not a fee: it is added.
  assert.equal((planPaidRow(paid({ ref: "x", amount: "300" }), { refId: "p1", amount: 15000 }, NOW) as { paidAmount: number }).paidAmount, 15300);
});

test("an unreadable stored amount is replaced", () => {
  for (const amount of ["", "n/a", "0"]) {
    const plan = planPaidRow(paid({ ref: "x", amount }), { refId: "p1", amount: 5000 }, NOW);
    assert.deepEqual(plan, { action: "write", paidAmount: 5000, paymentRef: "x, p1", reason: "replaces_unreadable" }, JSON.stringify(amount));
  }
});

test("formatted amounts read the way lib/metrics-source reads them", () => {
  assert.equal(parseAmountCell("₹15,000.00"), 15000);
  assert.equal(parseAmountCell("15,000"), 15000);
  assert.equal(parseAmountCell("20000"), 20000);
  assert.equal(parseAmountCell(""), null);
  assert.equal(parseAmountCell("—"), null);
  const plan = planPaidRow(paid({ amount: "₹15,000.00" }), { refId: "p2", amount: 5000.5 }, NOW);
  assert.equal((plan as { paidAmount: number }).paidAmount, 20000.5);
});

test("a numeric reference is written as text and still matches its replay", () => {
  assert.equal(refCellValue("5114915270123"), "'5114915270123");
  assert.equal(refCellValue("CFPay_thyroid_test2"), "CFPay_thyroid_test2");
  assert.equal(refCellValue("5114915270123, CFPay_thyroid_test2"), "5114915270123, CFPay_thyroid_test2", "a list is already text");
  // Read back with the apostrophe (a plain-text column keeps it) or without it.
  for (const cell of ["'5114915270123", "5114915270123"]) {
    assert.deepEqual(planPaidRow(paid({ ref: cell }), { refId: "5114915270123", amount: 15000 }, NOW), { action: "duplicate", reason: "same_ref" }, cell);
  }
});

test("Payment Ref parsing and its cap", () => {
  assert.deepEqual(refsIn("a1, b2,c3  d4"), ["a1", "b2", "c3", "d4"]);
  assert.deepEqual(refsIn(""), []);
  const many = Array.from({ length: MAX_REFS_PER_ROW }, (_, i) => `r${i}`).join(", ");
  const plan = planPaidRow(paid({ ref: many }), { refId: "new", amount: 5000 }, NOW);
  const kept = refsIn((plan as { paymentRef: string }).paymentRef);
  assert.equal(kept.length, MAX_REFS_PER_ROW);
  assert.equal(kept.at(-1), "new");
});
