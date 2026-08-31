import { test } from "node:test";
import assert from "node:assert/strict";
import {
  milestonesFor,
  missingCount,
  withinDays,
  FOLLOWUP_DUE_HOURS,
  type MilestoneInput,
  type MsEvent,
  type MilestoneId,
} from "./crm-milestones.ts";

const NOW = new Date("2026-08-31T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600000).toISOString();

const base = (over: Partial<MilestoneInput> = {}): MilestoneInput => ({
  hasBooking: true,
  cancelled: false,
  sessionStart: hoursAgo(26),
  call: null,
  paid: false,
  paidAmount: null,
  events: [],
  now: NOW,
  ...over,
});

const get = (ms: ReturnType<typeof milestonesFor>, id: MilestoneId) => ms.find((m) => m.id === id)!;

test("every milestone is present, in a fixed order, every time", () => {
  const ms = milestonesFor(base());
  assert.equal(ms.length, 9);
  assert.deepEqual(ms.map((m) => m.id), [
    "scheduled", "message_sent", "confirmed", "report_received",
    "attended", "price_pitched", "closed", "followup_taken", "followup_needed",
  ]);
});

test("a missing report is NOT a failure — his ads promise reports are optional", () => {
  const ms = milestonesFor(base());
  assert.equal(get(ms, "report_received").state, "not_applicable");
  assert.match(get(ms, "report_received").note ?? "", /optional/i);
});

test("a document OR an image counts as her report — most women photograph the page", () => {
  const doc = milestonesFor(base({ events: [{ at: hoursAgo(30), kind: "message_in", mediaType: "document" }] }));
  assert.equal(get(doc, "report_received").state, "done");

  const img = milestonesFor(base({ events: [{ at: hoursAgo(30), kind: "message_in", mediaType: "image" }] }));
  assert.equal(get(img, "report_received").state, "done");

  const text = milestonesFor(base({ events: [{ at: hoursAgo(30), kind: "message_in" }] }));
  assert.equal(get(text, "report_received").state, "not_applicable");
});

test("nothing is a failure before its time — attendance during the grace window", () => {
  // Slot 10 minutes ago: Fathom has not had time to produce anything.
  const fresh = milestonesFor(base({ sessionStart: hoursAgo(0.16), call: null }));
  assert.equal(get(fresh, "attended").state, "not_applicable");

  // Slot yesterday with still no recording: that IS a gap.
  const stale = milestonesFor(base({ sessionStart: hoursAgo(26), call: null }));
  assert.equal(get(stale, "attended").state, "missing");
});

test("a future booking never reports a missing attendance", () => {
  const ms = milestonesFor(base({ sessionStart: new Date(NOW.getTime() + 3600000).toISOString() }));
  assert.equal(get(ms, "attended").state, "not_applicable");
});

test("the price drop is the story, so it rides in the value", () => {
  const ms = milestonesFor(
    base({ call: { attended: true, pricePitched: 30000, lowestPriceSaid: 20000, occurredAt: hoursAgo(26) } }),
  );
  const p = get(ms, "price_pitched");
  assert.equal(p.state, "done");
  assert.equal(p.value, "₹30,000 → ₹20,000");
  assert.match(p.note ?? "", /came down/i);

  const held = milestonesFor(
    base({ call: { attended: true, pricePitched: 30000, lowestPriceSaid: 30000, occurredAt: hoursAgo(26) } }),
  );
  assert.equal(get(held, "price_pitched").value, "₹30,000");
  assert.equal(get(held, "price_pitched").note, undefined);
});

test("an attended call with no number said is a real failure", () => {
  const ms = milestonesFor(base({ call: { attended: true, pricePitched: null, lowestPriceSaid: null, occurredAt: hoursAgo(26) } }));
  assert.equal(get(ms, "price_pitched").state, "missing");
  assert.match(get(ms, "price_pitched").note ?? "", /no number was ever said/i);
});

test("a no-show never reports a missing price — she was never pitched", () => {
  const ms = milestonesFor(base({ call: { attended: false, pricePitched: null, lowestPriceSaid: null, occurredAt: hoursAgo(26) } }));
  assert.equal(get(ms, "attended").state, "missing");
  assert.equal(get(ms, "price_pitched").state, "not_applicable");
  assert.equal(get(ms, "followup_taken").state, "not_applicable");
});

test("closed carries the amount, and clears what is owed", () => {
  const ms = milestonesFor(
    base({ paid: true, paidAmount: 20000, call: { attended: true, pricePitched: 20000, lowestPriceSaid: 20000, occurredAt: hoursAgo(26) } }),
  );
  assert.equal(get(ms, "closed").value, "₹20,000");
  assert.equal(get(ms, "followup_needed").state, "done");
  assert.equal(get(ms, "followup_needed").value, "closed");
});

test("priced, silent and past the window is the one state allowed to shout", () => {
  const quiet = milestonesFor(
    base({ call: { attended: true, pricePitched: 30000, lowestPriceSaid: 30000, occurredAt: hoursAgo(FOLLOWUP_DUE_HOURS + 25) } }),
  );
  assert.equal(get(quiet, "followup_taken").state, "missing");
  assert.equal(get(quiet, "followup_needed").state, "missing");
  assert.match(get(quiet, "followup_needed").value, /silent/);

  // Same call, but he messaged her an hour ago — nothing is owed.
  const chased = milestonesFor(
    base({
      call: { attended: true, pricePitched: 30000, lowestPriceSaid: 30000, occurredAt: hoursAgo(FOLLOWUP_DUE_HOURS + 25) },
      events: [{ at: hoursAgo(1), kind: "message_out" }],
    }),
  );
  assert.equal(get(chased, "followup_taken").state, "done");
  assert.equal(get(chased, "followup_needed").state, "done");
});

test("confirmation means she replied AFTER we wrote, not merely that she ever wrote", () => {
  const before = milestonesFor(
    base({ events: [{ at: hoursAgo(50), kind: "message_in" }, { at: hoursAgo(40), kind: "message_out" }] }),
  );
  assert.equal(get(before, "confirmed").state, "missing");

  const after = milestonesFor(
    base({ events: [{ at: hoursAgo(40), kind: "message_out" }, { at: hoursAgo(30), kind: "message_in" }] }),
  );
  assert.equal(get(after, "confirmed").state, "done");
});

test("with nothing sent, a missing reply is not her failure", () => {
  const ms = milestonesFor(base({ events: [] }));
  assert.equal(get(ms, "message_sent").state, "missing");
  assert.equal(get(ms, "confirmed").state, "not_applicable");
});

test("a cancelled booking is missing, not done", () => {
  const ms = milestonesFor(base({ hasBooking: false, cancelled: true }));
  assert.equal(get(ms, "scheduled").state, "missing");
  assert.equal(get(ms, "scheduled").value, "cancelled");
});

test("a brand-new lead shows few failures, not a wall of red", () => {
  // The trust test: someone who has done nothing wrong must not look guilty.
  const ms = milestonesFor(base({ hasBooking: true, sessionStart: new Date(NOW.getTime() + 7200000).toISOString(), events: [{ at: hoursAgo(2), kind: "message_out" }] }));
  assert.ok(missingCount(ms) <= 1, `expected at most 1 missing, got ${missingCount(ms)}`);
});

test("withinDays uses the most recent activity, not just the booking", () => {
  const old = { sessionStart: hoursAgo(24 * 10), events: [] as MsEvent[], now: NOW };
  assert.equal(withinDays(old, 3), false);

  const revived = { sessionStart: hoursAgo(24 * 10), events: [{ at: hoursAgo(5), kind: "message_in" }], now: NOW };
  assert.equal(withinDays(revived, 3), true);

  assert.equal(withinDays({ sessionStart: null, events: [], now: NOW }, 3), false);
});
