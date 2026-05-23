"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as typeof window & { dataLayer?: Record<string, unknown>[] };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: "page_view", page_path: pathname });
  }, [pathname]);

  return null;
}
