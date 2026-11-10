/**
 * lib/precall.ts — PURE. Her quiz answers and her blood report markers, turned
 * into everything her pre-call PDF prints: "Why your weight isn't moving: what
 * your answers and your report show". lib/precall-html.ts lays it out; the
 * route (app/api/admin/precall) does the reading, the printing, the saving and
 * the sending, exactly as the consultation summary's route does.
 *
 * THE ONE RULE: NOTHING IS INVENTED (as in lib/summary.ts)
 *  - A marker value reaches the PDF from one of two places only: a MarkerRow he
 *    typed (or confirmed, after a reading of her report pre-filled it) on the
 *    card, or the Marker / Her value (range) / Flag columns of the table in her notes
 *    Doc. A row with no value prints nothing; a marker she has no row for is
 *    never mentioned as hers.
 *  - Her answers are printed as she gave them, under the question's gist. An
 *    answer that is missing, or does not read as the thing it should be, is
 *    left out. Nothing is guessed from a neighbouring column.
 *  - Every sentence about a marker is fixed, reviewed library text
 *    (lib/precall-markers.ts) that says what the marker is in general terms,
 *    never what she has. The "on our call" list names the markers each point
 *    rests on, so the reader can see what it is built from.
 *
 * WHERE THE MARKERS COME FROM, THIS FILE DOES NOT CARE
 * The composer takes MarkerRow[] from anywhere: typed rows first, her notes
 * Doc otherwise (pickMarkers). Claude reading her report (a Claude Code
 * routine, whose <ReadReportWithClaude> component mounts in the slot on the
 * card, app/admin/PrecallTools) plugs in BEFORE this file, not inside it: it
 * pre-fills the editable rows through mergeReadRows, he checks them against
 * the report, and they arrive here as typed rows. So a value read off the
 * report never reaches a PDF he did not look at, and nothing it reads ever
 * writes a sentence: every sentence is the library's.
 *
 * ONE PAGE PREFERRED, TWO AT MOST
 * The page is sized in millimetres, as the summary is, and splitRows decides
 * how many marker rows page 1 holds from measured heights. Past MAX_MARKERS
 * the rest are left off with a warning, which is what keeps it to two pages.
 *
 * Column positions come from SYMPTOM_COLUMNS by NAME, never a hardcoded index.
 */
import { SYMPTOM_COLUMNS, clientName, digits10, istDate, type NotesContent } from "./drive.ts";
import { ageLabel, callDateLabel, cityLabel, clampText, displayName, splitValue, stuckLabel } from "./summary.ts";
import { citeName, libraryEntry, libraryRank, normalizeMarkerName, type MarkerGroup } from "./precall-markers.ts";

// ── Types ────────────────────────────────────────────────────────────────────

/** One marker as he typed it, as her notes Doc holds it, or as a reading of her report pre-filled it. */
export type MarkerRow = { marker: string; value: string; range?: string; flag?: string };

/** Where the rows on a PDF came from: the card's form (typed, or pre-filled and then checked), or her notes Doc. */
export type MarkerSource = "typed" | "notes";

/** Her answers, as the Leads sheet holds them: one string per column, "" when unanswered. */
export type QuizFacts = {
  name: string;
  age: string;
  city: string;
  diagnosis: string;
  medication: string;
  stuck: string;
  challenge: string;
  struggles: string;
  tried: string;
  goal: string;
};

export type FactRow = { label: string; value: string };

export type ReportRow = {
  marker: string;
  value: string;
  range: string;
  flag: string;
  /** The library line, on the last of her rows it explains. "" for a marker the library does not know. */
  note: string;
  group: MarkerGroup | "";
  /** How the "on our call" list names this row (lib/precall-markers citeName). */
  cite: string;
};

export type PrecallCall = { name: string; phone: string; when: string };

export type PrecallModel = {
  name: string;
  /** The header's grey line, in order: age band, city, call date. */
  meta: string[];
  facts: FactRow[];
  rows: ReportRow[];
  /** How many of `rows` print on page 1. Equal to rows.length for a one-page PDF. */
  split: number;
  /** "What we will look at on our call": each point names the markers it rests on. */
  agenda: string[];
};

