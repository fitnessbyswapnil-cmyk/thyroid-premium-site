/**
 * The free-funnel booking nudge, scenario by scenario.
 *
 * This job messages women who never booked, so every one of its mistakes is a
 * message to the wrong person: a woman who already has a call in the diary, a
 * woman who paid, or the same woman twice. Each of those is a separate test
 * below, because each has its own way of going wrong on real sheet data.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  planFreeBookingNudges,
  FREE_NUDGE_STAGE1_MIN_HOURS,
  FREE_NUDGE_STAGE1_MAX_DAYS,
  FREE_NUDGE_STAGE2_MIN_HOURS,
  FREE_NUDGE_MAX_AGE_DAYS,
  FREE_NUDGE_STAGE1,
  FREE_NUDGE_STAGE2,
  isWithinSendingHoursIST,
  type FreeBookingNudgeColumns,
} from "./reminder-plan.ts";

const COLS: FreeBookingNudgeColumns = {
  name: 0, phone: 1, createdAt: 2, paid: 3, bookingStatus: 4, sessionDate: 5, email: 6, nudgeSent: 7,
  gateOutcome: 8,
};

const NOW = Date.parse("2026-09-24T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

type RowOpts = {
  name?: string; phone?: string; age?: number;
  paid?: string; bookingStatus?: string; sessionDate?: string; nudged?: string;
  createdAt?: string; email?: string;
  /** "Gate Outcome": "eligible", "nurture_timing", or "" for a legacy row. */
  gate?: string;
};
function row(o: RowOpts = {}): string[] {
  return [
    o.name ?? "Priya Sharma",
    o.phone ?? "9876543210",
    o.createdAt ?? hoursAgo(o.age ?? 24),
    o.paid ?? "",
    o.bookingStatus ?? "",
    o.sessionDate ?? "",
    o.email ?? "",
    o.nudged ?? "",
    o.gate ?? "",
  ];
}
const plan = (rows: string[][], over: Partial<Parameters<typeof planFreeBookingNudges>[0]> = {}) =>
  planFreeBookingNudges({ rows, cols: COLS, now: NOW, ...over });

test("a woman who took the quiz yesterday and never booked is nudged", () => {
  const p = plan([row({ age: 24 })]);
  assert.equal(p.candidates.length, 1);
  assert.equal(p.candidates[0].phone, "9876543210");
  assert.equal(p.candidates[0].rowNumber, 2, "row 1 is the header");
});

test("she is left alone until the next day", () => {
  const p = plan([row({ age: FREE_NUDGE_STAGE1_MIN_HOURS - 1 })]);
  assert.equal(p.candidates.length, 0);
  assert.equal(p.skipped.tooNew, 1);
});

test("stage 1 lets go after its window rather than chasing forever", () => {
  const p = plan([row({ age: FREE_NUDGE_STAGE1_MAX_DAYS * 24 + 1 })]);
  assert.equal(p.candidates.length, 0);
  assert.equal(p.skipped.tooOld, 1);
});

test("a booking recorded in EITHER column stops the nudge", () => {
  for (const booked of [{ bookingStatus: "Booked" }, { sessionDate: "2026-09-28T15:30:00Z" }]) {
    const p = plan([row(booked)]);
    assert.equal(p.candidates.length, 0, JSON.stringify(booked));
    assert.equal(p.skipped.alreadyBooked, 1);
  }
});

test("a CANCELLED booking is still a booking, and never gets this message", () => {
  // She cancelled deliberately. "Your slot is still open" would be the wrong
  // sentence, and it is the booking pipeline's job to re-engage her, not this
  // one's.
  const p = plan([row({ bookingStatus: "Cancelled" })]);
  assert.equal(p.candidates.length, 0);
  assert.equal(p.skipped.alreadyBooked, 1);
});

test("a woman who paid is never told the call is free", () => {
  const p = plan([row({ paid: "Y" })]);
  assert.equal(p.candidates.length, 0);
  assert.equal(p.skipped.paid, 1);
});

test("the same stage never fires twice", () => {
  const p = plan([row({ nudged: "Y" })]);
  assert.equal(p.candidates.length, 0);
  assert.equal(p.skipped.alreadyNudged, 1);
});

