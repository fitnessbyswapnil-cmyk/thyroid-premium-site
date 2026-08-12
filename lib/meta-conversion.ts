/**
 * lib/meta-conversion.ts — SERVER-ONLY. The programme sale → Meta CAPI.
 *
 * WHY THIS EXISTS
 * The funnel already tells Meta about the ₹299 consultation (Purchase, fired by
 * the Cashfree webhook). It has never told Meta about the sale that actually
 * pays for the business: the ₹20,000 three-month programme, which closes on a
 * call hours or days later and touches no web page at all. Meta has therefore
 * been optimising for people who buy a ₹299 call — not for people who become
 * clients. Those are different audiences.
 *
 * WHY A SEPARATE EVENT NAME (not a second Purchase)
 * Purchase is reserved for the ₹299 consultation. Sending the programme as a
 * second Purchase would double the purchase COUNT per customer and wreck
 * cost-per-purchase — the number the ad account is judged on. 'Subscribe' is a
 * STANDARD Meta event (so it supports value optimisation, custom conversions
 * and value-based lookalikes, which arbitrary custom events support poorly),
 * and semantically it is what a paid coaching programme is.
 *
 * ATTRIBUTION
 * The close happens offline, so there is no cookie to read. Match quality comes
 * entirely from what the sheet stored when she first clicked the ad: fbclid,
 * visitor id, phone, email, name, city. deriveFbc() reconstitutes the _fbc
 * cookie Meta needs to tie the sale back to the exact ad click.
 */
import {
  buildUserData,
  sendCAPIEvent,
  PLACEHOLDER_EMAIL,
  type CAPIResult,
  // Explicit .ts extension: `node --experimental-strip-types` (the test runner)
  // resolves ESM paths literally and cannot infer it. tsconfig has
  // allowImportingTsExtensions, and the bundler resolves the exact file.
} from './server-tracking.ts'

/** Standard event used for the paid programme. See header for why not Purchase. */
export const PROGRAM_EVENT_NAME = 'Subscribe'
export const PROGRAM_CONTENT_NAME = 'thyroid_3month_program'

/** Meta rejects events whose event_time is more than 7 days old. */
export const MAX_EVENT_AGE_SECONDS = 7 * 24 * 60 * 60

// ── Pure helpers (unit-tested in meta-conversion.test.ts) ────────────────────

/**
 * Google Sheets returns a numeric-looking phone as "9078165199.0". Feeding that
 * straight to hashPhone() strips only the dot and hashes "90781651990" — an
 * 11-digit number that matches nobody, silently destroying the match. Normalise
 * to the last 10 digits first.
 */
