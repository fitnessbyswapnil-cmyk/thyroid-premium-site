import { test } from "node:test";
import assert from "node:assert/strict";
import { calMetadataConfig, calMetadataKey } from "./cal-metadata.ts";

test("keys are bracketed, which is the only form Cal.com forwards", () => {
  assert.equal(calMetadataKey("fbc"), "metadata[fbc]");
  assert.deepEqual(calMetadataConfig({ fbc: "fb.1.123.abc" }), {
    "metadata[fbc]": "fb.1.123.abc",
  });
});

test("NEVER produces a nested metadata object — the bug this module exists to stop", () => {
  const config = calMetadataConfig({
    fbc: "fb.1.123.abc",
    fbp: "fb.1.123.999",
    visitor_id: "v_1",
  });
  // A nested object would be String()-ed into "[object Object]" by Cal.com's
  // query-string serialiser and arrive at the webhook as {"a":"[object Object]"}.
  assert.equal(config.metadata, undefined);
  for (const value of Object.values(config)) {
    assert.equal(typeof value, "string");
    assert.ok(!value.includes("[object Object]"));
  }
  assert.deepEqual(Object.keys(config).sort(), [
    "metadata[fbc]",
    "metadata[fbp]",
    "metadata[visitor_id]",
  ]);
});

test("empty, null and undefined are dropped, not sent blank", () => {
  // Cal.com stores metadata verbatim, so a blank value arrives as a real key
  // holding nothing and the webhook cannot distinguish it from a real signal.
  assert.deepEqual(
    calMetadataConfig({ fbc: "", fbp: null, visitor_id: undefined, leadId: "l_1" }),
    { "metadata[leadId]": "l_1" },
  );
});

test("no signals at all yields an empty object, safe to spread", () => {
  assert.deepEqual(calMetadataConfig({}), {});
  assert.deepEqual(calMetadataConfig({ fbc: "", fbp: "" }), {});
});

test("numbers are stringified, and zero is kept", () => {
  // qscore is a number at its call site. Zero is a real score, not an absence.
  assert.deepEqual(calMetadataConfig({ qscore: 0 }), { "metadata[qscore]": "0" });
  assert.deepEqual(calMetadataConfig({ qscore: 43 }), { "metadata[qscore]": "43" });
});

test("the full live payload flattens exactly as the webhook reads it", () => {
  // cal-webhook.ts calls metaValue(metadata, 'fbc') etc, which reads
  // payload.metadata.fbc — precisely what these bracketed keys produce.
  const config = calMetadataConfig({
    leadId: "dq_1789846314584_g00lnl",
    orderId: "order_1",
    qscore: 43,
    fbc: "fb.1.1789846314584.TESTCLICK20260919",
    fbp: "fb.1.1789846314584.1234567890",
    visitor_id: "v_1789846314584_abcd1234",
  });
  assert.deepEqual(config, {
    "metadata[leadId]": "dq_1789846314584_g00lnl",
    "metadata[orderId]": "order_1",
    "metadata[qscore]": "43",
    "metadata[fbc]": "fb.1.1789846314584.TESTCLICK20260919",
    "metadata[fbp]": "fb.1.1789846314584.1234567890",
    "metadata[visitor_id]": "v_1789846314584_abcd1234",
  });
});
