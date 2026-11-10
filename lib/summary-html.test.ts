/**
 * lib/summary-html.ts — the approved two-page layout, filled. These pin the
 * parts that would be embarrassing or unsafe to get wrong: anything he typed
 * is escaped, the template's sample badges are gone, empty sources leave
 * their sections out, and his fixed wording survives verbatim.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SPENT_COLUMNS, SYMPTOM_COLUMNS, type NotesContent, type NotesKey, type NotesPart } from "./drive.ts";
import { buildSummary, type SummaryModel } from "./summary.ts";
import { esc, stepHtml, summaryHtml } from "./summary-html.ts";

type Parts = Partial<Record<NotesKey, Partial<NotesPart>>>;
const notes = (p: Parts): Pick<NotesContent, "sections"> => ({
  sections: Object.fromEntries(
    Object.entries(p).map(([k, v]) => [k, { text: v?.text ?? "", items: v?.items ?? [], rows: v?.rows ?? [] }]),
  ) as NotesContent["sections"],
});
const CALL = { name: "Meera K.", phone: "9876543210", when: "2026-11-09T09:30:00Z" };
const NOW = Date.parse("2026-11-10T06:00:00Z");

const model = (p: Parts, facts = {}): SummaryModel => {
  const r = buildSummary({ notes: notes(p), facts, call: CALL, now: NOW });
  assert.ok(r.model, "expected a model");
  return r.model;
};

const FULL: Parts = {
  words: { text: "Doctor kehta hai TSH normal hai — par main theek nahi hoon." },
  symptoms: { rows: [SYMPTOM_COLUMNS.map((c) => ({ "What she feels": "Tired", Marker: "TSH", "Her value (range)": "5.8 (0.4-4.0)", Flag: "high" })[c] ?? "")] },
  blockers: { items: ["Thyroid conversion is slow", "Protein is 35g a day"] },
  spent: { rows: [SPENT_COLUMNS.map((c) => ({ "What she tried": "Dietitian", "How long": "12 months", "Money (₹)": "60000" })[c] ?? "")] },
  price: { text: "20000" },
  nextStep: { text: "Reply START on WhatsApp by Friday 8pm." },
};
const SPARSE: Parts = { blockers: { items: ["Breakfast is tea and biscuits"] } };

const count = (s: string, needle: string) => s.split(needle).length - 1;

test("it is two A4 pages, sized in millimetres, nothing else", () => {
  const html = summaryHtml(model(FULL));
  assert.equal(count(html, '<section class="page'), 2);
  assert.match(html, /@page\{size:A4;margin:0\}/);
  assert.match(html, /\.page\{width:210mm;height:297mm;/);
  assert.match(html, /Page 1 of 2 &middot; Diagnosis/);
  assert.match(html, /Page 2 of 2 &middot; Decision/);
});

test("the template's sample badges are gone", () => {
  const html = summaryHtml(model(FULL));
  assert.ok(!/TEMPLATE|SAMPLE DATA|class="tmpl"/.test(html));
  assert.ok(!/Insert one published client result/i.test(html));
});

test("IBM Plex, all three families, and nothing else from outside", () => {
  const html = summaryHtml(model(FULL));
  assert.match(html, /family=IBM\+Plex\+Sans/);
  assert.match(html, /family=IBM\+Plex\+Serif/);
  assert.match(html, /family=IBM\+Plex\+Mono/);
  const urls = [...html.matchAll(/https?:\/\/[^\s"')]+/g)].map((m) => new URL(m[0]).host);
  assert.deepEqual([...new Set(urls)], ["fonts.googleapis.com"]);
});

test("everything he typed is escaped, so nothing in a Doc can become markup", () => {
  const evil = '<img src=x onerror="alert(1)"> & <script>alert(2)</script>';
  const html = summaryHtml(
    model({
      ...FULL,
      words: { text: evil },
      blockers: { items: [evil] },
      nextStep: { text: evil },
      symptoms: { rows: [SYMPTOM_COLUMNS.map(() => evil)] },
      spent: { rows: [SPENT_COLUMNS.map(() => evil)] },
    }),
  );
  assert.ok(!html.includes("<img src=x"), "an <img> tag came through");
  assert.ok(!html.includes("<script>alert"), "a <script> tag came through");
  assert.ok(html.includes("&lt;script&gt;alert(2)&lt;/script&gt;"));
  // Her name is escaped in all four places it appears.
  const named = summaryHtml(buildSummary({ notes: notes(FULL), facts: {}, call: { ...CALL, name: "Meera <b>K</b>" }, now: NOW }).model!);
  assert.ok(!named.includes("<b>K</b>"));
  assert.equal(count(named, "Meera &lt;b&gt;K&lt;/b&gt;"), 4);
});

test("esc covers the five characters that matter in HTML", () => {
  assert.equal(esc(`<a href="x" title='y'>&</a>`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
});

test("the word she has to reply with is bold, as in the approved sample", () => {
  assert.equal(stepHtml("Reply START on WhatsApp by Friday 8pm."), "Reply <strong>START</strong> on WhatsApp by Friday 8pm.");
  assert.equal(stepHtml("Book the next call"), "Book the next call");
  assert.equal(stepHtml("Reply <START>"), "Reply &lt;START&gt;");
});

test("her quote, without the template's timestamp", () => {
  const html = summaryHtml(model(FULL));
  assert.match(html, /&ldquo;Doctor kehta hai TSH normal hai — par main theek nahi hoon\.&rdquo;/);
  assert.match(html, /<span>Your words, from our call<\/span>/);
});

test("a sparse Doc leaves its empty sections out instead of printing them blank", () => {
  const html = summaryHtml(model(SPARSE));
  assert.ok(!html.includes("What you told me"), "quote section without a quote");
  assert.ok(!html.includes("What you feel"), "symptom table without symptoms");
  assert.match(html, /Your report is still being read\. The markers that match your symptoms go here once it is\./);
  assert.match(html, /These are patterns worth addressing, not a diagnosis\./, "the disclaimer stays");
  assert.ok(!html.includes("What you have already tried"), "cost table without costs");
  assert.ok(!html.includes("Spent so far"), "total bar without a total");
  assert.ok(!html.includes('class="amt"'), "price without a price");
  assert.ok(!html.includes("&#8377;") && !html.includes("₹"), "a rupee figure appeared from nowhere");
  assert.match(html, /<div class="ask solo">/);
  // With neither number, only the fixed sentence.
  assert.match(html, /<p>Hypothyroid fat loss gets <strong>slower<\/strong> each year/);
});

test("the full Doc fills every section", () => {
  const html = summaryHtml(model(FULL, { age: "38" }));
  assert.match(html, /<td class="m mv"><b>5\.8<\/b> <span>\(0\.4–4\.0\)<\/span><\/td><td class="flag">high<\/td>/);
  assert.match(html, /Why your weight is not moving &mdash; both/);
  assert.match(html, /You now know both\. What to fix/);
  assert.match(html, /<span class="v">₹60,000 · 1 year<\/span>/);
  assert.match(html, /Roughly ₹60,000 more spent the same way, and you will be 39 instead of 38\. Hypothyroid fat loss/);
  assert.match(html, /<div class="amt">₹20,000<\/div>/);
  assert.match(html, /Three months, 1-to-1 &middot; one-third of what the last year cost<br>Instalments available &mdash; ask me/);
  assert.match(html, /Reply <strong>START<\/strong> on WhatsApp by Friday 8pm\./);
});

test("his fixed wording is verbatim", () => {
  const html = summaryHtml(model(FULL));
  for (const fixed of [
    "None of this is a willpower problem.<br>It is a <em>sequencing</em> problem &mdash; and sequence is fixable.",
    "Diets failed because the root cause, thyroid and hormones, was never addressed. That&rsquo;s pressing the accelerator with the handbrake on. We reset the metabolism first.",
    "Home-cooked roti-sabzi meals built for thyroid health. No cutting out Indian food, no starving.",
    "Joint-friendly, 30&ndash;40 minutes, fits a meetings-till-8pm day. Plus sleep and daily rhythm.",
    "<b>Thyroid &amp; Lifestyle Consultation</b>60 minutes. Reports, lifestyle, symptoms → root cause.",
    "<b>Bonus — Private Client Community</b>Lifetime access, after the programme ends.<em>Yours to keep</em>",
    "Not medical advice. Results vary.",
    "Prepared for Meera K. by Swapnil Umbarkar",
    "Thyroid<br>Root-Cause Review",
  ]) {
    assert.ok(html.includes(fixed), `missing: ${fixed}`);
  }
});

test("the proof card is the published one, and says it is one woman's outcome", () => {
  const html = summaryHtml(model({ ...FULL, proof: { text: "Heenal" } }));
  assert.match(html, /<div class="pn">Heenal<span>IT Professional<\/span><\/div>/);
  assert.match(html, /In 90 days, despite Hypothyroidism\. Her blocker was in Pillar 1\. The root, not her diet\./);
  assert.match(html, /82 kg &rarr; 67 kg/);
  assert.match(html, /&minus;15 kg/);
  assert.match(html, /One client&rsquo;s own outcome, not a typical result\./);
});

test("the page fits itself to the sheet once the fonts are in, never below 80%", () => {
  const html = summaryHtml(model(FULL));
  assert.match(html, /document\.fonts\.ready/);
  assert.match(html, /var MIN = 0\.8;/);
  // Registered after the pages exist, so it can measure them.
  assert.ok(html.indexOf("<script>") > html.lastIndexOf('<section class="page'));
});
