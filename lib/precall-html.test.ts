/**
 * lib/precall-html.ts — the pre-call PDF's HTML. These pin what would be
 * unsafe or embarrassing on a page a client keeps: an em dash (the site's copy
 * rule), a missing "discuss with your doctor", a value that came from nowhere,
 * and anything he or she typed turning into markup in the printer's browser.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildPrecall, type MarkerRow, type PrecallModel, type QuizFacts } from "./precall.ts";
import { PRECALL_COPY, precallHtml } from "./precall-html.ts";
import { MARKER_LIBRARY } from "./precall-markers.ts";

const CALL = { name: "Meera Kulkarni", phone: "9876543210", when: "2026-11-12T10:30:00Z" };
const NOW = Date.parse("2026-11-10T06:00:00Z");

const FACTS: Partial<QuizFacts> = {
  age: "36 to 40", city: "Pune", diagnosis: "Yes, hypothyroid and on medication",
  stuck: "1 to 3 years", challenge: "A little comes off, then it stops", tried: "Yes, ₹10,000 to ₹25,000", goal: "10 to 15 kg",
};
const TYPICAL: MarkerRow[] = [
  { marker: "TSH", value: "5.8 µIU/mL", range: "0.4-4.0", flag: "H" },
  { marker: "Free T3", value: "2.1 pg/mL", range: "2.0-4.4", flag: "" },
  { marker: "Vitamin D (25-OH)", value: "14 ng/mL", range: "30-100", flag: "low" },
  { marker: "Ferritin", value: "18 ng/mL", range: "30-200", flag: "L" },
  { marker: "HbA1c", value: "5.9 %", range: "< 5.7", flag: "borderline" },
];
const FULL_PANEL: MarkerRow[] = [
  ...TYPICAL,
  { marker: "Free T4", value: "0.9 ng/dL", range: "0.8-1.8" },
  { marker: "Anti-TPO", value: "212 IU/mL", range: "< 34", flag: "H" },
  { marker: "Vitamin B12", value: "190 pg/mL", range: "211-911", flag: "L" },
  { marker: "Fasting Blood Sugar", value: "104 mg/dL", range: "70-100", flag: "H" },
  { marker: "LDL Cholesterol", value: "142 mg/dL", range: "< 100", flag: "H" },
  { marker: "Triglycerides", value: "168 mg/dL", range: "< 150", flag: "H" },
  { marker: "Total Cholesterol", value: "236 mg/dL", range: "< 200", flag: "H" },
  { marker: "HDL Cholesterol", value: "41 mg/dL", range: "> 50", flag: "L" },
  { marker: "Uric Acid", value: "6.4 mg/dL", range: "2.4-5.7", flag: "H" },
];

function model(markers: MarkerRow[], facts: Partial<QuizFacts> = FACTS, call = CALL): PrecallModel {
  const r = buildPrecall({ markers, facts, call, now: NOW });
  assert.ok(r.model, "expected a model");
  return r.model;
}
const count = (s: string, needle: string) => s.split(needle).length - 1;
/** Visible text: tags, the style block and the script dropped, entities decoded. */
const text = (html: string) =>
  html
    .replace(/<style>[\s\S]*?<\/style>/g, " ")
    .replace(/<script>[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&bull;/g, "•")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const SAMPLES = (): [string, string][] => [
  ["typical", precallHtml(model(TYPICAL))],
  ["two pages", precallHtml(model(FULL_PANEL))],
  ["sparse", precallHtml(model([{ marker: "TSH", value: "3.1" }], {}, { ...CALL, name: "Asha" }))],
];

// ── No em dash ───────────────────────────────────────────────────────────────

const EM_DASH = /[—―]|&mdash;|&#8212;|&#x2014;|&#8213;/i;

test("no em dash anywhere on the page: fixed copy, library lines, typed rows and her answers", () => {
  for (const [label, html] of SAMPLES()) assert.ok(!EM_DASH.test(html), label);
  // Em dashes typed into every box he and she can reach are rewritten, never printed.
  const dashed = precallHtml(
    model(
      [{ marker: "TSH — 3rd gen", value: "5.8 — high side", range: "0.4—4.0", flag: "H — check" }],
      { ...FACTS, challenge: "It comes off — then comes straight back", tried: "Yes — twice", goal: "10 — 15 kg" },
      { ...CALL, name: "Meera — K" },
    ),
  );
  assert.ok(!EM_DASH.test(dashed));
  assert.match(dashed, /0\.4–4\.0/, "a range keeps its range dash");
});

test("the fixed sentences hold the copy rules: no em dash, no cure or reversal, no banned words", () => {
  const fixed = Object.values(PRECALL_COPY).join(" ");
  assert.ok(!EM_DASH.test(fixed));
  assert.ok(!/\b(cure[sd]?|revers\w*|heal\w*|guarantee\w*|fix(es|ed)?)\b/i.test(fixed), "no cure or reversal claim");
  assert.ok(!/\b(unlock|elevate|transform\w*|journey|dive into)\b/i.test(fixed), "the house's banned words");
  assert.ok(!/\b(dose|dosage|tablet|pill)s?\b/i.test(fixed), "no medication advice");
});

// ── The doctor line ──────────────────────────────────────────────────────────

test("every PDF says, clearly, to discuss the results with her doctor, and that results vary", () => {
  for (const [label, html] of SAMPLES()) {
    const t = text(html);
    assert.equal(count(t, "Please discuss these results with your doctor."), 1, label);
    assert.match(t, /This page is coaching insight, not a diagnosis or medical advice\./, label);
    assert.match(t, /It does not change your medication or replace your doctor’s care\./, label);
    assert.match(t, /Individual results vary\./, label);
    // And every page's footer repeats the short form, so a page read alone still says it.
    assert.equal(count(t, "Coaching insight, not medical advice"), count(html, '<section class="page'), label);
  }
  // The doctor line is the box's heading, set in bold, not buried in small print.
  assert.match(precallHtml(model(TYPICAL)), /<strong>Please discuss these results with your doctor\.<\/strong>/);
});

test("on two pages the doctor box closes page 2, after the call list, and page 1 says it continues", () => {
  const html = precallHtml(model(FULL_PANEL));
  assert.equal(count(html, '<section class="page'), 2);
  const [, one, two] = html.split('<section class="page');
  assert.ok(!one.includes("Please discuss these results"));
  assert.match(one, /Continued on page 2\./);
  assert.match(one, /Page 1 of 2 &middot; Prepared for Meera Kulkarni/);
  assert.ok(two.indexOf("What we will look at on our call") < two.indexOf("Please discuss these results"));
  assert.match(two, /Page 2 of 2 &middot; Prepared for Meera Kulkarni/);
});

// ── No value without a source ────────────────────────────────────────────────

test("every value, range and flag cell is one he typed, in the order the library sets", () => {
  const html = precallHtml(model(TYPICAL));
  const cells = (cls: string) => [...html.matchAll(new RegExp(`<td class="${cls}">([^<]*)</td>`, "g"))].map((m) => text(m[1]));
  assert.deepEqual(cells("mk"), ["TSH", "Free T3", "Vitamin D (25-OH)", "Ferritin", "HbA1c"]);
  assert.deepEqual(cells("v"), ["5.8 µIU/mL", "2.1 pg/mL", "14 ng/mL", "18 ng/mL", "5.9 %"]);
  assert.deepEqual(cells("rg"), ["0.4–4.0", "2.0–4.4", "30–100", "30–200", "< 5.7"]);
  assert.deepEqual(cells("fl"), ["high", "", "low", "low", "borderline"]);
});

test("every number on the page traces to his rows, her answers, the call date or the page count", () => {
  const html = precallHtml(model(FULL_PANEL));
  const allowed = new Set<string>();
  const add = (s: string) => {
    for (const m of s.matchAll(/\d+(?:\.\d+)?/g)) allowed.add(m[0]);
  };
  FULL_PANEL.forEach((r) => [r.marker, r.value, r.range ?? "", r.flag ?? ""].forEach(add));
  Object.values(FACTS).forEach((v) => add(String(v)));
  add("36–40 12 Nov 2026 Page 1 of 2"); // the header's age band and call date, the footers
  // The library's own fixed words ("T3", "B12", "HbA1c") and the call list's numbering are fixed copy.
  MARKER_LIBRARY.forEach((e) => add(e.line));
  for (let i = 1; i <= 9; i++) allowed.add(String(i));
  const stray = [...text(html).matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]).filter((n) => !allowed.has(n));
  assert.deepEqual(stray, [], "a number appeared that nobody typed");
});

