/**
 * app/api/cal-webhook/route.ts
 *
 * Cal.com booking webhook → Meta CAPI "Schedule" (the ad optimization event).
 * Sole booking webhook (the legacy predecessor route was removed).
 *
 * SETUP IN CAL.COM:
 *  1. Cal.com → Settings → Developer → Webhooks → New
 *  2. Subscriber URL: https://swapnilumbarkarfitness.in/api/cal-webhook
 *  3. Event triggers: "Booking created"
 *  4. Secret → CAL_WEBHOOK_SECRET env var (Vercel). Cal.com signs the raw body
 *     with HMAC-SHA256 and sends it as the `x-cal-signature-256` header.
 *
 * DEDUP: the event_id is `schedule_<payload.uid>` — the SAME id the browser
 * Pixel pushes from the Cal.com embed bookingSuccessful callback — so Meta
 * collapses the browser + server Schedule into one.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  sendCAPIEvent,
  buildUserData,
  getClientIp,
  getUserAgent,
  getCookieFromReq,
} from '@/lib/server-tracking'
import crypto from 'crypto'

const CAL_WEBHOOK_SECRET = process.env.CAL_WEBHOOK_SECRET

// The real confirmation surface (the Cal.com embed is inline on /session-booked;
// there is no /call-booked/ redirect).
const SOURCE_URL = 'https://www.swapnilumbarkarfitness.in/session-booked'

// Best-effort in-memory idempotency. Serverless instances are ephemeral, so the
// real dedup guarantee is Meta's event_id matching — this just avoids obvious
// same-instance double-sends (e.g. Cal.com webhook retries).
const processedUids = new Set<string>()

type CalWebhook = {
  triggerEvent?: string
  payload?: {
    uid?: string
    title?: string
    startTime?: string
    attendees?: Array<{ name?: string; email?: string; phoneNumber?: string }>
    responses?: Record<string, { value?: unknown } | undefined>
  }
}

function verifyCalSignature(rawBody: string, signature: string): boolean {
  if (!CAL_WEBHOOK_SECRET) return true // skip only if not configured
  if (!signature) return false
  const computed = crypto
    .createHmac('sha256', CAL_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
  } catch {
    return false
  }
}

function responseValue(
  responses: Record<string, { value?: unknown } | undefined> | undefined,
  key: string,
): string {
  const v = responses?.[key]?.value
  return typeof v === 'string' ? v : ''
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-cal-signature-256') || ''

    if (!verifyCalSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody) as CalWebhook

    if (body.triggerEvent !== 'BOOKING_CREATED') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const payload = body.payload || {}
    const uid = payload.uid || ''
    if (!uid) {
      return NextResponse.json({ ok: true, skipped: 'no uid' })
    }

    if (processedUids.has(uid)) {
      return NextResponse.json({ ok: true, deduped: true })
    }
    processedUids.add(uid)

    const attendee = payload.attendees?.[0] || {}
    const name = attendee.name || responseValue(payload.responses, 'name') || ''
    const email = attendee.email || responseValue(payload.responses, 'email') || ''
    const phone =
      attendee.phoneNumber ||
      responseValue(payload.responses, 'phone') ||
      responseValue(payload.responses, 'attendeePhoneNumber') ||
      responseValue(payload.responses, 'smsReminderNumber') ||
      ''
    const firstName = name.split(' ')[0] || ''
    const lastName = name.split(' ').slice(1).join(' ') || ''

    // Cal.com is server-to-server: no browser cookies for fbp. We still pass any
    // _fbc/_fbp that happen to ride along (usually absent here) + ip/ua. The
    // browser-leg Pixel carries the strong fbp/fbc match; this leg carries
    // hashed email/phone — together they give high EMQ on the deduped Schedule.
    const userData = buildUserData({
      email,
      phone,
      firstName,
      lastName,
      externalId: uid,
      clientIp: getClientIp(req),
      userAgent: getUserAgent(req),
      fbc: getCookieFromReq(req, '_fbc'),
      fbp: getCookieFromReq(req, '_fbp'),
      country: 'in',
    })

    const result = await sendCAPIEvent('Schedule', {
      eventId: `schedule_${uid}`, // SAME id as the browser Pixel → Meta dedup
      sourceUrl: SOURCE_URL,
      userData,
      customData: { content_name: 'thyroid_strategy_call' },
      testCode: process.env.META_TEST_EVENT_CODE,
    })

    console.log('[cal-webhook] Schedule CAPI result:', result)
    return NextResponse.json({ received: true, capi: result })
  } catch (err) {
    console.error('[cal-webhook]', err)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
