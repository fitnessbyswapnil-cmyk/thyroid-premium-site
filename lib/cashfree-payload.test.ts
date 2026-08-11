import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, parseLeadId, detectSource } from "./cashfree-payload.ts";

// ── parseLeadId ───────────────────────────────────────────────────────────────
// leadIds themselves contain underscores (quiz_<ts>_<rand>), so splitting on "_"
// and taking index 1 returns "quiz" for every lead. Regression guard.

test("parseLeadId recovers a leadId containing underscores", () => {
  assert.equal(
    parseLeadId("thyroid_quiz_1786356626196_ab12cd_1786400000000"),
    "quiz_1786356626196_ab12cd",
  );
});

test("parseLeadId handles a simple leadId", () => {
  assert.equal(parseLeadId("thyroid_lead123_1786400000000"), "lead123");
});

test("parseLeadId returns empty for unrecognised refs", () => {
  assert.equal(parseLeadId("some-random-link-id"), "");
  assert.equal(parseLeadId(""), "");
});

// ── detectSource ──────────────────────────────────────────────────────────────

test("detectSource distinguishes the three channels", () => {
  assert.equal(detectSource({ order: { order_id: "thyroid_x_1" } }), "ORDER");
  assert.equal(detectSource({ link_id: "thyroid_x_1", link_status: "PAID" }), "LINK");
  assert.equal(detectSource({ form_id: "thyroid-session" }), "FORM");
  assert.equal(detectSource({}), "UNKNOWN");
});

// ── The payload that used to crash the route ─────────────────────────────────
// Cashfree's Payment Link "Test & Add" sends this shape. The old handler read
// body.data.payment.payment_status, threw a TypeError, and returned HTTP 500 —
// which made Cashfree refuse to register the endpoint.

test("Payment Link test payload normalises instead of throwing", () => {
  const cashfreeTestPayload = {
    data: {
      link_id: "payment_ps11",
      link_status: "PARTIALLY_PAID",
      link_amount: "100.00",
      link_amount_paid: "55.00",
      link_currency: "INR",
    },
  };
  const result = normalize(cashfreeTestPayload);
  assert.equal(result.source, "LINK");
  assert.equal(result.status, "PARTIALLY_PAID");
  assert.equal(result.payment, null, "PARTIALLY_PAID must not be treated as revenue");
});

test("Payment Link PAID normalises into a payment", () => {
  const result = normalize({
    data: {
      link_id: "thyroid_quiz_1786356626196_ab12cd_1786400000000",
      link_status: "PAID",
      link_amount_paid: "299.00",
      link_currency: "INR",
      customer_details: {
        customer_name: "Meenal Sharma",
        customer_phone: "9876543210",
        customer_email: "meenal@example.com",
      },
      link_notes: { visitor_id: "v_123", fbc: "fb.1.x.y", fbp: "fb.1.a.b" },
    },
  });
  assert.equal(result.source, "LINK");
  assert.ok(result.payment);
  assert.equal(result.payment.refId, "thyroid_quiz_1786356626196_ab12cd_1786400000000");
  assert.equal(result.payment.amount, 299);
  assert.equal(result.payment.currency, "INR");
  assert.equal(result.payment.phone, "9876543210");
  assert.equal(result.payment.tags.visitor_id, "v_123");
  assert.equal(parseLeadId(result.payment.refId), "quiz_1786356626196_ab12cd");
});

test("Payment Link EXPIRED is ignored", () => {
  const result = normalize({ data: { link_id: "thyroid_a_1", link_status: "EXPIRED" } });
  assert.equal(result.payment, null);
});

// ── The existing gateway path must be unchanged ──────────────────────────────

test("gateway order SUCCESS still normalises exactly as before", () => {
  const result = normalize({
    data: {
      order: {
        order_id: "thyroid_quiz_999_abc_1786400000000",
        order_amount: 299,
        order_currency: "INR",
        order_tags: { visitor_id: "v_777", fbc: "fb.1.c.d", fbp: "fb.1.e.f" },
      },
      payment: { payment_status: "SUCCESS", payment_amount: 299 },
      customer_details: {
        customer_name: "Kavya Ravi",
        customer_phone: "9998887776",
        customer_email: "kavya@example.com",
      },
    },
  });
  assert.equal(result.source, "ORDER");
  assert.ok(result.payment);
  assert.equal(result.payment.refId, "thyroid_quiz_999_abc_1786400000000");
  assert.equal(result.payment.amount, 299);
  assert.equal(result.payment.tags.fbc, "fb.1.c.d");
  assert.equal(result.payment.name, "Kavya Ravi");
});

test("gateway order FAILED produces no payment", () => {
  const result = normalize({
    data: {
      order: { order_id: "thyroid_a_1", order_currency: "INR" },
      payment: { payment_status: "FAILED", payment_amount: 299 },
    },
  });
  assert.equal(result.status, "FAILED");
  assert.equal(result.payment, null);
});

// ── Nothing may throw, whatever arrives ──────────────────────────────────────

test("malformed and empty payloads never throw", () => {
  const nasty = [
    {},
    { data: null },
    { data: "not-an-object" },
    { data: {} },
    { data: { order: null, payment: null } },
    { data: { link_id: null, link_status: null } },
    { data: { order: { order_id: "x" } } }, // ORDER with no payment branch
  ];
  for (const body of nasty) {
    assert.doesNotThrow(() => normalize(body as Record<string, unknown>));
  }
});

test("ORDER shape with a missing payment branch is skipped, not crashed", () => {
  const result = normalize({ data: { order: { order_id: "thyroid_a_1" } } });
  assert.equal(result.source, "ORDER");
  assert.equal(result.payment, null);
});
