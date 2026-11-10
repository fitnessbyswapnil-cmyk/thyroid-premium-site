/**
 * lib/summary.ts — PURE. His notes Doc, what she told the quiz and the
 * booking form, and the call itself, turned into everything her two-page
 * consultation summary prints. lib/summary-html.ts lays it out; the route
 * (app/api/admin/summary) does the reading and the saving.
 *
 * THE ONE RULE: NOTHING IS INVENTED
 * Every number and every word about her on the PDF comes from his notes or
 * from her own answers. When a source is empty the element is left out, or
 * the PDF says plainly what is still pending. It never fills the gap with
 * something plausible: a made-up marker on a client document is a lie about
 * her body, and a made-up total is a lie about her money.
 *
 * So the rules below are strict on purpose:
 *  - A marker value is printed only from his symptoms table, which he fills
 *    from her report. No table, no values: the page says her report is still
 *    being read.
 *  - The total spend adds only amounts that read as numbers. The total time
 *    appears only when EVERY row's length reads as months or years (rows he
 *    marked "ongoing" aside); one unreadable row and the bar shows money only,
 *    because a total that skipped a row would be short without saying so.
 *  - "Another twelve months" prints the yearly cost only when both totals are
 *    known, and her next birthday only when she gave an exact age. The quiz
 *    asks for a band ("36 to 40"), and a band is not an age.
 *  - The proof card is one the website already publishes (lib/summary-proof).
 *
 * THE PDF IS TWO PAGES, ALWAYS
 * Page 1 is the diagnosis, page 2 the decision. Everything he can make long is
 * clamped here (six symptom rows, six blockers, five cost rows, a 220-character
 * quote) and the page itself zooms down the last few per cent if a long line
 * still wraps (see the fit script in lib/summary-html.ts). Anything clamped is
 * reported back as a warning, so he knows what she will not see.
 *
 * Column positions come from SYMPTOM_COLUMNS and SPENT_COLUMNS by NAME. A
 * hardcoded index into a list once dropped the last quiz answer when a
 * question was added; these tables will grow a column one day too.
 */
import { SPENT_COLUMNS, SYMPTOM_COLUMNS, clientName, digits10, istDate, type NotesContent, type NotesPart } from "./drive.ts";
import { pickProof, type ProofCard } from "./summary-proof.ts";

// ── Limits ───────────────────────────────────────────────────────────────────

export const MAX_SYMPTOMS = 6;
export const MAX_BLOCKERS = 6;
export const MAX_SPENT = 5;
export const QUOTE_MAX = 220;
const BLOCKER_MAX = 120;
const NEXT_STEP_MAX = 200;
const NAME_MAX = 40;

// ── Types ────────────────────────────────────────────────────────────────────

/** What she told the quiz or the booking form, as she answered it. */
export type LeadFacts = {
  name: string;
  email: string;
  /** A band like "36 to 40", or an exact age when the form took free text. */
  age: string;
  city: string;
  /** Her answer to "has a doctor told you that you have a thyroid problem". */
  diagnosis: string;
  /** Her answer to "how long has your weight been stuck". */
  stuck: string;
};

export type SummaryCall = { name: string; phone: string; when: string };

export type SymptomRow = { feel: string; marker: string; value: string; range: string; flag: string };
export type SpentRow = { what: string; time: string; money: string };
export type Deliverable = { mark: string; title: string; body: string; tag: string };

export type SummaryModel = {
  name: string;
  /** The header's grey line, already in order: age, city, condition, call date. */
  meta: string[];
  /** Her words; "" leaves the section out. */
  quote: string;
  /** Empty means her report has not been read yet, and the page says so. */
  symptoms: SymptomRow[];
  blockers: string[];
  /** "all six" / "both" / "just one", and the matching sentence under the list. */
  blockerCount: { heading: string; line: string };
  /** Empty drops the cost table, the total bar and the price comparison. */
  spent: SpentRow[];
  /** "₹60,000 · 1.5 years", "₹60,000", or "" for no bar. */
  total: string;
  /** The data half of "Another twelve months of the same"; "" when neither number is known. */
  nextYear: string;
  proof: ProofCard;
  deliverables: Deliverable[];
  /** Null when he never quoted a price: no price block at all. */
  price: { amount: string; comparison: string } | null;
  nextStep: string;
};

export type SummaryResult = { model: SummaryModel | null; warnings: string[]; missing: string[] };

