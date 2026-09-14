import { test } from "node:test";
import assert from "node:assert/strict";
import {
  journeysOf,
  funnelOf,
  pipelineCounts,
  needsActionOf,
  nurtureMoves,
  ratchet,
  fillInferred,
  FUNNEL_STAGES,
  OVERDUE_AFTER_MIN,
  type Journey,
} from "./journey.ts";
import type { BookingRecord, CallRecord, Dataset, LeadRecord, MessageEvent } from "./metrics.ts";

const NOW = Date.parse("2026-09-14T12:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (t: number) => new Date(t).toISOString();

let rowNo = 1;
const lead = (o: Partial<LeadRecord> & { phone: string }): LeadRecord => ({
  row: ++rowNo,
  createdAt: iso(NOW - 2 * DAY),
  name: "Anita Rao",
  email: "",
  paid: false,
  paidAmount: null,
  paidAt: "",
  closedAmt: null,
  closedAt: "",
  programmeValue: null,
  programmeCollected: null,
  ...o,
});
const booking = (o: Partial<BookingRecord> & { uid: string; phone: string }): BookingRecord => ({
  createdAt: iso(NOW - 10 * DAY),
  startAt: iso(NOW - 5 * DAY),
  cancelled: false,
  name: "Anita Rao",
  email: "",
  ...o,
});
const call = (o: Partial<CallRecord> & { bookingUid: string }): CallRecord => ({
  occurredAt: iso(NOW - 5 * DAY),
  attended: true,
  scorecard: null,
  ...o,
});
const msg = (phone: string, at: number, dir: "in" | "out", manual = true): MessageEvent => ({ phone, at: iso(at), dir, manual, mediaType: "" });

const run = (data: Dataset, stored?: Parameters<typeof journeysOf>[1]["stored"]) => journeysOf(data, { now: NOW, stored });
const one = (js: Journey[], phone: string) => js.find((j) => j.phone === phone)!;

test("a sale marked straight from booked fills attended and pitched as inferred", () => {
  const data: Dataset = {
    leads: [lead({ phone: "9000000101", paidAmount: 30000, paid: true, paidAt: iso(NOW - 3 * DAY) })],
    bookings: [booking({ uid: "b1", phone: "9000000101" })],
    calls: [],
  };
  const j = one(run(data), "9000000101");
  assert.equal(j.furthest, "won");
  assert.equal(j.state, "won");
  assert.deepEqual(j.inferredStages, ["attended", "pitched"]);
  assert.equal(j.reached.booked?.inferred, false);
  assert.equal(j.reached.won?.inferred, false);
});

test("the funnel never has more Won than Attended, or any step above the one before", () => {
  // A spread of journeys: booked only, attended, pitched by checklist, won with no call.
  const data: Dataset = {
    leads: [
      lead({ phone: "9000000201" }),
      lead({ phone: "9000000202" }),
      lead({ phone: "9000000203" }),
      lead({ phone: "9000000204", paidAmount: 20000, paid: true, paidAt: iso(NOW - DAY) }),
      lead({ phone: "9000000205", closedAmt: 25000, closedAt: iso(NOW - DAY) }),
    ],
    bookings: [
      booking({ uid: "c2", phone: "9000000202" }),
      booking({ uid: "c3", phone: "9000000203" }),
      booking({ uid: "c4", phone: "9000000204" }),
    ],
    calls: [
      call({ bookingUid: "c2" }),
      call({ bookingUid: "c3", scorecard: { price_said_cleanly: true } }),
    ],
  };
  const steps = funnelOf(run(data), { from: null, to: NOW + 1 });
  const n = Object.fromEntries(steps.map((s) => [s.stage, s.n]));
  // 205 won with no booking at all: booked, attended and pitched are inferred for her.
  assert.deepEqual(n, { new: 5, booked: 4, attended: 4, pitched: 3, won: 2 });
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i].n <= steps[i - 1].n, `${steps[i].stage} ≤ ${steps[i - 1].stage}`);
  assert.ok(n.attended >= n.won);
  // Pitched via the checklist is observed, not inferred.
  assert.equal(one(run(data), "9000000203").reached.pitched?.inferred, false);
});

