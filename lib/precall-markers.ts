/**
 * lib/precall-markers.ts — PURE. The small, reviewed library of plain-language
 * lines her pre-call PDF prints under a blood marker (lib/precall-html.ts).
 *
 * WHAT A LINE MAY SAY
 * What the marker is, and why it matters for energy and weight, in general
 * terms. Never what SHE has: no line reads her value, compares it with a
 * range, names a condition she might have, or suggests anything about a dose,
 * a tablet or a medicine. The PDF puts her own value beside the line; the
 * reader draws no conclusion the page did not print. Every line is fixed text,
 * reviewed by the owner before it reaches a client, so a wording change happens
 * here and nowhere else (lib/precall-markers.test.ts holds the rules: no em
 * dash, no cure or reversal words, no medication words).
 *
 * A MARKER THE LIBRARY DOES NOT KNOW prints her value with no line under it.
 * Silence is the safe default: a guessed explanation of an unfamiliar test is
 * exactly the medical claim this page must never make.
 *
 * MATCHING IS ON THE NAME AS PRINTED
 * Labs print the same test a dozen ways ("TSH", "TSH 3rd Generation",
 * "Thyroid Stimulating Hormone", "S. TSH"), and the names arrive from his
 * typing, his notes Doc or the AI reader exactly as the report printed them.
 * The name is lower-cased, every run of punctuation becomes one space, and
 * each entry decides on that. The exclusions matter as much as the matches:
 * "Total Iron Binding Capacity" is not iron stores, "VLDL" and the ratios are
 * not the lipid basics, and "Anti-TG" is a thyroid antibody, not
 * triglycerides. Entries are tried in order, the antibody first.
 *
 * T3 AND T4 are matched in both their free and total forms (Indian thyroid
 * profiles usually print the totals), and their lines are worded to be true of
 * either.
 */

export type MarkerGroup = "thyroid" | "nutrients" | "sugar" | "lipids";

export type MarkerEntry = {
  key: string;
  group: MarkerGroup;
  /** What the marker is and why it matters for energy and weight. General, never about her. */
  line: string;
  /** Decides on the normalised printed name (normalizeMarkerName). */
  matches: (name: string) => boolean;
  /**
   * The short name the "on our call" list cites her row by, from the
   * normalised printed name: "Thyroid Stimulating Hormone (TSH)" is "TSH",
   * "T3, Total" is "T3". The table above it still prints her report's name.
   */
  short: (name: string) => string;
};

