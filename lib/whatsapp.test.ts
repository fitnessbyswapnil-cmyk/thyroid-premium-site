import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planBookingConfirmation,
  partnerTemplateEnabled,
  formatBookingWhen,
  BOOKING_CONFIRMED_TEMPLATE,
  BOOKING_CONFIRMED_PARTNER_TEMPLATE,
} from "./whatsapp.ts";

const WHEN = "Friday, 19 September 2026 at 06:00 pm";
const ON = { flag: "on", sessionWhen: WHEN, fullName: "Example Person" };

// The flag is the whole safety story: booking_confirmed_partner_v1 is PENDING
// review, and a send naming an unapproved template fails outright.
test("with the flag off nothing changes, whatever the sheet says", () => {
  for (const flag of ["", "off", "OFF", "1", "true", null]) {
    for (const partnerOnCall of ["yes", "unsure", "no", "sole", ""]) {
      const plan = planBookingConfirmation({ ...ON, flag, partnerOnCall });
      assert.equal(plan.template, BOOKING_CONFIRMED_TEMPLATE);
      assert.deepEqual(plan.params, ["Example"]);
      assert.equal(plan.reason, "flag_off");
    }
  }
});

test("only the literal string 'on' arms the partner template", () => {
  assert.equal(partnerTemplateEnabled("on"), true);
  assert.equal(partnerTemplateEnabled("ON"), true);
  assert.equal(partnerTemplateEnabled(" on "), true);
  assert.equal(partnerTemplateEnabled("true"), false);
  assert.equal(partnerTemplateEnabled("1"), false);
  assert.equal(partnerTemplateEnabled("off"), false);
  assert.equal(partnerTemplateEnabled(""), false);
  assert.equal(partnerTemplateEnabled(null), false);
});

// yes / unsure / no all mean "someone else is in this decision". "no" is not a
// refusal of the consultation — it is the case the forwardable message exists
// for, because that person is not currently planning to join.
test("every not-sole-decider answer gets the forwardable template", () => {
  for (const partnerOnCall of ["yes", "unsure", "no", "Yes", " UNSURE ", "No"]) {
    const plan = planBookingConfirmation({ ...ON, partnerOnCall });
    assert.equal(plan.template, BOOKING_CONFIRMED_PARTNER_TEMPLATE, partnerOnCall);
    assert.equal(plan.reason, "partner");
  }
});

// {{1}} of the partner template is the slot, NOT the first name. Getting this
// backwards still delivers — it just greets her with a timestamp — so it is
// exactly the kind of mistake nothing else would catch.
test("the partner template carries the session time as its only parameter", () => {
  const plan = planBookingConfirmation({ ...ON, partnerOnCall: "yes" });
  assert.deepEqual(plan.params, [WHEN]);
});

test("a sole decider and a legacy row both keep the existing template", () => {
  for (const partnerOnCall of ["sole", "n/a", "i decide", "", "   ", null, undefined]) {
    const plan = planBookingConfirmation({ ...ON, partnerOnCall });
    assert.equal(plan.template, BOOKING_CONFIRMED_TEMPLATE, String(partnerOnCall));
    assert.deepEqual(plan.params, ["Example"]);
    assert.equal(plan.reason, "sole_decider");
  }
});

// The column is added to the sheet by a separate change and may simply not be
// there. A missing column must read as "sole decider", never as an error.
test("a missing Partner On Call column is tolerated, not fatal", () => {
  const plan = planBookingConfirmation({ flag: "on", sessionWhen: WHEN, fullName: "Example Person" });
  assert.equal(plan.template, BOOKING_CONFIRMED_TEMPLATE);
  assert.equal(plan.reason, "sole_decider");
});

// "Your consultation is confirmed for ." is worse than the message she gets
// today, so an unformattable slot falls back rather than sending that.
test("no session time falls back instead of confirming an empty slot", () => {
  for (const sessionWhen of ["", "   ", null, undefined]) {
    const plan = planBookingConfirmation({ ...ON, sessionWhen, partnerOnCall: "yes" });
    assert.equal(plan.template, BOOKING_CONFIRMED_TEMPLATE);
    assert.equal(plan.reason, "no_session_time");
  }
});

// Exactly one confirmation per booking: the planner returns one template, so a
// caller cannot send both.
test("the plan names exactly one template and one parameter", () => {
  for (const partnerOnCall of ["yes", "sole", ""]) {
    const plan = planBookingConfirmation({ ...ON, partnerOnCall });
    assert.equal(typeof plan.template, "string");
    assert.equal(plan.params.length, 1);
  }
});

test("a blank name still addresses her as someone", () => {
  const plan = planBookingConfirmation({ flag: "off", fullName: "" });
  assert.deepEqual(plan.params, ["there"]);
});

test("formatBookingWhen joins the halves and survives a missing one", () => {
  assert.equal(formatBookingWhen("Friday, 19 September 2026", "06:00 pm"), WHEN);
  assert.equal(formatBookingWhen("Friday, 19 September 2026", ""), "Friday, 19 September 2026");
  assert.equal(formatBookingWhen("", "06:00 pm"), "06:00 pm");
  assert.equal(formatBookingWhen("", ""), "");
  assert.equal(formatBookingWhen(undefined, undefined), "");
});

// Meta rejects a body parameter containing a newline or tab and fails the whole
// send, so whitespace is collapsed before it ever reaches the API.
test("newlines and tabs never reach a body parameter", () => {
  assert.equal(formatBookingWhen("Friday,\n19 September", "06:00\tpm"), "Friday, 19 September at 06:00 pm");
  const plan = planBookingConfirmation({ ...ON, partnerOnCall: "yes", sessionWhen: "Friday\n\n6 pm" });
  assert.equal(plan.params[0], "Friday 6 pm");
  assert.ok(!/[\n\t]/.test(plan.params[0]));
});
