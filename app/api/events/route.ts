/**
 * app/api/events/route.ts
 *
 * Generic browser-to-CAPI bridge endpoint.
 * The browser fires a Pixel event + simultaneously POSTs to this
 * endpoint so the server sends the same event via CAPI.
 * Both use the same event_id → Meta deduplicates automatically.
 *
 * POST /api/events
 * Body: { event_name, event_id, source_url, user_data, custom_data }
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  sendCAPIEvent,
  buildUserData,
  getClientIp,
  getUserAgent,
  getCookieFromReq,
} from '@/lib/server-tracking'

// Allowed events from browser.
// 'Schedule' is deliberately ABSENT: the Cal.com BOOKING_CREATED webhook
// (/api/cal-webhook) is the ONLY server-side Schedule sender, keyed
// schedule_<uid> to dedupe with the browser Pixel. Relaying Schedule here as
// well produced a second server event (with whatever event_id the caller
// chose), which Meta could not collapse — 2 server Schedules per booking.
const ALLOWED_EVENTS = new Set([
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      event_name: string
      event_id: string
      source_url: string
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

    const { event_name, event_id, source_url, user_data = {}, custom_data } = body

    // Validate
    if (event_name === 'Schedule') {
      // Explicit, loggable rejection so any legacy caller / GTM server tag
      // that still relays Schedule is visible in Vercel logs instead of
      // silently double-counting in Meta.
      console.warn(
        `[api/events] 409 — Schedule relay rejected (event_id=${event_id}); /api/cal-webhook is the sole server Schedule sender`,
      )
      return NextResponse.json(
        { error: 'Schedule is sent server-side only by /api/cal-webhook (event_id schedule_<uid>)' },
        { status: 409 },
      )
    }
    if (!ALLOWED_EVENTS.has(event_name)) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }
    if (!event_id || !source_url) {
      return NextResponse.json({ error: 'Missing event_id or source_url' }, { status: 400 })
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

    const testCode = process.env.META_TEST_EVENT_CODE

    const result = await sendCAPIEvent(event_name, {
      eventId: event_id,
      sourceUrl: source_url,
      userData,
      customData: custom_data as Record<string, unknown>,
      testCode,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('/api/events error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Simple GET health check
export async function GET() {
  return NextResponse.json({ ok: true })
}
