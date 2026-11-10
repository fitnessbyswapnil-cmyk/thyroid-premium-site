/**
 * lib/precall-markers.ts — the reviewed library of lines her pre-call PDF
 * prints under a marker. These hold the two things that would hurt most if
 * they slipped: a line that reads as a diagnosis, a cure or medication advice,
 * and a printed test name matched to the wrong line (TIBC explained as iron
 * stores, Anti-TG as triglycerides).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DISPLAY_ORDER, MARKER_LIBRARY, citeName, libraryEntry, libraryRank, normalizeMarkerName } from "./precall-markers.ts";

const key = (name: string) => libraryEntry(name)?.key ?? null;

test("labs print a test a dozen ways; each reaches its own line", () => {
  const cases: [string, string][] = [
    ["TSH", "tsh"], ["S. TSH", "tsh"], ["TSH 3rd Generation", "tsh"], ["Ultrasensitive TSH (us-TSH)", "tsh"],
    ["Thyroid Stimulating Hormone", "tsh"], ["THYROTROPIN", "tsh"],
    ["Free T3", "t3"], ["FT3", "t3"], ["T3, Total", "t3"], ["Triiodothyronine (T3)", "t3"], ["Free Triiodothyronine", "t3"],
    ["Free T4", "t4"], ["FT4", "t4"], ["T4 Total", "t4"], ["Thyroxine (T4)", "t4"],
    ["Anti-TPO", "tpo"], ["Anti TPO Antibodies", "tpo"], ["Anti Thyroid Peroxidase Ab", "tpo"], ["TPO Ab", "tpo"],
    ["Vitamin D", "vitd"], ["Vitamin D, 25-Hydroxy", "vitd"], ["25-OH Vitamin D3", "vitd"], ["Vit D3", "vitd"],
    ["Vitamin B12", "b12"], ["Vit. B-12", "b12"], ["Cyanocobalamin", "b12"],
    ["Ferritin", "iron"], ["Serum Ferritin", "iron"], ["Iron", "iron"], ["Iron, Serum", "iron"],
    ["HbA1c", "sugar"], ["Glycated Haemoglobin (HbA1c)", "sugar"], ["Glycosylated Hemoglobin", "sugar"],
    ["Fasting Blood Sugar", "sugar"], ["Blood Sugar Fasting", "sugar"], ["Glucose - Fasting", "sugar"], ["Plasma Glucose (F)", "sugar"], ["FBS", "sugar"],
    ["Total Cholesterol", "lipids"], ["LDL Cholesterol", "lipids"], ["HDL Cholesterol", "lipids"], ["Triglycerides", "lipids"],
    ["VLDL", "lipids"], ["Non-HDL Cholesterol", "lipids"], ["Low Density Lipoprotein", "lipids"],
  ];
  for (const [name, want] of cases) assert.equal(key(name), want, name);
});

test("look-alikes are NOT matched: each is a different test, and silence beats a wrong line", () => {
  for (const name of [
    "Total Iron Binding Capacity", "TIBC", "UIBC", "Transferrin Saturation", "Iron Saturation %",
    "Chol/HDL Ratio", "LDL/HDL Ratio", "Lipoprotein (a)", "Lp(a)",
    "Anti-TG", "Anti Thyroglobulin Antibody", "Thyroglobulin",
    "Reverse T3", "TSH Receptor Antibody (TRAb)", "T3 Uptake", "Thyroxine Binding Globulin",
    "Glucose PP", "Post Prandial Blood Sugar", "Random Blood Sugar", "Estimated Average Glucose (eAG)", "Mean Plasma Glucose",
    "Fasting Insulin", "Uric Acid", "Haemoglobin", "Creatinine", "", "   ", "—",
  ]) {
    assert.equal(key(name), null, name);
  }
});

test("the antibody is matched first but printed after the hormones, the way a thyroid profile reads", () => {
  assert.equal(MARKER_LIBRARY[0].key, "tpo", "matched first, so Anti-TPO is never read as anything else");
  const rank = (n: string) => libraryRank(libraryEntry(n));
  assert.ok(rank("TSH") < rank("Free T3") && rank("Free T3") < rank("Free T4") && rank("Free T4") < rank("Anti-TPO"));
  assert.ok(rank("Anti-TPO") < rank("Vitamin D") && rank("Ferritin") < rank("HbA1c") && rank("HbA1c") < rank("LDL"));
  assert.equal(rank("Uric Acid"), DISPLAY_ORDER.length, "a test the library does not know comes last");
  assert.deepEqual([...DISPLAY_ORDER].sort(), MARKER_LIBRARY.map((e) => e.key).sort(), "every entry has a place");
});

test("citeName: short names for the call list, her own name without brackets or commas otherwise", () => {
  assert.equal(citeName("Thyroid Stimulating Hormone (TSH)"), "TSH");
  assert.equal(citeName("T3, Total"), "T3");
  assert.equal(citeName("Free T3"), "Free T3");
  assert.equal(citeName("FT4"), "Free T4");
  assert.equal(citeName("Anti Thyroid Peroxidase Ab"), "Anti-TPO");
  assert.equal(citeName("Vitamin D, 25-Hydroxy"), "Vitamin D");
  assert.equal(citeName("Iron, Serum"), "Iron");
  assert.equal(citeName("Serum Ferritin"), "Ferritin");
  assert.equal(citeName("Glucose, Fasting"), "Fasting glucose");
  assert.equal(citeName("HbA1c"), "HbA1c");
  assert.equal(citeName("Total Cholesterol"), "Total cholesterol");
  assert.equal(citeName("LDL Cholesterol"), "LDL");
  assert.equal(citeName("HDL Cholesterol"), "HDL");
  assert.equal(citeName("VLDL"), "VLDL");
  assert.equal(citeName("Triglycerides"), "Triglycerides");
  assert.equal(citeName("Uric Acid (Serum, Enzymatic Uricase)"), "Uric Acid");
  assert.equal(citeName("Haemoglobin (Hb), Whole Blood"), "Haemoglobin Whole Blood");
});

test("normalizeMarkerName folds case and punctuation only", () => {
  assert.equal(normalizeMarkerName("Vit. B-12 (Serum)"), "vit b 12 serum");
  assert.equal(normalizeMarkerName("  HbA1c  "), "hba1c");
});

// ── The copy rules, on every line the owner reviews ─────────────────────────

const LINES = MARKER_LIBRARY.map((e) => [e.key, e.line] as const);

test("no line has an em dash: the site's copy rule", () => {
  for (const [k, line] of LINES) assert.ok(!/[—―]/.test(line), k);
});

test("no line diagnoses, promises, or talks about her own result", () => {
  for (const [k, line] of LINES) {
    assert.ok(!/\b(cure[sd]?|curing|revers(e|es|ed|al|ing)|heal(s|ed|ing)?|guarantee[sd]?|fix(es|ed)?|permanent(ly)?)\b/i.test(line), `${k}: a cure or reversal word`);
    assert.ok(!/\byou have\b|\byour (result|results|value|values|level|levels|report)\b|\bis (high|low)\b|\bdeficien/i.test(line), `${k}: reads her result`);
    assert.ok(!/\b(hashimoto|hypothyroid(ism)?|hyperthyroid(ism)?|diabet|pre-?diabet|anaemi|anemi|thyroiditis)\b/i.test(line), `${k}: names a condition`);
  }
});

test("no line is medication advice: never a dose, a tablet or a medicine", () => {
  for (const [k, line] of LINES) {
    assert.ok(!/\b(dose|doses|dosage|tablet|tablets|pill|pills|medicine|medicines|medication|supplement|supplements|levothyrox\w*|thyronorm|eltroxin|thyrox\b|mg\b|mcg\b|iu\b|take|stop|increase|reduce)\b/i.test(line), `${k}: ${line}`);
  }
});

test("every line says why the marker matters for energy or weight", () => {
  for (const [k, line] of LINES) assert.ok(/\benergy\b|\bweight\b/i.test(line), k);
});

test("the lines stay short enough to sit under a row: two lines of small type at most", () => {
  for (const [k, line] of LINES) assert.ok(line.length <= 240, `${k} is ${line.length} characters`);
});
