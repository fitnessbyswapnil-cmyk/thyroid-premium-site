import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IST_OFFSET_MS,
  UNMARKED_AFTER_DAYS,
  UNMARKED_LIST_LIMIT,
  parseIstSession,
  isOutcomeMarked,
  selectUnmarkedOutcomes,
  formatUnmarkedOutcomes,
  type ConsultationRecord,
} from "./unmarked-outcomes.ts";

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 12, 6, 0); // 11:30 IST on 12 Sep 2026

const rec = (over: Partial<ConsultationRecord> = {}): ConsultationRecord => ({
  name: "A Lead",
  sessionAtMs: NOW - 5 * DAY,
  showed: "",
  closedAmount: "",
  programmeValue: "",
  ...over,
});

// ── parseIstSession ───────────────────────────────────────────────────────────
// The sheet writes an IST wall clock with no zone on it. Reading it in the
// runtime's timezone put the same row 5.5 hours apart on the worker and on a
// laptop, which moved rows in and out of the "three days old" set.

test("parseIstSession reads the slot as IST, not as the runtime's timezone", () => {
  assert.equal(parseIstSession("05 Sep 2026 3:00 PM"), Date.UTC(2026, 8, 5, 15, 0) - IST_OFFSET_MS);
});

test("parseIstSession handles midnight and noon either side of 12", () => {
  assert.equal(parseIstSession("05 Sep 2026 12:00 AM"), Date.UTC(2026, 8, 5, 0, 0) - IST_OFFSET_MS);
  assert.equal(parseIstSession("05 Sep 2026 12:30 PM"), Date.UTC(2026, 8, 5, 12, 30) - IST_OFFSET_MS);
});

test("parseIstSession tolerates a single-digit day and trailing text", () => {
  assert.equal(parseIstSession("5 Sep 2026 9:15 AM (IST)"), Date.UTC(2026, 8, 5, 9, 15) - IST_OFFSET_MS);
});

test("parseIstSession returns null for anything it cannot read", () => {
  assert.equal(parseIstSession(""), null);
  assert.equal(parseIstSession("2026-09-05T10:00:00Z"), null);
  assert.equal(parseIstSession("05 Sept 2026 3:00 PM"), null);
  assert.equal(parseIstSession("05 Xyz 2026 3:00 PM"), null);
});

// ── isOutcomeMarked ───────────────────────────────────────────────────────────

test("any of the three outcome columns counts as marked", () => {
  assert.equal(isOutcomeMarked(rec({ showed: "Y" })), true);
  assert.equal(isOutcomeMarked(rec({ closedAmount: "20000" })), true);
  assert.equal(isOutcomeMarked(rec({ programmeValue: "25000" })), true);
});

// "She did not turn up" is a recorded outcome, not a missing one — nudging
// about it forever is how the section gets ignored.
test("Showed: N is a marked outcome", () => {
  assert.equal(isOutcomeMarked(rec({ showed: "N" })), true);
});

test("an empty row, or a zero amount, is unmarked", () => {
  assert.equal(isOutcomeMarked(rec()), false);
  assert.equal(isOutcomeMarked(rec({ closedAmount: "0", programmeValue: "0" })), false);
  assert.equal(isOutcomeMarked(rec({ showed: "   " })), false);
});

test("a currency-formatted amount still counts as marked", () => {
  assert.equal(isOutcomeMarked(rec({ closedAmount: "₹20,000" })), true);
});

// ── selectUnmarkedOutcomes ────────────────────────────────────────────────────

test("a call younger than the threshold is not yet neglected", () => {
  const fresh = rec({ sessionAtMs: NOW - (UNMARKED_AFTER_DAYS - 1) * DAY });
  assert.deepEqual(selectUnmarkedOutcomes([fresh], NOW), []);
});

test("the threshold is strictly more than three days", () => {
  const exactly = rec({ sessionAtMs: NOW - UNMARKED_AFTER_DAYS * DAY });
  assert.equal(selectUnmarkedOutcomes([exactly], NOW).length, 0);
  assert.equal(selectUnmarkedOutcomes([exactly], NOW + 1).length, 1);
});

test("a marked call never appears however old it is", () => {
  const old = rec({ sessionAtMs: NOW - 40 * DAY, closedAmount: "20000" });
  assert.deepEqual(selectUnmarkedOutcomes([old], NOW), []);
});

test("a future or unparsed session is ignored", () => {
  assert.deepEqual(selectUnmarkedOutcomes([rec({ sessionAtMs: NOW + 2 * DAY })], NOW), []);
  assert.deepEqual(selectUnmarkedOutcomes([rec({ sessionAtMs: NaN })], NOW), []);
  assert.deepEqual(selectUnmarkedOutcomes([rec({ sessionAtMs: 0 })], NOW), []);
});

// Oldest first: that one is closest to falling out of Meta's seven-day window,
// so it is the one worth doing before the others.
test("the list is ordered oldest first", () => {
  const out = selectUnmarkedOutcomes(
    [
      rec({ name: "Four", sessionAtMs: NOW - 4 * DAY }),
      rec({ name: "Nine", sessionAtMs: NOW - 9 * DAY }),
      rec({ name: "Six", sessionAtMs: NOW - 6 * DAY }),
    ],
    NOW,
  );
  assert.deepEqual(out.map((o) => o.name), ["Nine", "Six", "Four"]);
  assert.deepEqual(out.map((o) => o.daysAgo), [9, 6, 4]);
});

test("a nameless row still gets listed", () => {
  const out = selectUnmarkedOutcomes([rec({ name: "  " })], NOW);
  assert.equal(out[0].name, "(no name)");
});

// ── formatUnmarkedOutcomes ────────────────────────────────────────────────────

test("nothing unmarked means no section at all", () => {
  assert.deepEqual(formatUnmarkedOutcomes([], IST_OFFSET_MS), []);
});

test("the section names the count, the day and the age", () => {
  const items = selectUnmarkedOutcomes([rec({ name: "Meera", sessionAtMs: NOW - 5 * DAY })], NOW);
  const text = formatUnmarkedOutcomes(items, IST_OFFSET_MS).join("\n");
  assert.match(text, /ACTION: 1 consultation\(s\) over 3 days old still have no outcome marked\./);
  assert.match(text, /7 Sep — Meera \(5d ago\)/);
});

// The brief travels through Make and Gmail, so it must never carry anything
// beyond a name and a date.
test("the section carries no phone, email or health data", () => {
  const items = selectUnmarkedOutcomes([rec({ name: "Meera" })], NOW);
  const text = formatUnmarkedOutcomes(items, IST_OFFSET_MS).join("\n");
  assert.equal(/\d{10}|@|thyroid|TSH|weight/i.test(text), false);
});

test("a backlog is truncated rather than emailed in full", () => {
  const many = Array.from({ length: UNMARKED_LIST_LIMIT + 4 }, (_, i) =>
    rec({ name: `Lead ${i}`, sessionAtMs: NOW - (5 + i) * DAY }),
  );
  const lines = formatUnmarkedOutcomes(selectUnmarkedOutcomes(many, NOW), IST_OFFSET_MS);
  const listed = lines.filter((l) => l.includes("d ago)"));
  assert.equal(listed.length, UNMARKED_LIST_LIMIT);
  assert.match(lines.join("\n"), /…and 4 more\./);
  assert.match(lines.join("\n"), /ACTION: 16 consultation\(s\)/);
});
