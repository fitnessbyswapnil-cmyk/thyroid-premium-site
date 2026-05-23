type DLPayload = Record<string, unknown>;

export function pushDL(payload: DLPayload) {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { dataLayer?: DLPayload[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(payload);
}

export function trackCtaClick(location: string, buttonLabel?: string) {
  pushDL({ event: "cta_click", location, button_label: buttonLabel ?? "", page_type: "landing" });
}

export function trackScrollDepth(depth: number, pageType = "landing") {
  pushDL({ event: "scroll_depth", depth, page_type: pageType });
}
