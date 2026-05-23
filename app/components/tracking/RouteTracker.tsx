"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { generateEventId, pushDL, trackViewContent } from "../../lib/analytics";

export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const event_id = generateEventId("page_view");
    pushDL({ event: "page_view", event_id, page_path: pathname });

    if (pathname === "/") {
      const timer = setTimeout(() => trackViewContent("landing"), 3000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return null;
}
