import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveStage,
  nextAction,
  agreedButUnpaid,
  NO_SHOW_GRACE_MIN,
  LOST_AFTER_DAYS,
  type StageInput,
  type CallFacts,
} from "./crm-stage.ts";

const NOW = new Date("2026-08-30T12:00:00.000Z");
const iso = (minsFromNow: number) => new Date(NOW.getTime() + minsFromNow * 60000).toISOString();

const base = (over: Partial<StageInput> = {}): StageInput => ({
  hasBooking: false,
  bookingCancelled: false,
  sessionStart: null,
  call: null,
  paid: false,
  now: NOW,
  ...over,
});

const call = (over: Partial<CallFacts> = {}): CallFacts => ({
  attended: true,
  pricePitched: null,
  moneyMovedOnCall: false,
  occurredAt: iso(-120),
  ...over,
});

test("payment outranks everything, including a missing call record", () => {
  assert.equal(deriveStage(base({ paid: true })), "won");
  // Won even when Fathom says she never showed — money is the only proof.
  assert.equal(deriveStage(base({ paid: true, call: call({ attended: false }) })), "won");
});

test("a lead with no booking is new", () => {
  assert.equal(deriveStage(base()), "new");
});

test("a future booking is booked; a cancelled one is cancelled", () => {
  assert.equal(deriveStage(base({ hasBooking: true, sessionStart: iso(60) })), "booked");
  assert.equal(
    deriveStage(base({ hasBooking: true, bookingCancelled: true, sessionStart: iso(60) })),
    "cancelled",
  );
});

test("a slot that just passed is NOT a no-show until Fathom has had time", () => {
  // Inside the grace window: the call may still be running, or the transcript
  // may still be processing. Calling this a no-show sends the wrong message.
  const justInside = base({ hasBooking: true, sessionStart: iso(-(NO_SHOW_GRACE_MIN - 5)) });
  assert.equal(deriveStage(justInside), "booked");

  const past = base({ hasBooking: true, sessionStart: iso(-(NO_SHOW_GRACE_MIN + 5)) });
  assert.equal(deriveStage(past), "no_show");
});

test("an attended call with no price is attended, not pitched", () => {
  assert.equal(deriveStage(base({ hasBooking: true, call: call({ pricePitched: null }) })), "attended");
  assert.equal(deriveStage(base({ hasBooking: true, call: call({ pricePitched: 0 }) })), "attended");
});

test("a price said out loud moves her to pitched", () => {
  assert.equal(deriveStage(base({ hasBooking: true, call: call({ pricePitched: 30000 }) })), "pitched");
});

test("pitched decays to lost only after the follow-up window", () => {
  const stillLive = base({
    hasBooking: true,
    call: call({ pricePitched: 30000, occurredAt: iso(-LOST_AFTER_DAYS * 24 * 60 + 60) }),
  });
  assert.equal(deriveStage(stillLive), "pitched");

  const expired = base({
    hasBooking: true,
    call: call({ pricePitched: 30000, occurredAt: iso(-(LOST_AFTER_DAYS * 24 * 60 + 60)) }),
  });
  assert.equal(deriveStage(expired), "lost");
});

test("absence of a recording is NOT a no-show when nothing has ever looked", () => {
  // The live account had 51 women marked no-show purely because the Fathom
  // ingest had never run. Absence of evidence is not evidence of absence.
  const past = base({ hasBooking: true, sessionStart: iso(-(NO_SHOW_GRACE_MIN + 60)) });

  assert.equal(deriveStage({ ...past, callDataAvailable: false }), "booked");
  // Once ingestion IS producing rows, the same input does mean she never joined.
  assert.equal(deriveStage({ ...past, callDataAvailable: true }), "no_show");
  // Default (flag absent) stays strict, so existing callers are unchanged.
  assert.equal(deriveStage(past), "no_show");
});

test("a recorded no-show wins over the calendar saying booked", () => {
  const s = base({ hasBooking: true, sessionStart: iso(30), call: call({ attended: false }) });
  assert.equal(deriveStage(s), "no_show");
});

test("agreed on the call but no payment is flagged — the gateway-failure case", () => {
  const agreed = base({ hasBooking: true, call: call({ pricePitched: 30000, moneyMovedOnCall: true }) });
  assert.equal(agreedButUnpaid(agreed), true);
  // Still 'pitched', never 'won' — the transcript is a signal, not proof.
  assert.equal(deriveStage(agreed), "pitched");

  assert.equal(agreedButUnpaid({ ...agreed, paid: true }), false);
});

test("next action routes on the REAL objection, not the excuse", () => {
  const s = base({ hasBooking: true, call: call({ pricePitched: 30000 }) });

  assert.match(nextAction("pitched", s, { objection: "needs to ask her husband" }).label, /recording/i);
  assert.match(nextAction("pitched", s, { objection: "wants proof it works" }).label, /report/i);
  assert.match(nextAction("pitched", s, { objection: "cannot afford 30000" }).label, /results gate/i);

  // Money objections must never route to OFFERING a discount. The label names
  // the results gate and explicitly rules the discount out, rather than simply
  // avoiding the word.
  const money = nextAction("pitched", s, { objection: "too expensive" });
  assert.match(money.label, /never a discount/i);
  assert.match(money.reason, /No discount/i);
});

test("an agreed callback time outranks every other next action", () => {
  const s = base({ hasBooking: true, call: call({ pricePitched: 30000 }) });
  const a = nextAction("pitched", s, { objection: "wants proof", agreedCallbackAt: "6.30 pm" });
  assert.match(a.label, /6\.30 pm/);
  assert.equal(a.urgency, "now");
});

test("an attended call with no price is the most urgent coaching failure", () => {
  const a = nextAction("attended", base());
  assert.equal(a.urgency, "now");
  assert.match(a.reason, /never quoted|never said/i);
});

test("cancelled is urgent — she is a live lead with no call on the calendar", () => {
  assert.equal(nextAction("cancelled", base()).urgency, "now");
});