test("a row without a usable phone number is skipped, not guessed at", () => {
  for (const phone of ["", "12345", "not a number"]) {
    const p = plan([row({ phone })]);
    assert.equal(p.candidates.length, 0, phone);
    assert.equal(p.skipped.noPhone, 1);
  }
});

test("a trailing .0 from Sheets does not break the phone", () => {
  const p = plan([row({ phone: "9876543210.0" })]);
  assert.equal(p.candidates.length, 1);
  assert.equal(p.candidates[0].phone, "9876543210");
});

test("a timestamp we cannot read is counted, never treated as due", () => {
  const p = plan([row({ createdAt: "sometime last week" })]);
  assert.equal(p.candidates.length, 0);
  assert.equal(p.skipped.unparseableTime, 1);
});

test("she retook the quiz and booked on the newer row — neither row is nudged", () => {
  // The killer case. Her booking lives on row 3; row 2 looks unbooked on its
  // own and would otherwise earn a "your slot is still open" message hours
  // after she picked one.
  const p = plan([
    row({ age: 30 }),
    row({ age: 24, bookingStatus: "Booked" }),
  ]);
  assert.equal(p.candidates.length, 0);
  assert.equal(p.skipped.duplicatePhone + p.skipped.alreadyBooked, 2);
});

test("she retook the quiz and booked nothing — she still hears from us once", () => {
  const p = plan([row({ age: 30 }), row({ age: 24 })]);
  assert.equal(p.candidates.length, 1, "one woman, one message");
  assert.equal(p.skipped.duplicatePhone, 1);
});

test("a paid row elsewhere settles her other rows too", () => {
  const p = plan([row({ age: 30 }), row({ age: 24, paid: "Y" })]);
  assert.equal(p.candidates.length, 0);
});

test("freshest quiz first, so the warmest lead is inside the cap", () => {
  const p = plan([
    row({ phone: "9000000001", age: 70 }),
    row({ phone: "9000000002", age: 22 }),
    row({ phone: "9000000003", age: 46 }),
  ]);
  assert.deepEqual(p.candidates.map((c) => c.phone), ["9000000002", "9000000003", "9000000001"]);
});

test("the cap holds and the overflow is reported rather than dropped silently", () => {
  const rows = Array.from({ length: 5 }, (_, i) =>
    row({ phone: `90000000${String(i).padStart(2, "0")}`, age: 24 }));
  const p = plan(rows, { limit: 2 });
  assert.equal(p.candidates.length, 2);
  assert.equal(p.skipped.overCap, 3);
  assert.equal(p.scanned, 5);
});

test("stage 2 picks up exactly where stage 1 stops, with no overlap and no gap", () => {
  const stage2 = { minAgeHours: FREE_NUDGE_STAGE2_MIN_HOURS, maxAgeDays: FREE_NUDGE_MAX_AGE_DAYS };
  assert.equal(
    FREE_NUDGE_STAGE2_MIN_HOURS,
    FREE_NUDGE_STAGE1_MAX_DAYS * 24,
    "a gap here would strand her between the two stages",
  );
  // Inside stage 1's window, stage 2 must not fire.
  assert.equal(plan([row({ age: 24 })], stage2).candidates.length, 0);
  // Inside stage 2's window, stage 1 must not fire.
  assert.equal(plan([row({ age: 96 })]).candidates.length, 0);
  assert.equal(plan([row({ age: 96 })], stage2).candidates.length, 1);
  // And stage 2 lets go at ten days.
  assert.equal(plan([row({ age: FREE_NUDGE_MAX_AGE_DAYS * 24 + 1 })], stage2).candidates.length, 0);
});

test("Cal.com's booking state beats the sheet, which drops most write-backs", () => {
  // The most dangerous row in the whole job: booked on Cal.com, but the Make
  // scenario never stamped either booking column, so the sheet swears she is
  // unbooked. Without Cal.com she gets "your slot is still open" hours after
  // picking one.
  const booked = new Set(["priya@example.com"]);
  const r = row({ age: 24, email: "priya@example.com" });
  assert.equal(plan([r]).candidates.length, 1, "the sheet alone sees nothing");
  assert.equal(plan([r], { bookedEmails: booked }).candidates.length, 0);
  assert.equal(plan([r], { bookedEmails: booked }).skipped.alreadyBooked, 1);
});

