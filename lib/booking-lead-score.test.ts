import { test } from "node:test";
import assert from "node:assert/strict";
import { findBookingLeadScore, scoreColumn } from "./booking-lead-score.ts";

const COLS = { leadId: 1, phone: 3, email: 4, score: 52 };
const HEADER: string[] = [];
const row = (at: Record<number, string>) => {
  const r: string[] = Array.from({ length: 53 }, () => "");
  for (const [k, v] of Object.entries(at)) r[Number(k)] = v;
  return r;
};

test("the 12-Sep shape: score on the quiz row, booking row blank, found by lead id", () => {
  const all = [
    HEADER,
    row({ 1: "dq_1", 3: "7987880954", 52: "70" }), // quiz + payment
    row({ 1: "dq_1", 3: "7987880954" }),           // Make's booking row
  ];
  const m = findBookingLeadScore(all, { leadId: "dq_1" }, COLS);
  assert.deepEqual(m, { score: 70, matchedBy: "leadId", rows: [2, 3] });
});

test("no lead id in the booking — a forwarded link, another phone — found by phone", () => {
  const all = [HEADER, row({ 1: "dq_1", 3: "+91 79878 80954", 52: "70" })];
  const m = findBookingLeadScore(all, { phone: "7987880954" }, COLS);
  assert.equal(m?.score, 70);
  assert.equal(m?.matchedBy, "phone");
});

test("phone formats compare on the last ten digits", () => {
  const all = [HEADER, row({ 3: "917987880954", 52: "61" })];
  assert.equal(findBookingLeadScore(all, { phone: "+91-79878-80954" }, COLS)?.score, 61);
});

test("email is the last resort, and is case-insensitive", () => {
  const all = [HEADER, row({ 4: "Her@Example.com", 52: "58" })];
  const m = findBookingLeadScore(all, { email: "her@example.com" }, COLS);
  assert.equal(m?.score, 58);
  assert.equal(m?.matchedBy, "email");
});

test("the placeholder address never matches anyone", () => {
  const all = [HEADER, row({ 4: "noreply@site.in", 52: "90" })];
  assert.equal(findBookingLeadScore(all, { email: "noreply@site.in" }, COLS, "noreply@site.in"), null);
});

test("a known lead id is never swapped for a phone match on someone else's row", () => {
  // Her id exists but carries no score; a DIFFERENT lead shares the phone
  // (a mother and daughter on one number). Borrowing that score would tell
  // Meta a lead was qualified on another woman's answers.
  const all = [HEADER, row({ 1: "dq_her", 3: "7987880954" }), row({ 1: "dq_other", 3: "7987880954", 52: "88" })];
  assert.equal(findBookingLeadScore(all, { leadId: "dq_her", phone: "7987880954" }, COLS), null);
});

test("the newest non-empty score wins across rows", () => {
  const all = [HEADER, row({ 3: "7987880954", 52: "40" }), row({ 3: "7987880954", 52: "72" }), row({ 3: "7987880954" })];
  assert.equal(findBookingLeadScore(all, { phone: "7987880954" }, COLS)?.score, 72);
});

test("blank, zero and junk are not scores", () => {
  for (const v of ["", "0", "abc", "-3"]) {
    const all = [HEADER, row({ 1: "dq_1", 52: v })];
    assert.equal(findBookingLeadScore(all, { leadId: "dq_1" }, COLS), null, `"${v}" must not count`);
  }
});

test("nothing to go on returns null rather than guessing", () => {
  assert.equal(findBookingLeadScore([HEADER, row({ 52: "70" })], {}, COLS), null);
  assert.equal(findBookingLeadScore([HEADER, row({ 3: "123", 52: "70" })], { phone: "123" }, COLS), null);
});

test("the score column is found by header, rightmost first, with a fallback", () => {
  assert.equal(scoreColumn(["a", "Lead Score", "b", "Lead Score"]), 3);
  assert.equal(scoreColumn(["a", "b"]), 52);
});
