/**
 * app/quiz/quizData.ts
 *
 * Single source of truth for the Thyroid Fat-Loss Blocker Score quiz:
 * the questions, the result bands, and the scoring logic.
 *
 * Scoring rule (from the build brief):
 *   - Higher points = MORE blocked. Best-for-fat-loss answer = 0, worst = 3.
 *   - `segmentationOnly` questions are tags only — their score is ignored in banding.
 *   - totalScore = sum of selected option scores across scored questions
 *     (multi-select is summed, capped at that question's max).
 *   - maxScore   = sum of the max option score across scored questions.
 *   - percent    = round(totalScore / maxScore * 100). Higher % → more blocked.
 */

export type Option = { label: string; score: number; tag: string; icon: IconKey };
export type Question = {
  id: string;
  type: "single" | "multi"; // single = auto-advance
  segmentationOnly?: boolean; // score ignored in banding
  question: string;
  sub?: string;
  /** Short, warm phrase naming this area when it lands in her top blockers. */
  area: string;
  options: Option[];
};

/** Icon keys map to line icons rendered in QuestionCard (keeps data lib icon-free). */
export type IconKey =
  | "heart"
  | "clock"
  | "pill"
  | "frown"
  | "utensils"
  | "egg"
  | "activity"
  | "dumbbell"
  | "moon"
  | "brain"
  | "battery"
  | "stomach"
  | "list"
  | "rocket";

