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

const CASHFREE_SECRET = process.env.CASHFREE_WEBHOOK_SECRET || ''

function verifyCashfreeSignature(rawBody: string, signature: string): boolean {
  if (!CASHFREE_SECRET) return true
  const computed = crypto
    .createHmac('sha256', CASHFREE_SECRET)
    .update(rawBody)
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

    if (!verifyCashfreeSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody) as CashfreeWebhook

    if (body.data.payment.payment_status !== 'SUCCESS') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const customer = body.data.customer_details
    const order    = body.data.order
    const payment  = body.data.payment

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

    return NextResponse.json({ received: true, capi: result })
  } catch (err) {
    console.error('[cashfree-webhook]', err)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
