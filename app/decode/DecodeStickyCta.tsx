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
 *
 * The label is the ad's label, character for character, and so are the other
 * two CTAs on the page. It used to read "Schedule my…  12 quick questions
 * first" — a different verb AND no price, which meant the last thing a
 * visitor saw before deciding disagreed with the creative that brought her.
 * The price stays on every CTA on purpose: it qualifies the click.
 */

import { useEffect, useRef, useState } from "react";

export default function DecodeStickyCta() {
  const barRef = useRef<HTMLDivElement>(null);
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

  // Reserve exactly the bar's own height at the bottom of the page.
  //
  // This used to be a hard-coded 84px, which was already ~50px short: at 375px
  // the label wraps to two lines and the sub-line to two more, so the bar is
  // about 134px tall and was sitting on top of the last of the page. A fixed
  // number cannot survive a copy change — the pixel it needs to match is a
  // consequence of the words in it — so it is measured instead, and re-measured
  // when the viewport changes.
  useEffect(() => {
    if (!show) {
      document.body.style.paddingBottom = "";
      return;
    }
    const apply = () => {
      const h = barRef.current?.offsetHeight ?? 0;
      document.body.style.paddingBottom = h ? `${h}px` : "";
    };
    apply();
    const ro = new ResizeObserver(apply);
    if (barRef.current) ro.observe(barRef.current);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      document.body.style.paddingBottom = "";
    };
  }, [show]);

  return (
    <div
      ref={barRef}
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
        className="cta-button cta-sticky mx-auto"
        style={{ maxWidth: "28rem", textDecoration: "none" }}
        tabIndex={show ? 0 : -1}
      >
        Book my 1-1 Thyroid Consultation
        <span className="cta-sub">₹299 &middot; 12 questions, then pick your slot</span>
      </a>
    </div>
  );
}
