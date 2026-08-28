/**
 * Buying-intent score, 0-100, for a Cal.com booking's qualifying answers.
 *
 * This is NOT the quiz funnel's "Lead Score" column, which measures symptom
 * severity — how bad her thyroid situation is. Severity says nothing about
 * whether she will pay. A woman with brutal symptoms who has never paid for
 * help and is "just gathering information" is a worse commercial prospect than
 * a milder case who decides alone and wants to start this week, even though the
 * severity score ranks her far higher.
 *
 * So this scores one question only: how likely is she to buy a 3-month
 * programme at Rs 20,000-30,000? Everything is weighted against that.
 *
 * WEIGHTS, and why they are in this order:
 *
 *   26  Can invest       Stated ability to pay. Note what the form actually
 *                        offers: Rs 50,000 / 30,000 / 15,000 — every option is
 *                        a PAYING option, there is no "I cannot invest". So the
 *                        three are much closer together than they look. Almost
 *                        nobody ticks the top box on a form before a call, and
 *                        Rs 15,000 is usually "I don't want to over-commit",
 *                        not "this is my ceiling". She is a buyer with a gap to
 *                        close, and is scored as one.
 *   18  Decision maker   "I need to discuss with my spouse" is the commonest
 *                        way a good call dies. A delay, though, not a refusal.
 *   16  When to start    Intent decays fast. "Just gathering information"
 *                        scores zero deliberately — it is a no with manners.
 *   16  Paid before      Behaviour beats intention. Someone who has actually
 *                        handed money to a coach is proven to buy; even under
 *                        Rs 10,000 counts, because paying at all is the line
 *                        that matters. "Only free advice" is the real red flag
 *                        here, not a small number.
 *    8  Diagnosis        Fit. Diagnosed and medicated is the core client.
 *    6  Weight to lose   Fit and pain size against the 10-15 kg promise.
 *    4  Stuck for        Pain duration.
 *    3  Own words        Effort proxy. A one-word answer to an open question
 *                        is a real signal; a paragraph is a better one.
 *    2  Age              ICP is 30+.
 *    1  City             Metro affordability, at the price point.
 *
 * Unanswered questions are excluded from BOTH sides of the ratio rather than
 * scored zero, so a booking made before a question existed is not punished for
 * it. Fewer than three answers returns null — too little signal to rank on.
 *
 * Matching is by substring on both the field key and the answer text, because
 * Cal.com booking-field slugs and option wording get edited over time and an
 * exact-match table would silently start scoring every lead zero.
 */

export type ScoreBreakdown = {
  id: string;
  label: string;
  earned: number;
  max: number;
  answer: string;
};

export type LeadScore = {
  /** 0-100, or null when fewer than three questions were answered. */
  score: number | null;
  answered: number;
  of: number;
  breakdown: ScoreBreakdown[];
};

