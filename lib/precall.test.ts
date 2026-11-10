/**
 * lib/precall.ts — her answers and her markers, composed for the pre-call PDF.
 * The rule these hold above all: nothing on the page is invented. A value
 * comes only from a row he typed or her notes Doc's table, an answer only
 * from her sheet row, and a row or answer that is half there is left out
 * with a warning, never completed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SYMPTOM_COLUMNS, type NotesContent } from "./drive.ts";
import {
  MAX_MARKERS,
  afterPrecallSend,
  agendaFor,
  andList,
  buildPrecall,
  cleanMarkerRows,
  factRows,
  markerRowsFromNotes,
  mergeReadRows,
  metaLine,
  noEmDash,
  pickMarkers,
  precallCaption,
  precallDedupeKey,
  precallFileName,
  precallFromReply,
  quizFactsFromSheet,
  reportRows,
  sameRows,
  splitRows,
  tidyFlag,
  tidyRange,
  type MarkerRow,
  type PrecallReady,
  type QuizFacts,
} from "./precall.ts";

const CALL = { name: "meera kulkarni", phone: "9876543210", when: "2026-11-12T10:30:00Z" };
const NOW = Date.parse("2026-11-10T06:00:00Z");

/** Her notes Doc with a symptoms table whose cells follow SYMPTOM_COLUMNS by NAME. */
const notesWith = (rows: Record<string, string>[]): Pick<NotesContent, "sections"> => ({
  sections: { symptoms: { text: "", items: [], rows: rows.map((r) => SYMPTOM_COLUMNS.map((c) => r[c] ?? "")) } },
});

const DECODE: Partial<QuizFacts> = {
  name: "Meera Kulkarni", age: "36 to 40", city: "Pune",
  diagnosis: "Yes, hypothyroid and on medication", medication: "Yes, hypothyroid and on medication",
  stuck: "1 to 3 years", challenge: "A little comes off, then it stops",
  struggles: "Report: Yes, from the last 6 months | Work: Homemaker | Pattern score: 71/100 (5/7)",
  tried: "Yes, ₹10,000 to ₹25,000", goal: "10 to 15 kg",
};
const SEVEN_Q: Partial<QuizFacts> = {
  diagnosis: "Yes, Hashimoto's", medication: "Yes, and still struggling with weight", stuck: "More than 3 years",
  struggles: "Exhausted by afternoon, Hair fall, Brain fog", challenge: "Exhausted by afternoon, Hair fall, Brain fog",
  tried: "Dieting / calorie cutting, Gym / personal trainer",
};

// ── Text ─────────────────────────────────────────────────────────────────────

test("noEmDash: a range dash between numbers, a comma anywhere else, never an em dash", () => {
  assert.equal(noEmDash("0.4—4.0"), "0.4–4.0");
  assert.equal(noEmDash("Tired — always"), "Tired, always");
  assert.equal(noEmDash("— Report"), "Report");
  assert.equal(noEmDash("—"), "");
  assert.equal(noEmDash("A ― B"), "A, B");
});

test("tidyRange and tidyFlag: the shapes reports and his typing arrive in", () => {
  assert.equal(tidyRange("(0.4 - 4.0)"), "0.4–4.0");
  assert.equal(tidyRange("30 to 100"), "30–100");
  assert.equal(tidyRange("< 5.7"), "< 5.7");
  assert.equal(tidyRange("0.4—4.0"), "0.4–4.0");
  assert.equal(tidyFlag("H"), "high");
  assert.equal(tidyFlag(" l "), "low");
  assert.equal(tidyFlag("↑"), "high");
  assert.equal(tidyFlag("Borderline"), "borderline");
  assert.equal(tidyFlag(""), "");
});

test("andList", () => {
  assert.equal(andList([]), "");
  assert.equal(andList(["TSH"]), "TSH");
  assert.equal(andList(["TSH", "Free T3"]), "TSH and Free T3");
  assert.equal(andList(["A", "B", "C"]), "A, B and C");
});

// ── Marker rows ──────────────────────────────────────────────────────────────

