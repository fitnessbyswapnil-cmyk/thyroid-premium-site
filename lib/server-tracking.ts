/**
 * lib/server-tracking.ts  — SERVER-SIDE Meta CAPI utilities
 *
 * Use from:
 *  - app/api/events/route.ts     (generic event endpoint)
 *  - app/api/tally-webhook/route.ts
 *  - app/api/calendly-webhook/route.ts
 *  - app/api/cashfree-webhook/route.ts
 *
 * NEVER import this in client components — it has no 'use client'
 * directive and reads server-only environment variables.
 */

import crypto from 'crypto'

// ── Config ──────────────────────────────────────────────────────
const PIXEL_ID   = process.env.META_PIXEL_ID!         // e.g. 123456789
const ACCESS_TOKEN = process.env.META_CAPI_TOKEN!     // Meta System User token
const CAPI_VERSION = 'v19.0'
const CAPI_URL = `https://graph.facebook.com/${CAPI_VERSION}/${PIXEL_ID}/events`

// ── Types ────────────────────────────────────────────────────────

export type UserData = {
  em?: string          // hashed email
  ph?: string          // hashed phone
  fn?: string          // hashed first name
  ln?: string          // hashed last name
  ct?: string          // hashed city
  st?: string          // hashed state/region
  zp?: string          // hashed zip
  country?: string     // hashed country code (2-letter)
  external_id?: string // hashed visitor_id / custom ID
  client_ip_address?: string
  client_user_agent?: string
  fbc?: string         // _fbc cookie value (NOT hashed)
  fbp?: string         // _fbp cookie value (NOT hashed)
  lead_id?: string     // Meta Lead ID (if using Lead Ads)
}

export type EventData = {
  currency?: string
  value?: number
  content_name?: string
  content_category?: string
  content_ids?: string[]
  num_items?: number
  predicted_ltv?: number
  order_id?: string
  [key: string]: unknown
}

export type CAPIEvent = {
  event_name: string
  event_id: string
  event_time: number      // Unix timestamp
  event_source_url: string
  action_source: 'website'
  user_data: UserData
  custom_data?: EventData
  opt_out?: boolean
  data_processing_options?: string[]
  data_processing_options_country?: number
  data_processing_options_state?: number
}

// ── SHA-256 Hashing ──────────────────────────────────────────────

export function hashValue(value: string): string {
  if (!value) return ''
  return crypto
    .createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex')
}

export function hashPhone(phone: string): string {
  if (!phone) return ''
  // Normalize: digits only, include country code
  const digits = phone.replace(/\D/g, '')
  // Add 91 prefix for India if 10 digits
  const normalized = digits.length === 10 ? `91${digits}` : digits
  return hashValue(normalized)
}

// ── User Data Builder ────────────────────────────────────────────
// Takes RAW (unhashed) values and hashes them.
// fbc/fbp are NOT hashed per Meta spec.

export function buildUserData(raw: {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  externalId?: string
  clientIp?: string
  userAgent?: string
  fbc?: string
  fbp?: string
}): UserData {
  const ud: UserData = {}

  if (raw.email)      ud.em = hashValue(raw.email)
  if (raw.phone)      ud.ph = hashPhone(raw.phone)
  if (raw.firstName)  ud.fn = hashValue(raw.firstName)
  if (raw.lastName)   ud.ln = hashValue(raw.lastName)
  if (raw.city)       ud.ct = hashValue(raw.city)
  if (raw.state)      ud.st = hashValue(raw.state)
  if (raw.zip)        ud.zp = hashValue(raw.zip)
  if (raw.country)    ud.country = hashValue(raw.country || 'in')
  if (raw.externalId) ud.external_id = hashValue(raw.externalId)
  if (raw.clientIp)   ud.client_ip_address = raw.clientIp  // NOT hashed
  if (raw.userAgent)  ud.client_user_agent = raw.userAgent  // NOT hashed
  if (raw.fbc)        ud.fbc = raw.fbc   // NOT hashed
  if (raw.fbp)        ud.fbp = raw.fbp   // NOT hashed

  return ud
}

// ── Send to Meta CAPI ────────────────────────────────────────────

export type CAPIResult = {
  success: boolean
  events_received?: number
  error?: string
  raw?: unknown
}

export async function sendToCAPI(
  events: CAPIEvent[],
  testEventCode?: string
): Promise<CAPIResult> {
  try {
    const body: Record<string, unknown> = {
      data: events,
    }
    if (testEventCode) {
      body.test_event_code = testEventCode
    }

    const res = await fetch(CAPI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    })

    const json = await res.json() as { events_received?: number; error?: { message: string } }

    if (!res.ok) {
      console.error('[CAPI] Error:', json)
      return { success: false, error: json?.error?.message || 'Unknown', raw: json }
    }

    return { success: true, events_received: json.events_received, raw: json }
  } catch (err) {
    console.error('[CAPI] Fetch error:', err)
    return { success: false, error: String(err) }
  }
}

// ── Convenience: send single event ──────────────────────────────

export async function sendCAPIEvent(
  eventName: string,
  opts: {
    eventId: string
    sourceUrl: string
    userData: UserData
    customData?: EventData
    testCode?: string
  }
): Promise<CAPIResult> {
  const event: CAPIEvent = {
    event_name: eventName,
    event_id: opts.eventId,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: opts.sourceUrl,
    action_source: 'website',
    user_data: opts.userData,
    ...(opts.customData ? { custom_data: opts.customData } : {}),
  }

  return sendToCAPI([event], opts.testCode)
}

// ── IP extraction from Request ───────────────────────────────────

export function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||  // Cloudflare
    req.headers.get('x-real-ip') ||          // Nginx
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    ''
  )
}

export function getUserAgent(req: Request): string {
  return req.headers.get('user-agent') || ''
}

// ── Cookie extraction from Request ──────────────────────────────

export function getCookieFromReq(req: Request, name: string): string {
  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}
