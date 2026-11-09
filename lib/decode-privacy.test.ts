/**
 * The privacy policy is reachable where her data is taken, and reading it
 * costs her nothing.
 *
 * The quiz gate asks for her WhatsApp number after every answer is in, and
 * those answers live only in component state until the gate is submitted. So
 * the policy opens in a <dialog> on the same page, never as a navigation: the
 * Instagram and Facebook in-app browsers have no second tab to send it to. And
 * the dialog's iframe mounts only while the dialog is open. Rendered
 * unconditionally, /privacy would load, and fire its layout's PageView, on
 * every single gate view.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const QUIZ = readFileSync("app/decode/DecodeQuiz.tsx", "utf8");
const start = QUIZ.indexOf("if (atGate) {");
const gate = start < 0 ? "" : QUIZ.slice(start, QUIZ.indexOf("</Shell>", start));

test("the gate links the privacy policy after the number field", () => {
  assert.ok(gate.length > 0, "the gate block was not found");
  assert.match(gate, /id="gate-phone"[\s\S]*href="\/privacy"/, "the link sits after the number field");
});

test("the policy opens in a dialog, and its iframe mounts only when opened", () => {
  assert.match(gate, /<dialog\b/);
  assert.match(gate, /\.showModal\(\)/);
  assert.match(gate, /\{privacyOpen && <iframe src="\/privacy"/, "the iframe must be conditional on the dialog being open");
  assert.equal((QUIZ.match(/<iframe\b/g) ?? []).length, 1, "exactly one iframe in the quiz, the conditional one");
});
