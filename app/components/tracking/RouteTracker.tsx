"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPageView } from "../../lib/analytics";

export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Carries full metaUserData (external_id always; em/ph/fn/ln when stored).
    trackPageView(pathname);
    // ViewContent fires once, on /book (the offer + checkout page) via
    // BookPageClient — not on the homepage. Keeps the funnel's ViewContent
    // count honest and the ViewContent audience qualified.
  }, [pathname]);

  return null;
}
