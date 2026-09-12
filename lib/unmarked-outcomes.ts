/**
 * lib/unmarked-outcomes.ts — PURE. Which consultations are still missing their
 * outcome, and how the morning brief should say so.
 *
 * WHY THIS EXISTS
 * The offline conversion is only as good as the marking. A consultation whose
 * outcome is never recorded is a sale Meta is never told about — and because
 * Meta refuses an event older than seven days, an unmarked close does not stay
 * recoverable, it expires. Nothing in the system notices that today: the Today
 * screen lists calls waiting on a decision, but the coach has to open it.
 *
 * So the brief he already reads every morning names them. Three days is the
 * threshold because it leaves four days of Meta's window to still act in, and
 * because a call from yesterday is a normal amount of not-yet-done.
 *
 * The brief goes to the owner, but it travels through Make and Gmail, so it
 * carries a name and a date and nothing else — no phone, no answers, no health.
 */

const DAY_MS = 86400000

/** The coach, his clients and every date string in the sheet are IST. */
export const IST_OFFSET_MS = 5.5 * 3600000

/** Below this a call is simply recent, not neglected. */
export const UNMARKED_AFTER_DAYS = 3

/** A backlog should be a prompt, not a wall of text in an email. */
export const UNMARKED_LIST_LIMIT = 12

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "05 Sep 2026 3:00 PM" → the epoch ms it names.
 *
 * The sheet writes the session slot as IST wall-clock text with no zone on it.
 * Handing that to `new Date(...)` reads it in the RUNTIME's timezone, which is
 * UTC on the worker and something else on a laptop — so the same row is five
 * and a half hours apart depending on where the code runs, and "more than three
 * days ago" lands on a different set of rows. Pinning the offset makes it the
 * same answer everywhere.
 */
export function parseIstSession(raw: string): number | null {
  const m = /^(\d{1,2}) (\w{3}) (\d{4}) (\d{1,2}):(\d{2}) ([AP]M)/.exec(String(raw ?? '').trim())
  if (!m) return null
  const [, d, mon, y, h, min, ap] = m
  const month = MONTHS.findIndex((x) => x.toLowerCase() === mon.toLowerCase())
  if (month < 0) return null
  let hour = Number(h) % 12
  if (ap === 'PM') hour += 12
  const ms = Date.UTC(Number(y), month, Number(d), hour, Number(min)) - IST_OFFSET_MS
  return Number.isFinite(ms) ? ms : null
}

export type ConsultationRecord = {
  name: string
  /** When the consultation was held, epoch ms. */
  sessionAtMs: number
  /** Raw sheet cells, exactly as read. */
  showed: string
  closedAmount: string
  programmeValue: string
}

export type UnmarkedOutcome = {
  name: string
  sessionAtMs: number
  daysAgo: number
}

const amount = (s: string) => Number(String(s ?? '').replace(/[^\d.]/g, '')) || 0

/**
 * An outcome counts as marked if ANY of the three columns the coach can write
 * says something. "Showed: N" is a marked outcome — she did not turn up, and
 * there is nothing further to record.
 */
export function isOutcomeMarked(r: ConsultationRecord): boolean {
  return (
    String(r.showed ?? '').trim() !== '' ||
    amount(r.closedAmount) > 0 ||
    amount(r.programmeValue) > 0
  )
}

/**
 * Consultations held more than UNMARKED_AFTER_DAYS ago with nothing recorded.
 * Oldest first — that one is closest to falling out of Meta's window, so it is
 * the one worth doing before the others.
 */
export function selectUnmarkedOutcomes(
  records: ConsultationRecord[],
  nowMs: number,
): UnmarkedOutcome[] {
  const cutoff = nowMs - UNMARKED_AFTER_DAYS * DAY_MS
  return records
    .filter((r) => Number.isFinite(r.sessionAtMs) && r.sessionAtMs > 0)
    .filter((r) => r.sessionAtMs < cutoff)
    .filter((r) => !isOutcomeMarked(r))
    .map((r) => ({
      name: String(r.name ?? '').trim() || '(no name)',
      sessionAtMs: r.sessionAtMs,
      daysAgo: Math.floor((nowMs - r.sessionAtMs) / DAY_MS),
    }))
    .sort((a, b) => a.sessionAtMs - b.sessionAtMs)
}

/** "5 Sep", read in the coach's own timezone rather than UTC. */
function dayLabel(ms: number, tzOffsetMs: number): string {
  const d = new Date(ms + tzOffsetMs)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

/**
 * The brief's section for these, or [] when there is nothing to nudge about —
 * an empty section every morning is how a morning brief stops being read.
 */
export function formatUnmarkedOutcomes(items: UnmarkedOutcome[], tzOffsetMs: number): string[] {
  if (items.length === 0) return []
  const shown = items.slice(0, UNMARKED_LIST_LIMIT)
  const overflow = items.length - shown.length
  return [
    ``,
    `ACTION: ${items.length} consultation(s) over ${UNMARKED_AFTER_DAYS} days old still have no outcome marked.`,
    ...shown.map((i) => `  ${dayLabel(i.sessionAtMs, tzOffsetMs)} — ${i.name} (${i.daysAgo}d ago)`),
    ...(overflow > 0 ? [`  …and ${overflow} more.`] : []),
    `Meta refuses a sale older than 7 days, so an unmarked close expires.`,
  ]
}