/** "Vit. B-12 (Serum)" → "vit b 12 serum". */
export function normalizeMarkerName(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const has = (re: RegExp) => (n: string) => re.test(n);
const not = (re: RegExp, yes: (n: string) => boolean) => (n: string) => !re.test(n) && yes(n);

export const MARKER_LIBRARY: readonly MarkerEntry[] = [
  {
    key: "tpo",
    group: "thyroid",
    line:
      "Anti-TPO is a thyroid antibody test. It helps your doctor see whether the immune system is involved in a thyroid condition, and thyroid conditions can affect energy and weight. It is read together with TSH.",
    matches: has(/\banti ?tpo\b|\btpo ?ab\b|\btpo antibod|\bthyroid peroxidase\b|\batpo\b/),
    short: () => "Anti-TPO",
  },
  {
    key: "tsh",
    group: "thyroid",
    line:
      "TSH is the signal your brain sends to tell your thyroid how hard to work. It is usually the first check of thyroid function. Thyroid hormones help set the pace of your metabolism, which affects energy and weight.",
    matches: not(/antibod|receptor|\btrab\b|\btsi\b/, has(/\btsh\b|\bthyroid stimulating hormone\b|\bthyrotropin\b/)),
    short: () => "TSH",
  },
  {
    key: "t3",
    group: "thyroid",
    line:
      "T3 is the active thyroid hormone, the form your cells use. It plays a part in how much energy your body burns at rest, which is one reason it matters for weight.",
    matches: not(/reverse|\brt3\b|antibod|uptake/, has(/\bf ?t3\b|\bt3\b|\btri ?iodothyronine\b/)),
    short: (n) => (/\bfree\b|\bft3\b|\bf t3\b/.test(n) ? "Free T3" : "T3"),
  },
  {
    key: "t4",
    group: "thyroid",
    line:
      "T4 is the main hormone your thyroid makes. Your body converts it into T3, the active form that helps set how much energy you burn, so T4 is read together with TSH and T3.",
    matches: not(/antibod|uptake|binding/, has(/\bf ?t4\b|\bt4\b|\bthyroxine\b/)),
    short: (n) => (/\bfree\b|\bft4\b|\bf t4\b/.test(n) ? "Free T4" : "T4"),
  },
  {
    key: "vitd",
    group: "nutrients",
    line:
      "Vitamin D supports your muscles, bones and immune system. Low levels are linked with tiredness, low energy and aches, which can make it harder to stay active.",
    matches: has(/\bvit(?:amin)? ?d(?: ?[23])?\b|\b25 ?oh\b|\b25 hydroxy|\bcalcidiol\b|\bcholecalciferol\b/),
    short: () => "Vitamin D",
  },
  {
    key: "b12",
    group: "nutrients",
    line:
      "Vitamin B12 helps your body make red blood cells and keeps your nerves healthy. Low levels are linked with tiredness and low energy.",
    matches: has(/\bvit(?:amin)? ?b ?12\b|\bb ?12\b|\bcyanocobalamin\b|\bcobalamin\b/),
    short: () => "Vitamin B12",
  },
  {
    key: "iron",
    group: "nutrients",
    line:
      "Ferritin shows how much iron your body has stored, and iron carries oxygen in your blood. Low iron is linked with tiredness, low energy and workouts feeling harder.",
    matches: (n) => /\bferritin\b/.test(n) || (/\biron\b/.test(n) && !/binding|tibc|uibc|saturation|transferrin/.test(n)),
    short: (n) => (/\bferritin\b/.test(n) ? "Ferritin" : "Iron"),
  },
  {
    key: "sugar",
    group: "sugar",
    line:
      "HbA1c reflects your average blood sugar over about three months, and fasting glucose is your blood sugar after a night without food. Both show how your body handles carbohydrates, which matters for energy through the day and for weight.",
    matches: not(
      /post ?prandial|\bpp\b|\bppbs\b|random|\brbs\b|average|\beag\b|\bmean\b/,
      has(
        /\bhba1c\b|\bhb a1c\b|\ba1c\b|\bgly(?:cated|cosylated) ha?emoglobin\b|\bfasting (?:blood |plasma )?(?:sugar|glucose)\b|\b(?:glucose|sugar) fasting\b|\b(?:glucose|sugar) f\b|\bfbs\b|\bfpg\b|\bfbg\b/,
      ),
    ),
    short: (n) => (/a1c|gly(?:cated|cosylated)/.test(n) ? "HbA1c" : "Fasting glucose"),
  },
  {
    key: "lipids",
    group: "lipids",
    line:
      "Cholesterol and triglycerides are fats carried in your blood. They are read for heart health, and food, activity, weight and thyroid function can all affect them.",
    matches: not(
      /ratio|anti|antibod|thyroglobulin|lipoprotein a\b|\blp a\b/,
      has(/\bcholesterol\b|\bldl\b|\bhdl\b|\bvldl\b|\btriglycerides?\b|\btg\b|\bdensity lipoprotein\b/),
    ),
    short: (n) =>
      /\btriglycerides?\b|\btg\b/.test(n) ? "Triglycerides"
      : /\bvldl\b|very low density/.test(n) ? "VLDL"
      : /\bnon hdl\b/.test(n) ? "Non-HDL cholesterol"
      : /\bldl\b|low density/.test(n) ? "LDL"
      : /\bhdl\b|high density/.test(n) ? "HDL"
      : "Total cholesterol",
  },
];

/** The entry for a name as printed, or null when the library does not know it. */
export function libraryEntry(printedName: string): MarkerEntry | null {
  const n = normalizeMarkerName(printedName);
  if (!n) return null;
  return MARKER_LIBRARY.find((e) => e.matches(n)) ?? null;
}

/**
 * The name the "on our call" list cites her row by: the library's short name,
 * or, for a test the library does not know, her report's own name without
 * the commas ("Iron, Serum") that would break a list apart.
 */
export function citeName(printedName: string): string {
  const entry = libraryEntry(printedName);
  if (entry) return entry.short(normalizeMarkerName(printedName));
  // "Uric Acid (Serum, Enzymatic Uricase)" is cited as "Uric Acid": the
  // bracket is the lab's method, and the table above prints it in full.
  const plain = String(printedName ?? "").replace(/\([^)]*\)/g, " ").replace(/\s*,\s*/g, " ").replace(/\s+/g, " ").trim();
  return plain || String(printedName ?? "").trim();
}

/**
 * The order the PDF lists her markers in, which is not the matching order:
 * the antibody is matched first so "Anti-TPO" is never read as anything else,
 * but it is printed after the hormones, the way a thyroid profile reads.
 */
export const DISPLAY_ORDER: readonly string[] = ["tsh", "t3", "t4", "tpo", "vitd", "b12", "iron", "sugar", "lipids"];

/** Where an entry is printed; anything the library does not know comes last. */
export function libraryRank(entry: MarkerEntry | null): number {
  const at = entry ? DISPLAY_ORDER.indexOf(entry.key) : -1;
  return at < 0 ? DISPLAY_ORDER.length : at;
}
