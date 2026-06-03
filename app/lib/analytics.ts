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
  value: 299,
  currency: "INR",
} as const;

export type UserData = {
  email?: string;
  phone?: string;
  first_name?: string;
};

const STORAGE_KEY = "meta_user_identity";

// ── Normalization ───────────────────────────────────────────────────────────────
// Browser Pixel advanced matching and server CAPI MUST hash the SAME string or
// the event won't match/dedupe. Meta's browser SDK lowercases/trims email and
// strips non-digits from phone but does NOT add a country code — so we normalize
// phone to full E.164 digits (91XXXXXXXXXX for India) ourselves, everywhere.
export function normalizeEmail(email?: string): string {
  return (email || "").trim().toLowerCase();
}

export function normalizePhone(phone?: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;          // bare Indian mobile
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;                                            // already has country code
}

// ── Meta signal helpers ────────────────────────────────────────────────────────

// Stable first-party ID used as external_id for CAPI.
// UNIFIED on the middleware-issued `_visitor_id` (180-day cookie) so that the
// browser Pixel, the server CAPI routes, and GTM all resolve to the SAME identity.
// Previously this minted a separate `meta_external_id`, which disagreed with the
// `_visitor_id` sent by the server — fragmenting match quality and breaking dedup.
export function getOrCreateExternalId(): string {
  if (typeof window === "undefined") return "";
  try {
    // 1. Edge-middleware cookie is the source of truth.
    const cookieMatch = document.cookie.match(/(?:^|;\s*)_visitor_id=([^;]+)/);
    const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1]) : "";
    if (fromCookie) {
      localStorage.setItem("_visitor_id", fromCookie); // mirror for cookie-loss
      return fromCookie;
    }
    // 2. localStorage mirror (survives cookie expiry/clearing).
    const fromStorage = localStorage.getItem("_visitor_id");
    if (fromStorage) return fromStorage;
    // 3. Last resort — mint one under the SAME key the rest of the stack reads.
    const id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("_visitor_id", id);
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

// ── Core signal attachment ─────────────────────────────────────────────────────
//
// WHY flat fields: GA4 Event Tags in Web GTM forward event params to sGTM as
// flat key-value pairs (ep.email, ep.phone, …). A nested user_data object is
// NOT automatically unwrapped by GTM — so sGTM receives email = undefined.
// Solution: push BOTH the nested user_data (for browser pixel / direct CAPI
// tags that know how to read it) AND flat top-level fields (for GTM DLVs that
// map into GA4 event params → sGTM event data).
function withUserSignals(payload: DLPayload, userData?: UserData): DLPayload {
  const identity = userData ?? getStoredIdentity();
  const external_id = getOrCreateExternalId();
  const fbc = getFbc();
  const fbp = getFbp();

  if (identity && Object.keys(identity).length > 0) {
    payload.user_data = { ...identity };
    // Flat fields — mapped in GTM as DLVs → GA4 event params → sGTM event data
    if (identity.email) payload.email = identity.email;
    if (identity.phone) payload.phone = identity.phone;
    if (identity.first_name) payload.first_name = identity.first_name;
  }
  if (external_id) payload.external_id = external_id;
  if (fbc) payload.fbc = fbc;
  if (fbp) payload.fbp = fbp;

  return payload;
}

// ── Tracking functions ─────────────────────────────────────────────────────────

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

// `eventId` lets the caller pass a DETERMINISTIC id (e.g. `Purchase_<order_id>`)
// so the browser Pixel and the Cashfree server webhook share one id and Meta
// deduplicates them. Without this they used random ids → double-counted revenue.
export function trackPurchase(userData?: UserData, eventId?: string) {
  const event_id = eventId || generateEventId("purchase");
  const payload = withUserSignals(
    { event: "purchase", event_id, content_type: "service", ...PRODUCT },
    userData,
  );
  pushDL(payload);
  return event_id;
}

// `eventId` lets the caller pass `Schedule_<invitee_uuid>` so the browser event
// dedupes against the Calendly server webhook (which keys on the same uuid).
export function trackSchedule(
  details?: {
    name?: string;
    date?: string;
    time?: string;
  },
  eventId?: string,
) {
  const event_id = eventId || generateEventId("schedule");
  // Reads identity from localStorage — by the time Calendly fires,
  // localStorage has the full merged identity from the purchase page.
  const payload = withUserSignals({
    event: "calendly_booked",
    event_id,
    ...PRODUCT,
    ...(details ?? {}),
  });
  pushDL(payload);
  return event_id;
}

export function trackScrollDepth(depth: number, pageType = "landing") {
  pushDL({ event: "scroll_depth", depth, page_type: pageType });
}