// ── Small text helpers ───────────────────────────────────────────────────────

const squash = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Cut at a word boundary and say so with an ellipsis, never mid-word. */
export function clampText(s: string, max: number): string {
  const t = squash(s);
  if (t.length <= max) return t;
  let cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  if (space > max * 0.6) cut = cut.slice(0, space);
  return cut.replace(/[\s,;:.\-–—]+$/, "") + "…";
}

/** "meera kulkarni" and "MEERA KULKARNI" read as typos on a document; mixed case is left exactly as typed. */
function tidyCase(s: string): string {
  if (!/[a-z]/i.test(s)) return s;
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'’(])([a-z])/g, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}

export function displayName(name: string): string {
  return tidyCase(squash(name).replace(/[\r\n]+/g, " ").slice(0, NAME_MAX).trim());
}

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];
const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** Indian grouping, the way she writes it: 60,000 and 1,50,000. */
export const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The calendar date in IST, the coach's clock. Built from numeric parts rather
 * than a formatted month name, because ICU versions disagree about "Sep" and
 * "Sept" and the worker's ICU is not the laptop's.
 */
function istParts(iso: string): { y: number; m: number; d: number } | null {
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(t);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const y = get("year"), m = get("month"), d = get("day");
  return y && m && d ? { y, m, d } : null;
}

/** "9 Nov 2026", or "" when the time does not parse. */
export function callDateLabel(iso: string): string {
  const p = istParts(iso);
  return p ? `${p.d} ${MONTHS[p.m - 1]} ${p.y}` : "";
}

/** The weekday `days` after the call, in IST. */
export function weekdayAfter(iso: string, days: number): string {
  const p = istParts(iso);
  if (!p) return "";
  return WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d + days)).getUTCDay()];
}

// ── Her facts: the header line ───────────────────────────────────────────────

/** "36 to 40" → "36–40". A band stays a band; only a bare number counts as exact. */
export function ageLabel(raw: string): string {
  const s = squash(raw).toLowerCase();
  let m = s.match(/^(\d{2})(?:\s*(?:years?|yrs?)(?:\s*old)?)?$/);
  if (m) return Number(m[1]) >= 16 && Number(m[1]) <= 90 ? m[1] : "";
  m = s.match(/^(\d{2})\s*(?:-|–|—|to)\s*(\d{2})(?:\s*(?:years?|yrs?))?$/);
  if (m) return `${m[1]}–${m[2]}`;
  m = s.match(/^(?:under|below|less than)\s*(\d{2})$/);
  if (m) return `Under ${m[1]}`;
  m = s.match(/^(?:over|above|more than)\s*(\d{2})$/);
  if (m) return `Over ${m[1]}`;
  m = s.match(/^(\d{2})\s*\+$/);
  if (m) return `${m[1]}+`;
  return "";
}

/** Her age as a number, only when she gave one. The band "36 to 40" is null. */
export function exactAge(raw: string): number | null {
  const label = ageLabel(raw);
  return /^\d{2}$/.test(label) ? Number(label) : null;
}

/** "Somewhere else" is an answer, not a city. */
export function cityLabel(raw: string): string {
  const s = squash(raw);
  if (!s || s.length > 40 || /[\d@]/.test(s)) return "";
  if (/^(somewhere else|other|others|none|n\/?a|-+|\.)$/i.test(s) || /somewhere else/i.test(s)) return "";
  return tidyCase(s);
}

/**
 * The condition, only when she said a doctor named it. "I suspect it" and
 * "Not tested, but I think so" name nothing, so nothing is printed: the PDF
 * would otherwise be diagnosing her.
 */
export function conditionLabel(raw: string): string {
  const s = squash(raw).toLowerCase();
  if (!s) return "";
  if (/suspect|think so|not sure|unsure|maybe|not (yet )?(diagnosed|tested)|undiagnosed/.test(s)) return "";
  if (/hashimoto/.test(s)) return "Hashimoto's";
  if (/hyperthyroid/.test(s)) return "Hyperthyroidism";
  if (/hypothyroid|\bhypo\b/.test(s)) return "Hypothyroidism";
  return "";
}

