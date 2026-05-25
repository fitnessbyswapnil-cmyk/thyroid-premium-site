"use client";

import { useEffect } from "react";
import { trackScrollDepth } from "../../lib/analytics";

export function ScrollDepthTracker() {
  useEffect(() => {
    const depths = [25, 50, 75, 100];
    const fired = new Set<number>();

    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.round((window.scrollY / max) * 100);
      for (const d of depths) {
        if (pct >= d && !fired.has(d)) {
          fired.add(d);
          trackScrollDepth(d);
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
