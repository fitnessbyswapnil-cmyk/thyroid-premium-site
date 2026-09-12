import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeLeadRows, LEAD_ID_COLUMN } from "./lead-row-merge.ts";

const HEADER = ["Timestamp", "Lead ID", "Name", "Phone", "Email"];
/** Build a row with values at given column indexes. */
const row = (leadId: string, at: Record<number, string>) => {
  const r: string[] = [];
  const max = Math.max(LEAD_ID_COLUMN, ...Object.keys(at).map(Number));
  for (let i = 0; i <= max; i++) r[i] = at[i] ?? "";
  r[LEAD_ID_COLUMN] = leadId;
  return r;
};

test("the exact failure from 12-Sep: score and payment survive the booking row", () => {
  // Her real sequence: quiz writes the score, the payment stamps Paid, then
  // the Cal.com Make scenario APPENDS a booking row that knows neither.
  const all = [
    HEADER,
    row("dq_1", { 36: "Best", 52: "74" }),          // quiz
    row("dq_1", { 40: "Y", 41: "1" }),               // payment
    row("dq_1", { 36: "⏳ Awaiting ₹299", 19: "Wednesday, 16 September 2026" }), // booking
  ];
  const merged = mergeLeadRows(all, "dq_1");
  assert.ok(merged);
  assert.equal(merged.cells[52], "74", "the Lead Score must survive — QualifiedSchedule depends on it");
  assert.equal(merged.cells[40], "Y", "Paid must survive the booking row");
  assert.equal(merged.cells[19], "Wednesday, 16 September 2026");
  assert.deepEqual(merged.rows, [2, 3, 4]);
  assert.equal(merged.row, 4, "writes still go to her newest row");
});

test("a later blank never erases what an earlier row knew", () => {
  const all = [HEADER, row("dq_1", { 2: "Swapnil" }), row("dq_1", { 2: "" })];
  assert.equal(mergeLeadRows(all, "dq_1")?.cells[2], "Swapnil");
});

test("a later non-blank still wins — newer writers are not ignored", () => {
  const all = [HEADER, row("dq_1", { 16: "lead_captured" }), row("dq_1", { 16: "booked" })];
  assert.equal(mergeLeadRows(all, "dq_1")?.cells[16], "booked");
});

test("one row behaves exactly as before", () => {
  const all = [HEADER, row("dq_1", { 2: "Swapnil", 52: "74" })];
  const m = mergeLeadRows(all, "dq_1");
  assert.deepEqual(m?.rows, [2]);
  assert.equal(m?.cells[52], "74");
});

test("other leads are never mixed in", () => {
  const all = [HEADER, row("dq_1", { 52: "74" }), row("dq_2", { 52: "12" })];
  assert.equal(mergeLeadRows(all, "dq_1")?.cells[52], "74");
  assert.equal(mergeLeadRows(all, "dq_2")?.cells[52], "12");
});

test("values are trimmed, and whitespace is not a value", () => {
  const all = [HEADER, row("dq_1", { 2: "Swapnil" }), row("dq_1", { 2: "   " })];
  assert.equal(mergeLeadRows(all, "dq_1")?.cells[2], "Swapnil");
  assert.equal(mergeLeadRows([HEADER, row(" dq_1 ", { 2: "x" })], "dq_1")?.cells[2], "x");
});

test("a missing lead, an empty id and a ragged sheet are all survivable", () => {
  assert.equal(mergeLeadRows([HEADER], "dq_1"), null);
  assert.equal(mergeLeadRows([HEADER, row("dq_1", {})], ""), null);
  assert.equal(mergeLeadRows([HEADER, undefined, row("dq_1", { 2: "x" })], "dq_1")?.cells[2], "x");
});