/** "1 to 3 years" → "1–3 years"; anything without a number and a unit is left out. */
export function stuckLabel(raw: string): string {
  let s = squash(raw);
  if (!/\d/.test(s) || !/(month|year|yr|\bmo\b)/i.test(s)) return "";
  s = s.replace(/(\d)\s*(?:-|–|—|to)\s*(\d)/g, "$1–$2");
  // Follows a comma in the header ("Hypothyroidism, more than 3 years").
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

export function metaLine(facts: Partial<LeadFacts>, when: string): string[] {
  const out: string[] = [];
  const age = ageLabel(facts.age ?? "");
  if (age) out.push(age);
  const city = cityLabel(facts.city ?? "");
  if (city) out.push(city);
  const condition = conditionLabel(facts.diagnosis ?? "");
  const stuck = stuckLabel(facts.stuck ?? "");
  if (condition && stuck) out.push(`${condition}, ${stuck}`);
  else if (condition) out.push(condition);
  else if (stuck) out.push(`Weight stuck for ${stuck}`);
  const date = callDateLabel(when);
  if (date) out.push(`Call: ${date}`);
  return out;
}

// ── Reading her facts out of the Leads sheet and the booking ─────────────────

/**
 * Her facts from the Leads sheet, every row she appears on, newest non-empty
 * value winning per field — the rule /api/admin/lead settled on, because
 * three writers touch the sheet and the last one (the booking) carries none of
 * her quiz answers. Columns are found by header NAME, every column of that
 * name, since the sheet has duplicated headers from older layouts.
 */
export function leadFactsFromSheet(values: unknown[][], phone: string): LeadFacts {
  const facts: LeadFacts = { name: "", email: "", age: "", city: "", diagnosis: "", stuck: "" };
  const want = digits10(phone);
  if (want.length !== 10 || !values.length) return facts;
  const header = (values[0] ?? []).map((h) => squash(h).toLowerCase());
  const cols = (...titles: string[]) =>
    titles.flatMap((t) => header.flatMap((h, i) => (h === t.toLowerCase() ? [i] : [])));
  const phoneCols = cols("Phone");
  if (!phoneCols.length) return facts;
  const fields: [keyof LeadFacts, number[]][] = [
    ["name", cols("Name")],
    ["email", cols("Email")],
    ["age", cols("Age")],
    ["city", cols("City")],
    // Both carry the same quiz answer; "Diagnosis" is the newer column.
    ["diagnosis", [...cols("Thyroid Condition"), ...cols("Diagnosis")]],
    ["stuck", cols("Struggle Duration")],
  ];
  for (let r = 1; r < values.length; r++) {
    const row = values[r] ?? [];
    if (!phoneCols.some((c) => digits10(String(row[c] ?? "")) === want)) continue;
    for (const [key, idxs] of fields) {
      for (const c of idxs) {
        const v = squash(row[c]);
        if (v) facts[key] = v;
      }
    }
  }
  return facts;
}

const answerText = (v: unknown): string => {
  if (typeof v === "string") return squash(v);
  if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) return answerText((v as { value?: unknown }).value);
  return "";
};

/**
 * The same facts from her Cal.com booking answers. Field slugs have been
 * edited over time, so keys are matched loosely, the way lib/lead-score does,
 * and an answer counts only if it reads as that fact: a "thyroid report"
 * field that also contains the word thyroid must not stand in for her
 * diagnosis.
 */
export function factsFromAnswers(answers: Record<string, unknown> | null | undefined): Partial<LeadFacts> {
  const entries = Object.entries(answers ?? {}).map(
    ([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ""), answerText(v)] as const,
  );
  const pick = (keyOk: (k: string) => boolean, reads: (v: string) => string) =>
    entries.find(([k, v]) => v && keyOk(k) && reads(v))?.[1] ?? "";
  const out: Partial<LeadFacts> = {
    age: pick((k) => k === "age" || k.endsWith("yourage") || k.includes("agegroup") || k.includes("ageband"), ageLabel),
    city: pick((k) => k.includes("city"), cityLabel),
    diagnosis: pick((k) => k.includes("diagnos") || k.includes("thyroid"), conditionLabel),
    stuck: pick((k) => k.includes("howlong") || k.includes("stuck") || k.includes("duration"), stuckLabel),
  };
  for (const k of Object.keys(out) as (keyof LeadFacts)[]) if (!out[k]) delete out[k];
  return out;
}

const READS: Partial<Record<keyof LeadFacts, (v: string) => string>> = {
  age: ageLabel, city: cityLabel, diagnosis: conditionLabel, stuck: stuckLabel,
};

