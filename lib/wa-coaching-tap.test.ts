import { test } from "node:test";
import assert from "node:assert/strict";
import { isCoachingTap } from "./wa-coaching-tap.ts";

// Tested both ways: the guard must catch every coaching tap AND let every
// funnel message through, because a false positive here silently drops a lead.

test("template quick-reply taps from the coaching app are recognised", () => {
  assert.equal(isCoachingTap({ button: { payload: "twd:20261108:y:AbC123xyz0_-Qwe", text: "Yes" } }), true);
  assert.equal(isCoachingTap({ button: { payload: "twd:20261108:m:AbC123xyz0_-Qwe", text: "Mostly" } }), true);
  assert.equal(isCoachingTap({ button: { payload: "twd:20261108:n:AbC123xyz0_-Qwe", text: "No" } }), true);
});

test("the Mostly follow-up reply buttons are recognised", () => {
  for (const code of ["f", "v", "s"]) {
    assert.equal(isCoachingTap({ interactive: { button_reply: { id: `twm:20261108:${code}:AbC123xyz0_-Qwe`, title: "Food" } } }), true);
  }
});

test("funnel template buttons are NOT treated as coaching taps", () => {
  assert.equal(isCoachingTap({ button: { payload: "Yes", text: "Yes" } }), false);
  assert.equal(isCoachingTap({ button: { payload: "BOOK_CALL", text: "Book my call" } }), false);
  assert.equal(isCoachingTap({ button: { text: "Yes" } }), false); // label only, no payload
  assert.equal(isCoachingTap({ interactive: { button_reply: { id: "reschedule", title: "Reschedule" } } }), false);
});

test("plain text, media and empty messages pass through", () => {
  assert.equal(isCoachingTap({}), false);
  assert.equal(isCoachingTap({ button: { payload: "" } }), false);
  // A lead literally typing the prefix in a text message is not a button tap.
  assert.equal(isCoachingTap({ interactive: { button_reply: { id: "" } } }), false);
});

test("the prefix must be at the start, not anywhere in the payload", () => {
  assert.equal(isCoachingTap({ button: { payload: "lead:twd:20261108" } }), false);
  assert.equal(isCoachingTap({ button: { payload: "TWD:20261108:y:x" } }), false);
});
