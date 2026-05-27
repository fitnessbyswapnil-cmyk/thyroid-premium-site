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
} from '@/lib/server-tracking'
import crypto from 'crypto'
import { google } from 'googleapis'

const CASHFREE_SECRET = process.env.CASHFREE_WEBHOOK_SECRET || ''
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
function verifyCashfreeSignature(rawBody: string, timestamp: string, signature: string): boolean {
  if (!CASHFREE_SECRET) return true
  const computed = crypto
    .createHmac('sha256', CASHFREE_SECRET)
    .update(timestamp + rawBody)
    .digest('base64')
  return computed === signature
}

type CashfreeWebhook = {
  data: {
    order: {
      order_id: string
      order_amount: number
      order_currency: string
      order_status: string
      order_tags?: Record<string, string>  // custom metadata
    }
    payment: {
      payment_status: 'SUCCESS' | 'FAILED' | 'PENDING'
      payment_amount: number
      payment_method: string
      cf_payment_id: string
    }
    customer_details: {
      customer_name: string
      customer_email: string
      customer_phone: string
    }
  }
  type: 'PAYMENT_SUCCESS_WEBHOOK' | string
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-webhook-signature') || ''
    const timestamp = req.headers.get('x-webhook-timestamp') || ''

    if (!verifyCashfreeSignature(rawBody, timestamp, signature)) {
      console.error('[cashfree-webhook] Invalid signature — possible spoofing attempt')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody) as CashfreeWebhook

    if (body.data.payment.payment_status !== 'SUCCESS') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const customer = body.data.customer_details
    const order    = body.data.order
    const payment  = body.data.payment

    // Idempotency check — return 200 so Cashfree stops retrying
    if (processedOrders.has(order.order_id)) {
      console.log(`[cashfree-webhook] Duplicate order ${order.order_id} — skipping`)
      return NextResponse.json({ ok: true, duplicate: true })
    }
    processedOrders.add(order.order_id)

    // Extract attribution from order_tags (set when creating Cashfree session)
    const tags = order.order_tags || {}
    const fbc       = tags['fbc'] || ''
    const fbp       = tags['fbp'] || ''
    const visitorId = tags['visitor_id'] || ''

    const clientIp  = getClientIp(req)
    const userAgent = getUserAgent(req)

    const firstName = customer.customer_name.split(' ')[0] || ''
    const lastName  = customer.customer_name.split(' ').slice(1).join(' ') || ''

    const userData = buildUserData({
      email: customer.customer_email,
      phone: customer.customer_phone,
      firstName,
      lastName,
      externalId: visitorId,
      clientIp,
      userAgent,
      fbc,
      fbp,
      country: 'in',
    })

    const eventId = `Purchase_${order.order_id}`

    const result = await sendCAPIEvent('Purchase', {
      eventId,
      sourceUrl: 'https://www.swapnilumbarkarfitness.in/session-booked',
      userData,
      customData: {
        value: payment.payment_amount,
        currency: order.order_currency || 'INR',
        order_id: order.order_id,
        content_name: 'thyroid_session_fee',
        num_items: 1,
      },
      testCode: process.env.META_TEST_EVENT_CODE,
    })

    console.log('[cashfree-webhook] Purchase CAPI result:', result)

    // Write to Google Sheets — server-to-server, most reliable path
    try {
      await appendPaymentToSheet({
        orderId: order.order_id,
        name: customer.customer_name,
        phone: customer.customer_phone,
        email: customer.customer_email,
        amount: payment.payment_amount,
        currency: order.order_currency || 'INR',
        tags,
      })
      console.log('[cashfree-webhook] Sheets row written for order:', order.order_id)
    } catch (sheetsErr) {
      // Log but don't fail the webhook response — Cashfree must get 200
      console.error('[cashfree-webhook] Sheets write failed:', sheetsErr instanceof Error ? sheetsErr.message : String(sheetsErr))
    }

    return NextResponse.json({ received: true, capi: result })
  } catch (err) {
    console.error('[cashfree-webhook]', err)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
