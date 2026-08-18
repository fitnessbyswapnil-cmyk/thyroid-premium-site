import { test } from "node:test";
import assert from "node:assert/strict";
import { planReminders, parseSheetTime, firstNameOf, phoneKey, type ReminderColumns } from "./reminder-plan.ts";

const COLS: ReminderColumns = { timestamp: 0, leadId: 1, name: 2, phone: 3, paid: 40, reminderSent: 44 };

const NOW = Date.parse("2026-08-11T12:00:00.000Z");
const agoMin = (m: number) => new Date(NOW - m * 60000).toISOString();

/** Build a sparse row with only the columns the planner reads. */
function row(o: {
  ts?: string;
  name?: string;
  phone?: string;
  paid?: string;
  reminded?: string;
  leadId?: string;
}): string[] {
  const r = new Array<string>(50).fill("");
  r[COLS.timestamp] = o.ts ?? agoMin(90);
  r[COLS.leadId] = o.leadId ?? "quiz_1786000000000_ab12cd";
  r[COLS.name] = o.name ?? "Priya Sharma";
  r[COLS.phone] = o.phone ?? "9876543210";
  r[COLS.paid] = o.paid ?? "";
  r[COLS.reminderSent] = o.reminded ?? "";
  return r;
}

// ── the happy path ───────────────────────────────────────────────────────────

