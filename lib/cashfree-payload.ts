/**
 * lib/cashfree-payload.ts
 *
 * Pure normalisation of Cashfree webhook payloads. NO side effects, no network,
 * no env — safe to unit-test and safe to import anywhere.
 *
 * Cashfree registers three webhook channels on separate dashboard tabs and each
 * sends a DIFFERENT payload shape:
 *   Payment Gateway → data.order.order_id + data.payment.payment_status
 *   Payment Link    → data.link_id + data.link_status
 *   Payment Form    → shape not yet observed in production
 *
 * Reading a nested field before establishing the shape is what made
 * /api/cashfree-webhook return HTTP 500 to Cashfree's Payment Link test — which
 * made Cashfree refuse to register the endpoint at all. Everything here reads
 * defensively and never assumes a branch exists.
 */

export type PaymentSource = 'ORDER' | 'LINK' | 'FORM'

export type NormalizedPayment = {
  source: PaymentSource
  refId: string   // order_id or link_id — idempotency key and Purchase event_id
  amount: number
  currency: string
  name: string
  email: string
  phone: string
  tags: Record<string, string>
}

/** Our refs are minted as `thyroid_<leadId>_<timestamp>` and leadIds themselves
 *  contain underscores (`quiz_1786…_ab12cd`), so a naive split() is wrong. */
export function parseLeadId(ref: string): string {
  return /^thyroid_(.+)_\d+$/.exec(ref ?? '')?.[1] ?? ''
}

export type Json = Record<string, unknown>

/** Safe object accessor — an absent or non-object value reads as {}. */
const obj = (v: unknown): Json => (v !== null && typeof v === 'object' ? (v as Json) : {})
/** Safe string accessor — null/undefined read as ''. */
const str = (v: unknown): string => (v == null ? '' : String(v))

export function detectSource(data: Json): PaymentSource | 'UNKNOWN' {
  if (str(obj(data.order).order_id)) return 'ORDER'
  if (data.link_id || data.link_status) return 'LINK'
  if (data.form_id || data.customer_details) return 'FORM'
  return 'UNKNOWN'
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(str(v))
  return Number.isFinite(n) ? n : fallback
}

/** Returns payment:null when the event is not a completed payment to act on. */
export function normalize(body: Json): { source: PaymentSource | 'UNKNOWN'; status: string; payment: NormalizedPayment | null } {
  const data = obj(body.data)
  const source = detectSource(data)
  if (source === 'UNKNOWN') return { source, status: '', payment: null }

  const cust = obj(data.customer_details)
  const common = {
    name: str(cust.customer_name),
    email: str(cust.customer_email),
    phone: str(cust.customer_phone),
  }

  if (source === 'ORDER') {
    const order = obj(data.order)
    const pay = obj(data.payment)
    const status = str(pay.payment_status)
    if (status !== 'SUCCESS') return { source, status, payment: null }
    return {
      source, status,
      payment: {
        source, ...common,
        refId: str(order.order_id),
        amount: num(pay.payment_amount, num(order.order_amount)),
        currency: str(order.order_currency) || 'INR',
        tags: obj(order.order_tags) as Record<string, string>,
      },
    }
  }

  if (source === 'LINK') {
    // PARTIALLY_PAID and EXPIRED are deliberately ignored — partial payment is
    // disabled on the account, and an expired link is not revenue.
    const status = str(data.link_status)
    if (status !== 'PAID') return { source, status, payment: null }
    return {
      source, status,
      payment: {
        source, ...common,
        refId: str(data.link_id),
        amount: num(data.link_amount_paid, num(data.link_amount)),
        currency: str(data.link_currency) || 'INR',
        // link_notes is the Payment Links equivalent of order_tags. Unverified
        // against live payloads, so treat an absent value as empty rather than
        // relying on it — leadId is recovered from refId regardless.
        tags: obj(data.link_notes ?? data.order_tags) as Record<string, string>,
      },
    }
  }

  // FORM — shape unconfirmed. Log it rather than guess at a payment.
  return { source, status: str(obj(data.payment).payment_status) || str(data.status), payment: null }
}
