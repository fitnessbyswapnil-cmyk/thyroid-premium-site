/**
 * lib/cashfree-log: nothing personal reaches a worker log line, and the
 * payload shape the route logs for diagnosis survives. All data is fake.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { maskText, redactForLog, refForLog } from "./cashfree-log.ts";
import { containsPhoneNumber } from "./ledger.ts";

test("a reference with no phone number is logged as it is", () => {
  for (const ref of ["CFPay_thyroid_test2", "thyroid_quiz_1786000000000_ab12cd_1786000000001", "link_test1", ""]) {
    assert.equal(refForLog(ref), ref);
  }
});

test("a form reference carrying her phone becomes a stable hash", () => {
  const ref = "CFForm_382622897_9999900001";
  const logged = refForLog(ref);
  assert.match(logged, /^ref#[0-9a-f]{10}$/);
  assert.ok(!logged.includes("9999900001"));
  assert.equal(refForLog(ref), logged, "the same ref always logs the same way");
  assert.notEqual(refForLog("CFForm_382622897_9999900002"), logged);
  assert.match(refForLog("CFForm_382622897_+919999900001"), /^ref#/);
});

test("maskText hides every phone number and email address in free text", () => {
  const s = maskText('{"customer_phone":"9999900001","alt":"+91 9999900002 x","mail":"test.priya@example.com"}');
  assert.ok(!containsPhoneNumber(s), s);
  assert.ok(!s.includes("@example.com"), s);
  assert.ok(s.includes("[phone]") && s.includes("[email]"));
  assert.equal(maskText("order quiz_1786000000000_ab12cd"), "order quiz_1786000000000_ab12cd", "timestamps are not phones");
});

test("redactForLog keeps the payload's shape, ids, statuses and amounts, and drops her details", () => {
  const body = {
    type: "PAYMENT_FORM_EVENT",
    data: {
      form_id: "382622897",
      form_status: "PAID",
      amount: 5000,
      customer_details: {
        customer_name: "Test Priya",
        customer_email: "test.priya@example.com",
        customer_phone: "9999900001",
        customer_id: "9999900001",
      },
      payment: { cf_payment_id: "5114915270123", payment_status: "SUCCESS", payment_amount: 5000,
        payment_method: { upi: { channel: "collect", upi_id: "testpriya@upi" } } },
      notes: ["call 9999900003"],
      phone_number: 9999900004,
    },
  };
  const out = redactForLog(body) as typeof body;
  const text = JSON.stringify(out);
  for (const secret of ["Test Priya", "test.priya", "9999900001", "9999900003", "9999900004", "testpriya@upi"]) {
    assert.ok(!text.includes(secret), `${secret} leaked: ${text}`);
  }
  assert.equal(out.type, "PAYMENT_FORM_EVENT");
  assert.equal(out.data.form_id, "382622897");
  assert.equal(out.data.form_status, "PAID");
  assert.equal(out.data.amount, 5000);
  assert.equal(out.data.payment.cf_payment_id, "5114915270123");
  assert.equal(out.data.payment.payment_status, "SUCCESS");
  assert.equal(out.data.payment.payment_method.upi.channel, "collect");
  assert.deepEqual(Object.keys(out.data.customer_details), ["customer_name", "customer_email", "customer_phone", "customer_id"], "every key kept");
});
