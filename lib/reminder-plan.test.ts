import { test } from "node:test";
import assert from "node:assert/strict";
import { planReminders, parseSheetTime, firstNameOf, type ReminderColumns } from "./reminder-plan.ts";

const COLS: ReminderColumns = { timestamp: 0, name: 2, phone: 3, paid: 40, reminderSent: 44 };

const NOW = Date.parse("2026-08-11T12:00:00.000Z");
const agoMin = (m: number) => new Date(NOW - m * 60000).toISOString();

/** Build a sparse row with only the columns the planner reads. */
function row(o: {
  ts?: string;
  name?: string;
  phone?: string;
  paid?: string;
  reminded?: string;
}): string[] {
  const r = new Array<string>(50).fill("");
  r[COLS.timestamp] = o.ts ?? agoMin(90);
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
  const plan = planReminders({ rows: [row({ ts: agoMin(10) })], cols: COLS, now: NOW });
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
  const rows = [
    row({ ts: agoMin(60), name: "Newest" }),
    row({ ts: agoMin(600), name: "Oldest" }),
    row({ ts: agoMin(300), name: "Middle" }),
  ];
  const plan = planReminders({ rows, cols: COLS, now: NOW, limit: 2 });
  assert.deepEqual(plan.candidates.map((c) => c.name), ["Oldest", "Middle"]);
  assert.equal(plan.skipped.overCap, 1);
});

// ── boundaries ───────────────────────────────────────────────────────────────

test("the window edges are inclusive at min and max", () => {
  const atMin = planReminders({ rows: [row({ ts: agoMin(45) })], cols: COLS, now: NOW });
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