export const questions: Question[] = [
  {
    id: "diagnosis",
    type: "single",
    area: "your thyroid diagnosis",
    question: "Have you been diagnosed with a thyroid condition?",
    options: [
      { label: "Yes, hypothyroidism", score: 2, tag: "dx_hypo", icon: "heart" },
      { label: "Yes, Hashimoto's", score: 3, tag: "dx_hashimoto", icon: "heart" },
      { label: "Suspected, not confirmed", score: 2, tag: "dx_suspected", icon: "heart" },
      { label: "No, but I have the symptoms", score: 1, tag: "dx_symptoms", icon: "heart" },
    ],
  },
  {
    id: "duration",
    type: "single",
    area: "how long this has been building",
    question: "How long have you struggled with thyroid-related weight?",
    options: [
      { label: "Less than a year", score: 0, tag: "dur_lt1", icon: "clock" },
      { label: "1–3 years", score: 1, tag: "dur_1_3", icon: "clock" },
      { label: "3–5 years", score: 2, tag: "dur_3_5", icon: "clock" },
      { label: "5+ years", score: 3, tag: "dur_5plus", icon: "clock" },
    ],
  },
  {
    id: "medication",
    type: "single",
    area: "your medication response",
    question: "Are you currently on thyroid medication?",
    options: [
      { label: "Yes, and levels are optimised", score: 1, tag: "med_optimised", icon: "pill" },
      { label: "Yes, but weight still won't move", score: 3, tag: "med_stuck", icon: "pill" },
      { label: "Recently started", score: 2, tag: "med_new", icon: "pill" },
      { label: "Not on any medication", score: 2, tag: "med_none", icon: "pill" },
    ],
  },
  {
    id: "frustration",
    type: "single",
    segmentationOnly: true,
    area: "what frustrates you most",
    question: "What frustrates you the most right now?",
    sub: "This shapes the report we send you.",
    options: [
      { label: "Weight won't move no matter what I try", score: 0, tag: "fr_weight", icon: "frown" },
      { label: "Constant fatigue and low energy", score: 0, tag: "fr_energy", icon: "battery" },
      { label: "Bloating and digestion issues", score: 0, tag: "fr_digestion", icon: "stomach" },
      { label: "Cravings and emotional eating", score: 0, tag: "fr_cravings", icon: "utensils" },
    ],
  },
  {
    id: "eating",
    type: "single",
    area: "the way you're eating",
    question: "Which best describes how you eat?",
    options: [
      { label: "I eat clean but nothing changes", score: 2, tag: "eat_clean_stuck", icon: "utensils" },
      { label: "I often skip meals", score: 3, tag: "eat_skip", icon: "utensils" },
      { label: "I snack / graze through the day", score: 2, tag: "eat_graze", icon: "utensils" },
      { label: "Good most days, slip on weekends", score: 1, tag: "eat_mostly", icon: "utensils" },
    ],
  },
  {
    id: "protein",
    type: "single",
    area: "your protein intake",
    question: "How often do you eat a proper protein source?",
    sub: "Eggs, paneer, chicken, fish, dal, Greek yoghurt.",
    options: [
      { label: "Most meals", score: 0, tag: "pro_high", icon: "egg" },
      { label: "Once a day", score: 1, tag: "pro_mid", icon: "egg" },
      { label: "A few times a week", score: 2, tag: "pro_low", icon: "egg" },
      { label: "Rarely", score: 3, tag: "pro_rare", icon: "egg" },
    ],
  },
  {
    id: "activity",
    type: "single",
    area: "your activity levels",
    question: "How active are you in a typical week?",
    options: [
      { label: "Mostly sitting / sedentary", score: 3, tag: "act_sedentary", icon: "activity" },
      { label: "Light walks here and there", score: 2, tag: "act_light", icon: "activity" },
      { label: "I work out 2–3 times", score: 1, tag: "act_mid", icon: "activity" },
      { label: "I work out 4+ times", score: 0, tag: "act_high", icon: "activity" },
    ],
  },
  {
    id: "strength",
    type: "single",
    area: "strength training",
    question: "Do you do any strength or resistance training?",
    options: [
      { label: "Yes, regularly", score: 0, tag: "str_regular", icon: "dumbbell" },
      { label: "Sometimes", score: 1, tag: "str_sometimes", icon: "dumbbell" },
      { label: "Just started", score: 2, tag: "str_new", icon: "dumbbell" },
      { label: "Never", score: 3, tag: "str_never", icon: "dumbbell" },
    ],
  },
  {
    id: "sleep",
    type: "single",
    area: "your sleep",
    question: "How is your sleep, honestly?",
    options: [
      { label: "Deep and restful, 7–8 hours", score: 0, tag: "sleep_good", icon: "moon" },
      { label: "Decent but not quite enough", score: 1, tag: "sleep_ok", icon: "moon" },
      { label: "Restless, I wake up often", score: 2, tag: "sleep_restless", icon: "moon" },
      { label: "Poor, under 6 hours", score: 3, tag: "sleep_poor", icon: "moon" },
    ],
  },
  {
    id: "stress",
    type: "single",
    area: "your stress load",
    question: "How would you describe your stress levels?",
    options: [
      { label: "Calm and managed", score: 0, tag: "stress_low", icon: "brain" },
      { label: "Manageable most days", score: 1, tag: "stress_ok", icon: "brain" },
      { label: "Often stressed", score: 2, tag: "stress_high", icon: "brain" },
      { label: "Constantly overwhelmed", score: 3, tag: "stress_overwhelmed", icon: "brain" },
    ],
  },
  {
    id: "energy",
    type: "single",
    area: "your afternoon energy crashes",
    question: "Do you get afternoon energy crashes?",
    options: [
      { label: "Rarely", score: 0, tag: "en_rare", icon: "battery" },
      { label: "Sometimes", score: 1, tag: "en_some", icon: "battery" },
      { label: "Most days", score: 2, tag: "en_most", icon: "battery" },
      { label: "Every single day", score: 3, tag: "en_daily", icon: "battery" },
    ],
  },
  {
    id: "digestion",
    type: "single",
    area: "your digestion",
    question: "How is your digestion?",
    options: [
      { label: "Smooth and regular", score: 0, tag: "dig_good", icon: "stomach" },
      { label: "Occasional bloating", score: 1, tag: "dig_occasional", icon: "stomach" },
      { label: "Frequently bloated or constipated", score: 2, tag: "dig_frequent", icon: "stomach" },
      { label: "Daily digestion issues", score: 3, tag: "dig_daily", icon: "stomach" },
    ],
  },
  {
    id: "tried",
    type: "multi",
    area: "what you've already tried",
    question: "What have you already tried for fat loss?",
    sub: "Select all that apply.",
    options: [
      { label: "Calorie counting", score: 0, tag: "tried_calories", icon: "list" },
      { label: "Keto / low-carb", score: 0, tag: "tried_keto", icon: "list" },
      { label: "Fasting", score: 0, tag: "tried_fasting", icon: "list" },
      { label: "Generic gym plans", score: 0, tag: "tried_gym", icon: "list" },
      { label: "Online programs", score: 0, tag: "tried_online", icon: "list" },
      { label: "Nothing structured yet", score: 1, tag: "tried_none", icon: "list" },
    ],
  },
  {
    id: "readiness",
    type: "single",
    area: "your readiness to start",
    question: "If you had a plan built for your thyroid, how ready are you to start?",
    options: [
      { label: "Ready to start now", score: 0, tag: "ready_now", icon: "rocket" },
      { label: "Ready in a few weeks", score: 1, tag: "ready_soon", icon: "rocket" },
      { label: "Just exploring for now", score: 2, tag: "ready_exploring", icon: "rocket" },
      { label: "Not sure yet", score: 3, tag: "ready_unsure", icon: "rocket" },
    ],
  },
];

// ── Result bands ────────────────────────────────────────────────────────────

export type BandId = "A" | "B" | "C" | "D";

