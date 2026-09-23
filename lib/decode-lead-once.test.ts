/**
 * One woman, one lead.
 *
 * The /decode score screen has a Back button that returns to the name/phone
 * gate. Before this guard, submitting that gate a second time minted a fresh
 * `dq_<ts>` id, which meant a second sheet row, a second QuizComplete and a
 * second Lead for the same person — and that is exactly what a live test on
 * 23-Sep produced: two leads thirteen seconds apart.
 *
 * Source-shape assertions, deliberately: the failure being guarded is a future
 * edit quietly restoring the unconditional mint, and its only symptom in
 * production is a lead count that reads higher than the women behind it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const QUIZ = readFileSync(new URL("../app/decode/DecodeQuiz.tsx", import.meta.url), "utf8");

test("a second gate submit reuses the lead id instead of minting a new one", () => {
  assert.match(QUIZ, /const resubmit = !!leadId;/, "the resubmit case is still detected");
  assert.match(
    QUIZ,
    /const id = leadId \|\| `dq_\$\{Date\.now\(\)\}_/,
    "the existing lead id wins over a fresh mint",
  );
});

test("a resubmit fires no second browser Lead, on either bot-check path", () => {
  assert.match(QUIZ, /if \(!bot\.enabled && !resubmit\) trackLead\(/, "the bot-check-off path skips it");
  assert.match(QUIZ, /if \(bot\.enabled && counted && !resubmit\) trackLead\(/, "the bot-check-on path skips it");
});

test("the Lead event id survives the resubmit, so the server leg deduplicates", () => {
  // Same event_id → the D1 ledger sees a row already marked sent and skips the
  // resend before any network call. A fresh id would be a second Lead in Meta.
  assert.match(QUIZ, /const leadEventIdRef = useRef\(""\);/, "the id is remembered across submits");
  assert.match(
    QUIZ,
    /const leadEventId = \(resubmit && leadEventIdRef\.current\) \|\| generateEventId\("lead"\);/,
    "and reused when she comes back",
  );
});

test("leadId is a dependency of the gate callback it now reads", () => {
  assert.match(QUIZ, /\}, \[a, gate, gateBusy, bot, leadId\]\);/, "a stale closure would reopen the bug");
});