test("email matching is case-insensitive and ignores a blank email", () => {
  const booked = new Set(["priya@example.com"]);
  assert.equal(plan([row({ age: 24, email: "Priya@Example.com" })], { bookedEmails: booked }).candidates.length, 0);
  assert.equal(plan([row({ age: 24, email: "" })], { bookedEmails: booked }).candidates.length, 1);
});

test("an empty sheet is a quiet no-op, not a crash", () => {
  const p = plan([]);
  assert.equal(p.candidates.length, 0);
  assert.equal(p.scanned, 0);
});

test("short and ragged rows do not throw", () => {
  const p = plan([[], ["Priya"], ["Priya", "9876543210"]]);
  assert.equal(p.candidates.length, 0);
  assert.equal(p.scanned, 3);
});

test("nudges are held outside civil hours in India", () => {
  // 03:00 IST is 21:30 UTC the day before; 10:00 IST is 04:30 UTC.
  assert.equal(isWithinSendingHoursIST(Date.parse("2026-09-23T21:30:00Z")), false, "3am IST");
  assert.equal(isWithinSendingHoursIST(Date.parse("2026-09-24T04:30:00Z")), true, "10am IST");
  assert.equal(isWithinSendingHoursIST(Date.parse("2026-09-24T03:29:00Z")), false, "8:59am IST");
  assert.equal(isWithinSendingHoursIST(Date.parse("2026-09-24T03:31:00Z")), true, "9:01am IST");
  assert.equal(isWithinSendingHoursIST(Date.parse("2026-09-24T15:29:00Z")), true, "8:59pm IST");
  assert.equal(isWithinSendingHoursIST(Date.parse("2026-09-24T15:31:00Z")), false, "9:01pm IST");
});

// ── "Not now" leads: the day-3 nudge only (D7) ──────────────────────────────
//
// She answered "In a month or two" or "Just exploring for now". The cron
// spreads FREE_NUDGE_STAGE1 and FREE_NUDGE_STAGE2 into the planner exactly as
// below (lib/decode-not-now.test.ts holds the route to that), so these tests
// run the same rules the route sends with.

const NOT_NOW = "nurture_timing";
type PlanOver = Partial<Parameters<typeof planFreeBookingNudges>[0]>;
const stage1 = (rows: string[][], over: PlanOver = {}) => plan(rows, { ...FREE_NUDGE_STAGE1, ...over });
const stage2 = (rows: string[][], over: PlanOver = {}) => plan(rows, { ...FREE_NUDGE_STAGE2, ...over });

test("the stage rules are the windows the cron always used, plus who each one is for", () => {
  assert.deepEqual(FREE_NUDGE_STAGE1, {
    minAgeHours: FREE_NUDGE_STAGE1_MIN_HOURS, maxAgeDays: FREE_NUDGE_STAGE1_MAX_DAYS, includeNurture: false,
  });
  assert.deepEqual(FREE_NUDGE_STAGE2, {
    minAgeHours: FREE_NUDGE_STAGE2_MIN_HOURS, maxAgeDays: FREE_NUDGE_MAX_AGE_DAYS, includeNurture: true,
  });
  assert.equal(FREE_NUDGE_STAGE2.minAgeHours, FREE_NUDGE_STAGE1.maxAgeDays * 24, "no gap, no overlap");
});

test("a not-now lead never gets the next-morning nudge, at any age inside its window", () => {
  for (const age of [FREE_NUDGE_STAGE1_MIN_HOURS, 24, 48, FREE_NUDGE_STAGE1_MAX_DAYS * 24 - 1]) {
    const p = stage1([row({ name: "Test Priya", phone: "9999900001", age, gate: NOT_NOW })]);
    assert.equal(p.candidates.length, 0, `age ${age}h`);
    assert.equal(p.skipped.nurtureTiming, 1, `age ${age}h is counted as not now, not lost`);
  }
});

test("a not-now lead gets the day-3 nudge, and only from day 3 to day 10", () => {
  const at = (age: number) => stage2([row({ name: "Test Priya", phone: "9999900001", age, gate: NOT_NOW })]);
  assert.equal(at(FREE_NUDGE_STAGE2_MIN_HOURS + 1).candidates.length, 1, "just past 72 h");
  assert.equal(at(96).candidates[0].phone, "9999900001");
  assert.equal(at(FREE_NUDGE_MAX_AGE_DAYS * 24 - 1).candidates.length, 1, "just before day 10");
  assert.equal(at(FREE_NUDGE_STAGE2_MIN_HOURS - 1).candidates.length, 0, "not before day 3");
  assert.equal(at(FREE_NUDGE_STAGE2_MIN_HOURS - 1).skipped.tooNew, 1);
  assert.equal(at(FREE_NUDGE_MAX_AGE_DAYS * 24 + 1).candidates.length, 0, "not after day 10");
  assert.equal(at(96).skipped.nurtureTiming, 0, "stage 2 never skips her for the gate");
});

