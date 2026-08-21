/**
 * app/api/booking-payment/route.ts
 *
 * PAY-AT-END funnel. She picks a slot and fills the qualification form on the
 * Cal.com embed FIRST, then pays. This route is the bridge between those two
 * halves: given a Cal.com booking uid it resolves the booking, creates the lead
 * from her own answers, and hands back a leadId the client uses to open the
 * SAME embedded Cashfree checkout the pay-first flow uses.
 *
 * WHY PAY-AT-END: her budget answer (Rs 50k / 30k / 15k) sits two questions
 * before the price, so Rs 299 is read against an anchor she set herself. She has
 * also invested several minutes and mentally owns the slot. Both push the
 * payment decision the right way. Pay-first applies only a money filter, to a
 * much smaller pool, and throws away the qualification data of everyone who
 * does not pay — here we keep it, because the lead is written before the charge.
 *
 * DELIBERATELY TOUCHES NO GUARDED PATH. It does not modify /api/cal-webhook
 * (which still fires Schedule on its own) and it does not modify
 * /api/create-cashfree-order — the client calls that unchanged with the leadId
 * returned here, so the order id stays thyroid_<leadId>_<timestamp> and Purchase
 * still fires from /session-booked with event_id Purchase_<orderId>.
 *
 * Idempotent: the leadId is derived from the booking uid, so a refresh or a
 * double-submit resolves to the same lead rather than creating a second one.
 */
import { NextRequest, NextResponse } from 'next/server'

const CAL_API_KEY = process.env.CAL_API_KEY

type CalAttendee = { name?: string; email?: string; phoneNumber?: string }
type CalBooking = {
  uid?: string
  start?: string
  startTime?: string
  attendees?: CalAttendee[]
  bookingFieldsResponses?: Record<string, unknown>
  responses?: Record<string, unknown>
  status?: string
}

const str = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()

/** Cal.com nests custom answers under different keys by version. Try them all. */
function answers(b: CalBooking): Record<string, unknown> {
  return { ...(b.responses || {}), ...(b.bookingFieldsResponses || {}) }
}

/** Pull an answer by trying several plausible field slugs. */
function pick(a: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const hit = Object.keys(a).find((x) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
      === k.toLowerCase().replace(/[^a-z0-9]/g, ''))
    if (hit) {
      const v = a[hit]
      if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
        const inner = str((v as Record<string, unknown>).value)
        if (inner) return inner
      }
      const s = str(v)
      if (s) return s
    }
  }
  return ''
}

async function fetchBooking(uid: string): Promise<CalBooking | null> {
  if (!CAL_API_KEY) return null
  try {
    const res = await fetch(`https://api.cal.com/v2/bookings/${encodeURIComponent(uid)}`, {
      headers: {
        Authorization: `Bearer ${CAL_API_KEY}`,
        'cal-api-version': '2024-08-13',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: CalBooking }
    return json.data ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  let uid = ''
  try {
    const body = (await req.json()) as { uid?: string }
    uid = str(body.uid)
  } catch {
    /* fall through to the 400 below */
  }
  if (!uid) {
    return NextResponse.json({ error: 'uid is required' }, { status: 400 })
  }

  const booking = await fetchBooking(uid)
  if (!booking) {
    return NextResponse.json(
      { error: 'booking_not_found', message: 'We could not find that booking yet.' },
      { status: 404 },
    )
  }

  const a = answers(booking)
  const attendee = booking.attendees?.[0] || {}

  const name = str(attendee.name) || pick(a, 'name', 'yourname')
  const email = str(attendee.email) || pick(a, 'email', 'emailaddress')
  const rawPhone =
    str(attendee.phoneNumber) ||
    pick(a, 'whatsapp', 'whatsappnumber', 'phone', 'phonenumber', 'attendeePhoneNumber')
  const digits = rawPhone.replace(/\D/g, '')
  const phone = digits.length > 10 ? digits.slice(-10) : digits

  // Deterministic from the booking uid → idempotent across refresh/retry.
  const leadId = `cal_${uid}`

  // Same sheet contract as the other entry points, so the dashboard, the cron
  // and the WhatsApp sequences keep reading identical headers.
  const origin = new URL(req.url).origin
  try {
    await fetch(`${origin}/api/quiz-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId,
        name,
        phone,
        email,
        city: pick(a, 'city', 'whichcity'),
        age: pick(a, 'age', 'whatisyourage'),
        diagnosis: pick(a, 'thyroid', 'thyroidstatus', 'diagnosed'),
        onMedication: pick(a, 'thyroid', 'thyroidstatus', 'diagnosed'),
        struggleDuration: pick(a, 'howlong', 'weightstuck'),
        symptoms: '',
        biggestChallenge: pick(a, 'inyourownwords', 'biggestchallenge', 'whathappens'),
        // Has she ever actually paid for help before — the strongest predictor
        // of a high-ticket close, and a far better signal than stated budget.
        triedBefore: pick(a, 'paidforhelpbefore', 'professionalhelp', 'investedinsofar'),
        amountSpent: pick(a, 'paidforhelpbefore'),
        goal: pick(a, 'weighttolose', 'urgentgoal', 'goal'),
        commitment: pick(a, 'investmentlevel', 'budget', 'howmuchcanyouinvest', 'paidprogram'),
        // Readiness, not capacity. These are different things and the sheet has
        // a column for each.
        timing: pick(a, 'whenwouldyoustart'),
        decisionMaker: pick(a, 'financialdecisionmaker', 'decisionmaker', 'solefinancialdecisionmaker'),
        profession: pick(a, 'profession'),
        source: 'calcom_pay_at_end',
        bookingUid: uid,
      }),
    })
  } catch {
    // Sheet write is best-effort: never block her from paying because a
    // spreadsheet API was slow. The Cashfree webhook stamps Paid regardless.
  }

  // city rides back for Meta advanced matching: ct is one of the higher-value
  // match keys and it is already sitting in her Cal.com answers, so leaving it
  // on the server was costing event match quality for nothing.
  return NextResponse.json({
    leadId,
    name,
    phone,
    email,
    city: pick(a, 'city', 'whichcity'),
    startTime: str(booking.start) || str(booking.startTime),
    uid,
  })
}