/**
 * Fill only the gaps in `primary`; never overwrite what she already told the
 * quiz. A value counts as given only if it reads as that fact, so the quiz's
 * "Somewhere else" does not hide the city she typed into the booking form.
 */
export function mergeFacts(primary: Partial<LeadFacts>, fallback: Partial<LeadFacts>): Partial<LeadFacts> {
  const out: Partial<LeadFacts> = { ...fallback };
  for (const [k, v] of Object.entries(primary) as [keyof LeadFacts, string][]) {
    if ((READS[k] ?? squash)(v ?? "")) out[k] = v;
  }
  return out;
}

/** Which of the header facts are still unknown, by the label he would use. */
export function missingFacts(facts: Partial<LeadFacts>): string[] {
  return [
    !ageLabel(facts.age ?? "") && "age",
    !cityLabel(facts.city ?? "") && "city",
    !conditionLabel(facts.diagnosis ?? "") && "diagnosis",
    !stuckLabel(facts.stuck ?? "") && "how long she has been stuck",
  ].filter((x): x is string => Boolean(x));
}

// ── Money and time ───────────────────────────────────────────────────────────

/**
 * "₹18,000", "18000", "18k", "Rs. 18,000/-", "1.5 lakh". Null for anything
 * else: a guess at "around 15-20" would put a number in the total she never
 * said.
 */
export function parseMoney(raw: string): number | null {
  let s = squash(raw).toLowerCase();
  if (!s) return null;
  s = s.replace(/^(approx\.?|approximately|about|around|roughly|~)\s*/, "");
  s = s.replace(/^(₹|rs\.?|inr)\s*/, "").replace(/\s*(\/-|rs\.?|rupees|inr)$/, "");
  s = s.replace(/,/g, "").replace(/\s+/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)(k|thousand|l|lakh|lakhs|lac|lacs)?$/);
  if (!m) return null;
  const unit = m[2] ?? "";
  const n = Number(m[1]) * (unit === "k" || unit === "thousand" ? 1000 : unit.startsWith("l") ? 100000 : 1);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
// The lookbehind keeps "a" and "an" from matching the last letter of a word.
const NUM = "(?<![a-z0-9.])(\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const UNIT = "(years?|yrs?|y|months?|mos?|mths?|m)(?![a-z])";
const toNum = (n: string) => (/^\d/.test(n) ? Number(n) : WORD_NUMBERS[n] ?? NaN);
const toMonths = (n: number, unit: string) => (unit.startsWith("y") ? n * 12 : n);

/**
 * How long one thing lasted, in months. "ongoing" for something she is still
 * doing (it has no length yet, so it neither adds to nor blocks the total).
 * Null for anything that is not months or years — weeks included, because
 * the total is stated in months and years and a conversion is a guess.
 */
export function parseDuration(raw: string): number | "ongoing" | null {
  let s = squash(raw).toLowerCase().replace(/\([^)]*\)/g, " ");
  if (!s.trim()) return null;
  if (/\b(ongoing|still|currently|continuing)\b/.test(s)) return "ongoing";
  s = s.replace(/(^|\s)(for|about|around|approx\.?|approximately|roughly|nearly|almost|over|more than|~)(?=\s|\d|$)/g, " ");
  let months = 0;
  let found = false;
  // "two and a half years", "1 and a half years"
  s = s.replace(new RegExp(`${NUM}\\s+and\\s+a\\s+half\\s+${UNIT}`, "g"), (_, n: string, u: string) => {
    months += toMonths(toNum(n) + 0.5, u); found = true; return " ";
  });
  // "a year and a half"
  s = s.replace(new RegExp(`${NUM}\\s*${UNIT}\\s+and\\s+a\\s+half`, "g"), (_, n: string, u: string) => {
    months += toMonths(toNum(n) + 0.5, u); found = true; return " ";
  });
  s = s.replace(new RegExp(`${NUM}\\s*${UNIT}`, "g"), (_, n: string, u: string) => {
    months += toMonths(toNum(n), u); found = true; return " ";
  });
  if (!found || !Number.isFinite(months) || months <= 0) return null;
  // Whatever is left must be glue ("1 year, 6 months", "1 yr + 3 mo"), not words.
  return /^[\s,&+]*(and[\s,&+]*)*$/.test(s) ? months : null;
}

