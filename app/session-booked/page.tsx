/**
 * app/session-booked/page.tsx
 *
 * Shown after successful Cashfree payment.
 * Contains Calendly embed.
 *
 * URL PARAMS EXPECTED (from Cashfree return URL):
 *  - payment_ref: Cashfree order_id
 *  - status: payment status
 *  - visitor_id, session_id, fbclid, utm_* (passed through)
 *
 * THIS PAGE:
 *  1. Fires InitiateCheckout (first load = payment was completed)
 *  2. On Calendly booking → fires Schedule browser + CAPI
 *  3. Prefills Calendly with known user data if available
 */
'use client'

import { useEffect, useSearchParams } from 'react'
// Note: use 'next/navigation' for App Router
import { useSearchParams as useNextSearchParams } from 'next/navigation'
import {
  listenCalendly,
  getVisitorId,
  getSessionId,
  getFbp,
  getFbc,
  getPersistedUserData,
  getEventId,
  newEventId,
  pushDL,
} from '@/lib/tracking'

const CALENDLY_URL = 'https://calendly.com/swapnilumbarkarfitness/strategy-call'

async function mirrorSchedule(eventId: string, userData: {
  email?: string; phone?: string; name?: string; inviteeUuid?: string
}) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'Schedule',
        event_id: eventId,
        source_url: window.location.href,
        user_data: {
          email: userData.email,
          phone: userData.phone,
          first_name: userData.name?.split(' ')[0],
          last_name: userData.name?.split(' ').slice(1).join(' '),
          external_id: userData.inviteeUuid || getVisitorId(),
        },
        custom_data: { content_name: 'thyroid_strategy_call' },
      }),
    })
  } catch {}
}

export default function SessionBookedPage() {
  const params = useNextSearchParams()
  const paymentRef = params.get('payment_ref') || ''
  const userData = typeof window !== 'undefined' ? getPersistedUserData() : {}

  // Build Calendly prefill URL
  const calendlyParams = new URLSearchParams()
  if (userData.name)  calendlyParams.set('name', userData.name)
  if (userData.email) calendlyParams.set('email', userData.email)
  if (userData.phone) calendlyParams.set('a1', userData.phone)  // Calendly custom field
  const calendlyFull = `${CALENDLY_URL}?${calendlyParams.toString()}`

  useEffect(() => {
    // 1. Fire InitiateCheckout on page load
    // (session fee was paid = initiate coaching relationship)
    const icId = getEventId('InitiateCheckout_booked')
    pushDL({
      event: 'initiate_checkout',
      event_id: icId,
      content_name: 'thyroid_session',
      value: 490,
      currency: 'INR',
      payment_ref: paymentRef,
    })
    // Mirror to CAPI
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'InitiateCheckout',
        event_id: icId,
        source_url: window.location.href,
        user_data: { external_id: getVisitorId() },
        custom_data: { value: 490, currency: 'INR' },
      }),
    }).catch(() => {})

    // 2. Listen for Calendly booking
    const cleanup = listenCalendly(async (booking) => {
      const schedId = newEventId('Schedule')

      // Push to dataLayer → GTM fires browser Pixel
      pushDL({
        event: 'calendly_booked',
        event_id: schedId,
        invitee_email: booking.invitee_email,
        invitee_name: booking.invitee_name,
        event_type: booking.event_type_name,
        metaUserData: {
          em: booking.invitee_email,
          ph: '',
          external_id: booking.invitee_uuid || getVisitorId(),
        },
      })

      // Mirror to CAPI
      await mirrorSchedule(schedId, {
        email: booking.invitee_email,
        name: booking.invitee_name,
        inviteeUuid: booking.invitee_uuid,
      })

      // Persist email for advanced matching
      if (booking.invitee_email) {
        localStorage.setItem('user_email', booking.invitee_email)
      }
    })

    return cleanup
  }, [paymentRef])

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '40px 20px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ color: '#a855f7', marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Payment Confirmed ✓
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '12px' }}>
          Book Your Strategy Call
        </h1>
        <p style={{ color: '#9ca3af', marginBottom: '32px' }}>
          Select a time that works for you. Swapnil will call you at the scheduled time.
        </p>

        {/* Calendly inline embed */}
        <div
          className="calendly-inline-widget"
          data-url={calendlyFull}
          style={{ minWidth: '320px', height: '700px' }}
        />

        {/* Calendly widget loader */}
        <script
          type="text/javascript"
          src="https://assets.calendly.com/assets/external/widget.js"
          async
        />
      </div>
    </main>
  )
}
