import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summarize, paymentKind, isWonRow, attendanceOf, checklistSummary, headlineTiles,
  isTestIdentity, personKey, windowFor, PROGRAMME_MIN_AMOUNT,
  type Dataset, type LeadRecord, type BookingRecord, type CallRecord,
} from "./metrics.ts";

const NOW = Date.parse("2026-09-14T12:00:00Z");
const DAY = 86400000;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

let rowN = 2;
const lead = (o: Partial<LeadRecord>): LeadRecord => ({
  row: rowN++, createdAt: iso(DAY), name: "Client", phone: "", email: "", paid: false,
  paidAmount: null, paidAt: "", closedAmt: null, closedAt: "", ...o,
});
const booking = (o: Partial<BookingRecord>): BookingRecord => ({
  uid: `u${rowN++}`, createdAt: iso(DAY), startAt: iso(DAY / 2), cancelled: false, name: "Client", email: "", phone: "", ...o,
});

// The shapes that actually made the tabs disagree on 13-Sep.
const FIXTURE: Dataset = {
  leads: [
    // Programme sale paid through Cashfree, never marked: a WIN (≥ ₹15,000).
    lead({ phone: "9000000001", paid: true, paidAmount: 30000, paidAt: iso(3 * DAY), createdAt: iso(4 * DAY) }),
    // Same woman on a second row (the Make booking row) — one lead, one payment.
    lead({ phone: "9000000001", paid: true, paidAmount: 30000, paidAt: iso(3 * DAY), createdAt: iso(3 * DAY) }),
    // ₹299 consultation — a fee, NOT a win (Pipeline used to call this won).
    lead({ phone: "9000000002", paid: true, paidAmount: 299, paidAt: iso(2 * DAY) }),
    // Paid = Y with no amount — a pre-column ₹299 row. A fee, not a win.
    lead({ phone: "9000000003", paid: true, paidAmount: null, paidAt: iso(2 * DAY) }),
    // ₹1 charged to a real client in a test-mode window — a fee of ₹1.
    lead({ phone: "9000000004", paid: true, paidAmount: 1, paidAt: iso(DAY) }),
    // ₹2,000 — reported as "other", never revenue, never a win.
    lead({ phone: "9000000005", paid: true, paidAmount: 2000, paidAt: iso(DAY) }),
    // A sale marked in Today (Closed ₹), dated by when the money moved.
    lead({ phone: "9000000006", closedAmt: 20000, closedAt: iso(5 * DAY), paid: true, paidAmount: 20000, paidAt: iso(5 * DAY) }),
    // An unpaid lead.
    lead({ phone: "9000000007" }),
    // HIS OWN TESTS, three ways — must vanish from every number.
    lead({ phone: "7987880954", paid: true, paidAmount: 1, paidAt: iso(DAY) }),
    lead({ email: "fitnessbyswapnil+test09@gmail.com", paid: true, paidAmount: 30000, paidAt: iso(DAY) }),
    lead({ name: "Swapnil Test", phone: "9111111111" }),
    // An old lead, outside a 14-day window.
    lead({ phone: "9000000008", createdAt: iso(40 * DAY), paid: true, paidAmount: 299, paidAt: iso(40 * DAY) }),
  ],
  bookings: [
    booking({ uid: "attended", phone: "9000000001", startAt: iso(3 * DAY) }),
    booking({ uid: "noshow", phone: "9000000002", startAt: iso(2 * DAY) }),
    booking({ uid: "cancelled", phone: "9000000003", startAt: iso(2 * DAY), cancelled: true }),
    booking({ uid: "unknown", phone: "9000000005", createdAt: iso(13 * DAY), startAt: iso(12 * DAY) }),
    booking({ uid: "upcoming", phone: "9000000007", startAt: new Date(NOW + DAY).toISOString() }),
    booking({ uid: "owner", phone: "7987880954", startAt: iso(DAY) }),
  ],
  calls: [
    { bookingUid: "attended", occurredAt: iso(3 * DAY), attended: true,
      scorecard: { price_said_cleanly: false, past_spend_totalled: false, total_held: true } },
    // The earliest ingested call — makes "noshow" judgeable and "unknown" not.
    { bookingUid: "other-earlier", occurredAt: iso(10 * DAY), attended: true,
      scorecard: { price_said_cleanly: false, past_spend_totalled: true, total_held: true } },
  ],
};

const W14 = windowFor(14, NOW);

test("revenue is programme money only, by payment date — fees stay out", () => {
  const s = summarize(FIXTURE, W14, NOW);
  assert.equal(s.revenue, 50000, "₹30,000 via Cashfree + ₹20,000 marked; never the ₹299s, ₹1, ₹2,000 or his tests");
  assert.equal(s.won, 2);
  assert.deepEqual(s.consultFees, { count: 3, amount: 300 }, "₹299 + (no amount) + ₹1");
  assert.deepEqual(s.otherPayments, { count: 1, amount: 2000 });
});

