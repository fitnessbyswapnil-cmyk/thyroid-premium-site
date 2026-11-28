/**
 * "Not now" on /decode (D7, audit/intended-flow.md §5 and §7).
 *
 * A woman who answers "In a month or two" or "Just exploring for now" sees her
 * score and the SAME free booking as everyone else, framed as no rush, plus an
 * Instagram follow link. Until 28-Nov-2026 she was sent to /webinar instead,
 * and the webinar is retired. On WhatsApp she gets the day-3 nudge only.
 *
 * The nudge rules themselves are tested in lib/free-booking-nudge.test.ts.
 * This file holds the two places those rules could be undone without a
 * planner test noticing: the quiz screen, and the cron route that wires the
 * stages to their templates. Source-shape assertions, like
 * free-call-tracking.test.ts, because the failure is a future edit quietly
 * putting the old routing back.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const QUIZ = read("app/decode/DecodeQuiz.tsx");
const ROUTE = read("app/api/cron/payment-reminder/route.ts");

/** Comments may explain the history; only code and copy are checked. The
 *  `[^:]` guard keeps the "//" of a URL from being read as a comment. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const between = (src: string, from: string, to: string): string => {
  const start = src.indexOf(from);
  if (start < 0) return "";
  const end = src.indexOf(to, start + from.length);
  return end < 0 ? "" : src.slice(start, end);
};

const NOT_NOW_SCREEN = between(QUIZ, ") : gatedOut ? (", ") : hasReport ? (");
const NOT_NOW_MEANING = between(QUIZ, "const meaning = notNow ? (", ") : !booking ?");

test("nothing in the quiz links to, or talks about, the retired webinar", () => {
  const live = code(QUIZ);
  assert.doesNotMatch(live, /webinar|masterclass/i);
  assert.doesNotMatch(live, /NURTURE_DESTINATION|decode_nurture/);
});

test("the not-now screen books through the same free scheduler as everyone else", () => {
  assert.ok(NOT_NOW_SCREEN.length > 0, "the not-now branch was not found; rewrite this test, do not delete it");
  assert.match(NOT_NOW_SCREEN, /<ScheduleClient\b/);
  assert.match(NOT_NOW_SCREEN, /\n\s+free\n/, "free, so nothing on this path can charge");
  assert.match(NOT_NOW_SCREEN, /ctaLabel=\{"Book my free session"\}/, "the same button label");
  assert.match(NOT_NOW_SCREEN, /existingLeadId=\{leadId \|\| undefined\}/, "her lead is reused, not minted twice");
  // One answers object for every screen, so the not-now booking writes the
  // same sheet columns as the eligible one.
  const uses = (QUIZ.match(/<ScheduleClient\b/g) ?? []).length;
  assert.equal((QUIZ.match(/extraAnswers=\{bookingAnswers\}/g) ?? []).length, uses);
});

test("the not-now screen says there is no rush, and offers Instagram in a new tab", () => {
  assert.match(NOT_NOW_SCREEN, /<NextSteps hasReport=\{!!hasReport\} noRush \/>/);
  assert.match(NOT_NOW_SCREEN, /href=\{NURTURE_INSTAGRAM_URL\}/);
  assert.match(NOT_NOW_SCREEN, /target="_blank"/, "the score and the booking stay where she left them");
  assert.match(NOT_NOW_SCREEN, /rel="noopener noreferrer"/);
  assert.match(QUIZ, /notNow \? \{ href: "#next-step", label: "Book my free session", sub: "No rush/);
  assert.ok(NOT_NOW_MEANING.length > 0, "the not-now meaning line was not found");
});

test("the not-now copy keeps the copy rules: no fee, no em dash, no banned words", () => {
  for (const [where, text] of [["screen", NOT_NOW_SCREEN], ["meaning", NOT_NOW_MEANING]] as const) {
    assert.doesNotMatch(text, /₹|299|\bfee\b|\bcosts?\b|\bpay\b/i, `${where}: the call is free, so no money words`);
    assert.doesNotMatch(text, /—/, `${where}: no em dashes`);
    assert.doesNotMatch(text, /\b(unlock|elevate|transform|journey|dive into)\b/i, `${where}: banned words`);
  }
});

test("the cron reads Gate Outcome for the free nudges, and no longer blanks not-now phones", () => {
  const base = between(ROUTE, "const freeNudgeColsBase = {", "};");
  assert.match(base, /gateOutcome: findCol\(header, GATE_OUTCOME_HEADER\)/);
  assert.match(
    ROUTE,
    /const nudgeableRows = nudgeableRowsOnly\(rows, 3, findCol\(header, "Bot Check"\)\);/,
    "the bot check still blanks; the gate is decided per stage now",
  );
});

test("the next-morning nudge is stage 1 rules, the day-3 nudge is stage 2 rules", () => {
  const p1 = between(ROUTE, "const freeNudgePlan = planFreeBookingNudges({", "});");
  const p2 = between(ROUTE, "const freeNudge2Plan = planFreeBookingNudges({", "});");
  assert.match(p1, /\.\.\.FREE_NUDGE_STAGE1,/);
  assert.match(p2, /\.\.\.FREE_NUDGE_STAGE2,/);
  for (const [name, call] of [["stage 1", p1], ["stage 2", p2]] as const) {
    assert.match(call, /rows: nudgeableRows,/, name);
    // An override after the spread would quietly change the window or the
    // audience the planner tests prove.
    assert.doesNotMatch(code(call), /minAgeHours|maxAgeDays|includeNurture/, `${name}: no override`);
  }
  // And each plan goes out under the template it was written for.
  assert.match(ROUTE, /const FREE_NUDGE_TEMPLATE = "free_booking_nudge_v1";/);
  assert.match(ROUTE, /const FREE_NUDGE_TEMPLATE2 = "free_booking_nudge_day3_v1";/);
  assert.match(ROUTE, /template: FREE_NUDGE_TEMPLATE, candidates: freeNudgePlan\.candidates/);
  assert.match(ROUTE, /template: FREE_NUDGE_TEMPLATE2, candidates: freeNudge2Plan\.candidates/);
});
