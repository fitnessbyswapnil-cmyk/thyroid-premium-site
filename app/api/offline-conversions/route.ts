/**
 * POST /api/offline-conversions
 *
 * Sends OFFLINE / back-end conversions to Meta CAPI — the events that happen
 * AFTER the website: the ₹20k–₹50k high-ticket coaching sale closed on a call,
 * and (optionally) "consultation completed" quality signals.
 *
 * This is what lets Meta optimize on REAL revenue (value-based bidding) instead
 * of the ₹299 booking-fee proxy.
 *
 * ── AUTH ──────────────────────────────────────────────────────────────────────
 *   Header `x-offline-secret: <OFFLINE_CONVERSIONS_SECRET>` is REQUIRED.
 *   If the env var is not set, the route is hard-disabled (503) so it can never
 *   be left open to spoofed sales.
 *
 * ── HOW TO FEED IT ────────────────────────────────────────────────────────────
 *   - Manually:   curl with one sale.
 *   - At scale:   a Google Sheets Apps Script / Zapier / cron that POSTs each
 *                 new "Closed Won" row. Key fields the Sheet already stores
 *                 (visitor_id, email, phone, fbc) make these high-EMQ matches.
 *
 * ── BODY ──────────────────────────────────────────────────────────────────────
 *   Single:  { ...record }
 *   Batch:   { events: [ {...record}, {...record} ] }
 *
 *   record = {
 *     eventName?:   "Purchase" | "HighTicketSale" | "ConsultationCompleted" (default "Purchase")
 *     value:        number   (required for Purchase/HighTicketSale)
 *     currency?:    string   (default "INR")
 *     saleId?:      string   (used for the dedup event_id; falls back to orderId)
 *     orderId?:     string
 *     email?:       string
 *     phone?:       string
 *     name?:        string
 *     city?:        string
 *     state?:       string
 *     zip?:         string
 *     visitorId?:   string   (the _visitor_id used everywhere — external_id)
 *     fbc?:         string
 *     fbp?:         string
 *     eventTime?:   string | number   (ISO string or unix seconds; the ACTUAL sale time)
 *     actionSource?: ActionSource     (default "system_generated")
 *     contentName?: string            (default "thyroid_coaching_program")
 *     predictedLtv?: number
 *   }
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  sendCAPIEvent,
  buildUserData,
  type ActionSource,
  type CAPIResult,
} from '@/lib/server-tracking'

const SECRET = process.env.OFFLINE_CONVERSIONS_SECRET || ''

type OfflineRecord = {
  eventName?: string
  value?: number
  currency?: string
  saleId?: string
  orderId?: string
  email?: string
  phone?: string
  name?: string
  city?: string
  state?: string
  zip?: string
  visitorId?: string
  external_id?: string
  fbc?: string
  fbp?: string
  eventTime?: string | number
  actionSource?: ActionSource
  contentName?: string
  predictedLtv?: number
}

function toUnixSeconds(t?: string | number): number {
  if (t == null) return Math.floor(Date.now() / 1000)
  if (typeof t === 'number') return t > 1e12 ? Math.floor(t / 1000) : Math.floor(t)
  const parsed = Date.parse(t)
  return Number.isNaN(parsed) ? Math.floor(Date.now() / 1000) : Math.floor(parsed / 1000)
}

async function processRecord(rec: OfflineRecord): Promise<CAPIResult & { event_id: string }> {
  const eventName = rec.eventName || 'Purchase'
  const currency = rec.currency || 'INR'
  const externalId = rec.visitorId || rec.external_id || ''

  const firstName = rec.name ? rec.name.split(' ')[0] : ''
  const lastName = rec.name ? rec.name.split(' ').slice(1).join(' ') : ''

  const userData = buildUserData({
    email: rec.email,
    phone: rec.phone,
    firstName,
    lastName,
    city: rec.city,
    state: rec.state,
    zip: rec.zip,
    externalId,
    fbc: rec.fbc,
    fbp: rec.fbp,
    country: 'in',
  })

  // Deterministic event_id so re-uploading the same sale dedupes instead of
  // double-counting. Prefer an explicit id; otherwise derive from identity+value.
  const idBasis =
    rec.saleId ||
    rec.orderId ||
    `${rec.email || rec.phone || externalId}_${rec.value ?? ''}`
  const eventId = `${eventName}_${idBasis}`

  const result = await sendCAPIEvent(eventName, {
    eventId,
    userData,
    actionSource: rec.actionSource || 'system_generated',
    eventTime: toUnixSeconds(rec.eventTime),
    customData: {
      ...(rec.value != null ? { value: rec.value } : {}),
      currency,
      content_name: rec.contentName || 'thyroid_coaching_program',
      num_items: 1,
      ...(rec.predictedLtv != null ? { predicted_ltv: rec.predictedLtv } : {}),
    },
    testCode: process.env.META_TEST_EVENT_CODE,
  })

  return { ...result, event_id: eventId }
}

export async function POST(req: NextRequest) {
  // Hard-disable unless a secret is configured AND matches.
  if (!SECRET) {
    return NextResponse.json(
      { error: 'Offline conversions disabled — set OFFLINE_CONVERSIONS_SECRET' },
      { status: 503 },
    )
  }
  if (req.headers.get('x-offline-secret') !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const records: OfflineRecord[] = Array.isArray((body as { events?: unknown }).events)
    ? ((body as { events: OfflineRecord[] }).events)
    : [body as OfflineRecord]

  if (records.length === 0) {
    return NextResponse.json({ error: 'No records' }, { status: 400 })
  }

  // Basic validation: revenue events need a value.
  for (const r of records) {
    const name = r.eventName || 'Purchase'
    if ((name === 'Purchase' || name === 'HighTicketSale') && r.value == null) {
      return NextResponse.json(
        { error: `Record with eventName "${name}" requires a numeric value` },
        { status: 400 },
      )
    }
    if (!r.email && !r.phone && !r.visitorId && !r.external_id) {
      return NextResponse.json(
        { error: 'Each record needs at least one identifier (email, phone, or visitorId)' },
        { status: 400 },
      )
    }
  }

  const results = []
  for (const rec of records) {
    try {
      results.push(await processRecord(rec))
    } catch (err) {
      results.push({ success: false, error: err instanceof Error ? err.message : String(err), event_id: '' })
    }
  }

  const sent = results.filter(r => r.success).length
  console.log(`[offline-conversions] ${sent}/${records.length} sent to CAPI`)

  return NextResponse.json({ received: records.length, sent, results })
}

export async function GET() {
  return NextResponse.json({ ok: true, configured: !!SECRET })
}