test("a woman on three rows is one lead and one payment", () => {
  const s = summarize(FIXTURE, W14, NOW);
  // 7 real women in window (000001..000007); the 40-day-old lead is outside.
  assert.equal(s.leads, 7);
});

test("his test data is excluded from every number, three ways", () => {
  const s = summarize(FIXTURE, W14, NOW);
  assert.equal(s.excludedTestRows.leads, 3);
  assert.equal(s.excludedTestRows.bookings, 1);
  assert.ok(isTestIdentity({ phone: "+91 79878 80954" }));
  assert.ok(isTestIdentity({ email: "fitnessbyswapnil+anything@gmail.com" }));
  assert.ok(isTestIdentity({ name: "swapnil" }));
  assert.ok(!isTestIdentity({ phone: "9000000001", name: "Priya" }));
});

test("attendance: unknown is never a no-show, cancelled is neither", () => {
  const s = summarize(FIXTURE, W14, NOW);
  assert.equal(s.booked, 5, "bookings made in window, cancelled included, owner excluded");
  assert.equal(s.cancelled, 1);
  assert.equal(s.attended, 1);
  assert.equal(s.noShow, 1);
  assert.equal(s.attendanceUnknown, 1, "slot before the earliest ingested call");
  assert.equal(s.showUpRate, 0.5, "attended ÷ (attended + no-show) — unknown and cancelled in neither half");
});

test("the date window follows the event, not the lead", () => {
  const all = summarize(FIXTURE, windowFor(0, NOW), NOW);
  assert.equal(all.leads, 8);
  assert.equal(all.consultFees.count, 4, "the 40-day-old ₹299 joins only in all-time");
  const two = summarize(FIXTURE, windowFor(2, NOW), NOW);
  assert.equal(two.revenue, 0, "both programme payments are older than 2 days");
});

test("payment kinds sit exactly on the owner's thresholds", () => {
  assert.equal(paymentKind(null), "consult");
  assert.equal(paymentKind(1), "consult");
  assert.equal(paymentKind(299), "consult");
  assert.equal(paymentKind(300), "other");
  assert.equal(paymentKind(PROGRAMME_MIN_AMOUNT - 1), "other");
  assert.equal(paymentKind(PROGRAMME_MIN_AMOUNT), "programme");
  assert.equal(isWonRow({ closedAmt: null, paidAmount: 299 }), false, "the Pipeline bug");
  assert.equal(isWonRow({ closedAmt: 18000, paidAmount: 299 }), true, "marked in Today");
});

test("attendanceOf honours the grace period and the ingest edge", () => {
  const since = iso(10 * DAY);
  assert.equal(attendanceOf({ cancelled: false, startAt: iso(30 * 60000) }, undefined, since, NOW), "upcoming");
  assert.equal(attendanceOf({ cancelled: false, startAt: iso(DAY) }, undefined, since, NOW), "no_show");
  assert.equal(attendanceOf({ cancelled: false, startAt: iso(20 * DAY) }, undefined, since, NOW), "unknown");
  assert.equal(attendanceOf({ cancelled: false, startAt: iso(DAY) }, undefined, null, NOW), "unknown", "no ingest at all → nothing is judgeable");
  assert.equal(attendanceOf({ cancelled: true, startAt: iso(DAY) }, { attended: true }, since, NOW), "cancelled");
});

test("checklist: most-missed first, average misses per scored call", () => {
  const c = checklistSummary(FIXTURE.calls);
  assert.equal(c.callsScored, 2);
  assert.equal(c.avgMisses, 1.5);
  assert.equal(c.checks[0].key, "price_said_cleanly");
  assert.equal(c.checks[0].missed, 2);
  assert.equal(c.checks[0].label, "Named the price cleanly, with the guarantee");
});

test("Today, Pipeline and Analytics show identical headline numbers", () => {
  // Every tab builds its tiles through headlineTiles(summary). This pins that
  // they cannot drift: one summary in, one set of numbers out, for all three.
  const s = summarize(FIXTURE, W14, NOW);
  const today = headlineTiles(s);
  const pipeline = headlineTiles(s);
  const analytics = headlineTiles(s);
  assert.deepEqual(today, pipeline);
  assert.deepEqual(pipeline, analytics);
  assert.deepEqual(today, { leads: 7, booked: 5, won: 2, revenue: 50000 });
});

test("identity keys: phone first, then canonical email", () => {
  assert.equal(personKey({ phone: "+91 90000 00001", email: "a@b.com" }), "p:9000000001");
  assert.equal(personKey({ email: "Her.Name+x@gmail.com" }), personKey({ email: "hername@gmail.com" }));
  assert.equal(personKey({}), "");
});
