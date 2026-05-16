"use client";

import { useEffect, useState } from "react";
import { useScarcity } from "../context/ScarcityProvider";

export default function StickyBookingBar() {
  const [visible, setVisible] = useState(false);
  const { scarcityShort, goToCta } = useScarcity();

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 640);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!visible) {
      document.body.style.paddingBottom = "";
      return;
    }

    document.body.style.paddingBottom =
      "calc(5.25rem + env(safe-area-inset-bottom))";

    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="complementary"
      aria-label="Reserve thyroid consultation"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:pb-4"
    >
      <div className="flex w-full max-w-[420px] items-center gap-3 rounded-[1.5rem] border border-white/[0.08] bg-[rgba(15,16,18,0.92)] px-3.5 py-2.5 shadow-[0_10px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-[var(--t1)]">
            ₹299 Thyroid Strategy Session
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-[var(--t4)]">
            {scarcityShort} · Premium coaching intake
          </p>
        </div>

        <button
          type="button"
          onClick={goToCta}
          aria-label="Apply for your 299 rupee thyroid strategy session"
          className="btn-sticky shrink-0"
        >
          Apply Now
        </button>
      </div>
    </div>
  );
}