test("cleanMarkerRows: blank rows are skipped quietly, half rows are left off WITH a warning, never completed", () => {
  const r = cleanMarkerRows([
    { marker: "", value: "", range: "", flag: "" },
    { marker: "TSH", value: "5.8 (0.4-4.0)", flag: "H" },
    { marker: "Vitamin D", value: "" },
    { marker: "", value: "14" },
    { marker: "Ferritin", value: "18 ng/mL", range: "30 - 200", flag: "low" },
    "not a row",
    null,
  ]);
  assert.equal(r.touched, true);
  assert.deepEqual(r.rows, [
    { marker: "TSH", value: "5.8", range: "0.4–4.0", flag: "high" },
    { marker: "Ferritin", value: "18 ng/mL", range: "30–200", flag: "low" },
  ]);
  assert.deepEqual(r.warnings, [
    "Row 3 (Vitamin D) has no value, so it is left off.",
    "Row 4 has a value but no marker name, so it is left off.",
  ]);
});

test("cleanMarkerRows: anything that is not a list of rows is nothing, and untouched", () => {
  for (const input of [undefined, null, "TSH 5.8", {}, 42, [], [{}], [{ marker: "  ", value: "\n" }]]) {
    const r = cleanMarkerRows(input);
    assert.deepEqual(r.rows, [], JSON.stringify(input));
    assert.equal(r.touched, false, JSON.stringify(input));
  }
});

test("cleanMarkerRows: long text is cut and said so; em dashes never survive", () => {
  const r = cleanMarkerRows([{ marker: "TSH — ultra", value: "Reactive — see comments in the report body", range: "—", flag: "H—" }]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].marker, "TSH, ultra");
  assert.ok(r.rows[0].value.length <= 28 && r.rows[0].value.endsWith("…"));
  assert.ok(!JSON.stringify(r.rows).includes("—"));
  assert.match(r.warnings[0], /value is long/);
});

test("markerRowsFromNotes reads Marker, Her value (range) and Flag by NAME, never What she feels", () => {
  const notes = notesWith([
    { "What she feels": "Tired", Marker: "TSH", "Her value (range)": "5.8 (0.4-4.0)", Flag: "high" },
    { "What she feels": "Hair fall" },
    { Marker: "Vitamin D", "Her value (range)": "14 (30-100)", Flag: "low" },
  ]);
  const rows = markerRowsFromNotes(notes);
  assert.equal(rows.length, 3);
  assert.ok(!JSON.stringify(rows).includes("Tired"), "her feelings are his call note, not a marker");
  assert.deepEqual(cleanMarkerRows(rows).rows, [
    { marker: "TSH", value: "5.8", range: "0.4–4.0", flag: "high" },
    { marker: "Vitamin D", value: "14", range: "30–100", flag: "low" },
  ]);
  assert.deepEqual(markerRowsFromNotes(null), []);
  assert.deepEqual(markerRowsFromNotes({ sections: {} }), []);
});

test("pickMarkers: anything typed wins outright; only an untouched form falls back to her notes Doc", () => {
  const notes = notesWith([{ Marker: "TSH", "Her value (range)": "3.1", Flag: "" }]);
  const typed = pickMarkers([{ marker: "Vitamin D", value: "22" }], notes);
  assert.equal(typed.source, "typed");
  assert.deepEqual(typed.rows.map((r) => r.marker), ["Vitamin D"]);

  // A half-typed form is a mistake to fix, not a cue to quietly print the Doc.
  const half = pickMarkers([{ marker: "Vitamin D", value: "" }], notes);
  assert.equal(half.source, "typed");
  assert.deepEqual(half.rows, []);
  assert.equal(half.warnings.length, 1);

  for (const untouched of [undefined, [], [{ marker: "", value: "", range: "", flag: "" }]]) {
    const fromDoc = pickMarkers(untouched, notes);
    assert.equal(fromDoc.source, "notes");
    assert.deepEqual(fromDoc.rows, [{ marker: "TSH", value: "3.1", range: "", flag: "" }]);
  }
  assert.deepEqual(pickMarkers(undefined, null).rows, [], "no Doc, nothing typed: nothing");
});

