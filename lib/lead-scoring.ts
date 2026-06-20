/**
 * lib/lead-scoring.ts
 *
 * Pure 0–100 lead-scoring model for the thyroid qualifying flow.
 * NO side effects, NO googleapis — safe to import anywhere and easy to unit-test.
 *
 * The score sums SIX weighted dimensions (total 100). Each dimension maps a real
 * qualifying question (by its QualifyingFlow step id) to points.
 *
 *   Budget / ability to invest .... 30   (investment)
 *   Urgency / timeline ............ 20   (timing)
 *   Commitment & readiness ........ 15   (commitment, 1–10 scale)
 *   Problem severity & fit ........ 15   (diagnosis + duration + goal/challenge)
 *   Tried & failed before ......... 10   (tried, multi-select)
 *   ICP fit ....................... 10   (profession; age is NOT collected)
 *
 * Tier: Best 70–100 · Average 45–69 · Worst 0–44.
 *
 * TO TUNE: edit the point tables in SCORING and the cutoffs in TIER_CUTOFFS.
 * Answer labels MUST match the option labels in QualifyingFlow STEPS exactly.
 */

export type Answers = Record<string, string | string[] | number | undefined>;
export type LeadTier = "Best" | "Average" | "Worst";

// ── Tunable config ────────────────────────────────────────────────────────────

export const SCORING = {
  // 1. Ability to invest / budget — 30 pts (strongest single buying signal)
  investment: {
    "I can invest ₹50,000": 30,
    "I can invest ₹30,000": 30,
    "I can invest ₹15,000": 15,
    "I'll decide on the call": 15,
  } as Record<string, number>,

  // 2. Urgency / timeline — 20 pts
  timing: {
    "This week": 20,
    "This month": 12,
    "In a month or two": 12,
    "Just exploring for now": 4,
  } as Record<string, number>,

  // 3. Commitment & readiness — 15 pts (1–10 self-rating)
  commitment: { veryReady: 15, somewhat: 8, low: 2 },

  // 4. Problem severity & fit — 15 pts (composed below from diagnosis+duration+goal)
  severity: { full: 15, mild: 8, none: 3 },

  // 5. Tried & failed before — 10 pts (count of real prior attempts)
  tried: { multiple: 10, some: 6, none: 3 },

  // 6. ICP fit — 10 pts (working woman / metro; age not asked, so profession-led)
  icp: {
    "Corporate / IT professional": 10,
    "Business owner / entrepreneur": 10,
    "Doctor / healthcare": 10,
    "Teacher / educator": 5,
    "Homemaker": 5,
    "Something else": 5,
  } as Record<string, number>,
} as const;

export const TIER_CUTOFFS = { best: 70, average: 45 } as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function asString(v: Answers[string]): string {
  return typeof v === "string" ? v : "";
}
function asArray(v: Answers[string]): string[] {
  if (Array.isArray(v)) return v;
  return typeof v === "string" && v ? [v] : [];
}

// ── Per-dimension scorers (exported for granular testing) ──────────────────────

export function scoreInvestment(a: Answers): number {
  return SCORING.investment[asString(a.investment)] ?? 0;
}

export function scoreTiming(a: Answers): number {
  return SCORING.timing[asString(a.timing)] ?? 0;
}

export function scoreCommitment(a: Answers): number {
  const n = typeof a.commitment === "number" ? a.commitment : Number(a.commitment) || 0;
  if (n >= 8) return SCORING.commitment.veryReady;
  if (n >= 5) return SCORING.commitment.somewhat;
  if (n >= 1) return SCORING.commitment.low;
  return 0;
}

export function scoreSeverity(a: Answers): number {
  const diagnosis = asString(a.diagnosis);
  const diagnosed =
    diagnosis === "Yes — hypothyroidism" ||
    diagnosis === "Yes — Hashimoto's" ||
    diagnosis === "Yes — not sure which type";

  const goal = asString(a.goal);
  const challenge = asString(a.challenge);
  const weightGoal =
    goal === "Lose the stubborn weight" ||
    goal === "All of the above" ||
    challenge === "The weight won't move, no matter what I do";

  const duration = asString(a.duration);
  const longStruggle = duration === "Over a year" || duration === "6–12 months";

  if (diagnosed && weightGoal && longStruggle) return SCORING.severity.full;
  // "mild": at least one strong fit signal present
  if (diagnosed || longStruggle || weightGoal) return SCORING.severity.mild;
  return SCORING.severity.none;
}

export function scoreTried(a: Answers): number {
  const real = asArray(a.tried).filter((x) => x && x !== "Nothing structured yet");
  if (real.length >= 2) return SCORING.tried.multiple;
  if (real.length === 1) return SCORING.tried.some;
  return SCORING.tried.none;
}

export function scoreIcp(a: Answers): number {
  return SCORING.icp[asString(a.profession)] ?? 0;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function tierFor(score: number): LeadTier {
  if (score >= TIER_CUTOFFS.best) return "Best";
  if (score >= TIER_CUTOFFS.average) return "Average";
  return "Worst";
}

export function scoreLead(a: Answers): {
  score: number;
  tier: LeadTier;
  breakdown: Record<string, number>;
} {
  const breakdown = {
    investment: scoreInvestment(a),
    timing: scoreTiming(a),
    commitment: scoreCommitment(a),
    severity: scoreSeverity(a),
    tried: scoreTried(a),
    icp: scoreIcp(a),
  };
  const raw = Object.values(breakdown).reduce((s, n) => s + n, 0);
  const score = Math.max(0, Math.min(100, raw));
  return { score, tier: tierFor(score), breakdown };
}
