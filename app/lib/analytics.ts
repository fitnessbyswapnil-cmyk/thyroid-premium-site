import { SESSION_PRICE } from "./pricing";

type DLPayload = Record<string, unknown>;

export function pushDL(payload: DLPayload) {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { dataLayer?: DLPayload[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(payload);
}

export function generateEventId(eventName: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${eventName}_${ts}_${rand}`;
}

const PRODUCT = {
  content_name: "Private Thyroid Strategy Session",
  content_category: "thyroid_coaching",
  value: SESSION_PRICE,
  currency: "INR",
} as const;

export type UserData = {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
};

const STORAGE_KEY = "meta_user_identity";
const EXTERNAL_ID_KEY = "meta_external_id";

// ── Meta signal helpers ────────────────────────────────────────────────────────

// Stable anonymous ID used as external_id for CAPI. Prefers the first-party
// `_visitor_id` cookie (set by middleware, 180-day, server-readable) so the
// browser Pixel and every server CAPI call share the SAME external_id — which
// is what lets Meta match them. Falls back to a localStorage id only if the
// cookie is unavailable (e.g. cookies disabled).
export function getOrCreateExternalId(): string {
  if (typeof window === "undefined") return "";
  try {
    const cookieMatch = document.cookie.match(/(?:^|;\s*)_visitor_id=([^;]+)/);
    if (cookieMatch) return decodeURIComponent(cookieMatch[1]);
    const existing = localStorage.getItem(EXTERNAL_ID_KEY);
    if (existing) return existing;
    const id = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(EXTERNAL_ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

// fbc = Facebook Click ID. Built from fbclid URL param and cached in sessionStorage
// so it survives same-tab redirects (Cashfree return, etc.).
export function getFbc(): string {
  if (typeof window === "undefined") return "";
  try {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    if (fbclid) {
      const fbc = `fb.1.${Date.now()}.${fbclid}`;
      sessionStorage.setItem("_fbc_cache", fbc);
      return fbc;
    }
    return sessionStorage.getItem("_fbc_cache") || "";
  } catch {
    return "";
  }
}

// fbp = Facebook Browser Pixel ID, set automatically by the Meta Pixel script.
export function getFbp(): string {
  if (typeof window === "undefined") return "";
  try {
    const match = document.cookie.match(/(?:^|;\s*)_fbp=([^;]+)/);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

// Read persisted identity from localStorage (browser only).
function getStoredIdentity(): UserData | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed: UserData = JSON.parse(raw);
    return Object.keys(parsed).length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

// ── Meta normalization helpers ──────────────────────────────────────────────────
// Meta hashes/matches normalized values. Email → lowercase + trimmed.
// Phone → digits only, with country code (no '+', no leading zeros). India default.

export function normalizeEmail(email?: string): string {
  return email ? email.trim().toLowerCase() : "";
}

export function normalizePhone(phone?: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  // 10-digit Indian mobile → prepend country code 91 → E.164 digits
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

// Builds the `metaUserData` object the GA4 "meta_userdata" tag reads.
// CRITICAL: only includes keys that have REAL values — a missing field is
// omitted entirely, never written as the string "undefined" (which Meta would
// hash into a junk match and tank EMQ). event_id should equal the dedup id of
// the event this object is attached to.
export function buildMetaUserData(
  identity: UserData | undefined,
  eventId?: string,
): Record<string, string> {
  const md: Record<string, string> = {};
  const em = normalizeEmail(identity?.email);
  const ph = normalizePhone(identity?.phone);
  const external_id = getOrCreateExternalId();
  const fbp = getFbp();
  const fbc = getFbc();

  if (em) md.em = em;
  if (ph) md.ph = ph;
  if (identity?.first_name) md.fn = identity.first_name.trim().toLowerCase();
  if (identity?.last_name) md.ln = identity.last_name.trim().toLowerCase();
  if (external_id) md.external_id = external_id;
  if (eventId) md.event_id = eventId;
  if (fbp) md.fbp = fbp;
  if (fbc) md.fbc = fbc;
  md.country = "in"; // 2-letter ISO, lowercased — how Meta expects it
  return md;
}

// ── Core signal attachment ─────────────────────────────────────────────────────
//
// WHY flat fields: GA4 Event Tags in Web GTM forward event params to sGTM as
// flat key-value pairs (ep.email, ep.phone, …). A nested user_data object is
// NOT automatically unwrapped by GTM — so sGTM receives email = undefined.
// Solution: push the nested user_data (for browser pixel / direct CAPI tags),
// flat top-level fields (for GTM DLVs → GA4 event params → sGTM), AND a
// `metaUserData` object with the exact keys the GA4 "meta_userdata" tag reads.
function withUserSignals(payload: DLPayload, userData?: UserData): DLPayload {
  const identity = userData ?? getStoredIdentity();
  const external_id = getOrCreateExternalId();
  const fbc = getFbc();
  const fbp = getFbp();

  if (identity && Object.keys(identity).length > 0) {
    payload.user_data = { ...identity };
    // Flat fields — mapped in GTM as DLVs → GA4 event params → sGTM event data
    if (identity.email) payload.email = normalizeEmail(identity.email);
    if (identity.phone) payload.phone = normalizePhone(identity.phone);
    if (identity.first_name) payload.first_name = identity.first_name;
    if (identity.last_name) payload.last_name = identity.last_name;
  }
  if (external_id) payload.external_id = external_id;
  if (fbc) payload.fbc = fbc;
  if (fbp) payload.fbp = fbp;

  // Attach the metaUserData object with the current event's dedup id so the
  // GA4 tag gets real values instead of "undefined".
  payload.metaUserData = buildMetaUserData(
    identity,
    typeof payload.event_id === "string" ? payload.event_id : undefined,
  );

  return payload;
}

// ── Tracking functions ─────────────────────────────────────────────────────────

// PageView — fired on every route. Routed through withUserSignals so it carries
// the full metaUserData (external_id always, + em/ph/fn/ln when identity is
// already stored) instead of bare external_id/fbc/fbp. This is the biggest EMQ
// lift: external_id on every anonymous PageView, hydrated on later loads.
export function trackPageView(pagePath?: string) {
  const event_id = generateEventId("page_view");
  pushDL(
    withUserSignals({
      event: "page_view",
      event_id,
      ...(pagePath ? { page_path: pagePath } : {}),
    }),
  );
  return event_id;
}

export function trackViewContent(pageType = "landing") {
  const event_id = generateEventId("view_content");
  pushDL(
    withUserSignals({
      event: "view_content",
      event_id,
      page_type: pageType,
      content_type: "service",
      ...PRODUCT,
    }),
  );
}

export function trackCtaClick(location: string, buttonLabel?: string) {
  const event_id = generateEventId("cta_click");
  pushDL(
    withUserSignals({
      event: "cta_click",
      event_id,
      location,
      button_label: buttonLabel ?? "",
      page_section: location,
      page_type: "landing",
      ...PRODUCT,
    }),
  );
}

export function trackLead(userData?: UserData) {
  const event_id = generateEventId("lead");
  const payload = withUserSignals(
    { event: "lead", event_id, ...PRODUCT },
    userData,
  );
  pushDL(payload);
  return event_id;
}

export function trackInitiateCheckout() {
  const event_id = generateEventId("initiate_checkout");
  // Reads identity from localStorage — called just before Cashfree redirect,
  // so persistUserIdentity() has already merged URL params + existing storage.
  const payload = withUserSignals({
    event: "initiate_checkout",
    event_id,
    ...PRODUCT,
  });
  pushDL(payload);
  return event_id;
}

// eventId: pass `Purchase_${orderId}` so the browser Pixel, /api/events, AND
// the Cashfree webhook all share ONE id and Meta deduplicates to a single
// Purchase. Falls back to a generated id only when the order id is unknown.
// value: pass the REAL charged amount (₹1 in test mode, ₹199 live) so the Pixel
// Purchase value isn't hardcoded; falls back to PRODUCT.value when omitted.
export function trackPurchase(userData?: UserData, eventId?: string, transactionId?: string, value?: number) {
  const event_id = eventId || generateEventId("purchase");
  const payload = withUserSignals(
    {
      event: "purchase",
      event_id,
      content_type: "service",
      ...PRODUCT,
      ...(value != null ? { value } : {}),
      ...(transactionId ? { transaction_id: transactionId } : {}),
    },
    userData,
  );
  pushDL(payload);
  return event_id;
}

// Schedule = a confirmed Cal.com booking (the Meta optimization event).
// eventId: pass the deterministic `schedule_<cal_booking_uid>` so the browser
// Pixel and the Cal.com webhook CAPI share ONE id and Meta deduplicates to a
// single Schedule. Falls back to a generated id only when the uid is unknown.
// Pushes dataLayer event "schedule" (the GTM web trigger must listen for this).
export function trackSchedule(
  details?: {
    name?: string;
    date?: string;
    time?: string;
  },
  eventId?: string,
  userData?: UserData,
) {
  const event_id = eventId || generateEventId("schedule");
  const payload = withUserSignals(
    {
      event: "schedule",
      event_id,
      ...PRODUCT,
      ...(details ?? {}),
    },
    userData,
  );
  pushDL(payload);
  return event_id;
}

export function trackScrollDepth(depth: number, pageType = "landing") {
  pushDL({ event: "scroll_depth", depth, page_type: pageType });
}
