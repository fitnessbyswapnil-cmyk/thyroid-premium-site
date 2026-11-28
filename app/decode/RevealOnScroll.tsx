"use client";

import { useEffect } from "react";

/**
 * Soft rise-in for [data-reveal] blocks on /decode (Magic UI BlurFade's
 * behaviour, about 30 lines instead of a motion runtime). Only blocks that
 * start below the fold are held back, so the first screen never blinks; each
 * runs once; reduced motion skips it entirely. The styles live in globals.css
 * under .theme-clinic.
 */
export default function RevealOnScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const vh = window.innerHeight;
    const pending = [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter(
      (el) => el.getBoundingClientRect().top > vh * 0.92,
    );
    if (!pending.length) return;
    pending.forEach((el) => el.classList.add("reveal-wait"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.remove("reveal-wait");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    pending.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      pending.forEach((el) => el.classList.remove("reveal-wait"));
    };
  }, []);
  return null;
}
