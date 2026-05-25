/**
 * middleware.ts
 * Edge middleware — runs on every request BEFORE page render.
 * Responsibilities:
 *  1. Capture fbclid → write _fbc cookie (Meta standard format)
 *  2. Capture UTM params → persist as cookies (30-day)
 *  3. Generate/refresh session_id (30-min rolling)
 *  4. Generate/persist visitor_id (180-day first-party identity)
 *
 * WHY MIDDLEWARE NOT useEffect:
 *  - Middleware runs on the Edge before hydration, so cookies are set
 *    before ANY JS executes. This means fbclid is captured even if
 *    the user has JS disabled or leaves immediately.
 *  - server-side rendering can read these cookies for CAPI enrichment.
 */
import { NextRequest, NextResponse } from 'next/server'

const COOKIE_OPTS_SESSION = {
  path: '/',
  sameSite: 'lax' as const,
  maxAge: 30 * 60,          // 30-min rolling session
}
const COOKIE_OPTS_MEDIUM = {
  path: '/',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60, // 30 days
}
const COOKIE_OPTS_LONG = {
  path: '/',
  sameSite: 'lax' as const,
  maxAge: 180 * 24 * 60 * 60, // 180 days
}

function genId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now()}_${rand}`
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { searchParams } = req.nextUrl

  // ── 1. fbclid → _fbc (Meta standard: fb.{version}.{ts}.{fbclid})
  const fbclid = searchParams.get('fbclid')
  if (fbclid) {
    res.cookies.set('_fbc', `fb.1.${Date.now()}.${fbclid}`, COOKIE_OPTS_LONG)
    // Also store raw fbclid for URL appending on CTA redirects
    res.cookies.set('_fbclid_raw', fbclid, COOKIE_OPTS_LONG)
  }

  // ── 2. UTM params
  const utms = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id']
  utms.forEach(k => {
    const v = searchParams.get(k)
    if (v) res.cookies.set(k, v, COOKIE_OPTS_MEDIUM)
  })

  // ── 3. gclid (Google — store for GA4 enrichment)
  const gclid = searchParams.get('gclid')
  if (gclid) res.cookies.set('_gclid', gclid, COOKIE_OPTS_LONG)

  // ── 4. session_id — rolling 30-min
  const existingSession = req.cookies.get('_session_id')?.value
  const sessionId = existingSession || genId('s')
  res.cookies.set('_session_id', sessionId, COOKIE_OPTS_SESSION)

  // ── 5. visitor_id — 180-day first-party identity anchor
  const existingVisitor = req.cookies.get('_visitor_id')?.value
  if (!existingVisitor) {
    res.cookies.set('_visitor_id', genId('v'), COOKIE_OPTS_LONG)
  }

  // ── 6. landing_url — capture once per session for attribution
  if (!existingSession) {
    const landingUrl = req.nextUrl.pathname + req.nextUrl.search
    res.cookies.set('_landing_url', encodeURIComponent(landingUrl), COOKIE_OPTS_MEDIUM)
  }

  return res
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
