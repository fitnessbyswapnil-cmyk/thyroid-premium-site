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

export function trackCtaClick(location: string, buttonLabel?: string) {
  const event_id = generateEventId("cta_click");
  pushDL({
    event: "cta_click",
    event_id,
    location,
    button_label: buttonLabel ?? "",
    page_type: "landing",
  });
}

export function trackScrollDepth(depth: number, pageType = "landing") {
  pushDL({ event: "scroll_depth", depth, page_type: pageType });
}

export function trackViewContent(pageType = "landing", contentName = "Thyroid Strategy Session") {
  const event_id = generateEventId("view_content");
  pushDL({
    event: "view_content",
    event_id,
    page_type: pageType,
    content_name: contentName,
    content_type: "service",
  });
}

export function trackPurchase() {
  const event_id = generateEventId("purchase");
  pushDL({
    event: "purchase",
    event_id,
    value: 299,
    currency: "INR",
    content_name: "Thyroid Strategy Session",
    content_type: "service",
  });
  return event_id;
}

export function trackSchedule(details?: { name?: string; date?: string; time?: string }) {
  const event_id = generateEventId("schedule");
  pushDL({
    event: "calendly_booked",
    event_id,
    value: 299,
    currency: "INR",
    content_name: "Thyroid Strategy Session Booked",
    ...(details ?? {}),
  });
  return event_id;
}
