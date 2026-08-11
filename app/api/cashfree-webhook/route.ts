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
import { sendBookingConfirmation } from '@/lib/whatsapp'
import {
  colLetter,
  findLeadRowNumber,
  planPaymentColumns,
  MATCH_COLUMNS,
  RESERVED_INDEXES,
} from '@/lib/lead-sheet'
import { google } from 'googleapis'

const CASHFREE_SECRET = process.env.CASHFREE_WEBHOOK_SECRET || ''
// Cashfree registers Payment Gateway, Payment Link and Payment Form webhooks on
// three separate tabs, each of which may issue its own signing secret. Falls back
// to the gateway secret when unset so nothing breaks before the others are added.
const CASHFREE_LINK_SECRET = process.env.CASHFREE_LINK_WEBHOOK_SECRET || CASHFREE_SECRET
const LEADS_SHEET_NAME = 'Leads'
// Status lives at column Q (16) — the lifecycle automations match it by index.
const STATUS_COLUMN = 16

// Best-effort in-memory idempotency guard — prevents double-processing within
// the same serverless instance. Does not survive cold starts; the payment_status
// check below is the durable guard for cross-instance duplicates.
const processedOrders = new Set<string>()

/**
 * Record a payment against the lead's EXISTING row.
 *
 * This used to append a brand-new row, which produced two unlinked rows per
 * paying customer: the quiz lead, and a payment row keyed by order_id. The
 * dashboard counted both as leads and had no per-lead way to show who paid.
 *
 * Now: locate the lead by Lead ID → phone → email, update Status in place, and
 * stamp Paid / Paid Amount / Paid At. Only appends when no lead can be matched,
 * and marks that row as orphaned so it is obvious in the sheet.
 *
 * Never writes columns 17/18 — those belong to the Cal.com → Sheets scenario.
 */
type PaymentRecordResult = 'updated' | 'already_paid' | 'orphan_appended' | 'failed'

