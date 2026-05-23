"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  generateEventId,
  pushDL,
  trackViewContent,
  getOrCreateExternalId,
  getFbc,
  getFbp,
} from "../../lib/analytics";

export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const event_id = generateEventId("page_view");
    const external_id = getOrCreateExternalId();
    const fbc = getFbc();
    const fbp = getFbp();
    const payload: Record<string, unknown> = {
      event: "page_view",
      event_id,
      page_path: pathname,
    };
    if (external_id) payload.external_id = external_id;
    if (fbc) payload.fbc = fbc;
    if (fbp) payload.fbp = fbp;
    pushDL(payload);

    if (pathname === "/") {
      const timer = setTimeout(() => trackViewContent("landing"), 3000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return null;
}