/** "18 months" is said as "1.5 years"; 19 stays "19 months". Never rounded. */
export function timeLabel(months: number): string {
  if (months >= 12 && months % 6 === 0) {
    const years = months / 12;
    return `${years} ${years === 1 ? "year" : "years"}`;
  }
  return `${months} ${months === 1 ? "month" : "months"}`;
}

/** The same length as a phrase: "the last two years", "the last year and a half". */
export function timePhrase(months: number): string {
  const years = Math.floor(months / 12);
  if (months % 12 === 0) return years === 1 ? "the last year" : `the last ${numberWord(years)} years`;
  if (months > 12 && months % 12 === 6) {
    return years === 1 ? "the last year and a half" : `the last ${numberWord(years)} and a half years`;
  }
  if (Number.isInteger(months)) return months === 1 ? "the last month" : `the last ${numberWord(months)} months`;
  return `the last ${months} months`;
}

const FRACTIONS = ["", "", "half", "one-third", "one-fourth", "one-fifth", "one-sixth", "one-seventh", "one-eighth", "one-ninth", "one-tenth"];

/**
 * "one-fourth" for a programme that costs a quarter of what she already
 * spent: the nearest simple fraction, the way a person would say it. Only
 * from 1.5x up — below that the programme costs about what she spent, and a
 * fraction would flatter it.
 */
export function fractionWord(spent: number, price: number): string {
  if (!(spent > 0) || !(price > 0)) return "";
  const ratio = spent / price;
  if (ratio < 1.5) return "";
  const n = Math.round(ratio);
  return FRACTIONS[n] ?? "less than one-tenth";
}

/** The largest amount in what he typed: "3 months for 20000" quotes 20000, not 3. */
export function parsePrice(raw: string): number | null {
  const s = squash(raw).toLowerCase();
  let best: number | null = null;
  for (const m of s.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|l)?(?![a-z])/g)) {
    const n = parseMoney(`${m[1]}${m[2] ?? ""}`);
    if (n !== null && (best === null || n > best)) best = n;
  }
  return best;
}

// ── Blockers to deliverables ─────────────────────────────────────────────────

const START = "(?<![a-z0-9])";
const rx = (stems: string[]) => new RegExp(`${START}(${stems.join("|")})`, "i");

/**
 * The six things she gets, in the owner's own words, and the blocker words
 * that tie each one back to page 1. Text is fixed; only the small gold tag
 * under each one is computed.
 */
export const DELIVERABLES = [
  {
    mark: "1", title: "Thyroid & Lifestyle Consultation", body: "60 minutes. Reports, lifestyle, symptoms → root cause.",
    match: rx(["thyroid", "tsh", "f?t3", "f?t4", "vitamin", "ferritin", "b12", "insulin", "hba1c", "hormon"]),
    pillar: "", fallback: "Root cause",
  },
  {
    mark: "2", title: "Custom Indian Nutrition Plan", body: "Meals you already eat. PDF and app.",
    match: rx(["food", "meal", "protein", "diet", "eat", "carb", "sugar", "digest", "bloat"]),
    pillar: "Pillar 2", fallback: "Pillar 2",
  },
  {
    mark: "3", title: "Low-Impact Training Plan", body: "Home or gym. Demo videos. Joint-friendly.",
    match: rx(["exercis", "train", "gym", "walk", "steps?(?![a-z])", "joint", "knee", "strength"]),
    pillar: "Pillar 3", fallback: "Pillar 3",
  },
  {
    mark: "4", title: "Weekly Check-Ins, Biweekly Reviews", body: "Weight, energy, mood, sleep, training.",
    match: rx(["sleep", "stress", "cortisol", "routine", "consisten"]),
    pillar: "", fallback: "Every two weeks",
  },
  {
    mark: "5", title: "Unlimited WhatsApp Support", body: "Direct access to me. Never stuck.",
    match: null, pillar: "", fallback: "Every week",
  },
  {
    mark: "+", title: "Bonus — Private Client Community", body: "Lifetime access, after the programme ends.",
    match: null, pillar: "", fallback: "Yours to keep",
  },
] as const;

/**
 * Which deliverable each blocker belongs to: the one whose word comes FIRST in
 * the sentence, because that is what the sentence is about. "Eating window is
 * 14 hours; insulin never gets a break" is an eating problem that mentions
 * insulin, and belongs to the nutrition plan, which is how the approved
 * sample reads. -1 when no word matches.
 */