export function normalizeSheetPhone(raw: string): string {
  const digits = String(raw ?? '').replace(/\.0+$/, '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : ''
}

/**
 * Meta matches an ad click on the _fbc cookie, formatted
 * `fb.1.<clickUnixMs>.<fbclid>`. The sheet sometimes holds a full fbc (the quiz
 * captured the cookie) and sometimes a bare fbclid (captured from the URL).
 * Accept either; build the cookie form when only the raw id is present.
 */
export function deriveFbc(stored: string, clickTimeMs: number): string {
  const v = String(stored ?? '').trim()
  if (!v) return ''
  if (/^fb\.\d\.\d+\..+/.test(v)) return v // already in cookie form
  const ts = Number.isFinite(clickTimeMs) && clickTimeMs > 0 ? Math.floor(clickTimeMs) : Date.now()
  return `fb.1.${ts}.${v}`
}

export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = String(full ?? '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  }
}

/**
 * Resolve the event_time Meta will accept.
 *
 * Backfilling old wins is the obvious first instinct ("send my last six
 * closes"), and Meta silently rejects anything older than 7 days. Report that
 * rather than let the caller believe a rejected event landed.
 */
export function resolveEventTime(
  closedAtMs: number | undefined,
  nowMs: number,
): { eventTime: number; tooOld: boolean } {
  const nowS = Math.floor(nowMs / 1000)
  if (!closedAtMs || !Number.isFinite(closedAtMs) || closedAtMs <= 0) {
    return { eventTime: nowS, tooOld: false }
  }
  const closedS = Math.floor(closedAtMs / 1000)
  if (closedS > nowS) return { eventTime: nowS, tooOld: false } // clock skew / future date
  if (nowS - closedS > MAX_EVENT_AGE_SECONDS) {
    // Send it anyway at the oldest accepted time so the signal is not lost,
    // but tell the caller the timestamp was moved.
    return { eventTime: nowS - MAX_EVENT_AGE_SECONDS + 60, tooOld: true }
  }
  return { eventTime: closedS, tooOld: false }
}

/** Deterministic id → a re-send for the same lead dedupes inside Meta. */
export function programEventId(seed: string): string {
  return `program_${String(seed ?? '').trim() || 'unknown'}`
}

// ── Send ─────────────────────────────────────────────────────────────────────

export type ProgramConversionInput = {
  /** Stable per-lead identifier; falls back to the sheet row number. */
  seed: string
  amount: number
  currency?: string
  name?: string
  phone?: string
  email?: string
  city?: string
  /** Raw fbclid OR a full fb.1.* cookie value, as stored in the sheet. */
  fbclid?: string
  fbp?: string
  visitorId?: string
  /** When she first clicked the ad — used to build fbc. Lead timestamp is fine. */
  leadCreatedAtMs?: number
  /** When the sale actually closed. Defaults to now. */
  closedAtMs?: number
}

export type ProgramConversionResult = CAPIResult & {
  eventId: string
  eventName: string
  eventTime: number
  timestampAdjusted: boolean
  /** Which strong identifiers we managed to attach — visible in the dashboard. */
  matchKeys: string[]
}

export async function sendProgramConversion(
  input: ProgramConversionInput,
  nowMs: number = Date.now(),
): Promise<ProgramConversionResult> {
  const { firstName, lastName } = splitName(input.name ?? '')
  const phone = normalizeSheetPhone(input.phone ?? '')
  // A shared placeholder address hashes identically for every lead and poisons
  // match quality — the same rule the Cashfree webhook follows.
  const email =
    input.email && input.email.trim().toLowerCase() !== PLACEHOLDER_EMAIL ? input.email.trim() : undefined
  const fbc = deriveFbc(input.fbclid ?? '', input.leadCreatedAtMs ?? 0)

  const userData = buildUserData({
    email,
    phone: phone || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    city: input.city || undefined,
    externalId: input.visitorId || undefined,
    fbc: fbc || undefined,
    fbp: input.fbp || undefined,
    country: 'in',
  })

  const matchKeys = (['em', 'ph', 'fn', 'ln', 'ct', 'external_id', 'fbc', 'fbp'] as const).filter(
    (k) => !!userData[k],
  )

  const { eventTime, tooOld } = resolveEventTime(input.closedAtMs, nowMs)
  const eventId = programEventId(input.seed)
  const currency = input.currency || 'INR'

  const result = await sendCAPIEvent(PROGRAM_EVENT_NAME, {
    eventId,
    userData,
    // The sale closes on the consultation call, not on a web page.
    actionSource: 'phone_call',
    eventTime,
    customData: {
      value: input.amount,
      currency,
      content_name: PROGRAM_CONTENT_NAME,
      content_category: 'coaching_program',
      // Meta's value models read predicted_ltv when present; for a fixed-term
      // programme the paid amount IS the realised value.
      predicted_ltv: input.amount,
      num_items: 1,
    },
    testCode: process.env.META_TEST_EVENT_CODE,
  })

  return {
    ...result,
    eventId,
    eventName: PROGRAM_EVENT_NAME,
    eventTime,
    timestampAdjusted: tooOld,
    matchKeys,
  }
}
