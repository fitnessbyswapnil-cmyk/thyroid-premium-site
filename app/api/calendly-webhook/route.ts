/**
 * app/api/calendly-webhook/route.ts
 *
 * Receives Calendly booking confirmations via webhook.
 * Fires Meta CAPI Schedule event with full user data.
 *
 * SETUP IN CALENDLY:
 *  1. Calendly → Integrations → Webhooks → New Webhook
 *  2. URL: https://swapnilumbarkarfitness.in/api/calendly-webhook
 *  3. Events: invitee.created
 *  4. Save the signing key in CALENDLY_WEBHOOK_SECRET env var
 *
 * WHY SERVER-SIDE SCHEDULE MATTERS:
 *  - iOS 14+ blocks browser Pixel heavily
 *  - A Schedule event from the server fires 100% of the time
 *  - Calendly gives us name + email = high EMQ
 *  - This is your highest-value Meta signal (completed call booking)
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  sendCAPIEvent,
  buildUserData,
  getClientIp,
  getUserAgent,
} from '@/lib/server-tracking'
import crypto from 'crypto'

const CALENDLY_SIGNING_SECRET = process.env.CALENDLY_WEBHOOK_SECRET

type CalendlyEvent = {
  event: 'invitee.created' | 'invitee.canceled'
  payload: {
    event_type: { name: string; uuid: string }
    event: { uri: string; start_time: string }
    invitee: {
      name: string
      email: string
      timezone: string
      uuid: string
      uri?: string
      questions_and_answers?: Array<{ question: string; answer: string }>
    }
    tracking: {
      utm_source?: string
      utm_medium?: string
      utm_campaign?: string
      utm_content?: string
      utm_term?: string
      salesforce_uuid?: string
    }
  }
  created_at: string
}

function verifyCalendlySignature(req: NextRequest, rawBody: string): boolean {
  if (!CALENDLY_SIGNING_SECRET) return true // skip if not configured
  const sig = req.headers.get('Calendly-Webhook-Signature') || ''
  // Calendly uses HMAC-SHA256 of "t=timestamp,v1=hmac"
  const parts = sig.split(',')
  const tPart = parts.find(p => p.startsWith('t='))
  const v1Part = parts.find(p => p.startsWith('v1='))
  if (!tPart || !v1Part) return false
  const ts = tPart.slice(2)
  const received = v1Part.slice(3)
  const toSign = `${ts}.${rawBody}`
  const computed = crypto.createHmac('sha256', CALENDLY_SIGNING_SECRET).update(toSign).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(received))
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    if (!verifyCalendlySignature(req, rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody) as CalendlyEvent

    if (body.event !== 'invitee.created') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    // Tolerate both Calendly payload shapes: v1-style (payload.invitee.*) and
    // v2-style (payload.* with the invitee URI at payload.uri).
    const p = body.payload as typeof body.payload & {
      uri?: string
      email?: string
      name?: string
      questions_and_answers?: Array<{ question: string; answer: string }>
    }
    const invitee  = p.invitee || ({} as typeof p.invitee)
    const tracking = p.tracking || {}
    const name     = invitee.name || p.name || ''
    const email    = invitee.email || p.email || ''
    const firstName = name.split(' ')[0] || ''
    const lastName  = name.split(' ').slice(1).join(' ') || ''

    // Try to extract phone from Q&A (either shape)
    const qa = invitee.questions_and_answers || p.questions_and_answers
    const phoneField = qa?.find(
      q => q.question.toLowerCase().includes('phone') || q.question.toLowerCase().includes('whatsapp')
    )
    const phone = phoneField?.answer || ''

    // Derive the invitee uuid from its URI (last path segment) so the event_id
    // matches what the browser computes → Pixel/CAPI Schedule deduplicates.
    const inviteeUri = invitee.uri || p.uri || ''
    const inviteeUuid = invitee.uuid || inviteeUri.split('/').filter(Boolean).pop() || ''

    // external_id = the SAME _visitor_id used across the whole funnel, passed to
    // Calendly as salesforce_uuid. Falls back to the invitee uuid only if missing.
    const externalId = tracking.salesforce_uuid || inviteeUuid

    const clientIp  = getClientIp(req)
    const userAgent = getUserAgent(req)

    const userData = buildUserData({
      email,
      phone,
      firstName,
      lastName,
      externalId,
      clientIp,
      userAgent,
      country: 'in',
    })

    const eventId = `Schedule_${inviteeUuid}`

    const result = await sendCAPIEvent('Schedule', {
      eventId,
      sourceUrl: 'https://www.swapnilumbarkarfitness.in/session-booked',
      userData,
      customData: {
        content_name: 'thyroid_strategy_call',
        ...(body.payload.event_type?.name ? { event_type: body.payload.event_type.name } : {}),
        ...(tracking.utm_source ? { utm_source: tracking.utm_source } : {}),
      },
      testCode: process.env.META_TEST_EVENT_CODE,
    })

    console.log('[calendly-webhook] Schedule CAPI result:', result)

    return NextResponse.json({ received: true, capi: result })
  } catch (err) {
    console.error('[calendly-webhook]', err)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
