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
import { writeLeadRow } from '@/lib/lead-sheet'
import { sendBookingConfirmation } from '@/lib/whatsapp'

const CASHFREE_SECRET = process.env.CASHFREE_WEBHOOK_SECRET || ''

// Best-effort in-memory idempotency guard — prevents double-processing within
// the same serverless instance. Does not survive cold starts; the payment_status
// check below is the durable guard for cross-instance duplicates.
const processedOrders = new Set<string>()

/**
 * Record the payment ON THE LEAD'S EXISTING ROW.
 *
 * This used to append a brand-new row, which meant every paying customer
 * appeared twice in the Leads sheet — once from the quiz, once from the
 * webhook — with no link between them. That inflated the lead count, broke the
 * booked-% denominator, and made "did this lead pay?" unanswerable per row.
 *
 * writeLeadRow() already does update-or-append keyed on the pinned Email
 * column and refuses to touch the reserved Booking columns (17/18) owned by
 * the Cal.com Make scenario, so payment reuses that proven path rather than
 * hand-rolling a second writer.
 *
 * Status (col Q) is intentionally left alone: it is createOnly because a live
 * lifecycle scenario filters on it, so payment lands in dedicated Paid columns.
 */
async function recordPaymentOnLeadRow(data: {
  orderId: string
  name: string
  phone: string
  email: string
  amount: number
  currency: string
  tags: Record<string, string>
}) {
  // The placeholder address is shared by every lead who paid without giving a
  // real email, so matching on it would stamp one woman's payment onto an
  // unrelated row. Better an honest orphan row than corrupted data.
  const matchable = data.email && data.email !== PLACEHOLDER_EMAIL ? data.email : ''

  const result = await writeLeadRow({
    email: matchable,
    name: data.name,
    phone: data.phone,
    paid: 'Y',
    paidAmount: String(data.amount),
    paidOrderId: data.orderId,
    // Only meaningful when no existing row matched and we append a fresh one.
    ...(matchable ? {} : { status: `payment_received_orphan|${data.amount}${data.currency}` }),
    ...(data.tags['visitor_id'] ? { visitor_id: data.tags['visitor_id'] } : {}),
    ...(data.tags['utm_source'] ? { utm_source: data.tags['utm_source'] } : {}),
    ...(data.tags['utm_medium'] ? { utm_medium: data.tags['utm_medium'] } : {}),
    ...(data.tags['utm_campaign'] ? { utm_campaign: data.tags['utm_campaign'] } : {}),
  })

  console.log(
    `[cashfree-webhook] payment recorded order=${data.orderId} action=${result.action}` +
      (result.rowNumber ? ` row=${result.rowNumber}` : '') +
      (result.addedHeaders.length ? ` newColumns=${result.addedHeaders.join(',')}` : '') +
      (matchable ? '' : ' (ORPHAN — no real email to match on)'),
  )
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

    // Never send the Cashfree placeholder email to Meta — omit em entirely so a
    // uniform fake hash doesn't poison match quality across all purchases.
    const realEmail =
      customer.customer_email && customer.customer_email !== PLACEHOLDER_EMAIL
        ? customer.customer_email
        : undefined

    const userData = buildUserData({
      email: realEmail,
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
      await recordPaymentOnLeadRow({
        orderId: order.order_id,
        name: customer.customer_name,
        phone: customer.customer_phone,
        email: customer.customer_email,
        amount: payment.payment_amount,
        currency: order.order_currency || 'INR',
        tags,
      })
    } catch (sheetsErr) {
      // Log but don't fail the webhook response — Cashfree must get 200
      console.error('[cashfree-webhook] Sheets write failed:', sheetsErr instanceof Error ? sheetsErr.message : String(sheetsErr))
    }

    // Half of everyone who pays never picks a call slot — the money is spent
    // and no consultation happens. This template is the recovery path, and it
    // has to go out while the payment confirmation is still on her screen.
    //
    // Deliberately after the CAPI + sheet work and never awaited into the
    // response path: Cashfree must receive its 200 regardless, and a WhatsApp
    // outage must never look like a failed payment notification.
    try {
      const waResult = await sendBookingConfirmation(customer.customer_phone, customer.customer_name)
      console.log(
        `[cashfree-webhook] booking_confirmation order=${order.order_id} sent=${waResult.sent}` +
          (waResult.skipped ? ` skipped=${waResult.skipped}` : '') +
          (waResult.error ? ` error=${waResult.error}` : ''),
      )
    } catch (waErr) {
      console.error('[cashfree-webhook] booking_confirmation threw (swallowed):', waErr)
    }

    return NextResponse.json({ received: true, capi: result })
  } catch (err) {
    console.error('[cashfree-webhook]', err)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
