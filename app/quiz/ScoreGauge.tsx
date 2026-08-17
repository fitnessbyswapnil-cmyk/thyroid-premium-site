"use client";

/**
 * ScoreGauge — the quiz's signature element.
 *
 * A thin champagne-gold arc that fills as she answers (header "ring" variant)
 * and animates up to her final Blocker Score on the result screen ("result"
 * variant, with a Playfair count-up number in the centre).
 *
 * `value` is 0–100. Reduced motion is respected: arc + number snap instantly.
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

type Variant = "ring" | "result";

export function ScoreGauge({
  value,
  variant = "ring",
  size,
  caption,
}: {
  value: number;
  variant?: Variant;
  size?: number;
  caption?: string;
}) {
  const reduce = useReducedMotion();
  const dim = size ?? (variant === "result" ? 220 : 56);
  const stroke = variant === "result" ? 10 : 5;
  const r = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));

  // Count-up for the result number.
  const [display, setDisplay] = useState(reduce ? clamped : 0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (variant !== "result") return;
    if (reduce) {
      setDisplay(clamped);
      return;
    }
    const start = performance.now();
    const duration = 1400;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * clamped));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [clamped, variant, reduce]);

  const offset = circumference * (1 - clamped / 100);
  const gradId = `quiz-gold-${variant}`;

  return (
    <div
      style={{ width: dim, height: dim }}
      className="relative flex shrink-0 items-center justify-center"
    >
      <svg
        width={dim}
        height={dim}
        viewBox={`0 0 ${dim} ${dim}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E4C97B" />
            <stop offset="100%" stopColor="#C9A24B" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        {/* Gold progress arc */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: reduce
              ? "none"
              : "stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1)",
            filter: "drop-shadow(0 0 6px rgba(201,162,75,0.45))",
          }}
        />
      </svg>

      {variant === "result" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="quiz-display leading-none"
            style={{
              fontSize: dim * 0.34,
              fontWeight: 600,
              color: "var(--gold-soft)",
              letterSpacing: "-0.02em",
            }}
          >
            {display}
          </span>
          <span
            className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "rgba(201,162,75,0.75)" }}
          >
            {caption ?? "Blocker Score"}
          </span>
        </div>
      ) : (
        <span
          className="quiz-display absolute"
          style={{
            fontSize: dim * 0.3,
            fontWeight: 600,
            color: "var(--gold-soft)",
            opacity: clamped > 0 ? 1 : 0.35,
            transition: "opacity 400ms ease",
          }}
        >
          {Math.round(clamped)}
        </span>
      )}
    </div>
  );
}
