/**
 * app/api/cal-webhook/route.ts
 *
 * Cal.com booking webhook → Meta CAPI "Schedule" (the ad optimization event).
 * Sole booking webhook (the legacy predecessor route was removed).
 *
 * SETUP IN CAL.COM:
 *  1. Cal.com → Settings → Developer → Webhooks → New
 *  2. Subscriber URL: https://www.swapnilumbarkarfitness.in/api/cal-webhook
 *  3. Event triggers: "Booking created"
 *  4. Secret → CAL_WEBHOOK_SECRET env var (Vercel). Cal.com signs the raw body
 *     with HMAC-SHA256 and sends it as the `x-cal-signature-256` header. The
 *     Vercel value MUST equal the secret entered on the Cal.com webhook.
 *
 * DEDUP: the event_id is `schedule_<payload.uid>` — the SAME id the browser
 * Pixel pushes from the Cal.com embed bookingSuccessful callback — so Meta
 * collapses the browser + server Schedule into one.
 *
 * DELIVERY CONTRACT (why Cal.com was logging "failed" before):
 *  - The ONLY non-2xx this route returns is 401, and ONLY on a genuine
 *    signature mismatch. Cal.com retries non-2xx and shows them as failed, so
 *    once a request is accepted (signature ok / unconfigured) we ALWAYS return
 *    200 — even for unknown triggers, missing uid, malformed JSON, or a failed
 *    Meta CAPI call. A Meta outage must never make Cal.com mark delivery failed.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import {
  sendCAPIEvent,
  buildUserData,
  getCookieFromReq,
} from '@/lib/server-tracking'
import { FREE_CALL_VALUE } from '@/app/lib/pricing'
import { QUALIFIED_MIN_SCORE } from '@/lib/booking-lead-score'
import { lookupSheetScore } from '@/lib/booking-lead-score-sheet'
import crypto from 'crypto'

const CAL_WEBHOOK_SECRET = process.env.CAL_WEBHOOK_SECRET

// The real confirmation surface (the Cal.com embed is inline on /session-booked;
// there is no /call-booked/ redirect).
const SOURCE_URL = 'https://www.swapnilumbarkarfitness.in/session-booked'

// Best-effort in-memory idempotency. Serverless instances are ephemeral, so the
// real dedup guarantee is Meta's event_id matching — this just avoids obvious
// same-instance double-sends (e.g. Cal.com webhook retries).
const processedUids = new Set<string>()

type CalWebhook = {
  triggerEvent?: string
  payload?: {
    uid?: string
    title?: string
    startTime?: string
    attendees?: Array<{ name?: string; email?: string; phoneNumber?: string }>
    responses?: Record<string, { value?: unknown } | undefined>
    // Set by the /book Cal embed (CalendarStep) — carries first-party signals the
    // server leg can't read from cookies (Cal.com → here is machine-to-machine):
    // visitor_id (external_id), city, _fbc, _fbp.
    metadata?: Record<string, unknown>
  }
}

type SignatureResult = 'valid' | 'mismatch' | 'unconfigured'

/**
 * Verify Cal.com's HMAC-SHA256 over the RAW request body.
 * - rawBody must be the exact bytes received (await req.text()), NOT a
 *   re-serialized parse — re-stringifying changes key order/whitespace and
 *   breaks the HMAC.
 * - Explicit length check before timingSafeEqual (which throws on unequal
 *   length) so a malformed header is a clean 'mismatch', not an exception.
 */