export type PrecallResult = { model: PrecallModel | null; warnings: string[] };

// ── Limits ───────────────────────────────────────────────────────────────────

/** Two pages hold this many rows with room to spare (see splitRows). */
export const MAX_MARKERS = 16;
const MARKER_MAX = 40;
const VALUE_MAX = 28;
const RANGE_MAX = 26;
const FLAG_MAX = 16;
const FACT_MAX = 72;
const LIST_FACT_MAX = 96;

// ── Text ─────────────────────────────────────────────────────────────────────

const squash = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/**
 * The site's copy rule: no em dash, anywhere on this PDF, including in what he
 * typed. Between two numbers it was a range, so it becomes the range dash;
 * anywhere else it becomes a comma.
 */
export function noEmDash(s: string): string {
  return String(s ?? "")
    .replace(/(\d)\s*[—―]+\s*(\d)/g, "$1–$2")
    .replace(/\s*[—―]+\s*/g, ", ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .replace(/,\s*,/g, ",")
    .trim();
}

const clean = (s: unknown) => noEmDash(squash(s));

/** "(0.4 - 4.0)" → "0.4–4.0". The range column carries no brackets. */
export function tidyRange(raw: string): string {
  let s = clean(raw);
  const m = s.match(/^\((.*)\)$/);
  if (m) s = m[1].trim();
  return s.replace(/(\d)\s*(?:-|–|to)\s*(\d)/g, "$1–$2");
}

const FLAG_WORDS: Record<string, string> = {
  h: "high", hi: "high", high: "high", "↑": "high",
  l: "low", lo: "low", low: "low", "↓": "low",
};

/** "H" is how a report prints high; anything else he typed stays as typed, lower-cased. */
export function tidyFlag(raw: string): string {
  const s = clean(raw).toLowerCase();
  return FLAG_WORDS[s] ?? s;
}

/** ["TSH"] → "TSH", ["TSH", "Free T3"] → "TSH and Free T3", three → "A, B and C". */
export function andList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// ── Marker rows ──────────────────────────────────────────────────────────────

/**
 * Rows from anywhere, made safe to print. An all-blank row is one he never
 * filled and is skipped quietly; a half row (a marker with no value, a value
 * with no marker) is left off WITH a warning, because printing it would mean
 * filling the gap. A value typed with its range in brackets, "5.8 (0.4-4.0)",
 * is split the way the summary splits it.
 *
 * `touched` says whether there was anything in the rows at all, which is what
 * decides between "use these" and "fall back to her notes Doc".
 */
export function cleanMarkerRows(
  input: unknown,
  where = "Row",
): { rows: MarkerRow[]; touched: boolean; warnings: string[] } {
  const list = Array.isArray(input) ? input : [];
  const rows: MarkerRow[] = [];
  const warnings: string[] = [];
  let touched = false;
  list.forEach((raw, i) => {
    const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const marker = clean(o.marker);
    let value = clean(o.value);
    let range = tidyRange(String(o.range ?? ""));
    const flag = tidyFlag(String(o.flag ?? ""));
    if (!marker && !value && !range && !flag) return;
    touched = true;
    if (!range) {
      const split = splitValue(value);
      if (split.range) {
        value = split.value;
        range = tidyRange(split.range);
      }
    }
    const label = `${where} ${i + 1}`;
    if (!marker) {
      warnings.push(`${label} has a value but no marker name, so it is left off.`);
      return;
    }
    if (!value) {
      warnings.push(`${label} (${clampText(marker, 30)}) has no value, so it is left off.`);
      return;
    }
    if (value.length > VALUE_MAX) warnings.push(`${label} (${clampText(marker, 30)}): the value is long, so the PDF cuts it short.`);
    rows.push({
      marker: clampText(marker, MARKER_MAX),
      value: clampText(value, VALUE_MAX),
      range: clampText(range, RANGE_MAX),
      flag: clampText(flag, FLAG_MAX),
    });
  });
  return { rows, touched, warnings };
}

const SYMPTOM = {
  marker: SYMPTOM_COLUMNS.indexOf("Marker"),
  value: SYMPTOM_COLUMNS.indexOf("Her value (range)"),
  flag: SYMPTOM_COLUMNS.indexOf("Flag"),
};
const cellAt = (row: string[], i: number) => (i >= 0 ? String(row[i] ?? "") : "");

/**
 * Her notes Doc's table, as MarkerRows: the Marker, Her value (range) and Flag
 * columns, found by name. "What she feels" is his call note, not a marker, and
 * is not read. A row holding only a feeling is blank here and skipped.
 */
export function markerRowsFromNotes(notes: Pick<NotesContent, "sections"> | null | undefined): MarkerRow[] {
  const rows = notes?.sections?.symptoms?.rows ?? [];
  return rows.map((r) => ({ marker: cellAt(r, SYMPTOM.marker), value: cellAt(r, SYMPTOM.value), flag: cellAt(r, SYMPTOM.flag) }));
}

/**
 * Which rows the PDF uses. Typed rows win whenever he typed anything: a row
 * he half-filled is a mistake to fix, not a cue to quietly use the Doc
 * instead. Only an untouched form falls back to her notes Doc.
 */
export function pickMarkers(
  typed: unknown,
  notes: Pick<NotesContent, "sections"> | null | undefined,
): { rows: MarkerRow[]; source: MarkerSource; warnings: string[] } {
  const fromTyped = cleanMarkerRows(typed);
  if (fromTyped.touched) return { rows: fromTyped.rows, source: "typed", warnings: fromTyped.warnings };
  const fromDoc = cleanMarkerRows(markerRowsFromNotes(notes), "Notes Doc row");
  return { rows: fromDoc.rows, source: "notes", warnings: fromDoc.warnings };
}

/**
 * Her rows in library order (thyroid, then vitamins and iron, then sugar, then
 * lipids, then anything the library does not know), each library line printed
 * once, under the LAST of her rows it explains, so "Cholesterol and
 * triglycerides are…" closes the lipid rows rather than splitting them. Stable
 * within an entry, so his order survives where the library has no opinion.
 */
export function reportRows(rows: MarkerRow[]): ReportRow[] {
  const ranked = rows
    .map((r, i) => ({ r, i, entry: libraryEntry(r.marker) }))
    .sort((a, b) => libraryRank(a.entry) - libraryRank(b.entry) || a.i - b.i);
  const lastOf = new Map<string, number>();
  ranked.forEach(({ entry }, at) => {
    if (entry) lastOf.set(entry.key, at);
  });
  return ranked.map(({ r, entry }, at) => ({
    marker: r.marker,
    value: r.value,
    range: r.range ?? "",
    flag: r.flag ?? "",
    note: entry && lastOf.get(entry.key) === at ? entry.line : "",
    group: entry?.group ?? "",
    cite: clampText(citeName(r.marker), 30),
  }));
}

// ── Her answers ──────────────────────────────────────────────────────────────

const EMPTY_FACTS: QuizFacts = {
  name: "", age: "", city: "", diagnosis: "", medication: "",
  stuck: "", challenge: "", struggles: "", tried: "", goal: "",
};

/** Columns by header NAME, every column of that name: the sheet has duplicated headers from older layouts. */
const QUIZ_COLUMNS: Record<keyof QuizFacts, string[]> = {
  name: ["Name"],
  age: ["Age"],
  city: ["City"],
  // Both carry the same quiz answer; "Diagnosis" is the newer column and wins.
  diagnosis: ["Thyroid Condition", "Diagnosis"],
  medication: ["On Medication"],
  stuck: ["Struggle Duration"],
  challenge: ["Biggest Challenge"],
  struggles: ["Weight Struggles"],
  tried: ["Tried Before"],
  goal: ["Goal"],
};

/**
 * Her answers from the Leads sheet: every row she appears on, newest non-empty
 * value winning per field, the rule lib/summary's leadFactsFromSheet and
 * /api/admin/lead settled on. This reads more columns than the summary needs.
 */
export function quizFactsFromSheet(values: unknown[][], phone: string): QuizFacts {
  const facts: QuizFacts = { ...EMPTY_FACTS };
  const want = digits10(phone);
  if (want.length !== 10 || !values?.length) return facts;
  const header = (values[0] ?? []).map((h) => squash(h).toLowerCase());
  const cols = (titles: string[]) =>
    titles.flatMap((t) => header.flatMap((h, i) => (h === t.toLowerCase() ? [i] : [])));
  const phoneCols = cols(["Phone"]);
  if (!phoneCols.length) return facts;
  const fields = (Object.keys(QUIZ_COLUMNS) as (keyof QuizFacts)[]).map((k) => [k, cols(QUIZ_COLUMNS[k])] as const);
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

/** A placeholder is not an answer. */
const answered = (s: string) => {
  const t = clean(s);
  return t && !/^(-+|\.|n\/?a|none|null|undefined)$/i.test(t) ? t : "";
};

/**
 * Her answers as the PDF prints them, under the gist of the question. Two
 * quizzes write some of these columns with different meanings, so each is
 * read by what it holds, never by which quiz it was:
 *  - "Weight Struggles" is her symptom list on the 7-question quiz and a
 *    "Report: … | Work: …" line on the decode quiz. Only a list without "|"
 *    is symptoms.
 *  - "Biggest Challenge" repeats that symptom list on the 7-question quiz and
 *    holds her answer to "What happens when you try to lose weight?" on the
 *    decode quiz. Only an answer that is not the symptom list is a challenge.
 *  - "On Medication" repeats the diagnosis answer on the decode quiz; a
 *    repeat is not printed twice.
 *  - "Tried Before" is what she paid on the decode quiz ("Yes, under
 *    ₹10,000") and what she tried on the other, so its label follows.
 * Age band and city go in the header instead (metaLine).
 */
export function factRows(facts: Partial<QuizFacts>): FactRow[] {
  const f = { ...EMPTY_FACTS, ...facts };
  const out: FactRow[] = [];
  const add = (label: string, value: string, max = FACT_MAX) => {
    const v = answered(value);
    if (v) out.push({ label, value: clampText(v, max) });
  };

  if (stuckLabel(f.stuck)) add("Weight stuck for", f.stuck);
  const struggles = answered(f.struggles);
  const symptoms = struggles && !struggles.includes("|") ? struggles : "";
  const challenge = answered(f.challenge);
  if (challenge && challenge !== symptoms && !challenge.includes("|")) add("Your biggest challenge", challenge);
  add("Thyroid diagnosis", f.diagnosis);
  const medication = answered(f.medication);
  if (medication && medication !== answered(f.diagnosis)) add("Thyroid medication", medication);
  if (symptoms) add("Symptoms you mentioned", symptoms, LIST_FACT_MAX);
  const tried = answered(f.tried);
  if (tried) add(/^(no, never|yes,)/i.test(tried) ? "Paid for help before" : "Already tried", tried, LIST_FACT_MAX);
  if (/\bkg\b/i.test(f.goal)) add("Weight you want to lose", f.goal);
  return out;
}

/** The header's grey line: age band, city, call date. Each only when it reads as one. */
export function metaLine(facts: Partial<QuizFacts>, when: string): string[] {
  const out: string[] = [];
  const age = ageLabel(facts.age ?? "");
  if (age) out.push(age);
  const city = cityLabel(facts.city ?? "");
  if (city) out.push(city);
  const date = callDateLabel(when);
  if (date) out.push(`Call: ${date}`);
  return out;
}

// ── The call agenda ──────────────────────────────────────────────────────────

const GROUP_ORDER: MarkerGroup[] = ["thyroid", "nutrients", "sugar", "lipids"];

/**
 * "What we will look at on our call". Fixed sentences, one per group of her
 * markers that is present, each naming the markers it rests on; then any
 * other result she has a flag on; then the plan. A group she has no marker in
 * has no point, so nothing here talks about a test she did not do.
 */
export function agendaFor(rows: ReportRow[], facts: FactRow[], goal: string): string[] {
  const names = (pick: (r: ReportRow) => boolean) => [...new Set(rows.filter(pick).map((r) => r.cite))];
  const out: string[] = [];
  for (const g of GROUP_ORDER) {
    const cites = names((r) => r.group === g);
    if (!cites.length) continue;
    const list = andList(cites);
    const one = cites.length === 1;
    if (g === "thyroid") {
      out.push(facts.length
        ? `How your thyroid results (${list}) fit with what you told me about your weight.`
        : `How your thyroid results (${list}) connect to your weight.`);
    } else if (g === "nutrients") {
      out.push(`Your ${list} ${one ? "result" : "results"}, and how energy and recovery shape a plan you can keep up.`);
    } else if (g === "sugar") {
      out.push(`Your ${list} ${one ? "result" : "results"}, and how meals can be built for steadier energy through the day.`);
    } else {
      out.push(`Your ${list} ${one ? "result" : "results"}, and what food and activity can do for ${one ? "it" : "them"} alongside your doctor’s advice.`);
    }
  }
  // A long tail of other flagged tests is cited by its first few names; the
  // table above lists every one.
  const flagged = names((r) => !r.group && Boolean(r.flag));
  if (flagged.length) {
    const shown = flagged.length > OTHER_CITES ? [...flagged.slice(0, OTHER_CITES - 1), `${flagged.length - OTHER_CITES + 1} more`] : flagged;
    out.push(`Anything else your report flags (${andList(shown)}).`);
  }
  const g = answered(goal);
  // "More than 20 kg" follows "losing" mid-sentence.
  const kg = /^[A-Z][a-z]/.test(g) ? g[0].toLowerCase() + g.slice(1) : g;
  out.push(/\bkg\b/i.test(kg) ? `Where to start, and in what order, for your goal of losing ${clampText(kg, 30)}.` : "Where to start, and in what order.");
  return out;
}

/** How many other flagged tests the call list names before "and N more". */
const OTHER_CITES = 4;

// ── Fitting two pages ────────────────────────────────────────────────────────

/**
 * Heights in CSS pixels at 100% zoom, measured on headless-Chrome renders of
 * lib/precall-html (getBoundingClientRect, IBM Plex loaded). `page` is the A4
 * sheet's content box: 297 mm is 1122.5 px, less 50 px and 36 px of padding.
 * Text that wraps is estimated by characters per line, a little short of the
 * measured width, so an estimate errs tall; the page's fit script zooms a
 * page that still runs over down to 80%, so it only has to be close.
 */
export const LAYOUT = {
  page: 1036,
  /** Band, title block and the lead paragraph. */
  head: 170,
  /** Page 2's slim header. */
  head2: 70,
  /** Section margin and label, less one grid gap. */
  factsHead: 32,
  /** One grid row: the label, one line of answer, the gap. */
  factRow: 42.5,
  factLine: 17.5,
  factChars: 42,
  /** Section margin, label and the column heads. */
  tableHead: 61,
  rowSolo: 34.5,
  rowWithNote: 38.5,
  noteLine: 15.2,
  noteChars: 122,
  tableNote: 23,
  agendaHead: 43,
  agendaLine: 17.5,
  agendaGap: 7,
  agendaChars: 100,
  doctor: 100,
  foot: 25,
} as const;

const lines = (text: string, perLine: number) => Math.max(1, Math.ceil(text.length / perLine));

export const rowHeight = (r: ReportRow) =>
  r.note ? LAYOUT.rowWithNote + lines(r.note, LAYOUT.noteChars) * LAYOUT.noteLine : LAYOUT.rowSolo;

/** Her answers sit two to a grid row; a row is as tall as its longer answer. */
export function factsHeight(facts: FactRow[]): number {
  if (!facts.length) return 0;
  let h = LAYOUT.factsHead;
  for (let i = 0; i < facts.length; i += 2) {
    const tallest = Math.max(...facts.slice(i, i + 2).map((f) => lines(f.value, LAYOUT.factChars)));
    h += LAYOUT.factRow + (tallest - 1) * LAYOUT.factLine;
  }
  return h;
}

export function agendaHeight(agenda: string[]): number {
  return LAYOUT.agendaHead + agenda.reduce((h, a, i) => h + lines(a, LAYOUT.agendaChars) * LAYOUT.agendaLine + (i ? LAYOUT.agendaGap : 0), 0);
}

/**
 * How many rows print on page 1. All of them when everything fits one sheet
 * (allowing the fit script a 6% zoom). Otherwise page 1 takes as many rows as
 * fit under the header and her answers, and page 2 carries the rest with the
 * call agenda and the doctor box, so the PDF always ends the same way.
 */
export function splitRows(rows: ReportRow[], facts: FactRow[], agenda: string[]): number {
  const tail = LAYOUT.tableNote + agendaHeight(agenda) + LAYOUT.doctor + LAYOUT.foot;
  const above = LAYOUT.head + factsHeight(facts) + LAYOUT.tableHead;
  const rowsTotal = rows.reduce((n, r) => n + rowHeight(r), 0);
  if (rows.length <= 1 || above + rowsTotal + tail <= LAYOUT.page / 0.94) return rows.length;
  let room = LAYOUT.page - above - LAYOUT.tableNote - LAYOUT.foot;
  let n = 0;
  while (n < rows.length && rowHeight(rows[n]) <= room) {
    room -= rowHeight(rows[n]);
    n++;
  }
  // Page 1 always shows at least one row, and page 2 at least one.
  return Math.min(Math.max(n, 1), rows.length - 1);
}

// ── The model ────────────────────────────────────────────────────────────────

/**
 * Everything the PDF prints. `model` is null when there is no marker to print,
 * and the route answers 422 no_markers: a "what your report shows" page with
 * nothing from her report on it would only be her answers read back to her.
 */
export function buildPrecall(input: {
  markers: MarkerRow[];
  facts: Partial<QuizFacts>;
  call: PrecallCall;
  now?: number;
}): PrecallResult {
  const { markers, facts, call } = input;
  const now = input.now ?? Date.now();
  const when = Number.isFinite(new Date(call.when).getTime()) ? call.when : new Date(now).toISOString();
  const warnings: string[] = [];

  const cleaned = cleanMarkerRows(markers);
  warnings.push(...cleaned.warnings);
  if (!cleaned.rows.length) return { model: null, warnings };
  if (cleaned.rows.length > MAX_MARKERS) {
    warnings.push(`Only the first ${MAX_MARKERS} markers fit on two pages, so ${cleaned.rows.length - MAX_MARKERS} were left off. Put the ones that matter most first.`);
  }
  const rows = reportRows(cleaned.rows.slice(0, MAX_MARKERS));
  const unknown = rows.filter((r) => !r.group).map((r) => r.marker);
  if (unknown.length) {
    warnings.push(`No plain-language line for ${andList(unknown.map((m) => `“${clampText(m, 30)}”`))}, so ${unknown.length === 1 ? "it prints" : "they print"} with no explanation.`);
  }

  // Her name is typed text too, and prints three times: the copy rule holds for it.
  const name = noEmDash(displayName(call.name) || displayName(facts.name ?? ""));
  const factList = factRows(facts);
  if (!factList.length) warnings.push("None of her quiz answers were found, so the PDF has no “What you told me” section.");
  const agenda = agendaFor(rows, factList, facts.goal ?? "");

  return {
    model: {
      name,
      meta: metaLine(facts, when),
      facts: factList,
      rows,
      split: splitRows(rows, factList, agenda),
      agenda,
    },
    warnings,
  };
}

// ── What the route needs around it ───────────────────────────────────────────

/** "Pre-call Analysis · Meera K. · 2026-11-12.pdf": the call's IST date. */
export function precallFileName(name: string, when: string): string {
  return `Pre-call Analysis · ${clientName(name)} · ${istDate(when)}.pdf`;
}

/** One pre-call PDF per call: making it again replaces the file instead of adding a second. */
export function precallDedupeKey(phone: string, when: string): string {
  return `precall:${digits10(phone)}:${istDate(when)}`;
}

/** The words that go with the PDF on WhatsApp, or that he pastes when her window is shut. */
export function precallCaption(name: string, withAnswers = true): string {
  const first = displayName(name).split(" ")[0] ?? "";
  const what = withAnswers ? "what your quiz answers and your report show" : "what your report shows";
  return `${first ? `${first}, here` : "Here"} is your pre-call analysis: ${what}, ready for our call.`;
}

// ── The dashboard's side: what each reply means ─────────────────────────────

/** Whatever /api/admin/precall answered. Read defensively: a 502 may be an HTML page. */
export type PrecallReply = {
  pdfUrl?: unknown;
  warnings?: unknown;
  windowOpen?: unknown;
  windowMinutesLeft?: unknown;
  markerSource?: unknown;
  sent?: unknown;
  error?: unknown;
  hint?: unknown;
  waText?: unknown;
};

export type PrecallReady = {
  phase: "ready";
  pdfUrl: string;
  warnings: string[];
  windowOpen: boolean;
  /** ISO time it went to her on WhatsApp; "" until then. */
  sentAt: string;
  /** The server's words for the phone fallback, once it has offered some. */
  waText: string;
  sendError: string;
  markerSource: string;
};
export type PrecallView = PrecallReady | { phase: "error"; code: string; hint: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/** What a reply to Generate means for the card it came from. */
export function precallFromReply(status: number, body: PrecallReply | null | undefined, nowIso: string): PrecallView {
  const b = body ?? {};
  const code = str(b.error);
  const hint = str(b.hint);
  if (status >= 200 && status < 300) {
    const pdfUrl = str(b.pdfUrl);
    // A 200 with nothing to open is a failure, however it is labelled.
    if (!pdfUrl) return { phase: "error", code: code || "no_pdf", hint: hint || "The pre-call PDF came back without a file. Press Generate again." };
    return {
      phase: "ready",
      pdfUrl,
      warnings: strs(b.warnings),
      windowOpen: b.windowOpen === true,
      sentAt: b.sent === true ? nowIso : "",
      waText: "",
      sendError: "",
      markerSource: str(b.markerSource),
    };
  }
  return {
    phase: "error",
    code: code || `http_${status}`,
    hint: hint || (code === "no_markers"
      ? "Type her marker values, or fill the Marker column in her notes Doc."
      : `The pre-call PDF failed (HTTP ${status}). Press Generate again.`),
  };
}

/**
 * What a reply to "Send to her" does to a card already showing a ready PDF.
 * The PDF exists whatever happens to the send, so the card never loses its
 * Open link: a failed send adds a line, and a shut window swaps the button
 * for the phone fallback, carrying the server's words for it.
 */
export function afterPrecallSend(prev: PrecallReady, status: number, body: PrecallReply | null | undefined, nowIso: string): PrecallReady {
  const b = body ?? {};
  if (status === 409 && str(b.error) === "window_closed") {
    return { ...prev, windowOpen: false, waText: str(b.waText) || prev.waText, sendError: "" };
  }
  const next = precallFromReply(status, b, nowIso);
  if (next.phase === "ready") {
    if (next.sentAt) return { ...next, waText: prev.waText, sendError: "" };
    return { ...next, windowOpen: false, waText: prev.waText, sendError: str(b.hint) || "WhatsApp did not send it. Send it from your phone." };
  }
  return { ...prev, sendError: next.hint };
}

/**
 * The form after a reading of her report pre-fills it (the report-reader slot
 * on the card). The incoming rows are cleaned exactly like typed ones. An
 * untouched form takes the reading as it is; rows he already typed stay, first
 * and unchanged, and only markers he has not typed are added: a reading never
 * overwrites a value he entered.
 */
export function mergeReadRows(current: MarkerRow[], incoming: MarkerRow[]): MarkerRow[] {
  const read = cleanMarkerRows(incoming).rows;
  const typed = current.filter((r) => [r.marker, r.value, r.range, r.flag].some((v) => String(v ?? "").trim()));
  const have = new Set(typed.map((r) => normalizeMarkerName(r.marker)).filter(Boolean));
  return [...typed, ...read.filter((r) => !have.has(normalizeMarkerName(r.marker)))];
}

/** True when two sets of rows would print the same PDF: Send only goes out for the PDF he reviewed. */
export function sameRows(a: MarkerRow[], b: MarkerRow[]): boolean {
  const key = (rows: MarkerRow[]) => JSON.stringify(cleanMarkerRows(rows).rows);
  return key(a) === key(b);
}
