/**
 * lib/browser-events.ts — the logic behind POST /api/events, the generic
 * browser-to-CAPI bridge. app/api/events/route.ts is a thin wrapper around
 * handleBrowserEvent() so that the unit tests can run the real handler with a
 * real Request (lib/pageview-beacon.test.ts), which a route file importing
 * `next/server` and `@/` paths cannot do under `node --test`.
 *
 * The browser fires its Pixel event and POSTs the same event here; the server
 * sends it via CAPI with the same event_id, and Meta keeps one of the two.
 *
 * Body: { event_name, event_id, source_url, user_data?, custom_data? }
 *
 * Its main caller is the PageView beacon (lib/pageview-beacon.ts), one per
 * document on the production host. PageView therefore gets two extra rules here:
 * its event_id must have the GTM variable's `pv_` shape, and its source_url is
 * trimmed to fbclid / utm_* before it reaches Meta (see below). Nothing here
 * touches Google Sheets: this runs on every page load, and a page view is not
 * a lead.
 *
 * Every send goes through sendCAPIEvent, so through the D1 ledger's
 * exactly-once path: a `pv_` id that already reached Meta is not sent again.
 */
// Explicit .ts extensions: the test runner resolves ESM paths literally, and
// none of these modules load anything Cloudflare- or Next-specific at import.
import {
  sendCAPIEvent,
  buildUserData,
  getClientIp,
  getUserAgent,
  getCookieFromReq,
  getTestEventCode,
} from './server-tracking.ts'
import { isTrackingHost, isTrackingUrl, PRODUCTION_HOST } from './tracking-host.ts'
import { redactSourceUrl } from './ledger.ts'
import { isPageViewEventId } from './pageview-beacon.ts'

// Allowed events from browser.
// 'Schedule' is deliberately ABSENT: the Cal.com BOOKING_CREATED webhook
// (/api/cal-webhook) is the ONLY server-side Schedule sender, keyed
// schedule_<uid> to dedupe with the browser Pixel. Relaying Schedule here as
// well produced a second server event (with whatever event_id the caller
// chose), which Meta could not collapse — 2 server Schedules per booking.
export const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'Lead',
  'StartForm',
  'CTAClick',
  'WhatsAppClick',
  'InitiateCheckout',
  'AddPaymentInfo',
  'SessionQualified',
  'Engagement',
  'ScrollDepth',
])

/**
 * Both ends of the request must be the production host.
 *
 * Until 19-Sep-2026 this endpoint validated the event NAME and nothing else.
 * `source_url` was checked for presence, never parsed, and passed straight to
 * Meta as `event_source_url`; no Origin, Referer or Host was read; there was no
 * auth and no rate limit. Any caller anywhere could inject a Lead or an
 * InitiateCheckout into the live dataset with an arbitrary source URL — and
 * legitimately, every Vercel preview deployment did exactly that, because
 * "same-origin" on a preview IS the preview host.
 *
 * Checking both matters. The request host stops a preview or workers.dev
 * deployment relaying its own traffic; the source_url stops an off-host caller
 * reaching the production endpoint and claiming a production URL.
 */
export function rejectOffHost(req: Request, sourceUrl: string): string | null {
  const requestHost = req.headers.get('host')
  if (!isTrackingHost(requestHost)) {
    return `request host ${requestHost ?? '(none)'} is not ${PRODUCTION_HOST}`
  }
  // Origin is absent on same-origin POSTs in some browsers, so it is only
  // checked when present — an origin that IS sent and is wrong is a real signal.
  const origin = req.headers.get('origin')
  if (origin && !isTrackingUrl(origin)) {
    return `origin ${origin} is not ${PRODUCTION_HOST}`
  }
  if (!isTrackingUrl(sourceUrl)) {
    return `source_url ${sourceUrl} is not on ${PRODUCTION_HOST}`
  }
  return null
}

type BrowserEventBody = {
  event_name?: unknown
  event_id?: unknown
  source_url?: unknown
  user_data?: {
    email?: string
    phone?: string
    first_name?: string
    last_name?: string
    city?: string
    external_id?: string
  }
  custom_data?: Record<string, unknown>
}

