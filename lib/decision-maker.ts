/**
 * lib/decision-maker.ts — PURE. Who actually decides, and was that person on
 * the call.
 *
 * WHY THIS EXISTS
 * The commonest way a good consultation dies is not price. It is that the
 * woman on the call is not the only person deciding, and the man who shares
 * the decision hears the whole thing second-hand from someone who was told it
 * once. Roughly two calls in three are held without that person present.
 *
 * Everything here is a READ of answers the funnel already collects. Nothing is
 * scored, nothing is written, nothing is sent to Meta, and nothing is shown to
 * the lead — a badge that says "ASK AT MINUTE 1" is a note to the coach about
 * how to open a call, never a label on the woman taking it.
 *
 * Two inputs, both sheet columns read BY HEADER NAME and both allowed to be
 * missing:
 *   "Decision Maker"   — her quiz answer, free text, five different wordings
 *                        across three quizzes and counting.
 *   "Partner On Call"  — yes / unsure / no, added later, absent on every
 *                        legacy row.
 *
 * A row with neither gets no badge at all. An absent answer is not evidence of
 * a sole decider, and a green badge invented out of missing data is worse than
 * no badge — it tells the coach to skip the one question that would have
 * caught it.
 */

/**
 * The opener, fixed and always visible next to an amber badge.
 *
 * Fixed because the wording is the whole point. "Is the decision yours, or is
 * someone else involved?" is answerable without embarrassment; "do you need
 * your husband's permission?" is not, and gets a defensive "no" that holds up
 * for forty minutes and then collapses at the price.
 *
 * Always visible — not a tooltip, not behind a tap. He reads this screen
 * between calls with a phone in one hand; anything that needs a hover is a
 * thing he will not see.
 */
export const ASK_AT_MINUTE_ONE =
  'Ask in the first two minutes: "Before we start — if today makes sense, is the decision yours, ' +
  'or is someone else involved?" If someone else is, read the report, give value, and rebook with ' +
  'them present. Do not run the full pitch.'

/** Who signs off. "shared" means someone else is in the decision, not that she
 *  has no say. */
export type DecisionRole = 'sole' | 'shared' | 'unknown'

/** Whether that other person will be on the call. */
export type PartnerOnCall = 'yes' | 'unsure' | 'no' | 'unknown'

export type BadgeTone = 'good' | 'warn'

export type DecisionBadge = {
  label: string
  tone: BadgeTone
  /** Present only on the amber badge — the line to read out at minute one. */
  prompt?: string
}

/**
 * Sheet header → 0-based column index, case- and space-insensitive, preferring
 * the rightmost match like every other reader of this sheet.
 *
 * Case-insensitive on purpose: these headers are typed by hand when a column
 * is added, and "Partner on Call" would otherwise silently read as absent —
 * which looks exactly like a legacy row and hides the answer that was given.
 * -1 when the column does not exist, which every caller must tolerate.
 */
export function findColumn(header: readonly string[], title: string): number {
  const want = title.trim().toLowerCase()
  let found = -1
  for (let i = 0; i < header.length; i++) {
    if (String(header[i] ?? '').trim().toLowerCase() === want) found = i
  }
  return found
}

/**
 * Her quiz answer → who decides.
 *
 * Five wordings are live across the three quizzes, and more will arrive:
 *   "Yes, I am the sole financial decision-maker"     (/assessment)
 *   "No, I need to discuss it with my spouse/family"  (/assessment)
 *   "Yes, I decide on my own"                         (/decode)
 *   "No, I need to discuss it with my spouse or family"
 *   "I decide for myself" · "I decide, then tell my family"
 *   "I discuss with my partner, but it's my choice"   (/book)
 *   "My partner / family decides"
 *
 * So this matches on meaning, not on a list of exact strings — a list would
 * silently classify the next wording as unknown and drop the badge.
 *
 * SHARED IS CHECKED FIRST. An answer that mentions both ("No, I need to
 * discuss it…") must never be read as sole on the strength of a stray word.
 * The cost of the two mistakes is not symmetric: reading a shared decider as
 * sole loses the sale, reading a sole decider as shared costs one polite
 * question at the start of a call.
 */
export function classifyDecisionRole(raw: string): DecisionRole {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return 'unknown'

  // Someone else is in the decision.
  if (/^no\b/.test(s)) return 'shared'
  if (/\bneed to (discuss|talk|check|ask|speak)/.test(s)) return 'shared'
  if (/\b(partner|spouse|husband|wife|family|parents?)\b[^.]*\bdecides?\b/.test(s)) return 'shared'
  if (/\bnot\b[^.]*\b(sole|only|one who decides)\b/.test(s)) return 'shared'

  // She signs off, even where she talks it over first.
  if (/^yes\b/.test(s)) return 'sole'
  if (/\bsole\b/.test(s)) return 'sole'
  if (/\bi decide\b/.test(s)) return 'sole'
  if (/\b(my|her) (own )?(choice|call|decision)\b/.test(s)) return 'sole'
  if (/\bdecide (for myself|on my own|alone|myself)\b/.test(s)) return 'sole'

  return 'unknown'
}

/**
 * The "Partner On Call" cell → yes / unsure / no.
 *
 * Written by the quiz as one of those three words, but this is a spreadsheet:
 * it will eventually contain "Yes", "y", "not sure", "maybe" and a stray
 * space. Anything unrecognised is `unknown`, never a silent "no".
 */
export function classifyPartnerOnCall(raw: string): PartnerOnCall {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return 'unknown'
  if (/^(unsure|not sure|maybe|don'?t know|dunno|idk|possibly)/.test(s)) return 'unsure'
  if (/^(y|yes|true|1)\b/.test(s) || s === 'y') return 'yes'
  if (/^(n|no|false|0)\b/.test(s) || s === 'n') return 'no'
  return 'unknown'
}

/**
 * The badge for one upcoming booking, or null for a row that knows nothing.
 *
 *   sole decider                     → SOLE DECIDER    (green, nothing to do)
 *   shared, partner joining          → PARTNER JOINING (green, already fixed)
 *   shared, unsure / no / unanswered → ASK AT MINUTE 1 (amber, + the opener)
 *   no decision answer at all        → null            (legacy row, no badge)
 *
 * An unanswered "Partner On Call" on a SHARED decider is amber, not nothing.
 * That row is exactly the call this whole change exists for: someone else is
 * in the decision and nobody has established whether he will be there. Before
 * the column existed, every such row looked like that — treating them as
 * silent would leave the badge blank on the entire back catalogue of the one
 * case it was built to catch.
 */
export function decisionBadge(decisionRaw: string, partnerRaw: string): DecisionBadge | null {
  const role = classifyDecisionRole(decisionRaw)
  if (role === 'unknown') return null
  if (role === 'sole') return { label: 'SOLE DECIDER', tone: 'good' }
  if (classifyPartnerOnCall(partnerRaw) === 'yes') return { label: 'PARTNER JOINING', tone: 'good' }
  return { label: 'ASK AT MINUTE 1', tone: 'warn', prompt: ASK_AT_MINUTE_ONE }
}
