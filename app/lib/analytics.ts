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

export function trackViewContent(pageType = "landing") {
  const event_id = generateEventId("view_content");
  pushDL({
    event: "view_content",
    event_id,
    page_type: pageType,
    content_type: "service",
    ...PRODUCT,
  });
}

export function trackCtaClick(location: string, buttonLabel?: string) {
  const event_id = generateEventId("cta_click");
  pushDL({
    event: "cta_click",
    event_id,
    location,
    button_label: buttonLabel ?? "",
    page_section: location,
    page_type: "landing",
    ...PRODUCT,
  });
}

export function trackLead(userData?: UserData) {
  const event_id = generateEventId("lead");
  const payload: DLPayload = {
    event: "lead",
    event_id,
    ...PRODUCT,
  };
  if (userData && Object.keys(userData).length > 0) {
    payload.user_data = { ...userData };
  }
  pushDL(payload);
  return event_id;
}

export function trackInitiateCheckout() {
  const event_id = generateEventId("initiate_checkout");
  pushDL({
    event: "initiate_checkout",
    event_id,
    ...PRODUCT,
  });
  return event_id;
}

export function trackPurchase(userData?: UserData) {
  const event_id = generateEventId("purchase");
  const payload: DLPayload = {
    event: "purchase",
    event_id,
    content_type: "service",
    ...PRODUCT,
  };
  if (userData && Object.keys(userData).length > 0) {
    payload.user_data = { ...userData };
  }
  pushDL(payload);
  return event_id;
}

export function trackSchedule(details?: { name?: string; date?: string; time?: string }) {
  const event_id = generateEventId("schedule");
  pushDL({
    event: "calendly_booked",
    event_id,
    ...PRODUCT,
    ...(details ?? {}),
  });
  return event_id;
}

export function trackScrollDepth(depth: number, pageType = "landing") {
  pushDL({ event: "scroll_depth", depth, page_type: pageType });
}