export type Band = {
  id: BandId;
  name: string;
  /** Inclusive upper bound of percent for this band. */
  maxPercent: number;
  icon: IconKey;
  /** Base description shown under the personalised opening line. */
  body: string;
};

export const bands: Band[] = [
  {
    id: "A",
    name: "Fine-Tuning Mode",
    maxPercent: 25,
    icon: "rocket",
    body: "You're closer than you think. A few small, targeted adjustments could release the fat loss your thyroid is currently holding back.",
  },
  {
    id: "B",
    name: "Hidden Brakes",
    maxPercent: 50,
    icon: "activity",
    body: "A handful of specific blockers are quietly stalling your progress. They're very fixable once you know exactly what they are.",
  },
  {
    id: "C",
    name: "Compounded Blockers",
    maxPercent: 75,
    icon: "brain",
    body: "Several systems are working against you at once, which is exactly why generic plans haven't worked. You need a sequence built for your thyroid.",
  },
  {
    id: "D",
    name: "Full System Reset",
    maxPercent: 100,
    icon: "heart",
    body: "Your metabolism is significantly suppressed right now. This isn't your fault, and it's reversible, but it needs a structured, thyroid-first protocol, not another crash diet.",
  },
];

// Frustration tag (Q4) → warm phrase injected into the result paragraph.
const FRUSTRATION_PHRASE: Record<string, string> = {
  fr_weight: "the weight that simply won't move",
  fr_energy: "the constant fatigue and low energy",
  fr_digestion: "the bloating and digestion issues",
  fr_cravings: "the cravings and emotional eating",
};

// ── Scoring ──────────────────────────────────────────────────────────────────

/** answers[questionId] = array of selected option labels (length 1 for single). */
export type Answers = Record<string, string[]>;

export type QuizResult = {
  totalScore: number;
  maxScore: number;
  percent: number;
  band: Band;
  /** All selected option tags across every question. */
  tags: string[];
  /** Selected tag for the segmentation-only frustration question (Q4). */
  frustrationTag: string;
  /** Up to two warm phrases for her highest-scoring blocker areas. */
  topAreas: string[];
  /** Personalised result paragraph (band body + frustration + top areas). */
  paragraph: string;
};

function optionsFor(q: Question, selectedLabels: string[]): Option[] {
  return q.options.filter((o) => selectedLabels.includes(o.label));
}

/** Score contributed by one question, respecting the multi-select cap. */
function questionScore(q: Question, selected: Option[]): number {
  if (q.segmentationOnly) return 0;
  const sum = selected.reduce((s, o) => s + o.score, 0);
  if (q.type === "multi") {
    const cap = Math.max(...q.options.map((o) => o.score));
    return Math.min(sum, cap);
  }
  return sum;
}

export function maxScore(): number {
  return questions
    .filter((q) => !q.segmentationOnly)
    .reduce((s, q) => s + Math.max(...q.options.map((o) => o.score)), 0);
}

export function computeResult(answers: Answers): QuizResult {
  const max = maxScore();
  let total = 0;
  const tags: string[] = [];
  // (questionId, area, score) for ranking top blockers — scored singles only.
  const ranked: { area: string; score: number }[] = [];

  for (const q of questions) {
    const selected = optionsFor(q, answers[q.id] ?? []);
    selected.forEach((o) => tags.push(o.tag));
    const qScore = questionScore(q, selected);
    total += qScore;
    if (!q.segmentationOnly && q.type === "single" && qScore > 0) {
      ranked.push({ area: q.area, score: qScore });
    }
  }

  const percent = max > 0 ? Math.round((total / max) * 100) : 0;
  const band = bands.find((b) => percent <= b.maxPercent) ?? bands[bands.length - 1];

  const frustrationTag = (answers["frustration"]?.[0]
    ? questions
        .find((q) => q.id === "frustration")!
        .options.find((o) => o.label === answers["frustration"][0])?.tag
    : "") ?? "";

  const topAreas = ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((r) => r.area);

  const paragraph = buildParagraph(band, frustrationTag, topAreas);

  return { totalScore: total, maxScore: max, percent, band, tags, frustrationTag, topAreas, paragraph };
}

function buildParagraph(band: Band, frustrationTag: string, topAreas: string[]): string {
  const frustration = FRUSTRATION_PHRASE[frustrationTag];
  const lead = frustration
    ? `You told us ${frustration} is what frustrates you most. `
    : "";

  let blockers = "";
  if (topAreas.length === 2) {
    blockers = ` Right now, ${topAreas[0]} and ${topAreas[1]} are the two biggest things holding your results back.`;
  } else if (topAreas.length === 1) {
    blockers = ` Right now, ${topAreas[0]} is the biggest thing holding your results back.`;
  }

  return `${lead}${band.body}${blockers}`;
}
