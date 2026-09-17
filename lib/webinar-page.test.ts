/**
 * Copy guard for /webinar and /webinar/confirmed. Meta reviews the landing
 * page, and the ad account has been restricted before. This fails the test run
 * if a banned claim reaches the rendered copy.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const FILES = ["app/webinar/WebinarClient.tsx", "app/webinar/RegisterForm.tsx", "app/webinar/confirmed/ConfirmedClient.tsx", "lib/webinar.ts"];
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

/** Rendered copy only: string literals and JSX text. Comments are not copy. */
function copyOf(file: string): string[] {
  const code = src(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const out: string[] = [];
  for (const m of code.matchAll(/"([^"\n]*[A-Za-z][^"\n]*)"|`([^`]*[A-Za-z][^`]*)`/g)) out.push(m[1] ?? m[2]);
  for (const m of code.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) out.push(m[1]);
  return out.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
}

// The lines the owner asked to keep, which name medication only to rule
// it out. Anything else mentioning stopping or changing medicine fails.
const MEDICATION_ALLOWED = [
  "You want me to tell you to stop your thyroid medicine",
  "Will you tell me to stop my medicine?",
  "No. Never. I do not touch your medication and I do not sell supplements.",
  "Never change or stop thyroid medicine without your doctor.",
];

test("no reversal, cure, heal or fix claims", () => {
  for (const f of FILES) for (const t of copyOf(f)) {
    assert.doesNotMatch(t, /\b(revers\w*|cur(e|ed|es|ing)|heal\w*|fix(ed|es|ing)?)\b/i, `${f}: "${t}"`);
  }
});

test("nothing about stopping, reducing or replacing medication, beyond the kept lines", () => {
  for (const f of FILES) for (const t of copyOf(f)) {
    if (!/\b(stop|reduc\w*|replac\w*|off|without|change)\b/i.test(t) || !/\b(medicines?|medications?|meds|tablets?|thyronorm|eltroxin)\b/i.test(t)) continue;
    assert.ok(MEDICATION_ALLOWED.some((ok) => t.includes(ok)), `${f}: "${t}"`);
  }
});

test("no assertions about her body, no success rates, no exclamation marks", () => {
  for (const f of FILES) for (const t of copyOf(f)) {
    assert.doesNotMatch(t, /\byou are overweight\b|\byour body is\b/i, `${f}: "${t}"`);
    assert.doesNotMatch(t, /\d+\s?%/, `${f}: "${t}"`);
    assert.doesNotMatch(t, /\bguarantee/i, `${f}: "${t}"`);
    assert.doesNotMatch(t, /[A-Za-z.)]!(\s|$)/, `${f}: "${t}"`);
  }
});

test("the results-vary line sits with the transformations", () => {
  const code = src("app/webinar/WebinarClient.tsx");
  const vary = code.indexOf("Results vary");
  assert.ok(vary > 0 && vary < code.indexOf("{TRANSFORM.map"), "Results vary must come before the transformation grid");
});

test("the transformation images are the cropped copies, and the reversal screenshot is gone", () => {
  const code = src("app/webinar/WebinarClient.tsx");
  assert.doesNotMatch(code, /\/transformations\//, "use /webinar/*.webp crops: the originals print banned claims");
  assert.doesNotMatch(code.replace(/\/\*[\s\S]*?\*\//g, ""), /Heenal R4|proof-heenal/);
  for (const m of code.matchAll(/"(\/webinar\/[a-z-]+\.webp)"/g)) {
    assert.ok(existsSync(new URL(`../public${m[1]}`, import.meta.url)), `missing ${m[1]}`);
  }
});

test("the method name appears exactly three times on the page", () => {
  const code = src("app/webinar/WebinarClient.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  const uses = (code.match(/\{WEBINAR_METHOD\}|\{Method\}/g) ?? []).length;
  assert.equal(uses, 3);
});

test("five repeated calls to action on the shortened page", () => {
  const code = src("app/webinar/WebinarClient.tsx");
  assert.equal((code.match(/<Cta label=/g) ?? []).length, 5);
});

test("bonuses come only from lib/webinar.ts, and only the ready ones reach the page", () => {
  const code = src("app/webinar/WebinarClient.tsx");
  assert.match(code, /readyBonuses\("instant"\)/);
  assert.match(code, /readyBonuses\("class"\)/);
  assert.doesNotMatch(code, /readyBonuses\("buyer"\)/, "buyer bonuses are pitched in the class, not on this page");
});

test("Community, class and replay links never appear in page code", () => {
  for (const f of ["app/webinar/WebinarClient.tsx", "app/webinar/confirmed/ConfirmedClient.tsx", "app/webinar/RegisterForm.tsx"]) {
    const code = src(f);
    assert.doesNotMatch(code, /chat\.whatsapp\.com|zoom\.us|meet\.google\.com/, f);
  }
  const confirmed = src("app/webinar/confirmed/ConfirmedClient.tsx");
  assert.match(confirmed, /href="\/webinar\/group"/);
  assert.match(confirmed, /href="\/webinar\/starter-kit"/);
});

test("the hero never makes a report sound required", () => {
  const code = src("app/webinar/WebinarClient.tsx");
  const h1 = code.slice(code.indexOf("<h1"), code.indexOf("</h1>"));
  assert.doesNotMatch(h1, /report/i, "the headline is a general thyroid fat-loss angle");
  assert.match(h1, /slow thyroid/, "the headline says who the class is for");
  assert.doesNotMatch(h1, /natural/i, "\"naturally\" reads as \"without medicine\" in this niche");
  assert.match(code, /No report needed to join/, "the hero says a report is not needed");
  assert.doesNotMatch(code, /Bring your (last thyroid )?report/i);
});
