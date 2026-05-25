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
const EXTERNAL_ID_KEY = "meta_external_id";

// ── Meta signal helpers ────────────────────────────────────────────────────────

// Stable anonymous ID persisted in localStorage — used as external_id for CAPI.
export function getOrCreateExternalId(): string {
  if (typeof window === "undefined") return "";
  try {
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

export function trackPurchase(userData?: UserData) {
  const event_id = generateEventId("purchase");
  const payload = withUserSignals(
    { event: "purchase", event_id, content_type: "service", ...PRODUCT },
    userData,
  );
  pushDL(payload);
  return event_id;
}

export function trackSchedule(details?: {
  name?: string;
  date?: string;
  time?: string;
}) {
  const event_id = generateEventId("schedule");
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