test("reportRows: library order, each line once under the LAST of its rows, unknown tests last and unexplained", () => {
  const rows = reportRows([
    { marker: "Uric Acid", value: "6.4", flag: "high" },
    { marker: "Triglycerides", value: "168" },
    { marker: "Anti-TPO", value: "212" },
    { marker: "LDL Cholesterol", value: "142" },
    { marker: "TSH", value: "5.8" },
    { marker: "Free T3", value: "2.1" },
  ]);
  assert.deepEqual(rows.map((r) => r.marker), ["TSH", "Free T3", "Anti-TPO", "Triglycerides", "LDL Cholesterol", "Uric Acid"]);
  assert.match(rows[0].note, /^TSH is the signal/);
  assert.match(rows[1].note, /^T3 is the active thyroid hormone/);
  assert.match(rows[2].note, /^Anti-TPO is a thyroid antibody test/);
  assert.equal(rows[3].note, "", "the lipid line waits for the last lipid row");
  assert.match(rows[4].note, /^Cholesterol and triglycerides/);
  assert.equal(rows[5].note, "");
  assert.equal(rows[5].group, "");
  assert.deepEqual(rows.map((r) => r.cite), ["TSH", "Free T3", "Anti-TPO", "Triglycerides", "LDL", "Uric Acid"]);
});

// ── Her answers ──────────────────────────────────────────────────────────────

const SHEET = [
  ["Timestamp", "Name", "Phone", "Email", "City", "Age", "Diagnosis", "On Medication", "Struggle Duration", "Biggest Challenge", "Weight Struggles", "Tried Before", "Goal", "Thyroid Condition", "Phone"],
  ["2026-11-01", "Meera", "9876543210", "", "Pune", "", "", "", "", "", "", "", "", "Yes, hypothyroid and on medication", ""],
  ["2026-11-02", "Asha", "9123456789", "", "Mumbai", "41 to 50", "No", "", "Less than 6 months", "", "", "", "", "", ""],
  ["2026-11-03", "Meera Kulkarni", "", "", "", "36 to 40", "", "", "1 to 3 years", "A little comes off, then it stops", "Report: Yes | Work: Homemaker", "Yes, under ₹10,000", "10 to 15 kg", "", "+91 98765 43210"],
  ["2026-11-04", "", "919876543210", "", "", "", "", "", "", "", "", "", "", "", ""],
];

test("quizFactsFromSheet: every row of hers, newest non-empty answer per field, by header NAME, any phone column", () => {
  const f = quizFactsFromSheet(SHEET, "98765-43210");
  assert.equal(f.name, "Meera Kulkarni");
  assert.equal(f.city, "Pune");
  assert.equal(f.age, "36 to 40");
  assert.equal(f.diagnosis, "Yes, hypothyroid and on medication", "the older Thyroid Condition column still counts");
  assert.equal(f.stuck, "1 to 3 years");
  assert.equal(f.challenge, "A little comes off, then it stops");
  assert.equal(f.tried, "Yes, under ₹10,000");
  assert.equal(f.goal, "10 to 15 kg");
  assert.equal(f.medication, "");
  assert.ok(!Object.values(f).includes("Mumbai") && !Object.values(f).includes("41 to 50"), "another woman's answers never leak in");
  assert.deepEqual(quizFactsFromSheet(SHEET, "123"), quizFactsFromSheet([], "9876543210"));
  assert.equal(quizFactsFromSheet([["Name", "City"], ["Meera", "Pune"]], "9876543210").city, "", "no Phone column, no match");
});

test("factRows on the decode quiz: her answers verbatim; the Report/Work line and the repeated diagnosis are not printed", () => {
  assert.deepEqual(factRows(DECODE), [
    { label: "Weight stuck for", value: "1 to 3 years" },
    { label: "Your biggest challenge", value: "A little comes off, then it stops" },
    { label: "Thyroid diagnosis", value: "Yes, hypothyroid and on medication" },
    { label: "Paid for help before", value: "Yes, ₹10,000 to ₹25,000" },
    { label: "Weight you want to lose", value: "10 to 15 kg" },
  ]);
});

test("factRows on the 7-question quiz: the symptom list once, not twice as a challenge", () => {
  assert.deepEqual(factRows(SEVEN_Q), [
    { label: "Weight stuck for", value: "More than 3 years" },
    { label: "Thyroid diagnosis", value: "Yes, Hashimoto's" },
    { label: "Thyroid medication", value: "Yes, and still struggling with weight" },
    { label: "Symptoms you mentioned", value: "Exhausted by afternoon, Hair fall, Brain fog" },
    { label: "Already tried", value: "Dieting / calorie cutting, Gym / personal trainer" },
  ]);
});

