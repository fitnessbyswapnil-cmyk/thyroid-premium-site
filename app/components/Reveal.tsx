"use client";

/**
 * Reveal — fade-up-on-scroll, in ~40 lines instead of 221 kB.
 *
 * This replaces framer-motion on the landing route. Every motion usage on `/`
 * was a fade-up variant or one scale-in: `whileInView` reveals with a stagger.
 * None of it needed a physics engine, and the library was 27% of the route's
 * entire JS payload — the single biggest item on a page whose measured
 * click-to-landing-page-view retention is 59%.
 *
 * IntersectionObserver + two CSS classes reproduces the same effect with the
 * same easing and timing. Motion is skipped entirely under
 * prefers-reduced-motion, which framer-motion did not honour here.
 */

import { useEffect, useRef, useState, type ReactNode, type ElementType } from "react";

export default function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
  ...rest
}: {
  children: ReactNode;
  as?: ElementType;
  /** Seconds. Mirrors framer's staggerChildren: pass index * 0.13. */
  delay?: number;
  className?: string;
} & Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Server render is the hidden state, so a viewer with JS disabled would
    // never see the content — reveal immediately if motion is unwanted.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal${shown ? " reveal-in" : ""}${className ? " " + className : ""}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
