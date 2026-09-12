/**
 * lib/dm-presence.ts — PURE. Was the decision-maker actually on the call, as a
 * number that moves.
 *
 * WHY A NUMBER AND NOT A FEELING
 * Badges on the Today screen change how one call opens. Whether that habit
 * takes hold is a separate question, and the only honest answer to it is a
 * rolling count: of the consultations held in the last fortnight, how many had
 * the person who shares the decision on them. It starts near a third. Anything
 * above seventy per cent is the point at which the objection stops being the
 * thing that kills consultations.
 *
 * Read-only. The one input it does not already have — "DM Present" — is marked
 * by the coach on the Today screen after the call, one tap, yes or no.
 */

import { parseIstSession } from './unmarked-outcomes.ts'

const DAY_MS = 86400000

/** How far back the figure looks. Two weeks is long enough to hold a solo
 *  coach's call volume and short enough that a habit change shows up in it. */
export const DM_PRESENCE_WINDOW_DAYS = 14

/** Where this is trying to get to, from a baseline near a third. */
export const DM_PRESENCE_TARGET_PCT = 70

/** One consultation, straight off the sheet, cells unparsed. */
export type PresenceRecord = {
  /** "Session Date" exactly as the sheet holds it: IST wall clock, no zone. */
  sessionDate: string
  /** "Showed" — Y once the call was held. */
  showed: string
  /** "DM Present" — yes / no, blank until the coach marks it. */
  dmPresent: string
}

export type PresenceRate = {
  /** Rounded percentage, or null when nothing in the window was marked. */
  pct: number | null
  /** Marked calls in the window — the sample the percentage is out of. */
  n: number
  yes: number
  /** Every held call in the window, marked or not. */
  held: number
  /** Held but not yet marked. The number that makes `n` trustworthy or not. */
  unmarked: number
}

const isHeld = (s: string) => /^(y|yes|true|1)$/i.test(String(s ?? '').trim())

/**
 * The rolling figure: of the calls held in the last fourteen days, how many
 * had the decision-maker on them.
 *
 * THE DENOMINATOR IS MARKED CALLS, NOT HELD CALLS. A held call with no answer
 * says nothing about who was on it, and counting it as a miss would show 20%
 * on a fortnight where he held ten calls, marked three and two were fine. A
 * number that moves when he forgets to tap is a number he stops believing, and
 * this one exists to be believed at 33% and again at 70%. The held and
 * unmarked counts come back alongside so the screen can admit how thin the
 * sample is rather than hiding it inside the percentage.
 *
 * Session dates are IST wall clock with no zone on them (see parseIstSession):
 * read in the runtime's timezone the same row is 5.5 hours out on the worker
 * versus a laptop, which moves calls in and out of the window at its edge.
 */
export function dmPresenceRate(
  records: readonly PresenceRecord[],
  nowMs: number,
  windowDays: number = DM_PRESENCE_WINDOW_DAYS,
): PresenceRate {
  const since = nowMs - windowDays * DAY_MS
  let held = 0
  let n = 0
  let yes = 0

  for (const r of records ?? []) {
    if (!isHeld(r?.showed ?? '')) continue
    const at = parseIstSession(String(r?.sessionDate ?? ''))
    // A held call whose date will not parse is dropped rather than counted at
    // epoch zero, where it would sit outside every window anyway but silently.
    if (at === null || at < since || at > nowMs) continue
    held++
    const marked = String(r?.dmPresent ?? '').trim().toLowerCase()
    if (marked === 'yes') { n++; yes++ }
    else if (marked === 'no') { n++ }
  }

  return {
    pct: n === 0 ? null : Math.round((yes / n) * 100),
    n,
    yes,
    held,
    unmarked: held - n,
  }
}

/**
 * The one line, written once and used by both the dashboard and the morning
 * brief so they can never quietly disagree about the same fortnight.
 * An em dash, not "0%", when nothing has been marked — no data is not zero.
 */
export function formatDmPresence(r: PresenceRate, windowDays: number = DM_PRESENCE_WINDOW_DAYS): string {
  const value = r.pct === null ? '–' : `${r.pct}%`
  return `Decision-maker present: ${value} (last ${windowDays} days, n=${r.n})`
}
