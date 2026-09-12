import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toDateInputValue,
  parseDateInputValue,
  paymentDateStatus,
  META_ATTRIBUTION_WINDOW_DAYS,
} from "./payment-date.ts";
import { MAX_EVENT_AGE_SECONDS } from "./meta-conversion.ts";

const DAY = 86400000;

// ── The constant that must not drift ──────────────────────────────────────────
// The warning the coach sees and the clamp the server applies have to describe
// the same rule. They live in separate modules because meta-conversion.ts is
// server-only, so this is the thing holding them together.

test("the UI warning window is exactly Meta's accepted event age", () => {
  assert.equal(META_ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60, MAX_EVENT_AGE_SECONDS);
});

// ── toDateInputValue ──────────────────────────────────────────────────────────

test("toDateInputValue renders the LOCAL calendar day, zero-padded", () => {
  assert.equal(toDateInputValue(new Date(2026, 8, 5)), "2026-09-05");
  assert.equal(toDateInputValue(new Date(2026, 11, 31)), "2026-12-31");
});

test("toDateInputValue round-trips through parseDateInputValue", () => {
  const d = new Date(2026, 0, 1);
  assert.equal(parseDateInputValue(toDateInputValue(d)), d.getTime());
});

// ── parseDateInputValue ───────────────────────────────────────────────────────

test("parseDateInputValue returns local midnight of the chosen day", () => {
  assert.equal(parseDateInputValue("2026-09-05"), new Date(2026, 8, 5).getTime());
});

test("parseDateInputValue rejects anything that is not YYYY-MM-DD", () => {
  assert.equal(parseDateInputValue(""), null);
  assert.equal(parseDateInputValue("05/09/2026"), null);
  assert.equal(parseDateInputValue("2026-9-5"), null);
  assert.equal(parseDateInputValue("not a date"), null);
});

// Date silently rolls 31 Feb over to 3 March, which would record a payment on a
// day the coach never picked. Regression guard.
test("parseDateInputValue rejects a day that does not exist in that month", () => {
  assert.equal(parseDateInputValue("2026-02-31"), null);
  assert.equal(parseDateInputValue("2026-13-01"), null);
  assert.equal(parseDateInputValue("2026-04-31"), null);
});

test("parseDateInputValue accepts a real leap day", () => {
  assert.equal(parseDateInputValue("2028-02-29"), new Date(2028, 1, 29).getTime());
});

// ── paymentDateStatus ─────────────────────────────────────────────────────────

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

test("today is valid and not stale", () => {
  const now = at(2026, 9, 12, 10);
  const s = paymentDateStatus("2026-09-12", now);
  assert.deepEqual({ valid: s.valid, future: s.future, stale: s.stale }, { valid: true, future: false, stale: false });
});

test("a future date is refused rather than warned about", () => {
  const s = paymentDateStatus("2026-09-13", at(2026, 9, 12, 10));
  assert.equal(s.valid, false);
  assert.equal(s.future, true);
});

test("a date inside the window is valid and not stale", () => {
  const now = at(2026, 9, 12, 10);
  assert.equal(paymentDateStatus("2026-09-08", now).stale, false);
  assert.equal(paymentDateStatus("2026-09-06", now).stale, false);
});

// Local midnight seven calendar days back is more than 7x24h before a morning
// "now", which is precisely when the server starts clamping the timestamp. The
// warning has to appear on the same day the clamp starts, not a day later.
test("seven calendar days back is already stale", () => {
  const now = at(2026, 9, 12, 10);
  assert.equal(paymentDateStatus("2026-09-05", now).stale, true);
  assert.equal(paymentDateStatus("2026-09-05", now).valid, true, "stale still submits");
});

test("well outside the window is stale", () => {
  assert.equal(paymentDateStatus("2026-08-01", at(2026, 9, 12)).stale, true);
});

test("the stale boundary is exactly the attribution window, to the millisecond", () => {
  const day = parseDateInputValue("2026-09-05") ?? 0;
  const window = META_ATTRIBUTION_WINDOW_DAYS * DAY;
  assert.equal(paymentDateStatus("2026-09-05", day + window).stale, false);
  assert.equal(paymentDateStatus("2026-09-05", day + window + 1).stale, true);
});

test("an unparseable date is never submittable", () => {
  const s = paymentDateStatus("garbage", at(2026, 9, 12));
  assert.deepEqual(s, { valid: false, future: false, stale: false, ms: null });
});
