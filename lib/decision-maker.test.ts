import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ASK_AT_MINUTE_ONE,
  classifyDecisionRole,
  classifyPartnerOnCall,
  decisionBadge,
  findColumn,
} from "./decision-maker.ts";

// ── findColumn ────────────────────────────────────────────────────────────────
// These headers are typed by hand when a column is added. An exact-case lookup
// reads "Partner on Call" as absent, which is indistinguishable from a legacy
// row — so the answer she actually gave would silently vanish.

test("findColumn ignores case and surrounding space", () => {
  const header = ["Timestamp", " Partner on Call ", "Decision Maker"];
  assert.equal(findColumn(header, "Partner On Call"), 1);
  assert.equal(findColumn(header, "decision maker"), 2);
});

test("findColumn returns -1 for a column the sheet does not have yet", () => {
  assert.equal(findColumn(["Timestamp", "Name"], "Partner On Call"), -1);
});

test("findColumn prefers the rightmost match, like every other reader of this sheet", () => {
  assert.equal(findColumn(["DM Present", "Name", "DM Present"], "DM Present"), 2);
});

test("findColumn tolerates blank and missing header cells", () => {
  const header = ["", undefined as unknown as string, "DM Present"];
  assert.equal(findColumn(header, "DM Present"), 2);
});

// ── classifyDecisionRole ──────────────────────────────────────────────────────
// Five wordings are live across three quizzes. Matching exact strings would
// classify the sixth as unknown and quietly drop the badge.

test("every live 'she decides' wording reads as sole", () => {
  for (const answer of [
    "Yes, I am the sole financial decision-maker",
    "Yes, I decide on my own",
    "I decide for myself",
    "I decide, then tell my family",
    "I discuss with my partner, but it's my choice",
  ]) {
    assert.equal(classifyDecisionRole(answer), "sole", answer);
  }
});

test("every live 'someone else is in it' wording reads as shared", () => {
  for (const answer of [
    "No, I need to discuss it with my spouse/family",
    "No, I need to discuss it with my spouse or family",
    "My partner / family decides",
  ]) {
    assert.equal(classifyDecisionRole(answer), "shared", answer);
  }
});

test("an answer carrying both meanings is read as shared, never as sole", () => {
  // "No, I need to discuss it with my spouse/family" contains "decide" in
  // longer variants. Sole must never win on a stray word.
  assert.equal(
    classifyDecisionRole("No, I decide together with my husband — we need to discuss it"),
    "shared",
  );
  assert.equal(classifyDecisionRole("Not the sole decision-maker"), "shared");
});

test("an unanswered or unrecognisable cell is unknown, not a guess either way", () => {
  assert.equal(classifyDecisionRole(""), "unknown");
  assert.equal(classifyDecisionRole("   "), "unknown");
  assert.equal(classifyDecisionRole(undefined as unknown as string), "unknown");
  assert.equal(classifyDecisionRole("maybe"), "unknown");
});

// ── classifyPartnerOnCall ─────────────────────────────────────────────────────

test("partner-on-call reads the three written values in any casing", () => {
  assert.equal(classifyPartnerOnCall("yes"), "yes");
  assert.equal(classifyPartnerOnCall("Yes"), "yes");
  assert.equal(classifyPartnerOnCall(" UNSURE "), "unsure");
  assert.equal(classifyPartnerOnCall("no"), "no");
});

test("the three answers the quiz actually stores read back correctly", () => {
  // The quiz writes the short value; a row from an older build can hold the
  // full option label instead. Both wordings must land on the same meaning,
  // and "Not sure, I will try" must not be read as a "no" on its first letter.
  assert.equal(classifyPartnerOnCall("yes"), "yes");
  assert.equal(classifyPartnerOnCall("Yes, I can bring them"), "yes");
  assert.equal(classifyPartnerOnCall("unsure"), "unsure");
  assert.equal(classifyPartnerOnCall("Not sure, I will try"), "unsure");
  assert.equal(classifyPartnerOnCall("no"), "no");
  assert.equal(classifyPartnerOnCall("No, I will come alone"), "no");
});

test("spreadsheet drift is tolerated without inventing a 'no'", () => {
  assert.equal(classifyPartnerOnCall("Y"), "yes");
  assert.equal(classifyPartnerOnCall("N"), "no");
  assert.equal(classifyPartnerOnCall("not sure"), "unsure");
  assert.equal(classifyPartnerOnCall("maybe"), "unsure");
  assert.equal(classifyPartnerOnCall(""), "unknown");
  assert.equal(classifyPartnerOnCall("¯\\_(ツ)_/¯"), "unknown");
});

// ── decisionBadge ─────────────────────────────────────────────────────────────

test("a sole decider gets the green badge and no opener to read", () => {
  const b = decisionBadge("Yes, I am the sole financial decision-maker", "");
  assert.deepEqual(b, { label: "SOLE DECIDER", tone: "good" });
});

test("a shared decider whose partner is joining is green — the problem is solved", () => {
  const b = decisionBadge("No, I need to discuss it with my spouse/family", "yes");
  assert.deepEqual(b, { label: "PARTNER JOINING", tone: "good" });
});

test("a shared decider whose partner is unsure or absent is amber, and carries the opener", () => {
  for (const partner of ["unsure", "no"]) {
    const b = decisionBadge("No, I need to discuss it with my spouse/family", partner);
    assert.equal(b?.label, "ASK AT MINUTE 1", partner);
    assert.equal(b?.tone, "warn", partner);
    assert.equal(b?.prompt, ASK_AT_MINUTE_ONE, partner);
  }
});

test("a shared decider with no partner answer is amber — that IS the call this exists for", () => {
  // Every row written before the Partner On Call column existed looks like
  // this. Treating it as silent would blank the badge on the whole back
  // catalogue of the one case worth catching.
  const b = decisionBadge("No, I need to discuss it with my spouse/family", "");
  assert.equal(b?.label, "ASK AT MINUTE 1");
  assert.equal(b?.tone, "warn");
});

test("a legacy lead with no decision answer gets NO badge, not a green one", () => {
  assert.equal(decisionBadge("", ""), null);
  assert.equal(decisionBadge("", "yes"), null);
  assert.equal(decisionBadge(undefined as unknown as string, undefined as unknown as string), null);
});

test("the opener is the exact question, and says what to do with the answer", () => {
  assert.match(ASK_AT_MINUTE_ONE, /first two minutes/);
  assert.match(ASK_AT_MINUTE_ONE, /is the decision yours, or is someone else involved\?/);
  assert.match(ASK_AT_MINUTE_ONE, /rebook with them present/);
  assert.match(ASK_AT_MINUTE_ONE, /Do not run the full pitch\./);
});
