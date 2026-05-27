"use client";

import { useEffect, useState } from "react";
import { useScarcity } from "../context/ScarcityProvider";
import { trackCtaClick } from "../lib/analytics";

export default function StickyBookingBar() {
  const [visible, setVisible] = useState(false);
  const { goToCta } = useScarcity();

  // 20% scroll depth trigger — matches the point the user has seen the hero
  // and enough content to form intent, but hasn't yet reached a section CTA.
  useEffect(() => {
    const onScroll = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;
      const depth = window.scrollY / maxScroll;
      setVisible(depth >= 0.2);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Body bottom padding — only when the bar is slid into view
  useEffect(() => {
    if (visible) {
      document.body.style.paddingBottom =
        "calc(5rem + env(safe-area-inset-bottom))";
    } else {
      document.body.style.paddingBottom = "";
    }
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [visible]);

  return (
    // md:hidden — only renders on mobile/tablet below 768px
    <div
      role="complementary"
      aria-label="Book thyroid session"
      aria-hidden={!visible}
      className="md:hidden fixed inset-x-0 bottom-0 z-50 flex justify-center px-3"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingTop: "0.5rem",
        transform: visible
          ? "translateY(0)"
          : "translateY(calc(100% + 1.5rem))",
        transition:
          "transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        className="flex w-full max-w-[420px] items-center gap-3 rounded-[1.5rem] px-4 py-3"
        style={{
          background: "rgba(14,15,18,0.94)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow:
            "0 -1px 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.07)",
        }}
      >
        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold leading-tight tracking-[-0.01em] text-[var(--t1)]">
            Book ₹299 Session
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-[var(--t4)]">
            60 min · Private · Refund if no clarity
          </p>
        </div>

        {/* CTA button — thumb-friendly, premium */}
        <button
          type="button"
          onClick={() => { trackCtaClick("sticky_bar"); goToCta(); }}
          aria-label="Book your 299 rupee private thyroid strategy session"
          className="btn-sticky shrink-0"
        >
          Secure My Private Slot →
        </button>
      </div>
    </div>
  );
}
