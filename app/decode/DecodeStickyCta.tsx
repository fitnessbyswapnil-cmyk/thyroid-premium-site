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

  useEffect(() => {
    document.body.style.paddingBottom = visible ? "84px" : "";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [visible]);

  return (
    <div
      aria-hidden={!visible}
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2.5 transition-transform duration-300"
      style={{
        transform: visible ? "translateY(0)" : "translateY(110%)",
        background: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(8px)",
        borderTop: "1px solid var(--border-on-wash)",
      }}
    >
      <a
        href="#book"
        className="cta-button mx-auto"
        style={{ maxWidth: "28rem", textDecoration: "none" }}
        tabIndex={visible ? 0 : -1}
      >
        Get my report decoded &mdash; &#8377;299
        <span className="cta-sub">45 minutes, one to one</span>
      </a>
    </div>
  );
}
