/**
 * lib/summary.ts — what her consultation summary says, and the rule it lives
 * by: nothing on it is invented. Every number comes from his notes or her own
 * answers, and an empty source leaves the element out instead of filling it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SPENT_COLUMNS, SYMPTOM_COLUMNS, type NotesContent, type NotesKey, type NotesPart } from "./drive.ts";
import {
  ageLabel, buildSummary, callDateLabel, cityLabel, clampText, conditionLabel, deliverableFor, deliverablesFor,
  exactAge, factsFromAnswers, fractionWord, leadFactsFromSheet, mergeFacts, metaLine, missingFacts, numberList,
  parseDuration, parseMoney, parsePrice, replyWindow, splitValue, stuckLabel, summaryCaption, summaryDedupeKey,
  summaryFileName, timeLabel, timePhrase, weekdayAfter, MAX_BLOCKERS, MAX_SPENT, MAX_SYMPTOMS, QUOTE_MAX,
  type LeadFacts,
} from "./summary.ts";

type Parts = Partial<Record<NotesKey, Partial<NotesPart>>>;
const notes = (p: Parts): Pick<NotesContent, "sections"> => ({
  sections: Object.fromEntries(
    Object.entries(p).map(([k, v]) => [k, { text: v?.text ?? "", items: v?.items ?? [], rows: v?.rows ?? [] }]),
  ) as NotesContent["sections"],
});

/** A row in the Doc's own column order, whatever that order is. */
const symptomRow = (cells: Record<string, string>) => SYMPTOM_COLUMNS.map((c) => cells[c] ?? "");
const spentRow = (what: string, long: string, money: string) =>
  SPENT_COLUMNS.map((c) => (c === "What she tried" ? what : c === "How long" ? long : money));

// The approved sample, as he would type it into the notes Doc.
const SAMPLE_BLOCKERS = [
  "Thyroid conversion is slow — T4 is not becoming usable T3",
  "Vitamin D at 14 blocks thyroid hormone from doing its job",
  "Low ferritin — the body down-regulates metabolism to protect itself",
  "Eating window is 14 hours; insulin never gets a break",
  "Sleep is 5h20m average — cortisol stays high, so does fat storage",
  "Protein is roughly 35g a day against a 70g requirement",
];
const SAMPLE: Parts = {
  words: { text: "Main chaar saal se try kar rahi hoon. Doctor kehta hai TSH normal hai, sab theek hai — par main theek nahi hoon." },
  symptoms: {
    rows: [
      symptomRow({ "What she feels": "Wake up tired, never rested", Marker: "TSH", "Her value (range)": "5.8 (0.4-4.0)", Flag: "above range" }),
      symptomRow({ "What she feels": "Afternoon crash by 3pm", Marker: "Vitamin D", "Her value (range)": "14 (30-100)", Flag: "LOW" }),
    ],
  },
  blockers: { items: SAMPLE_BLOCKERS },
  spent: {
    rows: [
      spentRow("Dietitian, two rounds", "7 months", "18000"),
      spentRow("Gym membership + trainer", "11 months", "₹33,000"),
      spentRow("Supplements, off and on", "ongoing", "9k"),
    ],
  },
  price: { text: "20000" },
  nextStep: { text: "Reply START on WhatsApp by Friday 8pm." },
  proof: { text: "" },
  objection: { text: "Needs the husband to agree. Really the price." },
};
const FACTS: Partial<LeadFacts> = { age: "36 to 40", city: "Pune", diagnosis: "Yes, hypothyroid and on medication", stuck: "More than 3 years" };
// Mon 9 Nov 2026, 3pm IST.
const CALL = { name: "Meera K.", phone: "+91 98765 43210", when: "2026-11-09T09:30:00Z" };
const NOW = Date.parse("2026-11-10T06:00:00Z");

const build = (p: Parts = SAMPLE, facts: Partial<LeadFacts> = FACTS, call = CALL) =>
  buildSummary({ notes: notes(p), facts, call, now: NOW });

// ── The approved sample ──────────────────────────────────────────────────────