test("a library marker she has no row for is never printed as hers, and a row without a value prints nothing", () => {
  const html = precallHtml(model([{ marker: "TSH", value: "3.1" }, { marker: "Vitamin B12", value: "" }], {}));
  const t = text(html);
  assert.equal(count(html, '<tr class="r'), 1, "one row: the half row is left off, not completed");
  assert.ok(!t.includes("Vitamin B12"), "no row, no line, no mention");
  for (const absent of ["Ferritin", "HbA1c", "Cholesterol", "Vitamin D"]) assert.ok(!t.includes(absent), absent);
  assert.ok(!/µIU|ng\/mL|mg\/dL/.test(t), "no unit he did not type");
  assert.equal(buildPrecall({ markers: [{ marker: "TSH", value: "" }], facts: FACTS, call: CALL, now: NOW }).model, null, "no value at all, no PDF at all");
});

test("her answers print as she gave them, and an unknown one is left out rather than filled", () => {
  const t = text(precallHtml(model(TYPICAL, { stuck: "1 to 3 years", diagnosis: "Not tested, but I think so" })));
  assert.match(t, /Weight stuck for\s+1 to 3 years/);
  assert.match(t, /Thyroid diagnosis\s+Not tested, but I think so/);
  for (const absent of ["Your biggest challenge", "Paid for help before", "Weight you want to lose", "Thyroid medication", "Symptoms you mentioned"]) {
    assert.ok(!t.includes(absent), absent);
  }
  const none = text(precallHtml(model(TYPICAL, {})));
  assert.ok(!none.includes("What you told me"), "no answers, no section");
  assert.match(none, /What your report shows/);
  assert.ok(none.includes(PRECALL_COPY.leadNoAnswers));
});