test("a stored stage is never lost, even when its evidence disappears", () => {
  const derived = fillInferred({ new: iso(NOW - 9 * DAY) });
  const stored = fillInferred({ new: iso(NOW - 9 * DAY), booked: iso(NOW - 8 * DAY), attended: iso(NOW - 7 * DAY) });
  const r = ratchet(derived, stored);
  assert.ok(r.attended && r.booked);
  // Observed beats inferred for the same stage.
  const r2 = ratchet(fillInferred({ won: iso(NOW) }), fillInferred({ attended: iso(NOW - DAY) }));
  assert.equal(r2.attended?.inferred, false);
  assert.equal(r2.pitched?.inferred, true);
  for (const s of FUNNEL_STAGES) assert.ok(r2[s], `${s} filled`);
});

test("one woman across a phone-only row, an email row and a booking is one person", () => {
  const data: Dataset = {
    leads: [
      lead({ phone: "9000000301", email: "" }),
      lead({ phone: "", email: "anita.rao@gmail.com" }),
      lead({ phone: "9000000301", email: "anita.rao@gmail.com" }),
    ],
    bookings: [booking({ uid: "p1", phone: "", email: "Anita.Rao@gmail.com" })],
    calls: [],
  };
  assert.equal(run(data).length, 1);
});

test("the payment placeholder address never joins two women", () => {
  const data: Dataset = {
    leads: [
      lead({ phone: "9000000401", email: "noreply@swapnilumbarkarfitness.in" }),
      lead({ phone: "9000000402", email: "noreply@swapnilumbarkarfitness.in" }),
    ],
    bookings: [],
    calls: [],
  };
  const js = run(data);
  assert.equal(js.length, 2, "two women, and neither is flagged as his test");
});

test("nurture: 30 quiet days moves her; a message brings her straight back; won never moves", () => {
  const quiet = lead({ phone: "9000000501", createdAt: iso(NOW - 45 * DAY) });
  const wonOld = lead({ phone: "9000000502", createdAt: iso(NOW - 90 * DAY), closedAmt: 20000, closedAt: iso(NOW - 80 * DAY) });
  const fresh = lead({ phone: "9000000503", createdAt: iso(NOW - 45 * DAY) });
  const data: Dataset = {
    leads: [quiet, wonOld, fresh],
    bookings: [],
    calls: [],
    messages: [msg("9000000503", NOW - 2 * DAY, "in")],
  };
  const js = run(data);
  const { move } = nurtureMoves(js);
  assert.deepEqual(move.map((j) => j.phone), ["9000000501"]);
  assert.equal(one(js, "9000000501").state, "new", "not in nurture until the job has moved her");

  // After the job ran: stored nurture → state nurture, out of the pipeline count.
  const stored = new Map([["p:9000000501", { reached: {}, nurtureSince: NOW - DAY }]]);
  const after = run(data, stored);
  assert.equal(one(after, "9000000501").state, "nurture");
  const counts = pipelineCounts(after);
  assert.equal(counts.nurture, 1);
  assert.equal(counts.inPipeline, 1, "the woman who messaged is still open; won is not");

  // She replies: released on the spot, before any job runs.
  const replied = run({ ...data, messages: [...data.messages!, msg("9000000501", NOW - HOUR, "in")] }, stored);
  assert.notEqual(one(replied, "9000000501").state, "nurture");
  assert.deepEqual(nurtureMoves(replied).release.map((j) => j.phone), ["9000000501"]);
});