test("factRows: unknown means omitted; an answer that is not the thing it should be is not printed", () => {
  assert.deepEqual(factRows({}), []);
  assert.deepEqual(factRows({ stuck: "a while", goal: "lose weight", diagnosis: "—", tried: "n/a", medication: "-" }), []);
  const f = factRows({ diagnosis: "Not tested, but I think so" });
  assert.deepEqual(f, [{ label: "Thyroid diagnosis", value: "Not tested, but I think so" }], "her own words, not a diagnosis");
});

test("metaLine: age band, city, call date, each only when it reads as one", () => {
  assert.deepEqual(metaLine(DECODE, CALL.when), ["36–40", "Pune", "Call: 12 Nov 2026"]);
  assert.deepEqual(metaLine({ city: "Somewhere else", age: "old" }, CALL.when), ["Call: 12 Nov 2026"]);
  assert.deepEqual(metaLine({}, "not a date"), []);
});

// ── The call agenda ──────────────────────────────────────────────────────────

test("agendaFor: one point per group she has, each naming the markers it rests on; nothing about tests she did not do", () => {
  const rows = reportRows([
    { marker: "TSH", value: "5.8" }, { marker: "Free T3", value: "2.1" },
    { marker: "Vitamin D (25-OH)", value: "14" }, { marker: "Ferritin", value: "18" },
    { marker: "Uric Acid", value: "6.4", flag: "high" }, { marker: "Creatinine", value: "0.8" },
  ]);
  const agenda = agendaFor(rows, factRows(DECODE), DECODE.goal ?? "");
  assert.deepEqual(agenda, [
    "How your thyroid results (TSH and Free T3) fit with what you told me about your weight.",
    "Your Vitamin D and Ferritin results, and how energy and recovery shape a plan you can keep up.",
    "Anything else your report flags (Uric Acid).",
    "Where to start, and in what order, for your goal of losing 10 to 15 kg.",
  ]);
  assert.ok(!agenda.join(" ").includes("Creatinine"), "an unflagged test the library does not know is not a point");
  assert.ok(!/HbA1c|cholesterol|sugar/i.test(agenda.join(" ")), "no point about a group she has no marker in");
});

test("agendaFor: singular and plural, no answers, a long tail of flags, and a goal mid-sentence", () => {
  const rows = reportRows([
    { marker: "HbA1c", value: "5.9" }, { marker: "LDL Cholesterol", value: "142" }, { marker: "TSH", value: "3" },
    ...["A", "B", "C", "D", "E", "F"].map((m) => ({ marker: `Test ${m}`, value: "1", flag: "high" })),
  ]);
  assert.deepEqual(agendaFor(rows, [], "More than 20 kg"), [
    "How your thyroid results (TSH) connect to your weight.",
    "Your HbA1c result, and how meals can be built for steadier energy through the day.",
    "Your LDL result, and what food and activity can do for it alongside your doctor’s advice.",
    "Anything else your report flags (Test A, Test B, Test C and 3 more).",
    "Where to start, and in what order, for your goal of losing more than 20 kg.",
  ]);
  assert.equal(agendaFor([], [], "")[0], "Where to start, and in what order.");
});

// ── Fitting the pages ────────────────────────────────────────────────────────

const many = (n: number): MarkerRow[] =>
  ["TSH", "Free T3", "Free T4", "Anti-TPO", "Vitamin D", "Vitamin B12", "Ferritin", "Iron", "HbA1c", "Fasting Blood Sugar",
    "Total Cholesterol", "LDL Cholesterol", "HDL Cholesterol", "Triglycerides", "Uric Acid", "Creatinine", "Urea", "Sodium"]
    .slice(0, n)
    .map((marker, i) => ({ marker, value: String(10 + i), range: "1-100", flag: i % 2 ? "high" : "" }));

test("splitRows: a typical report is one page; a full panel is two, and neither page is ever empty", () => {
  const facts = factRows(DECODE);
  const five = reportRows(many(5));
  assert.equal(splitRows(five, facts, agendaFor(five, facts, "")), 5, "five markers and her answers fit one sheet");
  const sixteen = reportRows(many(16));
  const at = splitRows(sixteen, facts, agendaFor(sixteen, facts, ""));
  assert.ok(at > 0 && at < 16, `split at ${at}`);
  assert.equal(splitRows(reportRows(many(1)), facts, []), 1);
});

