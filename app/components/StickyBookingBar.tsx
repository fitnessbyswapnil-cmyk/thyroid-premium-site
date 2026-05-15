"use client";

import { useEffect, useState } from "react";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

export default function StickyBookingBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="sticky-cta-bar"
      role="complementary"
      aria-label="Book a free consultation"
    >
      <div className="flex flex-col leading-tight">
        <span className="font-bold text-white" style={{ fontSize: "var(--text-sm)" }}>
          🔥 Only 5 Spots Left
        </span>
        <span className="text-gray-500" style={{ fontSize: "var(--text-xs)" }}>
          Free 60-min strategy call
        </span>
      </div>
      <button
        type="button"
        onClick={() => window.location.assign(CTA_URL)}
        aria-label="Book your free thyroid fat-loss strategy call"
        className="ml-auto shrink-0 rounded-full bg-gradient-to-r from-purple-500 to-purple-700 px-4 py-2.5 font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]"
        style={{ fontSize: "var(--text-sm)", minHeight: "44px" }}
      >
        Book Free Call →
      </button>
    </div>
  );
}