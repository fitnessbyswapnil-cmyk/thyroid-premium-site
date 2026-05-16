"use client";

import { useEffect, useState } from "react";

const CTA_URL =
  "https://swapnilumbarkarfitness.in/case-studies/#cta";

export default function StickyBookingBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 640);
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
      role="complementary"
      aria-label="Book a free consultation"
      className="fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 md:bottom-4"
    >

      {/* Floating luxury container */}
      <div
        className="
          flex w-full max-w-[420px] items-center gap-3
          rounded-[1.6rem]
          border border-white/[0.06]
          bg-[rgba(17,17,19,0.72)]
          px-3.5 py-2.5
          backdrop-blur-xl
          shadow-[0_10px_30px_rgba(0,0,0,0.22)]
        "
      >

        {/* Soft assistant text */}
        <div className="min-w-0 flex-1">

          <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-[var(--t1)]">
            Free Thyroid Strategy Call
          </p>

          <p className="mt-0.5 text-[10px] leading-none text-[var(--t4)]">
            Personalized guidance for your thyroid fat loss
          </p>
        </div>

        {/* Softer luxury CTA */}
        <button
          type="button"
          onClick={() =>
            window.location.assign(CTA_URL)
          }
          aria-label="Book your free thyroid fat-loss strategy call"
          className="
            shrink-0 rounded-full
            border border-purple-400/15
            bg-purple-500/[0.14]
            px-4 py-2
            text-[12px] font-semibold
            tracking-[-0.01em]
            text-purple-200
            transition-all duration-200
            hover:bg-purple-500/[0.18]
            active:scale-[0.98]
          "
        >
          Book Call
        </button>
      </div>
    </div>
  );
}