// ── The model ────────────────────────────────────────────────────────────────

test("buildPrecall: no marker, no PDF. A page of answers alone is not what the PDF promises", () => {
  for (const markers of [[], [{ marker: "TSH", value: "" }], [{ marker: "", value: "5.8" }]] as MarkerRow[][]) {
    const r = buildPrecall({ markers, facts: DECODE, call: CALL, now: NOW });
    assert.equal(r.model, null, JSON.stringify(markers));
  }
});

test("buildPrecall: the full model, from his rows and her answers only", () => {
  const r = buildPrecall({
    markers: [{ marker: "TSH", value: "5.8 µIU/mL", range: "0.4-4.0", flag: "H" }, { marker: "Uric Acid", value: "6.4", flag: "high" }],
    facts: DECODE,
    call: CALL,
    now: NOW,
  });
  assert.ok(r.model);
  assert.equal(r.model.name, "Meera Kulkarni");
  assert.deepEqual(r.model.meta, ["36–40", "Pune", "Call: 12 Nov 2026"]);
  assert.equal(r.model.facts.length, 5);
  assert.deepEqual(r.model.rows.map((x) => [x.marker, x.value, x.range, x.flag]), [["TSH", "5.8 µIU/mL", "0.4–4.0", "high"], ["Uric Acid", "6.4", "", "high"]]);
  assert.equal(r.model.split, 2);
  assert.deepEqual(r.warnings, ["No plain-language line for “Uric Acid”, so it prints with no explanation."]);
});

test("buildPrecall: past MAX_MARKERS the rest are left off with a warning, which is what keeps it to two pages", () => {
  const r = buildPrecall({ markers: many(18), facts: {}, call: CALL, now: NOW });
  assert.ok(r.model);
  assert.equal(r.model.rows.length, MAX_MARKERS);
  assert.ok(r.warnings.some((w) => w.startsWith(`Only the first ${MAX_MARKERS} markers fit on two pages, so 2 were left off.`)));
  assert.ok(r.warnings.includes("None of her quiz answers were found, so the PDF has no “What you told me” section."));
});

test("buildPrecall: a missing or broken call time dates the PDF today, never a made-up day", () => {
  const r = buildPrecall({ markers: [{ marker: "TSH", value: "3" }], facts: {}, call: { ...CALL, when: "" }, now: NOW });
  assert.deepEqual(r.model?.meta, ["Call: 10 Nov 2026"]);
});

// ── Around the route ─────────────────────────────────────────────────────────

test("file name, dedupe key and caption", () => {
  assert.equal(precallFileName("Meera K.", CALL.when), "Pre-call Analysis · Meera K. · 2026-11-12.pdf");
  // 23:00 UTC on the 11th is the 12th in IST: the coach's date.
  assert.equal(precallDedupeKey("+91 98765 43210", "2026-11-11T23:00:00Z"), "precall:9876543210:2026-11-12");
  assert.equal(precallCaption("meera kulkarni"), "Meera, here is your pre-call analysis: what your quiz answers and your report show, ready for our call.");
  assert.equal(precallCaption("", false), "Here is your pre-call analysis: what your report shows, ready for our call.");
  assert.ok(!/[—―]/.test(precallCaption("Meera")));
});

// ── The dashboard's side ─────────────────────────────────────────────────────

const READY: PrecallReady = {
  phase: "ready", pdfUrl: "https://drive.google.com/file/d/F/view", warnings: [], windowOpen: true,
  sentAt: "", waText: "", sendError: "", markerSource: "typed",
};
const NOW_ISO = "2026-11-10T06:00:00.000Z";

