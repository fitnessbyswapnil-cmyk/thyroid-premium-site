"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that counts up once, when it first scrolls into view (Number Flow's
 * job on the owner's design doc, without its runtime). The server renders the
 * FINAL value, so the page reads correctly with no JavaScript, in a crawler and
 * in a screenshot; reduced-motion visitors never see it move. The box is sized
 * to the final digit count so nothing around it shifts while it counts.
 */
export default function CountUp({
  value,
  prefix = "",
  suffix = "",
  duration = 900,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        setN(0);
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} aria-label={`${prefix}${value}${suffix}`}>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          minWidth: `${String(value).length}ch`,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {n}
      </span>
      <span aria-hidden="true">{suffix}</span>
    </span>
  );
}
