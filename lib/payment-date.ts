/**
 * lib/payment-date.ts — PURE, and safe to import from a client component.
 *
 * WHY THIS EXISTS
 * A programme sale closes on a call and gets marked on the dashboard whenever
 * the coach next opens it — sometimes days later. Until now the mark carried no
 * date at all, so Meta was told the sale happened at the moment of the tap. A
 * close marked five days late was attributed to the wrong day, and a close
 * marked eight days late was the one Meta would have refused outright.
 *
 * The date therefore has to be editable, and the screen has to say — before the
 * tap, not after — when the chosen date has aged out of Meta's window. That
 * check lives here rather than in lib/meta-conversion.ts because that module is
 * server-only (it reaches for the CAPI credentials on import) and pulling it
 * into the dashboard bundle would ship them nowhere useful and cost the worker
 * its size budget.
 *
 * The seven days below therefore DUPLICATE MAX_EVENT_AGE_SECONDS. The two are
 * pinned together by a test in payment-date.test.ts so the warning can never
 * quietly drift away from the rule it is warning about.
 */

/** Meta refuses an event whose event_time is older than this. */
export const META_ATTRIBUTION_WINDOW_DAYS = 7

const DAY_MS = 86400000

/** A Date → the "YYYY-MM-DD" an <input type="date"> wants, in LOCAL calendar
 *  terms. toISOString() would hand back the UTC day, which for the coach is
 *  yesterday for the first five and a half hours of every morning. */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * "YYYY-MM-DD" → the local start of that day, or null if it is not a real date.
 *
 * Local midnight, not UTC midnight: the age of the payment has to be counted in
 * the same calendar the coach picked it from. Local midnight is also always in
 * the past for today, so marking a sale at 9am never hands Meta a future
 * event_time.
 *
 * Date roll-over makes "2026-02-31" a silently valid Date (2026-03-03), so the
 * parsed components are compared back against the input.
 */
export function parseDateInputValue(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim())
  if (!m) return null
  const [, y, mo, d] = m
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null
  return dt.getTime()
}

export type PaymentDateStatus = {
  /** Parses, and is not in the future. Only a valid date may be submitted. */
  valid: boolean
  /** The coach picked a day that has not happened yet. */
  future: boolean
  /** Older than Meta's window — the sale still gets sent, but attribution is
   *  no longer reliable. Warn, do not block. */
  stale: boolean
  /** Local start of the chosen day, for the caller to send as an ISO string. */
  ms: number | null
}

/**
 * What the screen should say about a chosen payment date.
 *
 * `stale` uses the same "more than 7 × 24h before now" comparison the server
 * applies, so the warning appears exactly when the server would flag the event
 * — never a day early, never a day late.
 */
export function paymentDateStatus(value: string, nowMs: number): PaymentDateStatus {
  const ms = parseDateInputValue(value)
  if (ms === null) return { valid: false, future: false, stale: false, ms: null }
  if (ms > nowMs) return { valid: false, future: true, stale: false, ms }
  const stale = nowMs - ms > META_ATTRIBUTION_WINDOW_DAYS * DAY_MS
  return { valid: true, future: false, stale, ms }
}