export function deliverableFor(blocker: string): number {
  let best = -1;
  let at = Infinity;
  DELIVERABLES.forEach((d, i) => {
    if (!d.match) return;
    const hit = d.match.exec(blocker);
    if (hit && hit.index < at) {
      at = hit.index;
      best = i;
    }
  });
  return best;
}

/** [1,2,3] → "1–3", [4,6] → "4 & 6", [1,2,3,5] → "1–3 & 5". */
export function numberList(nums: number[]): string {
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) parts.push(`${sorted[i]}–${sorted[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(sorted[k]));
    i = j + 1;
  }
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}`;
}

export function deliverablesFor(blockers: string[]): Deliverable[] {
  const linked: number[][] = DELIVERABLES.map(() => []);
  blockers.forEach((b, i) => {
    const d = deliverableFor(b);
    if (d >= 0) linked[d].push(i + 1);
  });
  return DELIVERABLES.map((d, i) => {
    const nums = linked[i];
    const tag = nums.length
      ? `${nums.length === 1 ? "Blocker" : "Blockers"} ${numberList(nums)}${d.pillar ? ` · ${d.pillar}` : ""}`
      : d.fallback;
    return { mark: d.mark, title: d.title, body: d.body, tag };
  });
}

// ── The sections ─────────────────────────────────────────────────────────────

const part = (notes: Pick<NotesContent, "sections">, key: keyof NotesContent["sections"]): NotesPart =>
  notes.sections[key] ?? { text: "", items: [], rows: [] };

/** A list item he numbered or bulleted himself loses the marker; the PDF numbers them. */
const cleanItem = (s: string) => squash(s).replace(/^(?:\d+\s*[.):-]|[-•*·–—])\s*/, "").trim();

export function blockerCount(n: number): { heading: string; line: string } {
  if (n === 1) return { heading: "just one", line: "You now know it." };
  if (n === 2) return { heading: "both", line: "You now know both." };
  return { heading: `all ${numberWord(n)}`, line: `You now know all ${numberWord(n)}.` };
}

/** "5.8 (0.4-4.0)" → value "5.8", range "(0.4–4.0)". */
export function splitValue(raw: string): { value: string; range: string } {
  const s = squash(raw);
  const m = s.match(/^(.*?)\s*(\([^)]*\))\s*$/);
  const dash = (x: string) => x.replace(/(\d)\s*(?:-|–|—)\s*(\d)/g, "$1–$2");
  if (!m || !m[1]) return { value: s, range: "" };
  return { value: m[1], range: dash(m[2]) };
}

const SYMPTOM = {
  feel: SYMPTOM_COLUMNS.indexOf("What she feels"),
  marker: SYMPTOM_COLUMNS.indexOf("Marker"),
  value: SYMPTOM_COLUMNS.indexOf("Her value (range)"),
  flag: SYMPTOM_COLUMNS.indexOf("Flag"),
};
const SPENT = {
  what: SPENT_COLUMNS.indexOf("What she tried"),
  time: SPENT_COLUMNS.indexOf("How long"),
  money: SPENT_COLUMNS.indexOf("Money (₹)"),
};
const cellAt = (row: string[], i: number) => (i >= 0 ? squash(row[i]) : "");

/**
 * Everything the PDF prints. `model` is null when a required section is
 * empty, and `missing` names it in the Doc's own words, so the dashboard can
 * send him back to exactly that heading.
 */