test("an upcoming call keeps her out of nurture however quiet she has been", () => {
  const data: Dataset = {
    leads: [lead({ phone: "9000000601", createdAt: iso(NOW - 60 * DAY) })],
    bookings: [booking({ uid: "u1", phone: "9000000601", createdAt: iso(NOW - 40 * DAY), startAt: iso(NOW + 2 * DAY) })],
    calls: [],
  };
  assert.equal(nurtureMoves(run(data)).move.length, 0);
});

test("needs action: oldest first, overdue past 6 hours, one item per woman", () => {
  const data: Dataset = {
    leads: [
      lead({ phone: "9000000701", createdAt: iso(NOW - 32 * HOUR) }),
      lead({ phone: "9000000702", createdAt: iso(NOW - 35 * 60_000) }),
      lead({ phone: "9000000703", createdAt: iso(NOW - 5 * HOUR) }),
    ],
    bookings: [],
    calls: [],
  };
  const na = needsActionOf(run(data), data, NOW);
  assert.deepEqual(na.items.map((i) => i.phone), ["9000000701", "9000000703", "9000000702"]);
  assert.equal(na.count, 3);
  assert.equal(na.overdue, 1);
  assert.equal(na.items[0].tone, "red");
  assert.equal(na.items[1].tone, "amber");
  assert.equal(na.items[2].tone, "neutral");
  assert.ok(na.items[0].waitMin > OVERDUE_AFTER_MIN);
});

test("an automated welcome clears 'first message'; only a hand-typed message clears a rebook", () => {
  const data: Dataset = {
    leads: [
      lead({ phone: "9000000801", createdAt: iso(NOW - 3 * HOUR) }),
      lead({ phone: "9000000802", createdAt: iso(NOW - 20 * DAY) }),
    ],
    bookings: [booking({ uid: "ns", phone: "9000000802", startAt: iso(NOW - 2 * DAY), createdAt: iso(NOW - 4 * DAY) })],
    calls: [call({ bookingUid: "ns", attended: false, occurredAt: iso(NOW - 2 * DAY) })],
    messages: [
      msg("9000000801", NOW - 3 * HOUR + 30_000, "out", false), // welcome template
      msg("9000000802", NOW - DAY, "out", false), // automated no-show template
    ],
  };
  const na = needsActionOf(run(data), data, NOW);
  assert.deepEqual(na.items.map((i) => [i.phone, i.kind]), [["9000000802", "rebook_no_show"]]);

  const typed = { ...data, messages: [...data.messages!, msg("9000000802", NOW - HOUR, "out", true)] };
  assert.equal(needsActionOf(run(typed), typed, NOW).count, 0);
});

test("unknown attendance asks to be marked and is not cleared by a message", () => {
  const data: Dataset = {
    leads: [lead({ phone: "9000000901", createdAt: iso(NOW - 6 * DAY) })],
    bookings: [booking({ uid: "k1", phone: "9000000901", startAt: iso(NOW - DAY) })],
    // Coverage ends well before her slot, so no recording means unknown.
    calls: [call({ bookingUid: "other", occurredAt: iso(NOW - 20 * DAY) })],
    messages: [msg("9000000901", NOW - HOUR, "out", true)],
  };
  const na = needsActionOf(run(data), data, NOW);
  assert.deepEqual(na.items.map((i) => i.kind), ["mark_call"]);
});

test("won, booked-ahead and nurture women never need action", () => {
  const data: Dataset = {
    leads: [
      lead({ phone: "9000001001", paidAmount: 15000, paid: true, paidAt: iso(NOW - HOUR), createdAt: iso(NOW - 2 * HOUR) }),
      lead({ phone: "9000001002", createdAt: iso(NOW - 2 * HOUR) }),
    ],
    bookings: [booking({ uid: "ahead", phone: "9000001002", createdAt: iso(NOW - HOUR), startAt: iso(NOW + DAY) })],
    calls: [],
  };
  assert.equal(needsActionOf(run(data), data, NOW).count, 0);
});
