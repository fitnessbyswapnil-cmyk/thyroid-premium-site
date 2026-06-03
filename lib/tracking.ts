/**
 * lib/tracking.ts — first-party COOKIE / IDENTITY utilities (client-safe)
 *
 * Scope is intentionally narrow: read the identifiers that edge middleware and
 * the Meta Pixel set as cookies, plus a couple of cookie helpers. ALL event
 * emission lives in app/lib/analytics.ts — there is exactly ONE tracking event
 * system in this app. Do not re-add push/track functions here.
 */

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
   IDENTITY — read first-party identifiers set by middleware / Pixel
================================================================ */

export function getVisitorId(): string {
  return getCookie('_visitor_id') || (typeof localStorage !== 'undefined' ? localStorage.getItem('_visitor_id') || '' : '')
}

export function getFbp(): string {
  return getCookie('_fbp')
}

export function getFbc(): string {
  return getCookie('_fbc')
}

export function getUtmParams(): Record<string, string> {
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id']
  const result: Record<string, string> = {}
  keys.forEach(k => {
    // Cookie (set by middleware) takes priority, then sessionStorage fallback.
    const val = getCookie(k) || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(k) || '' : '')
    if (val) result[k] = val
  })
  return result
}

export function getFbclid(): string {
  return getCookie('_fbclid_raw') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('_fbclid') || '' : '')
}