export function buildSummary(input: {
  notes: Pick<NotesContent, "sections">;
  facts: Partial<LeadFacts>;
  call: SummaryCall;
  now?: number;
}): SummaryResult {
  const { notes, facts, call } = input;
  const now = input.now ?? Date.now();
  const when = Number.isFinite(new Date(call.when).getTime()) ? call.when : new Date(now).toISOString();
  const warnings: string[] = [];

  // Blockers are the spine of both pages; without one there is no summary.
  const allBlockers = part(notes, "blockers").items.map(cleanItem).filter(Boolean);
  if (!allBlockers.length) return { model: null, warnings, missing: ["Blockers"] };
  if (allBlockers.length > MAX_BLOCKERS) {
    warnings.push(`Only the first ${MAX_BLOCKERS} blockers fit, so ${allBlockers.length - MAX_BLOCKERS} were left off. Put the most important first.`);
  }
  const shown = allBlockers.slice(0, MAX_BLOCKERS);
  const longOnes = shown.flatMap((b, i) => (b.length > BLOCKER_MAX ? [i + 1] : []));
  if (longOnes.length === 1) warnings.push(`Blocker ${longOnes[0]} is long, so the PDF cuts it short.`);
  if (longOnes.length > 1) warnings.push(`Blockers ${numberList(longOnes)} are long, so the PDF cuts them short.`);
  const blockers = shown.map((b) => clampText(b, BLOCKER_MAX));

  const name = displayName(call.name) || displayName(facts.name ?? "");

  const meta = metaLine(facts, when);
  const unknown = missingFacts(facts);
  if (unknown.length) warnings.push(`Not in her quiz or booking answers, so not in the header: ${unknown.join(", ")}.`);

  // Her words. He may type the quotation marks himself; the PDF sets its own.
  const words = squash(part(notes, "words").text).replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
  if (!words) warnings.push("“Her words” is empty, so page 1 has no quote from her.");
  else if (words.length > QUOTE_MAX) warnings.push(`“Her words” is over ${QUOTE_MAX} characters, so the quote is cut short.`);
  const quote = clampText(words, QUOTE_MAX);

  // Symptoms, only from his table.
  const symptomRows = part(notes, "symptoms").rows
    .map((r) => {
      const { value, range } = splitValue(cellAt(r, SYMPTOM.value));
      return {
        feel: clampText(cellAt(r, SYMPTOM.feel), 60),
        marker: clampText(cellAt(r, SYMPTOM.marker), 40),
        value: clampText(value, 22),
        range: clampText(range, 24),
        flag: clampText(cellAt(r, SYMPTOM.flag).toLowerCase(), 18),
      };
    })
    .filter((r) => r.feel || r.marker || r.value);
  if (!symptomRows.length) warnings.push("“Symptoms matched to her report” is empty, so page 1 says her report is still being read.");
  if (symptomRows.length > MAX_SYMPTOMS) {
    warnings.push(`Only the first ${MAX_SYMPTOMS} symptom rows fit, so ${symptomRows.length - MAX_SYMPTOMS} were left off.`);
  }
  const symptoms = symptomRows.slice(0, MAX_SYMPTOMS);

  // What she already spent.
  const spentAll = part(notes, "spent").rows
    .map((r) => ({ what: cellAt(r, SPENT.what), time: cellAt(r, SPENT.time), money: cellAt(r, SPENT.money) }))
    .filter((r) => r.what || r.time || r.money);
  if (!spentAll.length) warnings.push("“Already spent” is empty, so page 2 has no cost table and no total.");
  if (spentAll.length > MAX_SPENT) {
    warnings.push(`Only the first ${MAX_SPENT} rows of “Already spent” fit, so ${spentAll.length - MAX_SPENT} were left off and the total counts only the ${MAX_SPENT} shown.`);
  }
  const spentShown = spentAll.slice(0, MAX_SPENT);
  let money = 0;
  let anyMoney = false;
  let months = 0;
  let timeKnown = spentShown.length > 0;
  for (const r of spentShown) {
    const amount = parseMoney(r.money);
    if (amount !== null) {
      money += amount;
      anyMoney = true;
    } else if (r.money) {
      warnings.push(`“${clampText(r.what || "A row", 40)}”: “${clampText(r.money, 20)}” is not an amount, so it is not in the total.`);
    }
    const d = parseDuration(r.time);
    if (d === "ongoing") continue;
    if (d === null) {
      if (timeKnown) {
        const what = `“${clampText(r.what || "A row", 40)}”`;
        warnings.push(r.time
          ? `${what}: “${clampText(r.time, 20)}” is not a length in months or years, so the total shows money only.`
          : `${what} has no length, so the total shows money only.`);
      }
      timeKnown = false;
    } else {
      months += d;
    }
  }
  if (months <= 0) timeKnown = false;
  const spentMoney = anyMoney ? money : null;
  const spentMonths = timeKnown ? months : null;
  const spent: SpentRow[] = spentShown.map((r) => {
    const amount = parseMoney(r.money);
    return {
      what: clampText(r.what, 70),
      time: clampText(r.time, 22),
      money: amount !== null ? rupees(amount) : clampText(r.money, 18),
    };
  });
  const total = [spentMoney !== null ? rupees(spentMoney) : "", spentMonths !== null ? timeLabel(spentMonths) : ""]
    .filter(Boolean)
    .join(" · ");

  // Another twelve months: each half only when its number is real.
  const perYear = spentMoney !== null && spentMonths !== null
    ? Math.round(spentMoney / (spentMonths / 12) / 1000) * 1000
    : 0;
  const age = exactAge(facts.age ?? "");
  const nextYear =
    perYear > 0 && age !== null ? `Roughly ${rupees(perYear)} more spent the same way, and you will be ${age + 1} instead of ${age}.`
    : perYear > 0 ? `Roughly ${rupees(perYear)} more spent the same way.`
    : age !== null ? `You will be ${age + 1} instead of ${age}.`
    : "";

  // Proof: a card the website already publishes, and only that.
  const proofPick = pickProof(part(notes, "proof").text);
  if (proofPick.ignored) {
    warnings.push(`“Proof to show” says “${clampText(proofPick.asked, 30)}”, who is not on the website's results, so the PDF shows ${proofPick.card.name}.`);
  }

  // Price, only when he said one.
  const priceText = squash(part(notes, "price").text);
  const priceNum = parsePrice(priceText);
  let price: SummaryModel["price"] = null;
  if (priceNum === null) {
    warnings.push(priceText ? "“Price quoted” has no number in it, so page 2 shows no price." : "“Price quoted” is empty, so page 2 shows no price.");
  } else {
    if (priceNum < 1000) warnings.push(`“Price quoted” reads as ${rupees(priceNum)}. Write it in full, like 20000.`);
    const fraction = spentMoney !== null ? fractionWord(spentMoney, priceNum) : "";
    const comparison = fraction
      ? `${fraction} of what ${spentMonths !== null ? `${timePhrase(spentMonths)} cost` : "you have already spent"}`
      : "";
    price = { amount: rupees(priceNum), comparison };
  }

  // Next step: his words, or a plain default with no scarcity claim in it.
  const typedStep = squash(part(notes, "nextStep").text);
  const nextStep = typedStep
    ? clampText(typedStep, NEXT_STEP_MAX)
    : `Reply START on WhatsApp by ${weekdayAfter(when, 3)}, 8pm.`;
  if (!typedStep) warnings.push(`“Next step” is empty, so the PDF says: ${nextStep}`);
  else if (typedStep.length > NEXT_STEP_MAX) warnings.push("“Next step” is long, so the PDF cuts it short.");

  return {
    model: {
      name,
      meta,
      quote,
      symptoms,
      blockers,
      blockerCount: blockerCount(blockers.length),
      spent,
      total,
      nextYear,
      proof: proofPick.card,
      deliverables: deliverablesFor(blockers),
      price,
      nextStep,
    },
    warnings,
    missing: [],
  };
}

