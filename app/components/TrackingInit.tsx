/**
 * app/components/TrackingInit.tsx
 *
 * Runs once per page load. Responsibilities:
 *  1. Push ViewContent to dataLayer (triggers GTM tag)
 *  2. Mirror ViewContent to /api/events (CAPI)
 *  3. Restore fbclid from URL param if not in cookie (edge case)
 *  4. Set up scroll depth tracking
 *  5. Set up session qualification logic
 *  6. Set up time-on-page engagement tracking
 *
 * Placed in layout.tsx so it runs on EVERY page.
 */
'use client'

import { useEffect } from 'react'
import {
  trackViewContent,
  trackScrollDepth,
  trackSessionQualified,
  trackEngagement,
  getEventId,
  getFbp,
  getFbc,
  getVisitorId,
  getSessionId,
} from '@/lib/tracking'

// Mirror a browser event to CAPI via /api/events
async function mirrorToCAPI(
  eventName: string,
  eventId: string,
  userData?: { email?: string; phone?: string; external_id?: string }
) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        source_url: window.location.href,
        user_data: userData || {
          external_id: getVisitorId(),
        },
      }),
    })
  } catch {
    // Non-critical — never let tracking errors affect UX
  }
}

const SCROLL_THRESHOLDS = [25, 50, 75, 90]

export default function TrackingInit() {
  useEffect(() => {
    // ── 1. ViewContent ──────────────────────────────────────────
    const vcEventId = getEventId('ViewContent')
    trackViewContent()  // dataLayer push → GTM fires browser Pixel
    mirrorToCAPI('ViewContent', vcEventId)  // server CAPI

    // ── 2. Scroll depth ─────────────────────────────────────────
    const firedDepths = new Set<number>()
    const onScroll = () => {
      const el = document.documentElement
      const pct = Math.round(
        (window.scrollY / Math.max(el.scrollHeight - el.clientHeight, 1)) * 100
      )
      SCROLL_THRESHOLDS.forEach(t => {
        if (pct >= t && !firedDepths.has(t)) {
          firedDepths.add(t)
          trackScrollDepth(t)
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    // ── 3. Session qualification ─────────────────────────────────
    // "Qualified" = scrolled ≥75% AND spent ≥45s on page
    let qualifiedFired = false
    let scrollReached75 = false
    const qualTimer = setTimeout(() => {
      if (scrollReached75 && !qualifiedFired) {
        qualifiedFired = true
        const qId = getEventId('SessionQualified')
        trackSessionQualified()
        mirrorToCAPI('SessionQualified', qId)
      }
    }, 45000)

    const engTimer = setTimeout(() => {
      const maxScroll = Math.max(...Array.from(firedDepths), 0)
      trackEngagement(maxScroll, 30)
    }, 30000)

    // Watch scroll to set 75% flag for qualification
    const onScroll75 = () => {
      const pct = Math.round(
        (window.scrollY / Math.max(
          document.documentElement.scrollHeight - window.innerHeight, 1
        )) * 100
      )
      if (pct >= 75) scrollReached75 = true
    }
    window.addEventListener('scroll', onScroll75, { passive: true })

    // ── 4. _fbp auto-generate if not set ────────────────────────
    // Meta expects _fbp = fb.1.{timestamp}.{random}
    // If the Pixel base code hasn't fired yet (before GTM loads),
    // we set a compatible value ourselves so CAPI can use it.
    if (!getFbc() && !getFbp()) {
      const subdomain = 1 // fb.1 for main domain
      const creationTime = Date.now()
      const randomInt = Math.floor(Math.random() * 1e9)
      const fbp = `fb.${subdomain}.${creationTime}.${randomInt}`
      document.cookie = `_fbp=${fbp}; path=/; max-age=${180*86400}; SameSite=Lax`
    }

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll75)
      clearTimeout(qualTimer)
      clearTimeout(engTimer)
    }
  }, [])

  return null
}
