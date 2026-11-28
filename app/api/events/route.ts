/**
 * app/api/events/route.ts
 *
 * Generic browser-to-CAPI bridge endpoint.
 * The browser fires a Pixel event + simultaneously POSTs to this
 * endpoint so the server sends the same event via CAPI.
 * Both use the same event_id → Meta deduplicates automatically.
 *
 * Its live caller is the PageView beacon (lib/pageview-beacon.ts), once per
 * page load on the production host.
 *
 * POST /api/events
 * Body: { event_name, event_id, source_url, user_data, custom_data }
 *
 * All of the logic, and the history of why each rule exists, lives in
 * lib/browser-events.ts, where the unit tests can run it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { handleBrowserEvent } from '@/lib/browser-events'

export async function POST(req: NextRequest) {
  const { status, body } = await handleBrowserEvent(req)
  return NextResponse.json(body, { status })
}

// Simple GET health check
export async function GET() {
  return NextResponse.json({ ok: true })
}