// ── What the route needs around it ───────────────────────────────────────────

/** "Consultation Summary · Meera K. · 2026-11-09.pdf" — the call's IST date. */
export function summaryFileName(name: string, when: string): string {
  return `Consultation Summary · ${clientName(name)} · ${istDate(when)}.pdf`;
}

/** One summary per call: regenerating it replaces the file instead of adding a second. */
export function summaryDedupeKey(phone: string, when: string): string {
  return `summary:${digits10(phone)}:${istDate(when)}`;
}

/** The words that go with the PDF on WhatsApp, or that he pastes when her window is shut. */
export function summaryCaption(name: string): string {
  const first = displayName(name).split(" ")[0] ?? "";
  return `${first ? `${first}, here` : "Here"} is your consultation summary from our call: what we found, and your next step.`;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Her 24-hour reply window, computed exactly as /api/admin/messages computes
 * it for the inbox: from HER last inbound message. Outside it WhatsApp takes
 * nothing from the business number but an approved template, so a document
 * cannot be sent at all.
 */
export function replyWindow(
  messages: { phone: string; direction: "in" | "out"; ts: string }[],
  phone: string,
  now: number,
): { open: boolean; minutesLeft: number } {
  const want = digits10(phone);
  let last = 0;
  for (const m of messages) {
    if (m.direction !== "in" || digits10(m.phone) !== want) continue;
    const t = new Date(m.ts).getTime();
    if (Number.isFinite(t) && t > last) last = t;
  }
  const leftMs = last ? Math.max(0, last + WINDOW_MS - now) : 0;
  const minutesLeft = Math.round(leftMs / 60000);
  return { open: minutesLeft > 0, minutesLeft };
}
