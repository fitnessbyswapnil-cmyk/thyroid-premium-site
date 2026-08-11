/**
 * app/api/cashfree-webhook/route.ts
 *
 * Receives Cashfree payment confirmation webhooks.
 * Fires Meta CAPI Purchase event.
 *
 * CASHFREE SETUP:
 *  1. Cashfree Dashboard → Developers → Webhooks
 *  2. URL: https://swapnilumbarkarfitness.in/api/cashfree-webhook
 *  3. Events: PAYMENT_SUCCESS
 *  4. Secret key → CASHFREE_WEBHOOK_SECRET env var
 *
 * IMPORTANT: Also configure "Return URL" in your Cashfree form to:
 *   https://www.swapnilumbarkarfitness.in/session-booked?
 *   payment_ref={order_id}&status={payment_status}
 *   (append visitor_id, session_id, fbclid if using custom payment session)
 *
 * WHY THIS MATTERS:
 *  - The session fee payment is your highest-value signal
 *  - Purchase CAPI fires even with browser tracking blocked
 *  - Enables Meta to optimize for paying leads, not just form fills
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  sendCAPIEvent,
  buildUserData,
  getClientIp,
  getUserAgent,
  PLACEHOLDER_EMAIL,
} from '@/lib/server-tracking'
import crypto from 'crypto'
import { normalize, parseLeadId, type Json } from '@/lib/cashfree-payload'
import { google } from 'googleapis'

const CASHFREE_SECRET = process.env.CASHFREE_WEBHOOK_SECRET || ''
// Cashfree registers Payment Gateway, Payment Link and Payment Form webhooks on
// three separate tabs, each of which may issue its own signing secret. Falls back
// to the gateway secret when unset so nothing breaks before the others are added.
const CASHFREE_LINK_SECRET = process.env.CASHFREE_LINK_WEBHOOK_SECRET || CASHFREE_SECRET
const LEADS_SHEET_NAME = 'Leads'

// Best-effort in-memory idempotency guard — prevents double-processing within
// the same serverless instance. Does not survive cold starts; the payment_status
// check below is the durable guard for cross-instance duplicates.
const processedOrders = new Set<string>()

async function appendPaymentToSheet(data: {
  orderId: string
  name: string
  phone: string
  email: string
  amount: number
  currency: string
  tags: Record<string, string>
}) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const sheetId = process.env.GOOGLE_SHEETS_ID

  console.log('[cashfree-webhook] Sheets env check:', {
    hasEmail: !!email,
    hasKey: !!key,
    keyLength: key?.length ?? 0,
    keyValid: key?.startsWith('-----BEGIN') ?? false,
    hasSheetId: !!sheetId,
  })

  if (!email || !key || !sheetId) {
    console.error('[cashfree-webhook] Missing Google Sheets env vars — cannot write row')
    return
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  const sheets = google.sheets({ version: 'v4', auth })

  // Row matches "Leads" tab column order:
  // Timestamp | Lead ID | Name | Phone | Email | Age | Thyroid Condition |
  // Weight Struggles | Energy Level | Biggest Frustration | Main Goal |
  // UTM Source | UTM Medium | UTM Campaign | FBclid | Visitor ID | Status
  const row = [
    new Date().toISOString(),       // Timestamp
    data.orderId,                   // Lead ID (order_id as proxy)
    data.name,                      // Name
    data.phone,                     // Phone
    data.email,                     // Email
    '',                             // Age
    '',                             // Thyroid Condition
    '',                             // Weight Struggles
    '',                             // Energy Level
    '',                             // Biggest Frustration
    '',                             // Main Goal
    data.tags['utm_source'] || '',  // UTM Source
    data.tags['utm_medium'] || '',  // UTM Medium
    data.tags['utm_campaign'] || '',// UTM Campaign
    data.tags['fbc'] || '',         // FBclid
    data.tags['visitor_id'] || '',  // Visitor ID
    `payment_received|${data.amount}${data.currency}`, // Status
  ]

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${LEADS_SHEET_NAME}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })

  console.log('[cashfree-webhook] Sheets append status:', response.status, response.data?.updates)
}

// Cashfree signature: HMAC-SHA256(timestamp + rawBody), base64-encoded.
// timestamp = x-webhook-timestamp header value.
// Accepts EITHER the gateway secret or the link/form secret — the three webhook
// channels are registered separately and may not share one.
function verifyCashfreeSignature(rawBody: string, timestamp: string, signature: string): boolean {
  if (!CASHFREE_SECRET) return true
  const secrets = CASHFREE_LINK_SECRET === CASHFREE_SECRET
    ? [CASHFREE_SECRET]
    : [CASHFREE_SECRET, CASHFREE_LINK_SECRET]
  return secrets.some((secret) => {
    const computed = crypto.createHmac('sha256', secret).update(timestamp + rawBody).digest('base64')
    return computed === signature
  })
}

// Cashfree pings this when validating an endpoint, and it makes the route
// trivially reachable for uptime checks.
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  // EVERY path below returns 200 except a genuine signature failure. A 500 here
  // makes Cashfree retry indefinitely AND blocks endpoint registration outright
  // — its "Test & Add" button refuses to save an endpoint that errors.
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-webhook-signature') || ''
    const timestamp = req.headers.get('x-webhook-timestamp') || ''

    if (!verifyCashfreeSignature(rawBody, timestamp, signature)) {
      console.error('[cashfree-webhook] Invalid signature — possible spoofing attempt')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let body: Json = {}
    try {
      body = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      console.error('[cashfree-webhook] Unparseable body:', rawBody.slice(0, 1000))
      return NextResponse.json({ ok: true, ignored: 'unparseable' })
    }

    const { source, status, payment } = normalize(body)

    if (source === 'UNKNOWN') {
      console.warn('[cashfree-webhook] Unrecognised payload shape:', JSON.stringify(body).slice(0, 2000))
      return NextResponse.json({ ok: true, ignored: 'unknown_shape' })
    }

    if (!payment) {
      console.log(`[cashfree-webhook] ${source} event with status "${status || 'n/a'}" — no action`)
      return NextResponse.json({ ok: true, source, status, skipped: true })
    }

    if (!payment.refId) {
      console.error(`[cashfree-webhook] ${source} success with no reference id — cannot process`)
      return NextResponse.json({ ok: true, ignored: 'no_ref' })
    }

    // Idempotency — return 200 so Cashfree stops retrying
    if (processedOrders.has(payment.refId)) {
      console.log(`[cashfree-webhook] Duplicate ${source} ${payment.refId} — skipping`)
      return NextResponse.json({ ok: true, duplicate: true })
    }
    processedOrders.add(payment.refId)

    const leadId = parseLeadId(payment.refId)

    // Attribution rides along in order_tags (gateway) / link_notes (links).
    const tags      = payment.tags || {}
    const fbc       = tags['fbc'] || ''
    const fbp       = tags['fbp'] || ''
    const visitorId = tags['visitor_id'] || ''

    if (source === 'LINK' && !visitorId) {
      // Not fatal — Meta still matches on phone/email — but it degrades match
      // quality, so make it visible rather than letting attribution rot quietly.
      console.warn(`[cashfree-webhook] LINK ${payment.refId} carried no visitor_id (leadId=${leadId || 'unparsed'})`)
    }

    const clientIp  = getClientIp(req)
    const userAgent = getUserAgent(req)

    const firstName = payment.name.split(' ')[0] || ''
    const lastName  = payment.name.split(' ').slice(1).join(' ') || ''

    // Never send the Cashfree placeholder email to Meta — omit it entirely so a
    // uniform fake hash doesn't poison match quality across all purchases.
    const realEmail =
      payment.email && payment.email !== PLACEHOLDER_EMAIL ? payment.email : undefined

    const userData = buildUserData({
      email: realEmail,
      phone: payment.phone,
      firstName,
      lastName,
      externalId: visitorId,
      clientIp,
      userAgent,
      fbc,
      fbp,
      country: 'in',
    })

    // event_id stays keyed on the reference so the browser Purchase leg
    // deduplicates against it exactly as it does today.
    const eventId = `Purchase_${payment.refId}`

    const result = await sendCAPIEvent('Purchase', {
      eventId,
      sourceUrl: 'https://www.swapnilumbarkarfitness.in/session-booked',
      userData,
      customData: {
        value: payment.amount,
        currency: payment.currency,
        order_id: payment.refId,
        content_name: 'thyroid_session_fee',
        num_items: 1,
      },
      testCode: process.env.META_TEST_EVENT_CODE,
    })

    console.log(`[cashfree-webhook] ${source} Purchase CAPI result:`, result)

    // Write to Google Sheets — server-to-server, most reliable path
    try {
      await appendPaymentToSheet({
        orderId: payment.refId,
        name: payment.name,
        phone: payment.phone,
        email: payment.email,
        amount: payment.amount,
        currency: payment.currency,
        tags,
      })
      console.log(`[cashfree-webhook] Sheets row written for ${source}:`, payment.refId)
    } catch (sheetsErr) {
      // Log but don't fail the webhook response — Cashfree must get 200
      console.error('[cashfree-webhook] Sheets write failed:', sheetsErr instanceof Error ? sheetsErr.message : String(sheetsErr))
    }

    return NextResponse.json({ received: true, source, leadId, capi: result })
  } catch (err) {
    // Last-resort net. Deliberately 200: a 500 blocks Cashfree registration and
    // triggers retry storms. The log is the alert.
    console.error('[cashfree-webhook] UNCAUGHT — returning 200 to avoid retry storm:', err)
    return NextResponse.json({ ok: true, error: 'handled' })
  }
}
