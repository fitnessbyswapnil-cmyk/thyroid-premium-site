/**
 * app/api/tally-webhook/route.ts
 *
 * Receives Tally form submission webhooks.
 * Tally sends a POST with form field data.
 *
 * SETUP IN TALLY:
 *  1. Open form → Integrations → Webhooks
 *  2. URL: https://swapnilumbarkarfitness.in/api/tally-webhook
 *  3. Enable "Include hidden fields"
 *
 * HIDDEN FIELDS TO ADD IN TALLY (as URL query params on the embed URL):
 *  fbclid, fbp, fbc, session_id, visitor_id, event_id, utm_source,
 *  utm_medium, utm_campaign, utm_content, utm_term
 *
 * TALLY WEBHOOK PAYLOAD (simplified):
 *  {
 *    "eventId": "...",
 *    "createdAt": "...",
 *    "data": {
 *      "fields": [
 *        { "key": "name", "label": "Full name", "value": "Priya" },
 *        { "key": "email", "label": "Email", "value": "priya@..." },
 *        { "key": "phone", "label": "Phone", "value": "+91..." },
 *        { "key": "fbclid", "label": "fbclid", "value": "..." },
 *        ...
 *      ]
 *    }
 *  }
 *
 * WHY THIS IS THE MOST IMPORTANT SERVER EVENT:
 *  - Tally form is where users submit name, email, phone
 *  - This is the ONLY place we get real PII for advanced matching
 *  - CAPI Lead fired here with hashed PII = highest EMQ score
 *  - Server-side fires even if browser blocks Pixel (iOS 14+)
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  sendCAPIEvent,
  buildUserData,
  getCookieFromReq,
  getClientIp,
  getUserAgent,
} from '@/lib/server-tracking'

// Optional: verify Tally webhook signature
const TALLY_SIGNING_SECRET = process.env.TALLY_SIGNING_SECRET

type TallyField = { key: string; label: string; value: string | null }
type TallyPayload = {
  eventId: string
  createdAt: string
  data: { fields: TallyField[] }
}

function fieldValue(fields: TallyField[], key: string): string {
  return fields.find(f => f.key === key)?.value?.toString() || ''
}

export async function POST(req: NextRequest) {
  try {
    // Optional signature check
    if (TALLY_SIGNING_SECRET) {
      const signature = req.headers.get('tally-signature') || ''
      const rawBody = await req.text()
      const crypto = await import('crypto')
      const expected = crypto
        .createHmac('sha256', TALLY_SIGNING_SECRET)
        .update(rawBody)
        .digest('hex')
      if (signature !== `sha256=${expected}`) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      const body = JSON.parse(rawBody) as TallyPayload
      return await processSubmission(req, body)
    }

    const body = (await req.json()) as TallyPayload
    return await processSubmission(req, body)
  } catch (err) {
    console.error('[tally-webhook]', err)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

async function processSubmission(req: NextRequest, body: TallyPayload) {
  const fields = body.data?.fields || []

  const email    = fieldValue(fields, 'email') || fieldValue(fields, 'Email')
  const phone    = fieldValue(fields, 'phone') || fieldValue(fields, 'Phone') || fieldValue(fields, 'whatsapp')
  const name     = fieldValue(fields, 'name')  || fieldValue(fields, 'Name')
  const firstName = name.split(' ')[0] || ''
  const lastName  = name.split(' ').slice(1).join(' ') || ''

  // Attribution params passed as hidden fields
  const fbc        = fieldValue(fields, 'fbc')  || getCookieFromReq(req, '_fbc')
  const fbp        = fieldValue(fields, 'fbp')  || getCookieFromReq(req, '_fbp')
  const visitorId  = fieldValue(fields, 'visitor_id') || getCookieFromReq(req, '_visitor_id')
  const sessionId  = fieldValue(fields, 'session_id')
  const eventId    = fieldValue(fields, 'event_id') || `Lead_tally_${body.eventId}`
  const utmSource  = fieldValue(fields, 'utm_source')

  const clientIp   = getClientIp(req)
  const userAgent  = getUserAgent(req)

  const userData = buildUserData({
    email,
    phone,
    firstName,
    lastName,
    externalId: visitorId,
    clientIp,
    userAgent,
    fbc,
    fbp,
    country: 'in',
  })

  const customData = {
    content_name: 'thyroid_consultation',
    content_category: 'lead',
    ...(utmSource ? { utm_source: utmSource } : {}),
  }

  // Fire Generate_Lead CAPI event
  const result = await sendCAPIEvent('Lead', {
    eventId,
    sourceUrl: 'https://www.swapnilumbarkarfitness.in/case-studies',
    userData,
    customData,
    testCode: process.env.META_TEST_EVENT_CODE,
  })

  console.log('[tally-webhook] Lead CAPI result:', result)

  // Persist name/email/phone to a session store or trigger CRM here if needed

  return NextResponse.json({ received: true, capi: result })
}
