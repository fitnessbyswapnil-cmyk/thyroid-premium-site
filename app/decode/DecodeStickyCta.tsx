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

/** `fromTop`: visible from page load, as on the reference page the redesign
 *  follows (docs/decode-redesign-feeldvibes-style.md). Default off keeps the
 *  20% scroll trigger for any other caller. */
export default function DecodeStickyCta({ fromTop = false }: { fromTop?: boolean } = {}) {
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
      if (fromTop) return setVisible(true);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      setVisible(fromTop || window.scrollY / max >= 0.2);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [fromTop]);

  // Stand down while a real CTA is on screen.
  //
  // The bar and the inline buttons are the same button, in the same red, with
  // the same words — so whenever an inline one scrolled into view the page
  // showed her the identical offer twice at once, one of them pinned over the
  // content she was reading. Two of the same button is not twice the pull; it
  // reads as a page shouting, and it costs the bar the thing that makes a
  // sticky CTA work, which is being the ONLY one.
  //
  // So the bar yields to the inline buttons and comes back when they leave.
  // Nothing about the labels changes: lib/decode-landing.test.ts still holds
  // every CTA to the ad's exact wording, and all of them are still on the page.
  const [inlineOnScreen, setInlineOnScreen] = useState(false);
  useEffect(() => {
    const inline = [...document.querySelectorAll<HTMLElement>(".cta-button")].filter(
      (el) => !el.classList.contains("cta-sticky"),
    );
    if (!inline.length) return;
    const seen = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.isIntersecting ? seen.add(e.target) : seen.delete(e.target);
        setInlineOnScreen(seen.size > 0);
      },
      // A sliver is not an arrival: require a third of the button, and ignore
      // the strip the bar itself occupies so the two never fight at the seam.
      { threshold: 0.34, rootMargin: "0px 0px -140px 0px" },
    );
    inline.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const show = visible && !retired && !inlineOnScreen;

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
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-4 pt-6 transition-transform duration-300"
      style={{
        transform: show ? "translateY(0)" : "translateY(110%)",
        // No bar. The button floats.
        //
        // This was an opaque white plank with a hairline top border, which is
        // fine for the first screen and wrong for every screen after it: most
        // of /decode is a near-black ground, so the plank cut a bright white
        // strip across the bottom of the page and announced itself as chrome
        // bolted on rather than part of the design.
        //
        // A scrim instead of a plank, and one that cannot be the wrong colour
        // on either ground: it fades from nothing to a touch of the page's own
        // ink, so it only ever darkens whatever is already behind it. The
        // button carries its own shadow and reads as a button on white and on
        // black alike.
        background:
          "linear-gradient(to top, rgba(10,9,8,0.55) 0%, rgba(10,9,8,0.28) 45%, rgba(10,9,8,0) 100%)",
        pointerEvents: "none",
      }}
    >
      <a
        href="/decode/quiz"
        className="cta-button cta-sticky mx-auto"
        style={{
          maxWidth: "28rem",
          textDecoration: "none",
          pointerEvents: "auto",
          boxShadow: "0 10px 30px rgba(0,0,0,0.38), 0 2px 6px rgba(0,0,0,0.22)",
        }}
        tabIndex={show ? 0 : -1}
      >
        Book my 1-1 Thyroid Consultation
        <span className="cta-sub">Free &middot; 60-min Thyroid Root Cause Session</span>
      </a>
    </div>
  );
}