async function recordPaymentInSheet(data: {
  refId: string
  leadId: string
  name: string
  phone: string
  email: string
  amount: number
  currency: string
  tags: Record<string, string>
}): Promise<PaymentRecordResult> {
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const sheetId = process.env.GOOGLE_SHEETS_ID

  if (!svcEmail || !key || !sheetId) {
    console.error('[cashfree-webhook] Missing Google Sheets env vars — cannot record payment')
    return 'failed'
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: svcEmail, private_key: key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  const statusValue = `payment_received|${data.amount}${data.currency}`
  const paidAt = new Date().toISOString()

  // Header + the three match columns, in one batched read.
  const [headerRes, colsRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${LEADS_SHEET_NAME}!1:1` }),
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      majorDimension: 'COLUMNS',
      ranges: [
        `${LEADS_SHEET_NAME}!${colLetter(MATCH_COLUMNS.leadId)}:${colLetter(MATCH_COLUMNS.leadId)}`,
        `${LEADS_SHEET_NAME}!${colLetter(MATCH_COLUMNS.phone)}:${colLetter(MATCH_COLUMNS.phone)}`,
        `${LEADS_SHEET_NAME}!${colLetter(MATCH_COLUMNS.email)}:${colLetter(MATCH_COLUMNS.email)}`,
      ],
    }),
  ])

  const header = (headerRes.data.values?.[0] ?? []).map((c) => String(c ?? ''))
  const ranges = colsRes.data.valueRanges ?? []
  const col = (i: number) => (ranges[i]?.values?.[0] ?? []).map((c) => String(c ?? ''))

  const rowNumber = findLeadRowNumber({
    leadIds: col(0),
    phones: col(1),
    emails: col(2),
    leadId: data.leadId,
    phone: data.phone,
    email: data.email,
    placeholderEmail: PLACEHOLDER_EMAIL,
  })

  const PAID_COLS = ['Paid', 'Paid Amount', 'Paid At', 'Payment Ref']
  const plan = planPaymentColumns(header, PAID_COLS)

  // Write any appended headers first so the data cells land under real titles.
  if (plan.newHeaders.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${LEADS_SHEET_NAME}!1:1`,
      valueInputOption: 'RAW',
      requestBody: { values: [plan.header] },
    })
  }

  const paidCells: Record<string, string> = {
    Paid: 'Y',
    'Paid Amount': String(data.amount),
    'Paid At': paidAt,
    'Payment Ref': data.refId,
  }

  if (rowNumber) {
    // Durable duplicate guard: if this lead's row is already stamped Paid, a
    // second webhook for the same payment (e.g. the gateway AND the link
    // channel both firing) must not re-send Purchase to Meta.
    const paidIndex = plan.indexes['Paid']
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${LEADS_SHEET_NAME}!${rowNumber}:${rowNumber}`,
    })
    const existingRow = (existing.data.values?.[0] ?? []).map((c) => String(c ?? ''))
    if ((existingRow[paidIndex] ?? '').trim().toUpperCase() === 'Y') {
      console.log(`[cashfree-webhook] Lead row ${rowNumber} already marked Paid — not re-recording (ref=${data.refId})`)
      return 'already_paid'
    }

    const cells: { index: number; value: string }[] = [
      { index: STATUS_COLUMN, value: statusValue },
      ...PAID_COLS.map((t) => ({ index: plan.indexes[t], value: paidCells[t] })),
    ].filter((c) => !RESERVED_INDEXES.has(c.index))

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: cells.map((c) => ({
          range: `${LEADS_SHEET_NAME}!${colLetter(c.index)}${rowNumber}`,
          values: [[c.value]],
        })),
      },
    })
    console.log(`[cashfree-webhook] Payment recorded on existing lead row ${rowNumber} (ref=${data.refId})`)
    return 'updated'
  }

  // No matching lead — append, clearly marked, so it is visible rather than lost.
  console.warn(`[cashfree-webhook] No lead row matched for ref=${data.refId} leadId=${data.leadId || 'n/a'} — appending orphan row`)

  const width = plan.header.length
  const row = new Array<string>(width).fill('')
  row[0] = paidAt
  row[MATCH_COLUMNS.leadId] = data.leadId || data.refId
  row[2] = data.name
  row[MATCH_COLUMNS.phone] = data.phone
  row[MATCH_COLUMNS.email] = data.email
  row[STATUS_COLUMN] = `${statusValue}|orphan`
  for (const t of PAID_COLS) {
    const i = plan.indexes[t]
    if (!RESERVED_INDEXES.has(i)) row[i] = paidCells[t]
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${LEADS_SHEET_NAME}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })
  return 'orphan_appended'
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
      // Log the FULL body, not a summary. Cashfree's Payment Form payload shape
      // is still unobserved in production, and a summary line can never reveal
      // it — which is exactly how it stayed unknown through two registrations.
      console.log(
        `[cashfree-webhook] ${source} event, status "${status || 'n/a'}" — no action. Body: ` +
          JSON.stringify(body).slice(0, 4000),
      )
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

    // Record in the sheet FIRST. The in-memory guard above dies on cold start,
    // and now that the Payment Link and Payment Form channels are registered
    // alongside the gateway, one payment could arrive twice with two different
    // reference ids (order_id AND link_id) — which the ref-keyed guard cannot
    // catch. A lead row already stamped Paid is the durable guard, and it is
    // the difference between accurate Purchase counts in Meta and inflated ones.
    let sheetResult: PaymentRecordResult = 'failed'
    try {
      sheetResult = await recordPaymentInSheet({
        refId: payment.refId,
        leadId,
        name: payment.name,
        phone: payment.phone,
        email: payment.email,
        amount: payment.amount,
        currency: payment.currency,
        tags,
      })
    } catch (sheetsErr) {
      // Fail OPEN: a Sheets outage must never cost us a Purchase event.
      console.error('[cashfree-webhook] Sheets payment record failed:', sheetsErr instanceof Error ? sheetsErr.message : String(sheetsErr))
    }

    if (sheetResult === 'already_paid') {
      console.log(`[cashfree-webhook] ${source} ${payment.refId} — lead already marked paid, skipping Purchase CAPI`)
      return NextResponse.json({ ok: true, duplicate: true, source, leadId })
    }

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

    console.log(`[cashfree-webhook] ${source} Purchase CAPI result:`, result, `sheet=${sheetResult}`)

    // Tell her the payment landed and hand her straight to Cal.com. This is the
    // fix for the ~50% of payers who previously paid and never booked.
    // Deliberately last, and fully swallowed: Cashfree must receive its 200
    // regardless, and a WhatsApp outage must never look like a failed payment.
    // Guarded by sheetResult so a duplicate webhook can never double-message her
    // — the 'already_paid' branch above returns before reaching this point.
    try {
      const waResult = await sendBookingConfirmation(payment.phone, payment.name)
      console.log(
        `[cashfree-webhook] booking_confirmation ${source} ref=${payment.refId} sent=${waResult.sent}` +
          (waResult.skipped ? ` skipped=${waResult.skipped}` : '') +
          (waResult.error ? ` error=${waResult.error}` : ''),
      )
    } catch (waErr) {
      console.error('[cashfree-webhook] booking_confirmation threw (swallowed):', waErr)
    }

    return NextResponse.json({ received: true, source, leadId, sheet: sheetResult, capi: result })
  } catch (err) {
    // Last-resort net. Deliberately 200: a 500 blocks Cashfree registration and
    // triggers retry storms. The log is the alert.
    console.error('[cashfree-webhook] UNCAUGHT — returning 200 to avoid retry storm:', err)
    return NextResponse.json({ ok: true, error: 'handled' })
  }
}
