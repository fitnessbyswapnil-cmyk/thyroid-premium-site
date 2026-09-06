"use client";

/**
 * The /decode sticky bar.
 *
 * Deliberately NOT app/components/StickyBookingBar: that one calls
 * useScarcity().goToCta(), which routes to the FREE consultation flow. On this
 * page that is the wrong destination, and it would quietly leak paid traffic
 * into the free funnel — where it would also fire the wrong conversion event.
 * So this is a small anchor-only twin: same 20% scroll trigger, same body
 * padding handling, no ScarcityProvider dependency.
 */

import { useEffect, useState } from "react";

export default function DecodeStickyCta() {
  const [visible, setVisible] = useState(false);
  // Once she has finished the quiz the bar has nothing left to ask for — the
  // real CTA is on screen — so it retires rather than repeating itself.
  const [retired, setRetired] = useState(false);
  useEffect(() => {
    const off = () => setRetired(true);
    window.addEventListener("decode-quiz-done", off);
    return () => window.removeEventListener("decode-quiz-done", off);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      setVisible(window.scrollY / max >= 0.2);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const show = visible && !retired;

  useEffect(() => {
    document.body.style.paddingBottom = show ? "84px" : "";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [show]);

  return (
    <div
      aria-hidden={!show}
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2.5 transition-transform duration-300"
      style={{
        transform: show ? "translateY(0)" : "translateY(110%)",
        background: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(8px)",
        borderTop: "1px solid var(--border-on-wash)",
      }}
    >
      <a
        href="/decode/quiz"
        className="cta-button mx-auto"
        style={{ maxWidth: "28rem", textDecoration: "none" }}
        tabIndex={show ? 0 : -1}
      >
        Get my thyroid score
        <span className="cta-sub">12 taps &middot; free &middot; about 40 seconds</span>
      </a>
    </div>
  );
}
