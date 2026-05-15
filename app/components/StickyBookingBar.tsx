"use client";

import { useEffect, useState } from "react";

const CTA_URL =
  "https://swapnilumbarkarfitness.in/case-studies/#cta";

export default function StickyBookingBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 540);
    };

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    return () =>
      window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="sticky-cta-bar"
      role="complementary"
      aria-label="Book a free consultation"
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-white">
          🔥 Free Thyroid Strategy Call
        </p>

        <p className="text-[11px] text-[var(--t4)]">
          Limited spots available this month
        </p>
      </div>

      <button
        type="button"
        onClick={() => window.location.assign(CTA_URL)}
        aria-label="Book your free thyroid fat-loss strategy call"
        className="shrink-0 rounded-full bg-gradient-to-r from-purple-500 to-purple-700 px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(168,85,247,0.22)] transition-all duration-200 hover:translate-y-[-1px]"
      >
        Book Now
      </button>
    </div>
  );
}