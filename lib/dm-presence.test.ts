import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DM_PRESENCE_TARGET_PCT,
  DM_PRESENCE_WINDOW_DAYS,
  dmPresenceRate,
  formatDmPresence,
  type PresenceRecord,
} from "./dm-presence.ts";

const DAY = 86400000;
// 12 Sep 2026, 11:30 IST. Session dates below are written in IST wall clock,
// exactly as the sheet holds them.
const NOW = Date.UTC(2026, 8, 12, 6, 0);

const ist = (day: number, time = "3:00 PM") => `${String(day).padStart(2, "0")} Sep 2026 ${time}`;

const rec = (over: Partial<PresenceRecord> = {}): PresenceRecord => ({
  sessionDate: ist(10),
  showed: "Y",
  dmPresent: "",
  ...over,
});

// ── dmPresenceRate ────────────────────────────────────────────────────────────

test("the percentage is of MARKED calls, so a forgotten tap cannot drag it down", () => {
  const r = dmPresenceRate(
    [
      rec({ dmPresent: "yes" }),
      rec({ dmPresent: "yes" }),
      rec({ dmPresent: "no" }),
      rec({ dmPresent: "" }), // held, never marked
      rec({ dmPresent: "" }),
    ],
    NOW,
  );
  assert.equal(r.pct, 67);
  assert.equal(r.n, 3);
  assert.equal(r.yes, 2);
  assert.equal(r.held, 5);
  assert.equal(r.unmarked, 2);
});

test("only calls that were actually held count", () => {
  const r = dmPresenceRate(
    [
      rec({ showed: "Y", dmPresent: "yes" }),
      rec({ showed: "N", dmPresent: "no" }), // no-show — nobody was on it
      rec({ showed: "", dmPresent: "yes" }), // outcome not marked at all
    ],
    NOW,
  );
  assert.equal(r.held, 1);
  assert.equal(r.n, 1);
  assert.equal(r.pct, 100);
});

test("the window is the last fourteen days, and excludes what sits outside it", () => {
  const r = dmPresenceRate(
    [
      rec({ sessionDate: ist(12, "10:00 AM"), dmPresent: "yes" }), // this morning
      rec({ sessionDate: ist(1), dmPresent: "no" }), // 11 days ago
      rec({ sessionDate: "20 Aug 2026 3:00 PM", dmPresent: "no" }), // 23 days ago
    ],
    NOW,
  );
  assert.equal(r.n, 2);
  assert.equal(r.pct, 50);
});

test("a call still in the future is not a held call, whatever the sheet says", () => {
  const r = dmPresenceRate([rec({ sessionDate: ist(20), showed: "Y", dmPresent: "yes" })], NOW);
  assert.equal(r.held, 0);
  assert.equal(r.pct, null);
});

test("session dates are read as IST, not as the runtime's timezone", () => {
  // 4:00 AM IST on the 12th is 22:30 UTC on the 11th. Read as UTC it would sit
  // in the future relative to NOW (06:00 UTC) and drop out of the window.
  const r = dmPresenceRate([rec({ sessionDate: ist(12, "4:00 AM"), dmPresent: "yes" })], NOW);
  assert.equal(r.held, 1);
  assert.equal(r.pct, 100);
});

test("an unparseable session date is dropped rather than counted at epoch zero", () => {
  const r = dmPresenceRate([rec({ sessionDate: "next Tuesday", dmPresent: "yes" })], NOW);
  assert.equal(r.held, 0);
  assert.equal(r.n, 0);
});

test("nothing marked is null, never 0% — no data is not a bad number", () => {
  const empty = dmPresenceRate([], NOW);
  assert.equal(empty.pct, null);
  assert.equal(empty.n, 0);

  const unmarkedOnly = dmPresenceRate([rec(), rec()], NOW);
  assert.equal(unmarkedOnly.pct, null);
  assert.equal(unmarkedOnly.held, 2);
  assert.equal(unmarkedOnly.unmarked, 2);
});

test("legacy rows with no DM Present column at all do not crash the figure", () => {
  const legacy = [
    { sessionDate: ist(10), showed: "Y" } as unknown as PresenceRecord,
    undefined as unknown as PresenceRecord,
  ];
  const r = dmPresenceRate(legacy, NOW);
  assert.equal(r.pct, null);
  assert.equal(r.held, 1);
});

test("marking values are read case-insensitively and anything else is not a vote", () => {
  const r = dmPresenceRate(
    [rec({ dmPresent: "YES" }), rec({ dmPresent: " No " }), rec({ dmPresent: "probably" })],
    NOW,
  );
  assert.equal(r.n, 2);
  assert.equal(r.yes, 1);
  assert.equal(r.pct, 50);
});

test("the window length is configurable, and the default is fourteen days", () => {
  assert.equal(DM_PRESENCE_WINDOW_DAYS, 14);
  // The bar this is measured against: a third today, seventy the point of it.
  assert.equal(DM_PRESENCE_TARGET_PCT, 70);
  const rows = [rec({ sessionDate: ist(5), dmPresent: "yes" })]; // 7 days ago
  assert.equal(dmPresenceRate(rows, NOW, 3).n, 0);
  assert.equal(dmPresenceRate(rows, NOW, 14).n, 1);
});

// ── formatDmPresence ──────────────────────────────────────────────────────────
// One line, one source of truth. The dashboard and the morning brief must not
// be able to quietly disagree about the same fortnight.

test("the line reads exactly as the dashboard and the brief both print it", () => {
  const r = dmPresenceRate([rec({ dmPresent: "yes" }), rec({ dmPresent: "no" }), rec({ dmPresent: "no" })], NOW);
  assert.equal(formatDmPresence(r), "Decision-maker present: 33% (last 14 days, n=3)");
});

test("with nothing marked the line says so instead of claiming zero", () => {
  assert.equal(formatDmPresence(dmPresenceRate([], NOW)), "Decision-maker present: – (last 14 days, n=0)");
});

test("the window in the words matches the window in the arithmetic", () => {
  const rows = [rec({ sessionDate: ist(5), dmPresent: "yes" })];
  assert.equal(formatDmPresence(dmPresenceRate(rows, NOW, 30), 30), "Decision-maker present: 100% (last 30 days, n=1)");
});

// ── the shape the callers rely on ─────────────────────────────────────────────

test("a fortnight at the baseline and a fortnight at the target both read cleanly", () => {
  const at = (yes: number, no: number) =>
    dmPresenceRate(
      [
        ...Array.from({ length: yes }, (_, i) => rec({ sessionDate: ist(2 + (i % 9)), dmPresent: "yes" })),
        ...Array.from({ length: no }, (_, i) => rec({ sessionDate: ist(2 + (i % 9)), dmPresent: "no" })),
      ],
      NOW,
    );
  assert.equal(formatDmPresence(at(3, 6)), "Decision-maker present: 33% (last 14 days, n=9)");
  assert.equal(formatDmPresence(at(7, 3)), "Decision-maker present: 70% (last 14 days, n=10)");
  // Every session above sits inside the fourteen-day window, so the sample
  // size in the line is the whole list and not a silently truncated slice.
  assert.ok(NOW - 14 * DAY < Date.UTC(2026, 8, 2));
});
