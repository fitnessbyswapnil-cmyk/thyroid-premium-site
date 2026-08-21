/**
 * app/api/booking-activity/route.ts
 *
 * How many consultations were actually booked in the last seven days.
 *
 * WHY THIS EXISTS, AND WHY IT REFUSES TO ANSWER SOMETIMES:
 * the honest version of a "Pooja from Ludhiana just booked" ticker. Two things
 * are wrong with that pattern and both are fixed here.
 *
 *   1. Invented names are a fabricated record presented as genuine. Beyond
 *      being a lie, naming a woman alongside "booked a thyroid fat loss call"
 *      discloses an inference about her health — which is exactly the category
 *      of data this funnel is careful with everywhere else.
 *
 *   2. Real activity tickers backfire on a quiet calendar. A truthful widget
 *      reading "1 booked this week" is worse than silence.
 *
 * So this returns a real count, and the component that consumes it renders
 * NOTHING below a threshold. It stays invisible until the number genuinely
 * helps, then turns itself on. No decision to remember, no lie to maintain.
 *
 * Fails closed: any error, any unexpected shape, any missing key returns
 * count 0, which renders nothing. A wrong number here is worse than none.
 */
import { NextResponse } from 'next/server'

const CAL_API_KEY = process.env.CAL_API_KEY

// Cached at the edge: the number moves slowly and Cal.com should not be hit
// on every pageview.
export const revalidate = 900

export async function GET() {
  if (!CAL_API_KEY) return NextResponse.json({ count: 0 })

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const res = await fetch(
      `https://api.cal.com/v2/bookings?afterCreatedAt=${encodeURIComponent(since)}&take=100`,
      {
        headers: {
          Authorization: `Bearer ${CAL_API_KEY}`,
          'cal-api-version': '2024-08-13',
        },
        next: { revalidate: 900 },
      },
    )
    if (!res.ok) {
      console.warn(`[booking-activity] Cal.com ${res.status} — returning 0`)
      return NextResponse.json({ count: 0 })
    }

    const body = (await res.json()) as { data?: unknown }
    const rows = Array.isArray(body?.data) ? body.data : null
    if (!rows) {
      console.warn('[booking-activity] unexpected shape — returning 0')
      return NextResponse.json({ count: 0 })
    }

    // Cancelled and rejected bookings are not social proof.
    const count = rows.filter((r) => {
      const status = String((r as { status?: unknown })?.status ?? '').toLowerCase()
      return status !== 'cancelled' && status !== 'rejected'
    }).length

    return NextResponse.json({ count })
  } catch (err) {
    console.warn('[booking-activity] threw — returning 0', err)
    return NextResponse.json({ count: 0 })
  }
}
