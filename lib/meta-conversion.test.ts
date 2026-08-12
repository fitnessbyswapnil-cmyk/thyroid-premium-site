import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSheetPhone,
  deriveFbc,
  splitName,
  resolveEventTime,
  programEventId,
  MAX_EVENT_AGE_SECONDS,
} from "./meta-conversion.ts";

// ── normalizeSheetPhone ───────────────────────────────────────────────────────
// Google Sheets hands back numeric cells as "9078165199.0". Stripping only
// non-digits yields an 11-digit number that hashes to nothing Meta can match,
// so the sale would be attributed to no one. Regression guard.

test("normalizeSheetPhone strips the Sheets float artifact", () => {
  assert.equal(normalizeSheetPhone("9078165199.0"), "9078165199");
});

test("normalizeSheetPhone takes the last 10 digits of a country-coded number", () => {
  assert.equal(normalizeSheetPhone("919078165199"), "9078165199");
  assert.equal(normalizeSheetPhone("+91 90781 65199"), "9078165199");
});

test("normalizeSheetPhone rejects anything shorter than 10 digits", () => {
  assert.equal(normalizeSheetPhone("12345"), "");
  assert.equal(normalizeSheetPhone(""), "");
});

// ── deriveFbc ─────────────────────────────────────────────────────────────────

test("deriveFbc builds the cookie form from a bare fbclid", () => {
  assert.equal(deriveFbc("PAcGRvZgJleHRu", 1786447192996), "fb.1.1786447192996.PAcGRvZgJleHRu");
});

test("deriveFbc passes through a value already in cookie form", () => {
  const existing = "fb.1.1786447192996.PAcGRvZgJleHRu";
  assert.equal(deriveFbc(existing, 999), existing);
});

test("deriveFbc returns empty when there is no click id", () => {
  assert.equal(deriveFbc("", 123), "");
  assert.equal(deriveFbc("   ", 123), "");
});

test("deriveFbc falls back to now when the click time is unusable", () => {
  const out = deriveFbc("abc", 0);
  assert.match(out, /^fb\.1\.\d{13}\.abc$/);
});

// ── splitName ─────────────────────────────────────────────────────────────────

test("splitName separates first and last name", () => {
  assert.deepEqual(splitName("Rashmi Sahu"), { firstName: "Rashmi", lastName: "Sahu" });
});

test("splitName handles a single name and extra whitespace", () => {
  assert.deepEqual(splitName("  Rashmi  "), { firstName: "Rashmi", lastName: "" });
  assert.deepEqual(splitName(""), { firstName: "", lastName: "" });
});

test("splitName keeps multi-word surnames intact", () => {
  assert.deepEqual(splitName("Nasreentaj Jilan Sayed"), {
    firstName: "Nasreentaj",
    lastName: "Jilan Sayed",
  });
});

// ── resolveEventTime ──────────────────────────────────────────────────────────

const NOW = 1786500000000; // fixed clock

test("resolveEventTime uses the close time when it is recent", () => {
  const closed = NOW - 2 * 24 * 3600 * 1000;
  const r = resolveEventTime(closed, NOW);
  assert.equal(r.eventTime, Math.floor(closed / 1000));
  assert.equal(r.tooOld, false);
});

test("resolveEventTime defaults to now when no close time is given", () => {
  const r = resolveEventTime(undefined, NOW);
  assert.equal(r.eventTime, Math.floor(NOW / 1000));
  assert.equal(r.tooOld, false);
});

test("resolveEventTime clamps a backfill older than Meta's 7-day limit", () => {
  const closed = NOW - 30 * 24 * 3600 * 1000;
  const r = resolveEventTime(closed, NOW);
  assert.equal(r.tooOld, true);
  const ageS = Math.floor(NOW / 1000) - r.eventTime;
  assert.ok(ageS < MAX_EVENT_AGE_SECONDS, "clamped time must be inside the accepted window");
  assert.ok(ageS > MAX_EVENT_AGE_SECONDS - 300, "clamped time should sit at the edge of the window");
});

test("resolveEventTime never sends a future timestamp", () => {
  const r = resolveEventTime(NOW + 60_000, NOW);
  assert.equal(r.eventTime, Math.floor(NOW / 1000));
  assert.equal(r.tooOld, false);
});

// ── programEventId ────────────────────────────────────────────────────────────

test("programEventId is deterministic per lead so re-sends dedupe", () => {
  assert.equal(programEventId("lead_123"), "program_lead_123");
  assert.equal(programEventId("lead_123"), programEventId("lead_123"));
});

test("programEventId survives a missing seed", () => {
  assert.equal(programEventId(""), "program_unknown");
});