type Rule = {
  id: string;
  label: string;
  max: number;
  match: (key: string) => boolean;
  points: (value: string) => number;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const has = (v: string, ...needles: string[]) => needles.some((n) => v.includes(n));

/** Where a Rs 20,000-30,000 programme is realistically affordable. */
const METROS = [
  "mumbai", "navi mumbai", "thane", "delhi", "new delhi", "gurugram", "gurgaon",
  "noida", "ghaziabad", "faridabad", "bangalore", "bengaluru", "hyderabad",
  "pune", "chennai", "kolkata", "ahmedabad",
];

const RULES: Rule[] = [
  {
    id: "budget",
    label: "Can invest",
    max: 26,
    // "investment-level" is the current slug. Guard against the prior-spend
    // question, which also talks about money.
    match: (k) =>
      k.includes("investment-level") ||
      (has(k, "invest", "able-to-invest") && !has(k, "previous", "paid", "spent", "ever")),
    // Every option on the form is a paying one, so the spread is deliberately
    // narrow. Rs 15,000 is a buyer with a gap to close on the call, not a lost
    // cause — treating her as one was costing real leads their ranking.
    points: (v) =>
      has(v, "50,000", "50000", "50k") ? 26
      : has(v, "30,000", "30000", "30k") ? 24
      : has(v, "20,000 or more", "20000 or more") ? 24
      : has(v, "15,000", "15000", "15k") ? 17
      : 18,
  },
  {
    id: "decision",
    label: "Decision maker",
    max: 18,
    match: (k) => has(k, "decision"),
    // Needing to ask a spouse delays a sale; it does not end one.
    points: (v) => (has(v, "sole") || v.startsWith("yes") ? 18 : 7),
  },
  {
    id: "urgency",
    label: "When to start",
    max: 16,
    match: (k) => has(k, "start", "timeline", "when-would", "when_would"),
    points: (v) =>
      has(v, "immediat") ? 16
      : has(v, "next month", "within the next") ? 12
      : has(v, "2 to 3", "2-3", "two to three") ? 5
      : has(v, "gathering", "information for now") ? 0
      : 8,
  },
  {
    id: "priorSpend",
    label: "Paid before",
    max: 16,
    match: (k) => has(k, "paid", "previous", "spent", "tried-before"),
    // Having paid ANY amount to a coach before is the signal; the size of it is
    // secondary. Never having paid for help is the one answer that should hurt.
    points: (v) =>
      has(v, "more than") && has(v, "25") ? 16
      : has(v, "10,000", "10000") && has(v, "25,000", "25000") ? 13
      : has(v, "under") ? 9
      : has(v, "only tried free", "free advice", "no, i have") ? 3
      : 8,
  },
  {
    id: "diagnosis",
    label: "Thyroid diagnosis",
    max: 8,
    match: (k) => has(k, "diagnos"),
    points: (v) =>
      has(v, "on medication") ? 8
      : v.startsWith("yes") ? 7
      : has(v, "suspect", "not sure", "unsure", "think i") ? 3
      : 1,
  },
  {
    id: "weight",
    label: "Weight to lose",
    max: 6,
    match: (k) => has(k, "weight-to-lose") || (has(k, "weight") && has(k, "lose")),
    points: (v) =>
      has(v, "20", "more than 15", "15+") ? 6
      : has(v, "10-15", "10 to 15") ? 6
      : has(v, "5-10", "5 to 10") ? 4
      : has(v, "under 5", "less than 5") ? 2
      : 4,
  },
  {
    id: "stuck",
    label: "Stuck for",
    max: 4,
    match: (k) => has(k, "how-long", "stuck", "duration"),
    points: (v) =>
      has(v, "more than 2", "2+ years", "over 2") ? 4
      : has(v, "1-2", "1 to 2") ? 4
      : has(v, "6-12", "6 to 12", "6 months to") ? 3
      : has(v, "less than 6", "under 6") ? 2
      : 3,
  },
  {
    id: "story",
    label: "Own words",
    max: 3,
    match: (k) => has(k, "what-happens", "own-words", "challenge"),
    points: (v) => (v.length >= 60 ? 3 : v.length >= 25 ? 2 : v.length >= 1 ? 1 : 0),
  },
  {
    id: "age",
    label: "Age",
    max: 2,
    match: (k) => has(k, "age"),
    points: (v) => (has(v, "under 30", "below 30") ? 1 : 2),
  },
  {
    id: "city",
    label: "City",
    max: 1,
    match: (k) => has(k, "city"),
    points: (v) => (METROS.some((m) => v.includes(m)) ? 1 : 0),
  },
];

/** Contact and plumbing fields Cal.com returns alongside the real answers. */
const SKIP = new Set([
  "email", "name", "phone", "guests", "location", "title", "notes",
  "attendeephonenumber", "smsremindernumber", "displayemail", "displayguests",
  "rescheduledreason", "cancellationreason", "cancelreason",
]);

export function scoreBooking(answers: Record<string, unknown> | undefined | null): LeadScore {
  const breakdown: ScoreBreakdown[] = [];
  let earned = 0;
  let available = 0;

  const entries = Object.entries(answers ?? {});

  for (const rule of RULES) {
    for (const [rawKey, rawVal] of entries) {
      const key = norm(rawKey);
      if (SKIP.has(key.replace(/[-_]/g, ""))) continue;
      if (!rule.match(key)) continue;

      const raw = rawVal == null ? "" : typeof rawVal === "string" ? rawVal : String(rawVal);
      const value = norm(raw);
      if (!value) continue;

      const pts = Math.max(0, Math.min(rule.max, rule.points(value)));
      earned += pts;
      available += rule.max;
      breakdown.push({ id: rule.id, label: rule.label, earned: pts, max: rule.max, answer: raw.trim() });
      break; // first matching field wins; never score one rule twice
    }
  }

  if (breakdown.length < 3 || available === 0) {
    return { score: null, answered: breakdown.length, of: RULES.length, breakdown };
  }
  return {
    score: Math.round((earned / available) * 100),
    answered: breakdown.length,
    of: RULES.length,
    breakdown,
  };
}

/** The budget answer as free text, for the dashboard's ₹20k-ready filter. */
export function budgetAnswer(answers: Record<string, unknown> | undefined | null): string {
  const rule = RULES[0];
  for (const [rawKey, rawVal] of Object.entries(answers ?? {})) {
    if (!rule.match(norm(rawKey))) continue;
    const raw = rawVal == null ? "" : typeof rawVal === "string" ? rawVal : String(rawVal);
    if (raw.trim()) return raw.trim();
  }
  return "";
}