test("an eligible lead still gets both nudges, exactly as before", () => {
  for (const gate of ["eligible", ""]) {
    const r1 = row({ name: "Test Asha", phone: "9999900002", age: 24, gate });
    const r2 = row({ name: "Test Asha", phone: "9999900002", age: 96, gate });
    assert.equal(stage1([r1]).candidates.length, 1, `stage 1, gate "${gate}"`);
    assert.equal(stage2([r2]).candidates.length, 1, `stage 2, gate "${gate}"`);
    assert.equal(stage1([r1]).skipped.nurtureTiming, 0);
  }
});

test("one batch with both kinds: stage 1 picks only the eligible lead, stage 2 picks both", () => {
  const day1 = [
    row({ name: "Test Asha", phone: "9999900002", age: 30, gate: "eligible" }),
    row({ name: "Test Priya", phone: "9999900001", age: 30, gate: NOT_NOW }),
  ];
  assert.deepEqual(stage1(day1).candidates.map((c) => c.phone), ["9999900002"]);
  const day4 = [
    row({ name: "Test Asha", phone: "9999900002", age: 96, gate: "eligible" }),
    row({ name: "Test Priya", phone: "9999900001", age: 96, gate: NOT_NOW }),
  ];
  assert.deepEqual(stage2(day4).candidates.map((c) => c.phone).sort(), ["9999900001", "9999900002"]);
});

test("leaving not-now women out is the default, so a new stage cannot reach them by accident", () => {
  const r = row({ name: "Test Priya", phone: "9999900001", age: 96, gate: NOT_NOW });
  const p = plan([r], { minAgeHours: FREE_NUDGE_STAGE2_MIN_HOURS, maxAgeDays: FREE_NUDGE_MAX_AGE_DAYS });
  assert.equal(p.candidates.length, 0);
  assert.equal(p.skipped.nurtureTiming, 1);
});

test("without a Gate Outcome column nobody is treated as not now", () => {
  // The column does not exist until the quiz first writes it, so findCol is -1.
  const r = row({ name: "Test Priya", phone: "9999900001", age: 24, gate: NOT_NOW });
  for (const gateOutcome of [-1, undefined]) {
    const p = stage1([r], { cols: { ...COLS, gateOutcome } });
    assert.equal(p.candidates.length, 1, String(gateOutcome));
  }
});

test("a not-now row that booked still settles her other rows", () => {
  // She took the quiz twice, "This month" and then "Just exploring", and
  // booked from the second. Her eligible row must not earn a nudge. Blanking
  // the not-now row's phone before planning (the old way) hid that booking
  // from the cross-row check, so this is the case it used to get wrong.
  const p = stage1([
    row({ name: "Test Priya", phone: "9999900001", age: 30, gate: "eligible" }),
    row({ name: "Test Priya", phone: "9999900001", age: 24, gate: NOT_NOW, bookingStatus: "Booked" }),
  ]);
  assert.equal(p.candidates.length, 0);
});

test("a not-now lead who already had the day-3 nudge does not get it twice", () => {
  const p = stage2([row({ name: "Test Priya", phone: "9999900001", age: 120, gate: NOT_NOW, nudged: "Y" })]);
  assert.equal(p.candidates.length, 0);
  assert.equal(p.skipped.alreadyNudged, 1);
});

test("a not-now lead who booked is never nudged by either stage", () => {
  const booked = { name: "Test Priya", phone: "9999900001", gate: NOT_NOW, sessionDate: "2026-12-01T10:00:00Z" };
  assert.equal(stage1([row({ ...booked, age: 24 })]).candidates.length, 0);
  assert.equal(stage2([row({ ...booked, age: 96 })]).candidates.length, 0);
  assert.equal(stage2([row({ ...booked, age: 96 })]).skipped.alreadyBooked, 1);
});