test("a marker the library does not know prints its value and no explanation", () => {
  const html = precallHtml(model([{ marker: "Uric Acid", value: "6.4 mg/dL", range: "2.4-5.7", flag: "H" }], {}));
  assert.match(html, /<tr class="r solo"><td class="mk">Uric Acid<\/td><td class="v">6\.4 mg\/dL<\/td>/);
  assert.equal(count(html, '<tr class="x">'), 0);
  assert.ok(text(html).includes(PRECALL_COPY.unexplainedNote));
  const known = precallHtml(model(TYPICAL));
  assert.ok(!text(known).includes(PRECALL_COPY.unexplainedNote), "said only when a row is unexplained");
});

// ── Escaping ─────────────────────────────────────────────────────────────────

test("everything typed, by him or by her, is escaped: nothing can become markup", () => {
  const evil = '<img src=x onerror="alert(1)"> & <script>alert(2)</script>';
  const html = precallHtml(
    model(
      [{ marker: evil, value: evil, range: evil, flag: evil }, { marker: "TSH", value: "<0.01", range: "0.4-4.0" }],
      { stuck: "1 to 3 years", challenge: evil, diagnosis: evil, tried: evil, goal: `${evil} 10 kg` },
      { ...CALL, name: 'Meera <b>K</b> "x"' },
    ),
  );
  assert.ok(!html.includes("<img src=x"), "an <img> tag came through");
  assert.ok(!/<script>alert/.test(html), "a <script> tag came through");
  assert.ok(html.includes("&lt;script&gt;alert(2)&lt;/script&gt;"));
  assert.ok(html.includes('<td class="v">&lt;0.01</td>'), "a value below the limit keeps its < sign, as text");
  assert.ok(!html.includes("<b>K</b>"));
  // Her name: the title, the header and the footer.
  assert.equal(count(html, "Meera &lt;b&gt;K&lt;/b&gt; &quot;x&quot;"), 3);
  // The only scripts are the fit script, and the only tags are the template's.
  assert.equal(count(html, "<script>"), 1);
});

// ── The house style and the printer's contract ──────────────────────────────

test("IBM Plex from Google Fonts and nothing else from outside: the printer allows only those hosts", () => {
  const html = precallHtml(model(TYPICAL));
  assert.match(html, /family=IBM\+Plex\+Sans/);
  assert.match(html, /family=IBM\+Plex\+Serif/);
  assert.match(html, /family=IBM\+Plex\+Mono/);
  const hosts = [...html.matchAll(/https?:\/\/[^\s"')]+/g)].map((m) => new URL(m[0]).host);
  assert.deepEqual([...new Set(hosts)], ["fonts.googleapis.com"]);
});

test("A4 sheets in millimetres, one page when it fits, and the fit script the printer waits for", () => {
  const one = precallHtml(model(TYPICAL));
  assert.equal(count(one, '<section class="page'), 1);
  assert.ok(!one.includes("Page 1 of"), "a single page is not numbered");
  assert.match(one, /@page\{size:A4;margin:0\}/);
  assert.match(one, /\.page\{width:210mm;height:297mm;/);
  assert.match(one, /document\.fonts\.ready/);
  assert.match(one, /var MIN = 0\.8;/);
  assert.match(one, /setAttribute\("data-fit", "1"\)/);
  assert.ok(one.indexOf("<script>") > one.lastIndexOf('<section class="page'), "registered after the pages exist");
});

test("visibly a different document from the summary: its own headline, band and kicker", () => {
  const html = precallHtml(model(TYPICAL));
  assert.match(html, /<h1>Why your weight isn’t moving<\/h1>/);
  assert.match(html, /<div class="sub">What your answers and your report show<\/div>/);
  assert.match(html, /<div class="band"><\/div>/);
  assert.match(html, /<div class="kick">Pre-call analysis<\/div>/);
  assert.match(html, /<title>Pre-call Analysis &middot; Meera Kulkarni<\/title>/);
  assert.ok(!html.includes("Root-Cause Review") && !html.includes("Consultation Summary"));
});