test("precallFromReply: a 200 with a file is ready; without one it is a failure, however it is labelled", () => {
  assert.deepEqual(
    precallFromReply(200, { pdfUrl: READY.pdfUrl, windowOpen: true, warnings: ["w", 3], markerSource: "notes" }, NOW_ISO),
    { ...READY, warnings: ["w"], markerSource: "notes" },
  );
  assert.equal(precallFromReply(200, { pdfUrl: READY.pdfUrl, sent: true }, NOW_ISO).phase, "ready");
  assert.equal((precallFromReply(200, { pdfUrl: READY.pdfUrl, sent: true }, NOW_ISO) as PrecallReady).sentAt, NOW_ISO);
  assert.deepEqual(precallFromReply(200, {}, NOW_ISO), { phase: "error", code: "no_pdf", hint: "The pre-call PDF came back without a file. Press Generate again." });
  assert.deepEqual(precallFromReply(422, { error: "no_markers" }, NOW_ISO), { phase: "error", code: "no_markers", hint: "Type her marker values, or fill the Marker column in her notes Doc." });
  assert.deepEqual(precallFromReply(502, null, NOW_ISO), { phase: "error", code: "http_502", hint: "The pre-call PDF failed (HTTP 502). Press Generate again." });
  assert.equal((precallFromReply(429, { error: "renderer_busy", hint: "Wait twenty seconds." }, NOW_ISO) as { hint: string }).hint, "Wait twenty seconds.");
});

test("afterPrecallSend: the file is never lost; a shut window swaps to the phone with the server's words", () => {
  const shut = afterPrecallSend(READY, 409, { error: "window_closed", waText: "Meera, here is…" }, NOW_ISO);
  assert.deepEqual(shut, { ...READY, windowOpen: false, waText: "Meera, here is…" });
  const sent = afterPrecallSend(READY, 200, { pdfUrl: READY.pdfUrl, sent: true, windowOpen: true }, NOW_ISO);
  assert.equal(sent.sentAt, NOW_ISO);
  const silent = afterPrecallSend(READY, 200, { pdfUrl: READY.pdfUrl, windowOpen: true }, NOW_ISO);
  assert.equal(silent.windowOpen, false);
  assert.equal(silent.sendError, "WhatsApp did not send it. Send it from your phone.");
  const failed = afterPrecallSend(READY, 502, { error: "send_failed", hint: "WhatsApp did not take the PDF." }, NOW_ISO);
  assert.deepEqual(failed, { ...READY, sendError: "WhatsApp did not take the PDF." });
});

test("mergeReadRows: a reading never overwrites what he typed, and fills an untouched form as it is", () => {
  const read: MarkerRow[] = [{ marker: "TSH", value: "5.8" }, { marker: "Vitamin D", value: "14" }];
  const asCleaned = [{ marker: "TSH", value: "5.8", range: "", flag: "" }, { marker: "Vitamin D", value: "14", range: "", flag: "" }];
  assert.deepEqual(mergeReadRows([{ marker: "", value: "" }], read), asCleaned);
  assert.deepEqual(
    mergeReadRows([{ marker: "tsh", value: "6.1" }, { marker: "", value: "" }], read),
    [{ marker: "tsh", value: "6.1" }, asCleaned[1]],
    "his TSH stays; only the marker he had not typed is added",
  );
});

test("mergeReadRows: a reading is cleaned like typing, so it can only ever fill the boxes with whole rows", () => {
  const merged = mergeReadRows([], [
    { marker: "TSH", value: "5.8 (0.4-4.0)", flag: "H" },
    { marker: "Vitamin D", value: "" },
    { marker: "", value: "14" },
    "junk" as unknown as MarkerRow,
    { marker: "Free T3 — total", value: "2.1", range: "2.0—4.4" },
  ]);
  assert.deepEqual(merged, [
    { marker: "TSH", value: "5.8", range: "0.4–4.0", flag: "high" },
    { marker: "Free T3, total", value: "2.1", range: "2.0–4.4", flag: "" },
  ]);
  assert.deepEqual(mergeReadRows([{ marker: "LDL", value: "142" }], []), [{ marker: "LDL", value: "142" }], "an empty reading changes nothing");
});

test("sameRows: Send goes out only for the PDF he reviewed", () => {
  const a: MarkerRow[] = [{ marker: "TSH", value: "5.8", range: "0.4-4.0", flag: "H" }, { marker: "", value: "" }];
  assert.equal(sameRows(a, [{ marker: " TSH ", value: "5.8", range: "(0.4 - 4.0)", flag: "high" }]), true, "the same PDF, typed differently");
  assert.equal(sameRows(a, [{ marker: "TSH", value: "5.9", range: "0.4-4.0", flag: "H" }]), false);
  assert.equal(sameRows([], [{ marker: "", value: "" }]), true);
});