test("the approved sample's tags come out exactly as he approved them", () => {
  const m = build().model!;
  assert.deepEqual(
    m.deliverables.map((d) => d.tag),
    ["Blockers 1–3", "Blockers 4 & 6 · Pillar 2", "Pillar 3", "Blocker 5", "Every week", "Yours to keep"],
  );
});

test("pillar and deliverable text is his, verbatim", () => {
  const m = build().model!;
  assert.deepEqual(m.deliverables.map((d) => `${d.mark} ${d.title}: ${d.body}`), [
    "1 Thyroid & Lifestyle Consultation: 60 minutes. Reports, lifestyle, symptoms → root cause.",
    "2 Custom Indian Nutrition Plan: Meals you already eat. PDF and app.",
    "3 Low-Impact Training Plan: Home or gym. Demo videos. Joint-friendly.",
    "4 Weekly Check-Ins, Biweekly Reviews: Weight, energy, mood, sleep, training.",
    "5 Unlimited WhatsApp Support: Direct access to me. Never stuck.",
    "+ Bonus — Private Client Community: Lifetime access, after the programme ends.",
  ]);
});

test("with no blocker matching a deliverable, each falls back to its fixed tag", () => {
  const tags = deliverablesFor(["Says she has no time at all"]).map((d) => d.tag);
  assert.deepEqual(tags, ["Root cause", "Pillar 2", "Pillar 3", "Every two weeks", "Every week", "Yours to keep"]);
});

test("a blocker belongs to the deliverable whose word comes first in it", () => {
  // "Eating … insulin": an eating problem that mentions insulin.
  assert.equal(deliverableFor("Eating window is 14 hours; insulin never gets a break"), 1);
  assert.equal(deliverableFor("Insulin resistance from late eating"), 0);
  assert.equal(deliverableFor("Knee pain stops her walking"), 2);
  assert.equal(deliverableFor("Stress eating at night"), 3);
  assert.equal(deliverableFor("No routine at all"), 3);
  // Words inside other words do not count: "great" is not "eat", "strain" is not "train".
  assert.equal(deliverableFor("A great deal of strain at work"), -1);
});

test("blocker numbers read the way the template writes them", () => {
  assert.equal(numberList([1, 2, 3]), "1–3");
  assert.equal(numberList([4, 6]), "4 & 6");
  assert.equal(numberList([5]), "5");
  assert.equal(numberList([1, 2]), "1 & 2");
  assert.equal(numberList([1, 2, 3, 5]), "1–3 & 5");
  assert.equal(numberList([1, 3, 5]), "1, 3 & 5");
  assert.equal(numberList([6, 1, 2, 3]), "1–3 & 6");
});

// ── Required, and what is clamped ────────────────────────────────────────────

test("no blockers, no summary: the route answers notes_incomplete naming the heading", () => {
  for (const blockers of [undefined, { items: [] }, { items: ["", "  "] }]) {
    const r = build({ ...SAMPLE, blockers });
    assert.equal(r.model, null);
    assert.deepEqual(r.missing, ["Blockers"]);
  }
});

test("every blocker is shown, up to six, and the count is said in words", () => {
  const counts: [number, string, string][] = [
    [1, "just one", "You now know it."],
    [2, "both", "You now know both."],
    [3, "all three", "You now know all three."],
    [4, "all four", "You now know all four."],
    [6, "all six", "You now know all six."],
  ];
  for (const [n, heading, line] of counts) {
    const m = build({ ...SAMPLE, blockers: { items: SAMPLE_BLOCKERS.slice(0, n) } }).model!;
    assert.equal(m.blockers.length, n);
    assert.deepEqual(m.blockerCount, { heading, line });
  }
});

test("past six blockers, the first six print and he is told what was left off", () => {
  const r = build({ ...SAMPLE, blockers: { items: [...SAMPLE_BLOCKERS, "Seven", "Eight"] } });
  assert.equal(r.model!.blockers.length, MAX_BLOCKERS);
  assert.deepEqual(r.model!.blockers, SAMPLE_BLOCKERS);
  assert.ok(r.warnings.some((w) => /first 6 blockers.*2 were left off/.test(w)), r.warnings.join("\n"));
});

