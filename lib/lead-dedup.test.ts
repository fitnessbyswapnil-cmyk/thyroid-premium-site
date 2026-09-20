/**
 * Lead is the only event in this funnel sent from BOTH the browser and the
 * server, so it is the only one that can be counted twice. These tests guard
 * the contract that stops that.
 *
 * The contract, in one line: the browser mints the event_id, and the server
 * sends Lead only when it is handed that id.
 *
 * Why it is written this way rather than "remember to pass the same id": a
 * mismatched id does not throw, does not log, and does not fail a build. It
 * inflates Lead in Ads Manager by exactly 2x and the only symptom is a cost per
 * lead that looks too good, which is the symptom nobody investigates. The same
 * class of silent-correctness bug as the Cal.com metadata defect in
 * lib/cal-metadata.ts, and it gets the same treatment: a test that fails if the
 * wiring is undone.
 *
 * These read source rather than call functions because the risk lives in the
 * wiring ACROSS three files, not inside any one of them — the same reason
 * lib/decode-quiz-order.test.ts reads the quiz source.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = (p: string) => join(import.meta.dirname, "..", p);
const QUIZ = readFileSync(root("app/decode/DecodeQuiz.tsx"), "utf8");
const ROUTE = readFileSync(root("app/api/quiz-lead/route.ts"), "utf8");
const ANALYTICS = readFileSync(root("app/lib/analytics.ts"), "utf8");
const SCHEDULE = readFileSync(root("app/schedule/ScheduleClient.tsx"), "utf8");

test("trackLead accepts a caller-minted id and prefers it", () => {
  // `eventId || generateEventId(...)` is the whole mechanism: pass one and both
  // legs agree, pass nothing and the old browser-only behaviour is unchanged.
  assert.match(ANALYTICS, /export function trackLead\(userData\?: UserData, eventId\?: string\)/);
  assert.match(ANALYTICS, /const event_id = eventId \|\| generateEventId\("lead"\)/);
});

test("the quiz gate mints ONE id and gives it to both legs", () => {
  const gate = QUIZ.slice(QUIZ.indexOf("const submitGate"), QUIZ.indexOf("}, [a, gate, gateBusy, bot]);"));
  assert.ok(gate.length > 0, "submitGate not found — this test needs rewriting, not deleting");

  // Minted exactly once.
  const mints = [...gate.matchAll(/const leadEventId = generateEventId\("lead"\)/g)];
  assert.equal(mints.length, 1, "leadEventId must be minted exactly once per submission");

  // Every trackLead call in the gate passes it. A bare trackLead(leadUser) here
  // is the regression: it would mint its own id and orphan the server leg.
  const calls = [...gate.matchAll(/trackLead\(([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(calls.length >= 2, "expected both the bot-check-off and bot-check-on Lead calls");
  for (const args of calls) {
    assert.ok(
      args.includes("leadEventId"),
      `trackLead(${args}) does not pass leadEventId — the server Lead would be counted as a second Lead`,
    );
  }

  // And the same id reaches the server.
  assert.match(gate, /leadEventId,/, "leadEventId must be posted to /api/quiz-lead");
});

test("the server sends Lead ONLY when handed an id", () => {
  // The guard is what makes double-counting structurally impossible rather than
  // merely avoided: no id means no browser leg to pair with, so no send.
  assert.match(ROUTE, /const leadEventId = str\(payload\.leadEventId\);\s*\n\s*if \(leadEventId\) \{/);
  assert.match(ROUTE, /sendCAPIEvent\("Lead", \{\s*\n\s*eventId: leadEventId,/);
});

test("the server Lead carries the same value and currency as the browser leg", () => {
  // The browser pushes PRODUCT, which is FREE_CALL_VALUE + "INR". LEAD_VALUE is
  // the server's name for the same zero. Two legs of one event disagreeing
  // about its worth is its own data-quality warning.
  assert.match(ANALYTICS, /value: FREE_CALL_VALUE,\s*\n\s*currency: "INR",/);
  const leadSend = ROUTE.slice(ROUTE.indexOf('sendCAPIEvent("Lead"'));
  assert.match(leadSend.slice(0, 1200), /customData: \{ value: LEAD_VALUE, currency: CURRENCY \}/);
});

test("the server Lead is inside the bot-check fence, like the browser one", () => {
  // The browser withholds Lead until the server verifies the submission. If the
  // server leg sat outside `!unverified` it would send for bot traffic the
  // browser deliberately refused, and teach the ad account that a bot converts.
  const fence = ROUTE.indexOf("if (str(payload.phone) && !unverified) {");
  assert.ok(fence > 0, "the bot-check fence moved — re-check that Lead is still inside it");
  assert.ok(
    ROUTE.indexOf('sendCAPIEvent("Lead"') > fence,
    "the Lead send must sit inside the !unverified block",
  );
});

test("/schedule keeps its own Lead and does not ask the route for a second one", () => {
  // /schedule sends Lead itself, through /api/events, and separately posts to
  // /api/quiz-lead for the sheet row. It has a local `leadEventId` of its own
  // for the /api/events leg — that one is fine. What must never happen is that
  // id appearing in the /api/quiz-lead BODY, which would make the route send a
  // second Lead on top of the one /api/events already sent.
  assert.match(SCHEDULE, /event_name: "Lead"/, "/schedule still sends its own Lead");

  const post = SCHEDULE.indexOf('fetch("/api/quiz-lead"');
  assert.ok(post > 0, "/schedule no longer posts to /api/quiz-lead — re-check this contract");
  const body = SCHEDULE.slice(post, SCHEDULE.indexOf("})", SCHEDULE.indexOf("JSON.stringify({", post)));
  assert.ok(
    !body.includes("leadEventId"),
    "the /api/quiz-lead body must not carry leadEventId — /schedule already sent its Lead via /api/events",
  );
});
