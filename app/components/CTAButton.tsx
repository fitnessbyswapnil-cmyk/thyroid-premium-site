/**
 * app/components/CTAButton.tsx
 *
 * Universal CTA button that:
 *  - Fires CTA_Click to dataLayer (GTM fires Pixel CTAClick)
 *  - Mirrors to CAPI
 *  - Fires StartForm event
 *  - Builds tracked Tally URL with all attribution params
 *  - Opens Tally in new tab (preserves context + attribution)
 *
 * USAGE:
 *   <CTAButton location="hero" />
 *   <CTAButton location="faq" label="💬 Chat on WhatsApp" variant="whatsapp" />
 */
'use client'

import {
  trackCTAClick,
  trackStartForm,
  trackWhatsAppClick,
  buildTallyUrl,
  newEventId,
  getVisitorId,
  getSessionId,
} from '@/lib/tracking'

const WA_NUMBER = '917987880954'  // ← YOUR REAL WHATSAPP NUMBER

interface CTAButtonProps {
  location: string
  label?: string
  variant?: 'primary' | 'whatsapp'
  className?: string
}

async function mirrorCTA(eventId: string, location: string) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'CTAClick',
        event_id: eventId,
        source_url: window.location.href,
        user_data: { external_id: getVisitorId() },
        custom_data: { cta_location: location },
      }),
    })
  } catch {}
}

export default function CTAButton({
  location,
  label = '🔥 Book FREE Consultation Call',
  variant = 'primary',
  className = '',
}: CTAButtonProps) {
  const handlePrimaryClick = async () => {
    const ctaId = newEventId('CTAClick')
    const sfId  = newEventId('StartForm')

    // 1. Push CTA click to dataLayer
    trackCTAClick(location)
    // 2. Push StartForm (fires before leaving page)
    trackStartForm()
    // 3. Mirror both to CAPI
    mirrorCTA(ctaId, location)
    // Small delay to allow network call to initiate
    await new Promise(r => setTimeout(r, 150))
    // 4. Navigate to Tally with all tracking params
    window.location.href = buildTallyUrl()
  }

  const handleWhatsAppClick = () => {
    trackWhatsAppClick(location)
    window.open(`https://wa.me/${WA_NUMBER}`, '_blank')
  }

  if (variant === 'whatsapp') {
    return (
      <button
        type="button"
        onClick={handleWhatsAppClick}
        className={className}
        aria-label="Chat on WhatsApp"
      >
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handlePrimaryClick}
      className={className}
      aria-label="Book free thyroid consultation call"
    >
      {label}
      <span style={{ display: 'block', fontSize: '12px', opacity: 0.85 }}>
        Free · 60 Min · Limited Spots
      </span>
    </button>
  )
}
