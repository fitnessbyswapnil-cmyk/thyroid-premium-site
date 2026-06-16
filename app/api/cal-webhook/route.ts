/**
 * app/api/cal-webhook/route.ts
 *
 * Cal.com booking webhook → Meta CAPI "Schedule" (the ad optimization event).
 * Sole booking webhook (the legacy predecessor route was removed).
 *
 * SETUP IN CAL.COM:
 *  1. Cal.com → Settings → Developer → Webhooks → New
 *  2. Subscriber URL: https://www.swapnilumbarkarfitness.in/api/cal-webhook
 *  3. Event triggers: "Booking created"
 *  4. Secret → CAL_WEBHOOK_SECRET env var (Vercel). Cal.com signs the raw body
 *     with HMAC-SHA256 and sends it as the `x-cal-signature-256` header. The
 *     Vercel value MUST equal the secret entered on the Cal.com webhook.
 *
 * DEDUP: the event_id is `schedule_<payload.uid>` — the SAME id the browser
 * Pixel pushes from the Cal.com embed bookingSuccessful callback — so Meta
 * collapses the browser + server Schedule into one.
 *
 * DELIVERY CONTRACT (why Cal.com was logging "failed" before):
 *  - The ONLY non-2xx this route returns is 401, and ONLY on a genuine
 *    signature mismatch. Cal.com retries non-2xx and shows them as failed, so
 *    once a request is accepted (signature ok / unconfigured) we ALWAYS return
 *    200 — even for unknown triggers, missing uid, malformed JSON, or a failed
 *    Meta CAPI call. A Meta outage must never make Cal.com mark delivery failed.
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

type SignatureResult = 'valid' | 'mismatch' | 'unconfigured'

/**
 * Verify Cal.com's HMAC-SHA256 over the RAW request body.
 * - rawBody must be the exact bytes received (await req.text()), NOT a
 *   re-serialized parse — re-stringifying changes key order/whitespace and
 *   breaks the HMAC.
 * - Explicit length check before timingSafeEqual (which throws on unequal
 *   length) so a malformed header is a clean 'mismatch', not an exception.
 */
function verifyCalSignature(rawBody: string, signature: string): SignatureResult {
  if (!CAL_WEBHOOK_SECRET) return 'unconfigured'
  if (!signature) return 'mismatch'
  const computed = crypto
    .createHmac('sha256', CAL_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')
  const a = Buffer.from(computed, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return 'mismatch'
  return crypto.timingSafeEqual(a, b) ? 'valid' : 'mismatch'
}

function responseValue(
  responses: Record<string, { value?: unknown } | undefined> | undefined,
  key: string,
): string {
  const v = responses?.[key]?.value
  return typeof v === 'string' ? v : ''
}

export async function POST(req: NextRequest) {
  // ── 1. Read the raw body ONCE — required to HMAC the exact signed bytes ──
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch (err) {
    // Can't read the body → can't verify or process. Don't 500 (Cal.com would
    // retry forever); acknowledge so it stops.
    console.error('[cal-webhook] 200 — could not read request body', err)
    return NextResponse.json({ ok: true, skipped: 'unreadable body' })
  }

  const signature = req.headers.get('x-cal-signature-256') || ''

  // Invocation log — proves whether Cal.com is hitting this endpoint at all,
  // independent of signature/trigger outcome below.
  console.log(`[cal-webhook] invoked — bytes=${rawBody.length} signaturePresent=${!!signature}`)

  // ── 2. Signature — the ONLY path allowed to return a non-2xx ──
  const sig = verifyCalSignature(rawBody, signature)
  if (sig === 'mismatch') {
    console.warn('[cal-webhook] 401 — signature mismatch (check CAL_WEBHOOK_SECRET matches the Cal.com webhook secret)')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  if (sig === 'unconfigured') {
    console.warn('[cal-webhook] CAL_WEBHOOK_SECRET is not set — skipping signature verification. Set it in Vercel to secure this endpoint.')
  }

  // ── 3. From here we ALWAYS return 200 so Cal.com never marks it failed ──
  let body: CalWebhook
  try {
    body = JSON.parse(rawBody) as CalWebhook
  } catch {
    console.warn('[cal-webhook] 200 — accepted but body was not valid JSON; nothing to do')
    return NextResponse.json({ ok: true, skipped: 'invalid json' })
  }

  const trigger = body.triggerEvent || ''
  if (trigger !== 'BOOKING_CREATED') {
    // PING (webhook test), BOOKING_CANCELLED, etc. — acknowledge, don't process.
    console.log(`[cal-webhook] 200 — ignored trigger=${trigger || 'none'}`)
    return NextResponse.json({ ok: true, skipped: trigger || 'no trigger' })
  }

  const payload = body.payload || {}
  const uid = payload.uid || ''
  if (!uid) {
    console.warn('[cal-webhook] 200 — BOOKING_CREATED with no uid; cannot key Schedule for dedup')
    return NextResponse.json({ ok: true, skipped: 'no uid' })
  }

  if (processedUids.has(uid)) {
    console.log(`[cal-webhook] 200 — deduped (same instance) uid=${uid}`)
    return NextResponse.json({ ok: true, deduped: true })
  }
  processedUids.add(uid)

  // ── 4. Send the Schedule CAPI event — isolated so a Meta failure can NEVER
  //        bubble a 500 back to Cal.com (sendCAPIEvent already returns instead
  //        of throwing, but the try/catch guarantees it for any future change) ──
  try {
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

    const eventId = `schedule_${uid}`
    const testCode = process.env.META_TEST_EVENT_CODE
    console.log(
      `[cal-webhook] BOOKING_CREATED — sending Schedule CAPI: trigger=${trigger} uid=${uid} event_id=${eventId} test_event_code=${testCode || '(unset)'}`,
    )

    const result = await sendCAPIEvent('Schedule', {
      eventId, // SAME id as the browser Pixel → Meta dedup
      sourceUrl: SOURCE_URL,
      userData,
      customData: { content_name: 'thyroid_strategy_call' },
      testCode,
    })

    // Full Meta CAPI response (status implied by success + the raw body), so the
    // Vercel logs show whether the Schedule was accepted by Meta.
    console.log(
      `[cal-webhook] 200 — Schedule CAPI result uid=${uid} event_id=${eventId} success=${result.success} events_received=${result.events_received ?? 0}` +
        (result.error ? ` error=${result.error}` : '') +
        ` response=${JSON.stringify(result.raw ?? null)}`,
    )
    return NextResponse.json({ received: true, capi: result })
  } catch (err) {
    // Schedule send failed unexpectedly — log, but still 200 so Cal.com is happy.
    console.error(`[cal-webhook] 200 — Schedule send threw (swallowed) uid=${uid}`, err)
    return NextResponse.json({ received: true, capi: { success: false, error: String(err) } })
  }
}