export type BrowserEventResult = { status: number; body: unknown }

export async function handleBrowserEvent(req: Request): Promise<BrowserEventResult> {
  try {
    let parsed: unknown
    try {
      // The PageView beacon posts a string, which sendBeacon labels text/plain.
      // The body is parsed as JSON whatever the content type says.
      parsed = await req.json()
    } catch {
      return { status: 400, body: { error: 'Invalid JSON' } }
    }
    if (!parsed || typeof parsed !== 'object') {
      return { status: 400, body: { error: 'Invalid body' } }
    }
    const { event_name, event_id, source_url, user_data = {}, custom_data } = parsed as BrowserEventBody

    // Validate
    if (event_name === 'Schedule') {
      // Explicit, loggable rejection so any legacy caller / GTM server tag
      // that still relays Schedule is visible in the logs instead of
      // silently double-counting in Meta.
      console.warn(
        `[api/events] 409 — Schedule relay rejected (event_id=${String(event_id)}); /api/cal-webhook is the sole server Schedule sender`,
      )
      return {
        status: 409,
        body: { error: 'Schedule is sent server-side only by /api/cal-webhook (event_id schedule_<uid>)' },
      }
    }
    if (typeof event_name !== 'string' || !ALLOWED_EVENTS.has(event_name)) {
      return { status: 400, body: { error: 'Invalid event' } }
    }
    if (typeof event_id !== 'string' || !event_id || typeof source_url !== 'string' || !source_url) {
      return { status: 400, body: { error: 'Missing event_id or source_url' } }
    }
    // A PageView pairs with web GTM tag 75 only through the `pv_` id the GTM
    // variable mints. Any other id could never be deduplicated, so it is
    // refused rather than counted as a lone server PageView.
    if (event_name === 'PageView' && !isPageViewEventId(event_id)) {
      return { status: 400, body: { error: 'PageView event_id must be pv_<ms>_<rand>' } }
    }

    const offHost = rejectOffHost(req, source_url)
    if (offHost) {
      console.warn(`[api/events] 403 — ${offHost} (event=${event_name} id=${event_id})`)
      return { status: 403, body: { error: 'Forbidden host' } }
    }

    const clientIp = getClientIp(req)
    const userAgent = getUserAgent(req)
    const fbc = getCookieFromReq(req, '_fbc')
    const fbp = getCookieFromReq(req, '_fbp')
    const visitorId = getCookieFromReq(req, '_visitor_id')

    const userData = buildUserData({
      email: user_data.email,
      phone: user_data.phone,
      firstName: user_data.first_name,
      lastName: user_data.last_name,
      city: user_data.city,
      externalId: user_data.external_id || visitorId,
      clientIp,
      userAgent,
      fbc,
      fbp,
      country: 'in',
    })

    // PageView's source_url is location.href taken while the HTML is still
    // parsing, so before any page has tidied its own address bar.
    // /booking-confirmed, for one, arrives as ?uid=…&name=…&date=…&time= and
    // only strips that once React runs; the browser pixel, which loads later,
    // never sees it. Meta gets the page with fbclid / utm_* only, the same
    // trimming the ledger applies to what it stores.
    const eventSourceUrl = event_name === 'PageView' ? redactSourceUrl(source_url) : source_url

    // Per browser, never global: only the owner's own short-lived test cookie
    // turns a send into a Test Events send (lib/test-event-cookie.ts). This
    // route used to read META_TEST_EVENT_CODE, which would have sent every
    // visitor's PageView to Test Events for as long as the env var was set.
    const testCode = getTestEventCode(req)

    const result = await sendCAPIEvent(event_name, {
      eventId: event_id,
      sourceUrl: eventSourceUrl,
      userData,
      customData: custom_data as Record<string, unknown>,
      ...(testCode ? { testCode } : {}),
    })

    return { status: 200, body: result }
  } catch (err) {
    console.error('/api/events error:', err)
    return { status: 500, body: { error: 'Internal error' } }
  }
}
