"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPageView, trackViewContent } from "../../lib/analytics";

export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Carries full metaUserData (external_id always; em/ph/fn/ln when stored).
    trackPageView(pathname);

    if (pathname === "/") {
      const timer = setTimeout(() => trackViewContent("landing"), 3000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return null;
}
