"use client";

import { useEffect, useRef, useState } from "react";
import { useScarcity } from "../context/ScarcityProvider";

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

export default function PostTestimonialCta() {
  const { ref, visible } = useInView(0.12);
  const { goToCta } = useScarcity();

  return (
    <section
      aria-label="Start your thyroid journey"
      className="relative overflow-hidden bg-[var(--bg-page)] py-[clamp(2rem,6vw,3.5rem)]"
    >
      {/* Gentle ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[min(50vw,220px)] overflow-hidden"
      >
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: "min(60vw, 280px)",
            height: "min(60vw, 280px)",
            background: "radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      <div className="container-narrow relative z-10">
        <div
          ref={ref}
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(18px)",
            transition: "opacity 0.65s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.65s cubic-bezier(0.25,0.46,0.45,0.94)",
            position: "relative",
            borderRadius: 20,
            border: "1px solid rgba(139,92,246,0.2)",
            background: "linear-gradient(135deg, rgba(139,92,246,0.055) 0%, rgba(255,255,255,0.012) 100%)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            padding: "clamp(1.75rem, 5.5vw, 2.5rem) clamp(1.25rem, 5vw, 2rem)",
            textAlign: "center",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 28px rgba(139,92,246,0.07)",
            overflow: "hidden",
          }}
        >
          {/* Soft top edge accent line */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "55%",
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.45), transparent)",
            }}
          />

          {/* Heading */}
          <h2
            style={{
              fontSize: "clamp(1.15rem, 3.5vw, 1.5rem)",
              fontWeight: 600,
              color: "rgba(255,255,255,0.90)",
              margin: "0 0 10px",
              lineHeight: 1.3,
              letterSpacing: "-0.02em",
              maxWidth: "22ch",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            If this felt familiar &mdash; there&apos;s a reason.
          </h2>

          {/* Ghost CTA — softer, curiosity-driven, mid-intensity */}
          <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              onClick={goToCta}
              aria-label="Learn more about the private thyroid strategy session"
              className="btn-ghost"
              style={{ maxWidth: "min(100%, 24rem)" }}
            >
              <span className="cta-label">This Sounds Like Me &mdash; Tell Me More</span>
              <span className="cta-sub">Start with a ₹299 private thyroid session</span>
            </button>
          </div>

          {/* No-pressure trust line */}
          <p
            style={{
              marginTop: 14,
              fontSize: 11,
              fontWeight: 500,
              color: "rgba(255,255,255,0.24)",
              letterSpacing: "0.035em",
            }}
          >
            No pressure. No obligation. Just clarity.
          </p>
        </div>
      </div>
    </section>
  );
}
