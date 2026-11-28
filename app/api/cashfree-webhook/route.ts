/**
 * app/api/cashfree-webhook/route.ts
 *
 * Records Cashfree payments. Every payment is a PROGRAMME payment.
 *
 * The 60-minute consultation is free (owner decision, 28-Nov-2026), so there
 * is no consultation fee for a payment to be. Whatever reaches this route — a
 * hosted payment form (`thyroid` ₹5,000, `PersonalizThyroid_Fat_Loss_Blueprint`
 * ₹15,000), one of his payment links, or an API order — is written to:
 *   - her Leads row: Status, Paid, Paid Amount, Paid At, Payment Ref;
 *   - the D1 payments ledger (lib/ledger recordPayment).
 * And nothing else. No event goes to Meta from here: the programme sale reaches
 * Meta as Purchase only when he marks it in Today (/api/admin/mark,
 * lib/meta-conversion). No WhatsApp goes to her from here either.
 *
 * Until 28-Nov this route sent every payment down the ₹299 fee flow: a
 * MicroPurchase to Meta for the paid amount and payment_receipt_v2 ("choose
 * your consultation slot"). So a programme fee paid through a hosted form
 * reached Meta as a full-amount consultation fee, and the client who paid it
 * was asked to pick a consultation slot. Nothing is sent to correct events
 * already sent: Meta events are never offset.
 *
 * A programme fee paid in parts is ADDED up on her row (lib/payment-row): on
 * 23-Nov one client paid ₹15,000 and then ₹5,000, and her Paid Amount must
 * read ₹20,000, not the last part. Paid At and Status describe the latest
 * payment; Payment Ref lists every reference on the row. A replay of any of
 * them, or the same payment arriving on a second webhook channel, is not
 * added again.
 *
 * How lib/metrics counts what this writes: it classifies Paid Amount, not this
 * route. ₹15,000 and over is programme revenue and a win; ₹300–₹14,999 is
 * "other payments" until her total reaches ₹15,000 or he marks the sale in
 * Today (whether a lone part-payment should count is an open question for the
 * owner, recorded at PROGRAMME_MIN_AMOUNT); ₹299 and under lands on the "₹299
 * fees" line (never revenue), where the historical consultation fees live — a
 * new one can only be a ₹1 test form or a leftover ₹299 order.
 *
 * Logs: a reference can carry her phone number, so every ref goes through
 * refForLog and every logged payload through redactForLog (lib/cashfree-log).
 *
 * CASHFREE SETUP:
 *  1. Cashfree Dashboard → Developers → Webhooks (Payment Gateway, Payment
 *     Links and Payment Forms each register it on their own tab)
 *  2. URL: https://www.swapnilumbarkarfitness.in/api/cashfree-webhook
 *  3. Events: payment success
 *  4. Secret key → CASHFREE_WEBHOOK_SECRET (and CASHFREE_LINK_WEBHOOK_SECRET
 *     when the link/form tab issues its own)
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { getLedgerDb, recordPayment } from '@/lib/ledger'
import { PLACEHOLDER_EMAIL } from '@/lib/server-tracking'
import crypto from 'crypto'
import { normalize, parseLeadId, type Json } from '@/lib/cashfree-payload'
import {
  colLetter,
  ensureGridColumns,
  findLeadRowNumber,
  planPaymentColumns,
  MATCH_COLUMNS,
  RESERVED_INDEXES,
} from '@/lib/lead-sheet'
import { headerAppendRefusal, headerCellWrites, LEADS_MIN_WIDTH } from '@/lib/header-cells'
import { planPaidRow, refCellValue } from '@/lib/payment-row'
import { maskText, redactForLog, refForLog } from '@/lib/cashfree-log'
import { google } from 'googleapis'
import { googleClientOptions } from '@/lib/google-fetch'

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
    clientOptions: googleClientOptions,
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
  // Each missing header is ONE cell past the last column (lib/header-cells),
  // never a rewrite of row 1: writing the whole row back is how a short read
  // overwrote four live headers on 24-Sep. The grid has a fixed width, so it
  // is widened first or the write fails with "exceeds grid limits".
  //
  // "Past the last column" is only as good as the read. A header read that is
  // narrower than the tab, or a target column that already holds data, means
  // the indexes are wrong, so nothing is written to the sheet at all and the
  // payment is left to the ledger, which still records it below.
  if (plan.newHeaders.length > 0) {
    const titles = plan.newHeaders.map((h) => h.title).join(', ')
    const refuse = (why: string): PaymentRecordResult => {
      console.error(`[cashfree-webhook] NOT appending header(s) ${titles}: ${why}. Payment not written to the sheet (ref=${refForLog(data.refId)}).`)
      return 'failed'
    }
    const tooNarrow = headerAppendRefusal({ headerLength: header.length, minWidth: LEADS_MIN_WIDTH, newHeaders: plan.newHeaders })
    if (tooNarrow) return refuse(tooNarrow)

    const widest = Math.max(...plan.newHeaders.map((h) => h.index))
    await ensureGridColumns(sheets, sheetId, LEADS_SHEET_NAME, widest)
    const targets = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      majorDimension: 'COLUMNS',
      ranges: plan.newHeaders.map((h) => `${LEADS_SHEET_NAME}!${colLetter(h.index)}:${colLetter(h.index)}`),
    })
    const occupied = headerAppendRefusal({
      headerLength: header.length,
      minWidth: LEADS_MIN_WIDTH,
      newHeaders: plan.newHeaders,
      targetColumns: plan.newHeaders.map((_, k) => targets.data.valueRanges?.[k]?.values?.[0] ?? []),
    })
    if (occupied) return refuse(occupied)

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: headerCellWrites(LEADS_SHEET_NAME, plan.newHeaders),
      },
    })
    console.log(`[cashfree-webhook] appended header cell(s): ${plan.newHeaders.map((h) => `${colLetter(h.index)}1 ${h.title}`).join(', ')}`)
  }

  // This payment alone, on a fresh or orphan row. On a row that already holds
  // a payment, Paid Amount becomes her running total and Payment Ref the list
  // of every reference on the row (lib/payment-row).
  const paidCells: Record<string, string> = {
    Paid: 'Y',
    'Paid Amount': String(data.amount),
    'Paid At': paidAt,
    'Payment Ref': refCellValue(data.refId),
  }

  if (rowNumber) {
    // Durable duplicate guard, and the running total (lib/payment-row). The
    // row may already hold a payment:
    //  - on this reference (a replay: Payment Ref lists every reference on
    //    the row), or with no stored reference (written before the Payment Ref
    //    column existed): not recorded again;
    //  - the same amount on another reference seconds ago: the same payment
    //    arriving on a second webhook channel, not recorded again;
    //  - an earlier part of her programme fee: ADDED, so ₹15,000 then ₹5,000
    //    reads ₹20,000. Keying on the Paid flag alone used to drop the second
    //    part, and overwriting used to keep only the second part.
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${LEADS_SHEET_NAME}!${rowNumber}:${rowNumber}`,
    })
    const existingRow = (existing.data.values?.[0] ?? []).map((c) => String(c ?? ''))
    const stored = (title: string) => existingRow[plan.indexes[title]] ?? ''
    const rowPlan = planPaidRow(
      {
        paid: stored('Paid'),
        ref: stored('Payment Ref'),
        amount: stored('Paid Amount'),
        at: stored('Paid At'),
        status: existingRow[STATUS_COLUMN] ?? '',
      },
      { refId: data.refId, amount: data.amount },
      Date.now(),
    )
    if (rowPlan.action === 'duplicate') {
      console.log(`[cashfree-webhook] Lead row ${rowNumber} already holds this payment (${rowPlan.reason}) — not re-recording (ref=${refForLog(data.refId)})`)
      return 'already_paid'
    }
    if (rowPlan.reason !== 'first') {
      console.log(`[cashfree-webhook] Lead row ${rowNumber} already held a payment; new payment ${refForLog(data.refId)} → Paid Amount ${rowPlan.paidAmount} (${rowPlan.reason})`)
    }
    paidCells['Paid Amount'] = String(rowPlan.paidAmount)
    paidCells['Payment Ref'] = refCellValue(rowPlan.paymentRef)

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
    console.log(`[cashfree-webhook] Payment recorded on existing lead row ${rowNumber} (ref=${refForLog(data.refId)})`)
    return 'updated'
  }

  // No matching lead — append, clearly marked, so it is visible rather than lost.
  console.warn(`[cashfree-webhook] No lead row matched for ref=${refForLog(data.refId)} leadId=${refForLog(data.leadId) || 'n/a'} — appending orphan row`)

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
      console.error(`[cashfree-webhook] Unparseable body (${rawBody.length} chars):`, maskText(rawBody.slice(0, 1000)))
      return NextResponse.json({ ok: true, ignored: 'unparseable' })
    }

    const { source, status, payment } = normalize(body)

    if (source === 'UNKNOWN') {
      console.warn('[cashfree-webhook] Unrecognised payload shape:', JSON.stringify(redactForLog(body)).slice(0, 2000))
      return NextResponse.json({ ok: true, ignored: 'unknown_shape' })
    }

    if (!payment) {
      // Log the whole body's SHAPE, not a summary. Cashfree's Payment Form
      // payload shape is still unobserved in production, and a summary line can
      // never reveal it — which is exactly how it stayed unknown through two
      // registrations. Every key, id, status and amount is kept; her name,
      // email and phone are redacted (lib/cashfree-log).
      console.log(
        `[cashfree-webhook] ${source} event, status "${status || 'n/a'}" — no action. Body: ` +
          JSON.stringify(redactForLog(body)).slice(0, 4000),
      )
      return NextResponse.json({ ok: true, source, status, skipped: true })
    }

    if (!payment.refId) {
      console.error(`[cashfree-webhook] ${source} success with no reference id — cannot process`)
      return NextResponse.json({ ok: true, ignored: 'no_ref' })
    }

    // Idempotency — return 200 so Cashfree stops retrying
    if (processedOrders.has(payment.refId)) {
      console.log(`[cashfree-webhook] Duplicate ${source} ${refForLog(payment.refId)} — skipping`)
      return NextResponse.json({ ok: true, duplicate: true })
    }
    processedOrders.add(payment.refId)

    const leadId = parseLeadId(payment.refId)
    const tags = payment.tags || {}

    // The sheet is the durable duplicate guard. The in-memory guard above dies
    // on cold start, and with the Payment Link and Payment Form channels
    // registered alongside the gateway, one payment could arrive twice — which
    // the ref-keyed guard cannot always catch. A lead row already stamped Paid
    // on this reference is reported as 'already_paid' and not written again.
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
      // A Sheets outage still records the payment in the ledger below, and
      // Cashfree still gets its 200.
      console.error('[cashfree-webhook] Sheets payment record failed:', sheetsErr instanceof Error ? sheetsErr.message : String(sheetsErr))
    }

    // Payments ledger (D1): next to the sheet write, never instead of it.
    // Recorded after the response so a ledger outage cannot delay Cashfree's
    // 200. order_ref is the primary key, so a replayed webhook is a no-op. The
    // binding is resolved here, inside the request; it is null off Cloudflare
    // and the whole block is skipped.
    const ledgerDb = await getLedgerDb()
    if (ledgerDb) {
      const ledgerRow = {
        orderRef: payment.refId,
        leadId,
        amount: payment.amount,
        currency: payment.currency,
        status: sheetResult === 'already_paid' ? ('duplicate' as const) : ('paid' as const),
        source,
        sheetResult,
        paidAtMs: Date.now(),
      }
      after(async () => {
        const written = await recordPayment(ledgerDb, ledgerRow)
        console.log(`[cashfree-webhook] ledger payment ref=${refForLog(ledgerRow.orderRef)} status=${ledgerRow.status} → ${written}`)
      })
    }

    if (sheetResult === 'already_paid') {
      console.log(`[cashfree-webhook] ${source} payment — lead already marked paid on this reference, not recorded again`)
      return NextResponse.json({ ok: true, duplicate: true, source, leadId })
    }

    // Recorded, and that is all. No Meta event and no WhatsApp: see the header.
    console.log(`[cashfree-webhook] ${source} payment of ${payment.amount} ${payment.currency} recorded as a programme payment (sheet=${sheetResult})`)
    return NextResponse.json({ received: true, source, leadId, sheet: sheetResult })
  } catch (err) {
    // Last-resort net. Deliberately 200: a 500 blocks Cashfree registration and
    // triggers retry storms. The log is the alert.
    console.error('[cashfree-webhook] UNCAUGHT — returning 200 to avoid retry storm:', err)
    return NextResponse.json({ ok: true, error: 'handled' })
  }
}