test("an unpaid lead inside the window is nudged", () => {
  const plan = planReminders({ rows: [row({})], cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.candidates[0].rowNumber, 2, "rows[0] is sheet row 2, under the header");
  assert.equal(plan.candidates[0].phone, "9876543210");
  assert.equal(plan.candidates[0].ageMinutes, 90);
});

test("her leadId comes through, so the reminder can link straight to /complete-payment", () => {
  const plan = planReminders({ rows: [row({ leadId: "quiz_1786012345000_xy9z8w" })], cols: COLS, now: NOW });
  assert.equal(plan.candidates[0].leadId, "quiz_1786012345000_xy9z8w");
});

test("a missing leadId column (-1) reads as empty, not a crash", () => {
  const cols: ReminderColumns = { ...COLS, leadId: -1 };
  const plan = planReminders({ rows: [row({})], cols, now: NOW });
  assert.equal(plan.candidates[0].leadId, "");
});

// ── the exclusions, one per rule ─────────────────────────────────────────────

test("a paying customer is never nudged for money she already sent", () => {
  const plan = planReminders({ rows: [row({ paid: "Y" })], cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped.paid, 1);
});

test("paid wins even when the reminder flag is also unset and the row looks perfect", () => {
  const plan = planReminders({ rows: [row({ paid: "y" })], cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 0, "case-insensitive");
});

test("a lead already reminded is not reminded twice", () => {
  const plan = planReminders({
    rows: [row({ reminded: "2026-08-11T10:00:00.000Z" })],
    cols: COLS,
    now: NOW,
  });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped.alreadyReminded, 1);
});

test("someone still mid-checkout is left alone", () => {
  const plan = planReminders({ rows: [row({ ts: agoMin(2) })], cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped.tooNew, 1);
});

test("last week's abandoners are out of the window", () => {
  const plan = planReminders({ rows: [row({ ts: agoMin(60 * 24 * 7) })], cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped.tooOld, 1);
});

test("a row with no usable phone is skipped rather than burning a send", () => {
  const plan = planReminders({ rows: [row({ phone: "12345" })], cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped.noPhone, 1);
});

test("an unreadable timestamp is counted, not silently dropped", () => {
  const plan = planReminders({ rows: [row({ ts: "sometime tuesday" })], cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped.unparseableTime, 1);
});

// ── the cap ──────────────────────────────────────────────────────────────────

test("the cap bounds a run and reaches the oldest leads first", () => {
  // Distinct phones — three different women, not one woman on three rows.
  const rows = [
    row({ ts: agoMin(60), name: "Newest", phone: "9000000001" }),
    row({ ts: agoMin(600), name: "Oldest", phone: "9000000002" }),
    row({ ts: agoMin(300), name: "Middle", phone: "9000000003" }),
  ];
  const plan = planReminders({ rows, cols: COLS, now: NOW, limit: 2 });
  assert.deepEqual(plan.candidates.map((c) => c.name), ["Oldest", "Middle"]);
  assert.equal(plan.skipped.overCap, 1);
});

// ── boundaries ───────────────────────────────────────────────────────────────

test("the window edges are inclusive at min and max", () => {
  const atMin = planReminders({ rows: [row({ ts: agoMin(5) })], cols: COLS, now: NOW });
  assert.equal(atMin.candidates.length, 1);
  const atMax = planReminders({ rows: [row({ ts: agoMin(24 * 60) })], cols: COLS, now: NOW });
  assert.equal(atMax.candidates.length, 1);
});

test("a short/ragged row array does not throw", () => {
  assert.doesNotThrow(() => planReminders({ rows: [[], ["x"], []], cols: COLS, now: NOW }));
  const plan = planReminders({ rows: [[], ["x"]], cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 0);
});

test("a missing column index (-1) is treated as empty, not as a crash", () => {
  const cols: ReminderColumns = { ...COLS, reminderSent: -1 };
  const plan = planReminders({ rows: [row({})], cols, now: NOW });
  assert.equal(plan.candidates.length, 1, "no reminder column yet == nobody reminded yet");
});

// ── one woman, one message ───────────────────────────────────────────────────
// Observed live: rows 202/203/204 were all Rashmi on ***5199. Without this she
// receives three identical reminders, and because only the sent row is stamped
// the other two stay eligible and nudge her again the next day.

test("three rows for the same phone produce ONE message", () => {
  const rows = [
    row({ ts: agoMin(475), name: "Rashmi", phone: "9876545199" }),
    row({ ts: agoMin(473), name: "Rashmi Sahu", phone: "919876545199" }),
    row({ ts: agoMin(454), name: "Rashmi Sahu", phone: "+91 98765 45199" }),
  ];
  const plan = planReminders({ rows, cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.skipped.duplicatePhone, 2);
});

test("the row kept is her OLDEST — closest to falling out of the window", () => {
  const rows = [
    row({ ts: agoMin(200), name: "newer", phone: "9876545199" }),
    row({ ts: agoMin(853), name: "older", phone: "9876545199" }),
  ];
  const plan = planReminders({ rows, cols: COLS, now: NOW });
  assert.equal(plan.candidates[0].name, "older");
});

test("a phone already PAID on another row disqualifies her other rows", () => {
  const rows = [
    row({ ts: agoMin(90), phone: "9876545199", paid: "Y" }),
    row({ ts: agoMin(90), phone: "9876545199" }),
  ];
  const plan = planReminders({ rows, cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 0, "never ask a payer to pay again");
  assert.equal(plan.skipped.duplicatePhone, 1);
});

test("a phone already reminded on one row still gets its own reminder on a genuinely different row", () => {
  // Owner decision 2026-08-18: REMINDED is per-row, not cross-row like PAID.
  // Row 1 is settled on ITS OWN stamp. Rows 2 and 3 are fresh retakes and are
  // eligible — but still collapse to ONE send between themselves, since
  // they're both unclaimed in the same batch.
  const rows = [
    row({ ts: agoMin(90), phone: "9876545199", reminded: "Y" }),
    row({ ts: agoMin(90), phone: "9876545199" }),
    row({ ts: agoMin(90), phone: "9876545199" }),
  ];
  const plan = planReminders({ rows, cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.skipped.alreadyReminded, 1, "only row 1, via its own stamp");
  assert.equal(plan.skipped.duplicatePhone, 1, "rows 2 and 3 collapse to one send");
});

test("a genuine retake hours after her first reminder is eligible on its own", () => {
  const rows = [
    row({ ts: agoMin(60 * 6), phone: "9876545199", reminded: "Y" }), // reminded 6h ago
    row({ ts: agoMin(90), phone: "9876545199" }), // fresh retake, 90 min old
  ];
  const plan = planReminders({ rows, cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.candidates[0].ageMinutes, 90);
});

test("different women are not collapsed together", () => {
  const rows = [
    row({ ts: agoMin(90), name: "Pinky", phone: "9876543203" }),
    row({ ts: agoMin(90), name: "Rashmi", phone: "9876545199" }),
  ];
  const plan = planReminders({ rows, cols: COLS, now: NOW });
  assert.equal(plan.candidates.length, 2);
  assert.equal(plan.skipped.duplicatePhone, 0);
});

test("the cap counts people, not rows", () => {
  const rows = [
    row({ ts: agoMin(500), name: "A", phone: "9000000001" }),
    row({ ts: agoMin(499), name: "A dup", phone: "9000000001" }),
    row({ ts: agoMin(400), name: "B", phone: "9000000002" }),
  ];
  const plan = planReminders({ rows, cols: COLS, now: NOW, limit: 2 });
  assert.deepEqual(plan.candidates.map((c) => c.name), ["A", "B"]);
  assert.equal(plan.skipped.overCap, 0, "the duplicate must not consume a slot");
});

test("phoneKey normalises every format the sheet produces", () => {
  assert.equal(phoneKey("9876545199"), "9876545199");
  assert.equal(phoneKey("919876545199"), "9876545199");
  assert.equal(phoneKey("+91 98765 45199"), "9876545199");
  assert.equal(phoneKey("9876545199.0"), "9876545199");
  assert.equal(phoneKey("12345"), "");
  assert.equal(phoneKey(""), "");
});

// ── time parsing ─────────────────────────────────────────────────────────────

test("parseSheetTime reads ISO, sheet serials and locale strings", () => {
  assert.equal(parseSheetTime("2026-08-11T12:00:00.000Z"), NOW);
  // 46245 = 2026-08-11 in Sheets' 1899-12-30 epoch.
  assert.equal(parseSheetTime("46245"), Date.UTC(2026, 7, 11));
  assert.ok(parseSheetTime("Aug 11, 2026 12:00:00") !== null);
  assert.equal(parseSheetTime(""), null);
  assert.equal(parseSheetTime("42"), null, "a bare small integer is junk, not a date");
});

test("firstNameOf takes only the first word and never returns empty", () => {
  assert.equal(firstNameOf("Priya Sharma"), "Priya");
  assert.equal(firstNameOf("  Kavya  "), "Kavya");
  assert.equal(firstNameOf(""), "there");
});

// ── booking nudge: paid but never booked ─────────────────────────────────────

import { planBookingNudges, type BookingNudgeColumns } from "./reminder-plan.ts";

const NCOLS: BookingNudgeColumns = { name: 2, phone: 3, paid: 40, paidAt: 41, bookingStatus: 17, sessionDate: 18, nudgeSent: 45 };
const agoHrs = (h: number) => new Date(NOW - h * 3600000).toISOString();

function paidRow(o: {
  name?: string;
  phone?: string;
  paid?: string;
  paidAt?: string;
  booking?: string;
  session?: string;
  nudged?: string;
}): string[] {
  const r = new Array<string>(50).fill("");
  r[NCOLS.name] = o.name ?? "Priya Sharma";
  r[NCOLS.phone] = o.phone ?? "9876543210";
  r[NCOLS.paid] = o.paid ?? "Y";
  r[NCOLS.paidAt] = o.paidAt ?? agoHrs(24);
  r[NCOLS.bookingStatus] = o.booking ?? "";
  r[NCOLS.sessionDate] = o.session ?? "";
  r[NCOLS.nudgeSent] = o.nudged ?? "";
  return r;
}

test("a payer with no booking a day later gets the booking nudge", () => {
  const plan = planBookingNudges({ rows: [paidRow({})], cols: NCOLS, now: NOW });
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.candidates[0].rowNumber, 2);
});

test("a booked woman is never nudged to book", () => {
  const plan = planBookingNudges({ rows: [paidRow({ booking: "Booked" })], cols: NCOLS, now: NOW });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped.alreadyBooked, 1);
});

test("a cancelled booking also counts as handled — she needs a rebook, not a slot-picker", () => {
  const plan = planBookingNudges({ rows: [paidRow({ booking: "Cancelled" })], cols: NCOLS, now: NOW });
  assert.equal(plan.skipped.alreadyBooked, 1);
});

test("an unpaid row can never receive a booking nudge", () => {
  const plan = planBookingNudges({ rows: [paidRow({ paid: "" })], cols: NCOLS, now: NOW });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped.notPaid, 1);
});

test("the nudge fires once, ever", () => {
  const plan = planBookingNudges({ rows: [paidRow({ nudged: "Y" })], cols: NCOLS, now: NOW });
  assert.equal(plan.skipped.alreadyNudged, 1);
});

test("too soon after payment is left alone — booking_confirmation just arrived", () => {
  const plan = planBookingNudges({ rows: [paidRow({ paidAt: agoHrs(3) })], cols: NCOLS, now: NOW });
  assert.equal(plan.skipped.tooNew, 1);
});

test("a payment older than a week belongs to personal outreach, not automation", () => {
  const plan = planBookingNudges({ rows: [paidRow({ paidAt: agoHrs(8 * 24) })], cols: NCOLS, now: NOW });
  assert.equal(plan.skipped.tooOld, 1);
});

test("her booking on ANOTHER row settles her paid row too", () => {
  const rows = [
    paidRow({ phone: "9078165199" }),
    paidRow({ phone: "919078165199.0", paid: "", booking: "Booked" }),
  ];
  const plan = planBookingNudges({ rows, cols: NCOLS, now: NOW });
  assert.equal(plan.candidates.length, 0, "same woman, different phone formats, already booked");
  assert.equal(plan.skipped.duplicatePhone, 1);
});

test("newest payment is nudged first when the cap bites", () => {
  const rows = [
    paidRow({ name: "Old", phone: "9000000001", paidAt: agoHrs(6 * 24) }),
    paidRow({ name: "Fresh", phone: "9000000002", paidAt: agoHrs(22) }),
  ];
  const plan = planBookingNudges({ rows, cols: NCOLS, now: NOW, limit: 1 });
  assert.deepEqual(plan.candidates.map((c) => c.name), ["Fresh"]);
  assert.equal(plan.skipped.overCap, 1);
});

test("a session date alone proves she booked, even when Booking Status was never stamped", () => {
  // Live data: the Cal.com scenario missed Booking Status on women who had
  // already sat their calls. Session Date was the surviving evidence.
  const plan = planBookingNudges({ rows: [paidRow({ session: "12 Aug 2026 11:00 AM" })], cols: NCOLS, now: NOW });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped.alreadyBooked, 1);
});

// ── broadcast: unpaid + unbooked + recent, once per template ─────────────────

import { planBroadcast, type BroadcastColumns } from "./reminder-plan.ts";

const BCOLS: BroadcastColumns = { timestamp: 0, name: 2, phone: 3, paid: 40, bookingStatus: 17, sessionDate: 18, stamp: 46 };

function bRow(o: { ts?: string; phone?: string; paid?: string; booking?: string; session?: string; stamp?: string }): string[] {
  const r = new Array<string>(50).fill("");
  r[BCOLS.timestamp] = o.ts ?? agoMin(60 * 20);
  r[2] = "Priya Sharma";
  r[BCOLS.phone] = o.phone ?? "9876543210";
  r[BCOLS.paid] = o.paid ?? "";
  r[BCOLS.bookingStatus] = o.booking ?? "";
  r[BCOLS.sessionDate] = o.session ?? "";
  r[BCOLS.stamp] = o.stamp ?? "";
  return r;
}

test("an unpaid unbooked recent lead is broadcast to", () => {
  const plan = planBroadcast({ rows: [bRow({})], cols: BCOLS, now: NOW });
  assert.equal(plan.candidates.length, 1);
});

test("paid, booked and already-sent leads are all excluded", () => {
  const rows = [
    bRow({ phone: "9000000001", paid: "Y" }),
    bRow({ phone: "9000000002", booking: "Booked" }),
    bRow({ phone: "9000000003", session: "12 Aug 4 PM" }),
    bRow({ phone: "9000000004", stamp: "2026-08-13T00:00:00Z" }),
  ];
  const plan = planBroadcast({ rows, cols: BCOLS, now: NOW });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped.paid, 1);
  assert.equal(plan.skipped.booked, 2);
  assert.equal(plan.skipped.alreadySent, 1);
});

test("a lead older than the window is left out", () => {
  const plan = planBroadcast({ rows: [bRow({ ts: agoMin(60 * 24 * 9) })], cols: BCOLS, now: NOW });
  assert.equal(plan.skipped.tooOld, 1);
});

test("a missing stamp column (-1) means nobody is 'already sent'", () => {
  const cols = { ...BCOLS, stamp: -1 };
  const plan = planBroadcast({ rows: [bRow({})], cols, now: NOW });
  assert.equal(plan.candidates.length, 1);
});

test("her paid row on another line settles her unpaid duplicate", () => {
  const rows = [bRow({ phone: "9078165199" }), bRow({ phone: "919078165199.0", paid: "Y" })];
  const plan = planBroadcast({ rows, cols: BCOLS, now: NOW });
  assert.equal(plan.candidates.length, 0);
});

test("minAgeHours holds back leads messaged earlier today", () => {
  const rows = [
    bRow({ phone: "9000000010", ts: agoMin(60 * 5) }),   // 5h — got today's cron
    bRow({ phone: "9000000011", ts: agoMin(60 * 21) }),  // 21h — got today's cron
    bRow({ phone: "9000000012", ts: agoMin(60 * 27) }),  // 27h — had nothing
    bRow({ phone: "9000000013", ts: agoMin(60 * 72) }),  // 3d — had nothing
  ];
  const plan = planBroadcast({ rows, cols: BCOLS, now: NOW, minAgeHours: 24 });
  assert.equal(plan.candidates.length, 2, "only leads older than 24h");
  assert.equal(plan.skipped.tooNew, 2);
});

test("minAgeHours defaults to 0 so a plain broadcast reaches everyone", () => {
  const plan = planBroadcast({ rows: [bRow({ ts: agoMin(30) })], cols: BCOLS, now: NOW });
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.skipped.tooNew, 0);
});
