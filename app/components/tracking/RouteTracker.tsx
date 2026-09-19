"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPageView } from "../../lib/analytics";
import { isTrackingHost } from "@/lib/tracking-host";

export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Every deployment of this repo used to push page_view on every route
    // change, whatever hostname it was serving — which is how Vercel preview
    // URLs ended up feeding the live dataset. Checked here rather than at
    // render time so static generation is untouched.
    if (!isTrackingHost(window.location.hostname)) return;
    // Carries full metaUserData (external_id always; em/ph/fn/ln when stored).
    trackPageView(pathname);
    // ViewContent fires once, on /book (the offer + checkout page) via
    // BookPageClient — not on the homepage. Keeps the funnel's ViewContent
    // count honest and the ViewContent audience qualified.
  }, [pathname]);

  return null;
}