function verifyCalSignature(rawBody: string, signature: string): SignatureResult {
  if (!CAL_WEBHOOK_SECRET) return 'unconfigured'
  if (!signature) return 'mismatch'
  const computed = crypto
    .createHmac('sha256', CAL_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')
  const a = Buffer.from(computed, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return 'mismatch'
  return crypto.timingSafeEqual(a, b) ? 'valid' : 'mismatch'
}

function responseValue(
  responses: Record<string, { value?: unknown } | undefined> | undefined,
  key: string,
): string {
  const v = responses?.[key]?.value
  return typeof v === 'string' ? v : ''
}

function metaValue(metadata: Record<string, unknown> | undefined, key: string): string {
  const v = metadata?.[key]
  return typeof v === 'string' ? v : ''
}


/**
 * QualifiedSchedule — fired ALONGSIDE Schedule when the booking-form answers
 * clear a bar, so the account can report (and one day optimise on) bookings
 * that look like buyers rather than bookings. Key-agnostic on purpose: Cal.com
 * slugs its question labels, so this scans every answer VALUE instead of
 * guessing keys. Scoring uses only what the form asks today.
 */
function qualifiedScore(responses: Record<string, { value?: unknown } | undefined> | undefined): number {
  const vals = Object.values(responses ?? {})
    .map((r) => (typeof r?.value === 'string' ? r.value : Array.isArray(r?.value) ? r!.value.join(' ') : ''))
    .join(' | ')
  const onMeds = /on medication|hypothyroid and on|take(s)? (thyroid )?medic/i.test(vals) && !/not on medication/i.test(vals)
  const diagnosed = /hypothyroid|hashimoto|diagnosed/i.test(vals)
  const stuck = /more than 3 years|more than 2 years|over 2 years|1\s*[-–]\s*3 years|2\s*[-–]\s*3 years|over a year/i.test(vals)
  const decidesAlone = /sole financial decision/i.test(vals)
  const startsSoon = /immediately|within the next month|this month|this week/i.test(vals)
  const budgetOk = /₹\s?(15|20|25|30|50),?000|15,000|20,000|25,000|30,000|50,000/i.test(vals) && !/decide on the call/i.test(vals)
  let n = 0
  if (onMeds || diagnosed) n++
  if (stuck) n++
  if (decidesAlone || (startsSoon && budgetOk)) n++
  if (startsSoon) n++
  return n
}

export async function POST(req: NextRequest) {
  // ── 1. Read the raw body ONCE — required to HMAC the exact signed bytes ──
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch (err) {
    // Can't read the body → can't verify or process. Don't 500 (Cal.com would
    // retry forever); acknowledge so it stops.
    console.error('[cal-webhook] 200 — could not read request body', err)
    return NextResponse.json({ ok: true, skipped: 'unreadable body' })
  }

  const signature = req.headers.get('x-cal-signature-256') || ''

  // Invocation log — proves whether Cal.com is hitting this endpoint at all,
  // independent of signature/trigger outcome below.
  console.log(`[cal-webhook] invoked — bytes=${rawBody.length} signaturePresent=${!!signature}`)

  // ── 2. Signature — the ONLY path allowed to return a non-2xx ──
  const sig = verifyCalSignature(rawBody, signature)
  if (sig === 'mismatch') {
    console.warn('[cal-webhook] 401 — signature mismatch (check CAL_WEBHOOK_SECRET matches the Cal.com webhook secret)')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  if (sig === 'unconfigured') {
    console.warn('[cal-webhook] CAL_WEBHOOK_SECRET is not set — skipping signature verification. Set it in Vercel to secure this endpoint.')
  }

  // ── 3. From here we ALWAYS return 200 so Cal.com never marks it failed ──
  let body: CalWebhook
  try {
    body = JSON.parse(rawBody) as CalWebhook
  } catch {
    console.warn('[cal-webhook] 200 — accepted but body was not valid JSON; nothing to do')
    return NextResponse.json({ ok: true, skipped: 'invalid json' })
  }

  const trigger = body.triggerEvent || ''
  if (trigger !== 'BOOKING_CREATED') {
    // PING (webhook test), BOOKING_CANCELLED, etc. — acknowledge, don't process.
    console.log(`[cal-webhook] 200 — ignored trigger=${trigger || 'none'}`)
    return NextResponse.json({ ok: true, skipped: trigger || 'no trigger' })
  }

  const payload = body.payload || {}
  const uid = payload.uid || ''
  if (!uid) {
    console.warn('[cal-webhook] 200 — BOOKING_CREATED with no uid; cannot key Schedule for dedup')
    return NextResponse.json({ ok: true, skipped: 'no uid' })
  }

  if (processedUids.has(uid)) {
    console.log(`[cal-webhook] 200 — deduped (same instance) uid=${uid}`)
    return NextResponse.json({ ok: true, deduped: true })
  }
  processedUids.add(uid)

  // ── 4. Send the Schedule CAPI event — isolated so a Meta failure can NEVER
  //        bubble a 500 back to Cal.com (sendCAPIEvent already returns instead
  //        of throwing, but the try/catch guarantees it for any future change) ──
  try {
    const attendee = payload.attendees?.[0] || {}
    const name = attendee.name || responseValue(payload.responses, 'name') || ''
    const email = attendee.email || responseValue(payload.responses, 'email') || ''
    const phone =
      attendee.phoneNumber ||
      responseValue(payload.responses, 'phone') ||
      responseValue(payload.responses, 'attendeePhoneNumber') ||
      responseValue(payload.responses, 'smsReminderNumber') ||
      ''
    const firstName = name.split(' ')[0] || ''
    const lastName = name.split(' ').slice(1).join(' ') || ''

    // Cal.com → here is machine-to-machine, so there are no browser cookies on
    // this request. The /book Cal embed forwards the visitor's first-party
    // signals in booking metadata; we read them here (falling back to any cookie
    // that happens to ride along, then to the booking uid for external_id).
    const metadata = payload.metadata
    // The live Cal form's city question uses the slug "which-city"; the plain
    // "city" key belongs to the old /book flow's metadata. Read both, so the
    // ct match key stops silently dropping off every live booking.
    const city =
      responseValue(payload.responses, 'city') ||
      responseValue(payload.responses, 'which-city') ||
      metaValue(metadata, 'city')
    // SAME external_id the browser Schedule sends (visitor_id) so they match;
    // uid only as a last resort. event_id (schedule_<uid>) is unchanged either way.
    const externalId = metaValue(metadata, 'visitor_id') || uid
    const fbc = metaValue(metadata, 'fbc') || getCookieFromReq(req, '_fbc')
    const fbp = metaValue(metadata, 'fbp') || getCookieFromReq(req, '_fbp')

    // clientIp / userAgent are deliberately ABSENT: this request is Cal.com's
    // server calling ours, so getClientIp/getUserAgent would report Cal's
    // datacenter egress IP and Cal's HTTP client as if they were the woman who
    // booked — actively wrong signals that pollute matching. Her real browser
    // identifiers arrive via metadata (fbc/fbp/visitor_id) when she booked
    // through the site embed, and via the browser Schedule leg's own request.
    const userData = buildUserData({
      email,
      phone,
      firstName,
      lastName,
      city,
      externalId,
      fbc,
      fbp,
      country: 'in',
    })

    const eventId = `schedule_${uid}`
    // META_TEST_EVENT_CODE now applies ONLY to the owner's own test bookings.
    //
    // On 28 Aug a real client booked at 22:03 while a deployment built with
    // TEST9290 was still live (deleting the env var does not touch the running
    // deployment — only the next build picks it up). Her Schedule was routed to
    // Test Events and permanently excluded from ads reporting: Events Manager
    // showed it received at ~22:10 while the counted total never moved. This
    // fence makes that class of accident impossible — a forgotten test code can
    // only ever swallow the coach's own bookings, never a client's.
    const testCodeRaw = process.env.META_TEST_EVENT_CODE
    const isOwnerBooking = /swapnil/i.test(name) || /swapnil/i.test(email)
    const testCode = testCodeRaw && isOwnerBooking ? testCodeRaw : undefined
    if (testCodeRaw && !testCode) {
      console.warn(
        `[cal-webhook] META_TEST_EVENT_CODE is set but this is a REAL client booking — sending WITHOUT the test code so the conversion counts. Remove the env var and redeploy.`,
      )
    }
    // Names only, never values — confirms which match signals actually arrived
    // (esp. whether ct/fbc/fbp/external_id rode in via Cal booking metadata).
    const matchKeys = Object.keys(userData).filter((k) => userData[k as keyof typeof userData])
    console.log(
      `[cal-webhook] Schedule match keys present: [${matchKeys.join(',')}] metadataPresent=${!!metadata} external_id_source=${metaValue(metadata, 'visitor_id') ? 'visitor_id' : 'uid'}`,
    )
    console.log(
      `[cal-webhook] BOOKING_CREATED — sending Schedule CAPI: trigger=${trigger} uid=${uid} event_id=${eventId} test_event_code=${testCode || '(unset)'}`,
    )

    const result = await sendCAPIEvent('Schedule', {
      eventId, // SAME id as the browser Pixel → Meta dedup
      sourceUrl: SOURCE_URL,
      userData,
      // value/currency are still sent so Meta does not flag "Schedule events
      // have formatting issues or missing values". But the call is FREE, so the
      // honest figure is zero. Reporting SESSION_PRICE here told Meta every
      // booking earned Rs 299 that never existed — on the one event the ads
      // optimise for. Mirrors the browser leg's PRODUCT.value exactly, so both
      // legs of the dedup pair agree.
      customData: { content_name: 'thyroid_strategy_call', value: FREE_CALL_VALUE, currency: 'INR' },
      testCode,
    })

    // ── QualifiedSchedule (additive; never affects the Schedule send above) ──
    //
    // It had never once fired. The quiz score reached this webhook only as
    // Cal booking metadata `qscore`, carried there by the browser — quiz page,
    // then local storage, then /session-booked, then the Cal embed. Any hop
    // could drop it: another phone, cleared storage, a link forwarded to her
    // husband, or (until 13-Sep) /api/lead-status reading the wrong sheet row.
    // With no qscore, the fallback scanned Cal's booking-form answers, empty
    // since those questions were removed on 08-Sep, and scored every booking 0.
    //
    // Now: metadata `qscore` first (cheapest, already right), then the sheet
    // itself — by the lead id Cal carries, else the phone or email she booked
    // with. The browser is no longer a link in the chain. The old form scan
    // stays as the last resort for bookings older than the quiz.
    //
    // It runs in after(): the sheet lookup is a network round trip, and Cal.com
    // must get its 200 without waiting on it. A bare promise would die when the
    // invocation freezes; after() keeps it alive. Event id qsched_<uid> goes
    // through the ledger, so a Cal retry cannot double-send it.
    const qualifyBooking = async () => {
      try {
        const metaScore = Number(metaValue(metadata, 'qscore'))
        let score = Number.isFinite(metaScore) && metaScore > 0 ? metaScore : 0
        let source = score ? 'metadata' : ''

        if (!score) {
          try {
            const found = await lookupSheetScore({ leadId: metaValue(metadata, 'leadId'), phone, email })
            if (found) {
              score = found.score
              source = `sheet:${found.matchedBy}`
            }
          } catch (lookupErr) {
            console.error('[cal-webhook] sheet score lookup failed (falling back to form scan):', lookupErr instanceof Error ? lookupErr.message : String(lookupErr))
          }
        }

        const qScore = score ? (score >= QUALIFIED_MIN_SCORE ? 3 : 0) : qualifiedScore(payload.responses)
        if (!score) source = 'form'

        if (qScore >= 3) {
          const q = await sendCAPIEvent('QualifiedSchedule', {
            eventId: `qsched_${uid}`,
            sourceUrl: SOURCE_URL,
            userData,
            customData: { score: score || qScore },
            ...(testCode ? { testCode } : {}),
          })
          console.log(`[cal-webhook] QualifiedSchedule uid=${uid} source=${source} score=${score || qScore} result=${JSON.stringify(q).slice(0, 160)}`)
        } else {
          console.log(`[cal-webhook] Schedule not qualified uid=${uid} source=${source} score=${score || qScore}`)
        }
      } catch (qErr) {
        console.error('[cal-webhook] QualifiedSchedule failed (swallowed):', qErr instanceof Error ? qErr.message : String(qErr))
      }
    }
    after(qualifyBooking)

    // Full Meta CAPI response (status implied by success + the raw body), so the
    // Vercel logs show whether the Schedule was accepted by Meta.
    console.log(
      `[cal-webhook] 200 — Schedule CAPI result uid=${uid} event_id=${eventId} success=${result.success} events_received=${result.events_received ?? 0}` +
        (result.error ? ` error=${result.error}` : '') +
        ` response=${JSON.stringify(result.raw ?? null)}`,
    )
    return NextResponse.json({ received: true, capi: result })
  } catch (err) {
    // Schedule send failed unexpectedly — log, but still 200 so Cal.com is happy.
    console.error(`[cal-webhook] 200 — Schedule send threw (swallowed) uid=${uid}`, err)
    return NextResponse.json({ received: true, capi: { success: false, error: String(err) } })
  }
}