test("numbers and bullets he typed himself are dropped; the PDF numbers them", () => {
  const m = build({ ...SAMPLE, blockers: { items: ["1. Late dinners", "2) Skips breakfast", "- No walking", "• Poor sleep"] } }).model!;
  assert.deepEqual(m.blockers, ["Late dinners", "Skips breakfast", "No walking", "Poor sleep"]);
  // A blocker that STARTS with a number keeps it.
  assert.deepEqual(build({ ...SAMPLE, blockers: { items: ["5h20m of sleep a night"] } }).model!.blockers, ["5h20m of sleep a night"]);
});

test("her quote is cut at 220 characters on a word, with an ellipsis, and his quote marks are not doubled", () => {
  const long = `“${"Main thak gayi hoon ".repeat(20).trim()}”`;
  const r = build({ ...SAMPLE, words: { text: long } });
  const q = r.model!.quote;
  assert.ok(q.length <= QUOTE_MAX, String(q.length));
  assert.ok(q.endsWith("…"));
  assert.ok(!/[“”"]/.test(q));
  assert.ok(r.warnings.some((w) => /over 220/.test(w)));
  assert.equal(build({ ...SAMPLE, words: { text: '"Bas, ab nahi."' } }).model!.quote, "Bas, ab nahi.");
});

test("an empty quote leaves the section out, and says so", () => {
  const r = build({ ...SAMPLE, words: { text: "" } });
  assert.equal(r.model!.quote, "");
  assert.ok(r.warnings.some((w) => /Her words/.test(w)));
});

test("clampText never cuts mid-word and leaves short text alone", () => {
  assert.equal(clampText("short", 10), "short");
  const c = clampText("alpha beta gamma delta epsilon", 15);
  assert.ok(c.endsWith("…") && c.length <= 15, c);
  assert.ok(!/\s…$/.test(c));
});

// ── Symptoms: only from his table ────────────────────────────────────────────

test("symptom cells are read by column name, values split from ranges", () => {
  const s = build().model!.symptoms;
  assert.deepEqual(s[0], { feel: "Wake up tired, never rested", marker: "TSH", value: "5.8", range: "(0.4–4.0)", flag: "above range" });
  assert.equal(s[1].flag, "low");
});

test("a value without a range, or a range with units, is kept as typed", () => {
  assert.deepEqual(splitValue("14"), { value: "14", range: "" });
  assert.deepEqual(splitValue("14 ng/mL (30 - 100 ng/mL)"), { value: "14 ng/mL", range: "(30–100 ng/mL)" });
  assert.deepEqual(splitValue("5.9 (<5.7)"), { value: "5.9", range: "(<5.7)" });
});

test("no symptom rows means no table and no values, ever invented or remembered", () => {
  const r = build({ ...SAMPLE, symptoms: { rows: [] } });
  assert.deepEqual(r.model!.symptoms, []);
  assert.ok(r.warnings.some((w) => /still being read/.test(w)));
  // Blank rows from the Doc's empty template are not symptoms either.
  assert.deepEqual(build({ ...SAMPLE, symptoms: { rows: [symptomRow({}), symptomRow({ Flag: "low" })] } }).model!.symptoms, []);
});

test("past six symptom rows, six print", () => {
  const rows = Array.from({ length: 9 }, (_, i) => symptomRow({ "What she feels": `Symptom ${i + 1}`, Marker: "TSH", "Her value (range)": "5.8" }));
  const r = build({ ...SAMPLE, symptoms: { rows } });
  assert.equal(r.model!.symptoms.length, MAX_SYMPTOMS);
  assert.ok(r.warnings.some((w) => /first 6 symptom rows/.test(w)));
});

// ── Money and time ───────────────────────────────────────────────────────────

test("money reads the ways she says it", () => {
  const cases: [string, number | null][] = [
    ["18000", 18000], ["₹18,000", 18000], ["18,000", 18000], ["18k", 18000], ["18 K", 18000],
    ["Rs. 18,000/-", 18000], ["INR 18000", 18000], ["1.5 lakh", 150000], ["2L", 200000], ["approx 9000", 9000],
    ["", null], ["a lot", null], ["15-20k", null], ["free", null], ["0", null],
  ];
  for (const [raw, want] of cases) assert.equal(parseMoney(raw), want, raw);
});

test("lengths of time read in months and years only", () => {
  const cases: [string, number | "ongoing" | null][] = [
    ["7 months", 7], ["11 months", 11], ["2 years", 24], ["1.5 years", 18], ["18 mo", 18], ["1 yr", 12],
    ["a year and a half", 18], ["two and a half years", 30], ["1 year 6 months", 18], ["1 year and 6 months", 18],
    ["for a year", 12], ["about 8 months", 8], ["six months", 6], ["2 years (on and off)", 24],
    ["ongoing", "ongoing"], ["still taking them", "ongoing"],
    ["6 weeks", null], ["", null], ["since her wedding", null], ["3-4 months", null],
  ];
  for (const [raw, want] of cases) assert.equal(parseDuration(raw), want, raw);
});

test("the total time is said exactly, never rounded", () => {
  assert.equal(timeLabel(18), "1.5 years");
  assert.equal(timeLabel(24), "2 years");
  assert.equal(timeLabel(12), "1 year");
  assert.equal(timeLabel(6), "6 months");
  assert.equal(timeLabel(19), "19 months");
  assert.equal(timePhrase(24), "the last two years");
  assert.equal(timePhrase(12), "the last year");
  assert.equal(timePhrase(18), "the last year and a half");
  assert.equal(timePhrase(30), "the last two and a half years");
  assert.equal(timePhrase(7), "the last seven months");
});

test("the sample totals ₹60,000 over a year and a half, which is ₹40,000 a year", () => {
  const m = build().model!;
  assert.equal(m.total, "₹60,000 · 1.5 years");
  assert.deepEqual(m.spent.map((r) => r.money), ["₹18,000", "₹33,000", "₹9,000"]);
  // The band "36 to 40" is not an age, so there is no "you will be 39".
  assert.equal(m.nextYear, "Roughly ₹40,000 more spent the same way.");
});

test("one unreadable length and the bar shows money only, and the yearly figure goes", () => {
  const spent = { rows: [spentRow("Dietitian", "7 months", "18000"), spentRow("Gym", "since her wedding", "33000")] };
  const r = build({ ...SAMPLE, spent });
  assert.equal(r.model!.total, "₹51,000");
  assert.equal(r.model!.nextYear, "");
  assert.ok(r.warnings.some((w) => /money only/.test(w)), r.warnings.join("\n"));
});

test("an unreadable amount stays out of the total and is still printed as typed", () => {
  const spent = { rows: [spentRow("Dietitian", "7 months", "18000"), spentRow("Ayurveda", "5 months", "a lot")] };
  const r = build({ ...SAMPLE, spent });
  assert.equal(r.model!.total, "₹18,000 · 1 year");
  assert.equal(r.model!.spent[1].money, "a lot");
  assert.ok(r.warnings.some((w) => /not an amount/.test(w)));
});

test("everything ongoing has no length, so no total time and no yearly figure", () => {
  const spent = { rows: [spentRow("Supplements", "ongoing", "9000")] };
  const m = build({ ...SAMPLE, spent }).model!;
  assert.equal(m.total, "₹9,000");
  assert.equal(m.nextYear, "");
});

test("no spend rows drops the table, the total and the comparison", () => {
  const r = build({ ...SAMPLE, spent: { rows: [] } });
  assert.deepEqual(r.model!.spent, []);
  assert.equal(r.model!.total, "");
  assert.equal(r.model!.price!.comparison, "");
  assert.equal(r.model!.nextYear, "");
  assert.ok(r.warnings.some((w) => /Already spent/.test(w)));
});

test("past five spend rows, five print and the total counts only those", () => {
  const rows = Array.from({ length: 7 }, (_, i) => spentRow(`Thing ${i + 1}`, "1 month", "1000"));
  const r = build({ ...SAMPLE, spent: { rows } });
  assert.equal(r.model!.spent.length, MAX_SPENT);
  assert.equal(r.model!.total, "₹5,000 · 5 months");
  assert.ok(r.warnings.some((w) => /first 5 rows/.test(w)));
});

test("another twelve months: her next birthday only from an exact age", () => {
  assert.equal(build(SAMPLE, { ...FACTS, age: "38" }).model!.nextYear, "Roughly ₹40,000 more spent the same way, and you will be 39 instead of 38.");
  assert.equal(build({ ...SAMPLE, spent: { rows: [] } }, { ...FACTS, age: "38" }).model!.nextYear, "You will be 39 instead of 38.");
  assert.equal(exactAge("36 to 40"), null);
  assert.equal(exactAge("38 years"), 38);
  assert.equal(exactAge("Over 50"), null);
});

// ── Price ────────────────────────────────────────────────────────────────────

test("no number in Price quoted, no price block", () => {
  for (const text of ["", "did not come up", "will tell her tomorrow"]) {
    const r = build({ ...SAMPLE, price: { text } });
    assert.equal(r.model!.price, null, text);
    assert.ok(r.warnings.some((w) => /Price quoted/.test(w)));
  }
});

test("the price he said, in rupees, and the comparison only from 1.5x her spend", () => {
  assert.deepEqual(build().model!.price, { amount: "₹20,000", comparison: "one-third of what the last year and a half cost" });
  assert.equal(parsePrice("Quoted 20,000 for three months"), 20000);
  assert.equal(parsePrice("3 months for 20k"), 20000);
  assert.equal(parsePrice("₹25,000, or 22,000 if she pays today"), 25000);
  assert.equal(fractionWord(29000, 20000), "");
  assert.equal(fractionWord(30000, 20000), "half");
  assert.equal(fractionWord(60000, 20000), "one-third");
  assert.equal(fractionWord(80000, 20000), "one-fourth");
  assert.equal(fractionWord(100000, 20000), "one-fifth");
  assert.equal(fractionWord(625000, 20000), "less than one-tenth");
});

test("money only (no total time) compares against what she spent, not a period", () => {
  const spent = { rows: [spentRow("Dietitian", "", "60000")] };
  assert.equal(build({ ...SAMPLE, spent }).model!.price!.comparison, "one-third of what you have already spent");
});

test("a price that reads as tiny is printed as said, and he is told", () => {
  const r = build({ ...SAMPLE, price: { text: "20" } });
  assert.equal(r.model!.price!.amount, "₹20");
  assert.ok(r.warnings.some((w) => /reads as ₹20/.test(w)));
});

// ── Next step ────────────────────────────────────────────────────────────────

test("his next step is used as written", () => {
  assert.equal(build().model!.nextStep, "Reply START on WhatsApp by Friday 8pm.");
});

test("a blank next step is START by the weekday three days after the call, IST, with no scarcity claim", () => {
  const r = build({ ...SAMPLE, nextStep: { text: "" } });
  // Monday 9 Nov + 3 = Thursday.
  assert.equal(r.model!.nextStep, "Reply START on WhatsApp by Thursday, 8pm.");
  assert.ok(!/slot|waitlist|only|last/i.test(r.model!.nextStep));
  // 20:00 UTC on Sunday is already Monday in Kolkata.
  assert.equal(weekdayAfter("2026-11-08T20:00:00Z", 3), "Thursday");
  assert.equal(weekdayAfter("2026-11-08T10:00:00Z", 3), "Wednesday");
});

// ── The header ───────────────────────────────────────────────────────────────

test("the header says only what she answered, in her band", () => {
  assert.deepEqual(metaLine(FACTS, CALL.when), ["36–40", "Pune", "Hypothyroidism, more than 3 years", "Call: 9 Nov 2026"]);
});

test("each header fact is left out when she did not give it", () => {
  assert.deepEqual(metaLine({}, CALL.when), ["Call: 9 Nov 2026"]);
  assert.deepEqual(metaLine({ stuck: "1 to 3 years" }, CALL.when), ["Weight stuck for 1–3 years", "Call: 9 Nov 2026"]);
  assert.deepEqual(metaLine({ diagnosis: "Yes, Hashimoto's" }, "not a date"), ["Hashimoto's"]);
});

test("ages print as the band she picked", () => {
  assert.equal(ageLabel("36 to 40"), "36–40");
  assert.equal(ageLabel("41-50"), "41–50");
  assert.equal(ageLabel("Under 30"), "Under 30");
  assert.equal(ageLabel("Over 50"), "Over 50");
  assert.equal(ageLabel("38"), "38");
  assert.equal(ageLabel("yes"), "");
  assert.equal(ageLabel("3"), "");
});

test("'Somewhere else' is not a city", () => {
  assert.equal(cityLabel("Somewhere else"), "");
  assert.equal(cityLabel("Delhi NCR"), "Delhi NCR");
  assert.equal(cityLabel("pune"), "Pune");
  assert.equal(cityLabel("411001"), "");
});

test("a condition prints only when a doctor named it", () => {
  assert.equal(conditionLabel("Yes, hypothyroidism"), "Hypothyroidism");
  assert.equal(conditionLabel("Yes, hypothyroid but not on medication"), "Hypothyroidism");
  assert.equal(conditionLabel("Yes, Hashimoto's"), "Hashimoto's");
  for (const raw of ["I suspect it, not diagnosed yet", "Not tested, but I think so", "No", "Yes", ""]) {
    assert.equal(conditionLabel(raw), "", raw);
  }
});

test("how long she has been stuck needs a number and a unit", () => {
  assert.equal(stuckLabel("1–3 years"), "1–3 years");
  assert.equal(stuckLabel("1 to 3 years"), "1–3 years");
  assert.equal(stuckLabel("More than 3 years"), "more than 3 years");
  assert.equal(stuckLabel("6 months to 1 year"), "6 months to 1 year");
  assert.equal(stuckLabel("Since my pregnancy"), "");
});

test("the call date is the IST date", () => {
  assert.equal(callDateLabel("2026-11-09T20:00:00Z"), "10 Nov 2026");
  assert.equal(callDateLabel("2026-09-09T05:00:00Z"), "9 Sep 2026");
  assert.equal(callDateLabel("nope"), "");
});

test("he is told which header facts were not found", () => {
  assert.deepEqual(missingFacts({}), ["age", "city", "diagnosis", "how long she has been stuck"]);
  assert.deepEqual(missingFacts(FACTS), []);
});

test("an all-lowercase name is tidied; a typed name is otherwise left alone", () => {
  assert.equal(build(SAMPLE, FACTS, { ...CALL, name: "meera kulkarni" }).model!.name, "Meera Kulkarni");
  assert.equal(build(SAMPLE, FACTS, { ...CALL, name: "Meera K." }).model!.name, "Meera K.");
  assert.equal(build(SAMPLE, FACTS, { ...CALL, name: "D'Souza" }).model!.name, "D'Souza");
});

// ── Reading her answers ──────────────────────────────────────────────────────

const SHEET = [
  ["Timestamp", "Lead ID", "Name", "Phone", "Email", "Age", "Thyroid Condition", "City", "Diagnosis", "Struggle Duration", "Phone"],
  ["2026-11-01", "dq_1", "Meera", "9876543210", "m@example.com", "36 to 40", "Yes, hypothyroid", "Pune", "", "1 to 3 years", ""],
  ["2026-11-02", "dq_2", "Other", "9123456789", "", "41 to 50", "", "Mumbai", "", "", ""],
  ["2026-11-03", "cal_1", "Meera K.", "", "m@example.com", "", "", "", "Yes, Hashimoto's", "", "+91 98765-43210"],
];

test("her facts merge across every row she is on, newest non-empty value winning", () => {
  const f = leadFactsFromSheet(SHEET, "919876543210");
  assert.deepEqual(f, {
    name: "Meera K.", email: "m@example.com", age: "36 to 40", city: "Pune",
    diagnosis: "Yes, Hashimoto's", stuck: "1 to 3 years",
  });
});

test("another woman's row never leaks into hers", () => {
  const f = leadFactsFromSheet(SHEET, "9876543210");
  assert.notEqual(f.city, "Mumbai");
  assert.notEqual(f.age, "41 to 50");
  assert.deepEqual(leadFactsFromSheet(SHEET, "9000000000"), { name: "", email: "", age: "", city: "", diagnosis: "", stuck: "" });
});

test("booking answers fill only what the quiz left blank", () => {
  const answers = {
    whatIsYourAge: "38", city: { value: "Nagpur" }, thyroidReport: "Yes, from the last 6 months",
    thyroidStatus: "Yes, diagnosed hypothyroid", howLong: "1-2 years", email: "x@example.com",
  };
  const fromBooking = factsFromAnswers(answers);
  assert.deepEqual(fromBooking, { age: "38", city: "Nagpur", diagnosis: "Yes, diagnosed hypothyroid", stuck: "1-2 years" });
  const merged = mergeFacts({ city: "Pune", age: "" }, fromBooking);
  assert.equal(merged.city, "Pune");
  assert.equal(merged.age, "38");
  // A quiz answer that names nothing does not hide the booking's real one.
  assert.equal(mergeFacts({ city: "Somewhere else" }, fromBooking).city, "Nagpur");
});

// ── Around the PDF ───────────────────────────────────────────────────────────

test("one file per call: the name and the dedupe key carry the call's IST date", () => {
  assert.equal(summaryFileName("Meera K.", "2026-11-09T20:00:00Z"), "Consultation Summary · Meera K. · 2026-11-10.pdf");
  assert.equal(summaryDedupeKey("+91 98765 43210", "2026-11-09T09:30:00Z"), "summary:9876543210:2026-11-09");
  assert.ok(!summaryFileName("Meera/K\nX", CALL.when).includes("/"));
});

test("the caption greets her by first name, plainly", () => {
  const c = summaryCaption("meera kulkarni");
  assert.ok(c.startsWith("Meera, here is your consultation summary"), c);
  assert.ok(!c.includes("!"));
  assert.ok(summaryCaption("").startsWith("Here is"));
});

test("her reply window runs 24 hours from HER last message, as in the inbox", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const at = (h: number) => new Date(now - h * 3600_000).toISOString();
  const msgs = [
    { phone: "919876543210", direction: "in" as const, ts: at(30) },
    { phone: "919876543210", direction: "in" as const, ts: at(2) },
    { phone: "919876543210", direction: "out" as const, ts: at(1) },
    { phone: "919123456789", direction: "in" as const, ts: at(0.5) },
  ];
  assert.deepEqual(replyWindow(msgs, "9876543210", now), { open: true, minutesLeft: 22 * 60 });
  // Our own messages never open it.
  assert.deepEqual(replyWindow(msgs.filter((m) => m.direction === "out"), "9876543210", now), { open: false, minutesLeft: 0 });
  assert.deepEqual(replyWindow([{ phone: "919876543210", direction: "in", ts: at(25) }], "9876543210", now), { open: false, minutesLeft: 0 });
  assert.deepEqual(replyWindow([], "9876543210", now), { open: false, minutesLeft: 0 });
});

// ── Nothing invented ─────────────────────────────────────────────────────────

test("a sparse Doc prints no number she did not give", () => {
  const r = build({ blockers: { items: ["Breakfast is tea and biscuits"] } }, {}, CALL);
  const m = r.model!;
  assert.equal(m.quote, "");
  assert.deepEqual(m.symptoms, []);
  assert.deepEqual(m.spent, []);
  assert.equal(m.total, "");
  assert.equal(m.nextYear, "");
  assert.equal(m.price, null);
  assert.deepEqual(m.meta, ["Call: 9 Nov 2026"]);
  // The only digits left are the call date and the proof card the website publishes.
  const text = JSON.stringify({ ...m, deliverables: [], proof: null });
  assert.ok(!text.includes("₹"), text);
  assert.ok(r.warnings.length >= 5);
  assert.ok(r.warnings.every((w) => !w.includes("!")));
});

test("the objection never reaches the model", () => {
  const text = JSON.stringify(build().model);
  assert.ok(!text.includes("husband") && !text.includes("Really the price"));
});
