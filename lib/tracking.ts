/**
 * lib/tracking.ts  — CLIENT-SIDE tracking utilities
 *
 * Rules:
 *  - All functions are browser-safe (check typeof window)
 *  - event_ids are generated once and persisted in sessionStorage
 *  - Never import from server-only modules
 */

/* ================================================================
   EVENT ID MANAGEMENT
   ================================================================
   event_id is the deduplication key between browser Pixel and
   server CAPI. It must be:
   - Unique per event type per page session
   - Identical when the same logical event fires browser + server
   - Stable (not regenerated on re-render)
================================================================ */

export function getEventId(eventName: string): string {
  if (typeof window === 'undefined') return ''
  const key = `_eid_${eventName}`
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = `${eventName}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem(key, id)
  }
  return id
}

/** Generate a FRESH event_id (for one-time events like clicks) */
export function newEventId(eventName: string): string {
  return `${eventName}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/* ================================================================
   COOKIE HELPERS
================================================================ */

export function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export function setCookie(name: string, value: string, maxAgeDays = 30): void {
  if (typeof document === 'undefined') return
  const exp = new Date(Date.now() + maxAgeDays * 86400000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${exp}; SameSite=Lax`
}

/* ================================================================
   IDENTITY — read first-party identifiers set by middleware
================================================================ */

export function getSessionId(): string {
  return getCookie('_session_id') || sessionStorage.getItem('_session_id') || ''
}

export function getVisitorId(): string {
  return getCookie('_visitor_id') || localStorage.getItem('_visitor_id') || ''
}

export function getFbp(): string {
  return getCookie('_fbp') || ''
}

export function getFbc(): string {
  return getCookie('_fbc') || ''
}

export function getUtmParams(): Record<string, string> {
  const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id']
  const result: Record<string, string> = {}
  keys.forEach(k => {
    // Cookie (set by middleware) takes priority, then sessionStorage fallback
    const val = getCookie(k) || sessionStorage.getItem(k) || ''
    if (val) result[k] = val
  })
  return result
}

export function getFbclid(): string {
  return getCookie('_fbclid_raw') || sessionStorage.getItem('_fbclid') || ''
}

/* ================================================================
   USER DATA — read persisted PII from localStorage (set by GTM
   "Persist User Identity" tag after Cashfree form capture)
================================================================ */

export function getPersistedUserData() {
  if (typeof localStorage === 'undefined') return {}
  return {
    email: localStorage.getItem('user_email') || '',
    phone: localStorage.getItem('user_phone') || '',
    externalId: localStorage.getItem('external_id') || getVisitorId(),
    name: localStorage.getItem('user_name') || '',
  }
}

export function persistUserData(data: {
  email?: string
  phone?: string
  externalId?: string
  name?: string
}) {
  if (typeof localStorage === 'undefined') return
  if (data.email) localStorage.setItem('user_email', data.email)
  if (data.phone) localStorage.setItem('user_phone', data.phone)
  if (data.externalId) localStorage.setItem('external_id', data.externalId)
  if (data.name) localStorage.setItem('user_name', data.name)
}

/* ================================================================
   TALLY FORM URL BUILDER
   Appends all tracking params so Tally can capture them as
   hidden fields and include them in webhook payload.
================================================================ */

const TALLY_BASE_URL = 'https://tally.so/r/Xx8yRO'

export function buildTallyUrl(): string {
  const params = new URLSearchParams()

  const fbclid = getFbclid()
  const fbp   = getFbp()
  const fbc   = getFbc()
  const sessionId = getSessionId()
  const visitorId = getVisitorId()
  const leadEventId = getEventId('Lead')

  if (fbclid)    params.set('fbclid', fbclid)
  if (fbp)       params.set('fbp', fbp)
  if (fbc)       params.set('fbc', fbc)
  if (sessionId) params.set('session_id', sessionId)
  if (visitorId) params.set('visitor_id', visitorId)
  if (leadEventId) params.set('event_id', leadEventId)

  // Append UTMs
  const utms = getUtmParams()
  Object.entries(utms).forEach(([k, v]) => params.set(k, v))

  const qs = params.toString()
  return qs ? `${TALLY_BASE_URL}?${qs}` : TALLY_BASE_URL
}

/* ================================================================
   CASHFREE SESSION URL BUILDER
   Used if you create Cashfree sessions server-side and need to
   embed return URL tracking.
================================================================ */

export function buildSessionBookedUrl(extraParams?: Record<string, string>): string {
  const base = 'https://www.swapnilumbarkarfitness.in/session-booked'
  const params = new URLSearchParams()

  const sessionId = getSessionId()
  const visitorId = getVisitorId()
  const fbclid   = getFbclid()
  const utms     = getUtmParams()

  if (sessionId) params.set('session_id', sessionId)
  if (visitorId) params.set('visitor_id', visitorId)
  if (fbclid)    params.set('fbclid', fbclid)
  Object.entries(utms).forEach(([k, v]) => params.set(k, v))
  if (extraParams) Object.entries(extraParams).forEach(([k, v]) => params.set(k, v))

  return `${base}?${params.toString()}`
}

/* ================================================================
   DATALAYER PUSH — typed wrapper
================================================================ */

export type DLEvent = {
  event: string
  event_id?: string
  [key: string]: unknown
}

export function pushDL(payload: DLEvent): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(payload)
}

/* ================================================================
   STANDARD EVENT PUSHES
================================================================ */

export function trackViewContent(): void {
  pushDL({
    event: 'view_content',
    event_id: getEventId('ViewContent'),
    content_name: 'thyroid_landing',
    session_id: getSessionId(),
    visitor_id: getVisitorId(),
    fbp: getFbp(),
    fbc: getFbc(),
  })
}

export function trackCTAClick(location: string): void {
  pushDL({
    event: 'cta_click',
    event_id: newEventId('CTAClick'),
    cta_location: location,
    session_id: getSessionId(),
  })
}

export function trackStartForm(): void {
  pushDL({
    event: 'start_form',
    event_id: getEventId('StartForm'),
    session_id: getSessionId(),
    visitor_id: getVisitorId(),
    fbp: getFbp(),
    fbc: getFbc(),
    ...getUtmParams(),
  })
}

export function trackWhatsAppClick(source: string): void {
  pushDL({
    event: 'whatsapp_click',
    event_id: newEventId('WhatsAppClick'),
    wa_source: source,
    session_id: getSessionId(),
    fbp: getFbp(),
    fbc: getFbc(),
  })
}

export function trackScrollDepth(pct: number): void {
  pushDL({
    event: 'scroll_depth',
    depth: pct,
    session_id: getSessionId(),
    event_id: `scroll_${pct}_${getSessionId()}`,
  })
}

export function trackSessionQualified(): void {
  pushDL({
    event: 'session_qualified',
    event_id: getEventId('SessionQualified'),
    session_id: getSessionId(),
    visitor_id: getVisitorId(),
    fbp: getFbp(),
    fbc: getFbc(),
  })
}

export function trackEngagement(depth: number, seconds: number): void {
  pushDL({
    event: 'engagement',
    scroll_depth: depth,
    time_on_page: seconds,
    session_id: getSessionId(),
  })
}

/* ================================================================
   CALENDLY POSTMESSAGE LISTENER
   Detects Calendly booking events from embedded iframe.
   Call this once in the /session-booked page.
================================================================ */

export type CalendlyEventData = {
  invitee_name?: string
  invitee_email?: string
  invitee_uuid?: string
  event_type_name?: string
  scheduled_event_uri?: string
}

export function listenCalendly(onBook: (data: CalendlyEventData) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = (e: MessageEvent) => {
    if (!e.origin.includes('calendly.com')) return
    const type = e.data?.event
    if (type === 'calendly.event_scheduled') {
      const payload = e.data?.payload || {}
      onBook({
        invitee_name: payload.invitee?.name,
        invitee_email: payload.invitee?.email,
        invitee_uuid: payload.invitee?.uuid,
        event_type_name: payload.event_type?.name,
        scheduled_event_uri: payload.event?.uri,
      })
    }
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}
