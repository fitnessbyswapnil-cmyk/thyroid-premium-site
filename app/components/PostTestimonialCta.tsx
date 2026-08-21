"use client";

import { useScarcity } from "../context/ScarcityProvider";
import { trackCtaClick } from "../lib/analytics";
import { useInView } from "../lib/useInView";

export default function PostTestimonialCta() {
  const { ref, visible } = useInView(0.12);
  const { goToCta } = useScarcity();

  return (
    <section
      aria-label="Get your thyroid score"
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
            background: "radial-gradient(ellipse, rgba(163, 114, 32,0.06) 0%, transparent 70%)",
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
            border: "1px solid #ede7dd",
            background: "#ffffff",
            padding: "clamp(1.75rem, 5.5vw, 2.5rem) clamp(1.25rem, 5vw, 2rem)",
            textAlign: "center",
            boxShadow: "0 1px 2px rgba(36, 31, 26,0.04), 0 10px 32px rgba(36, 31, 26,0.07)",
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
              background: "linear-gradient(90deg, transparent, rgba(163, 114, 32,0.5), transparent)",
            }}
          />

          {/* Heading */}
          <h2
            style={{
              fontSize: "clamp(1.15rem, 3.5vw, 1.5rem)",
              fontWeight: 600,
              color: "var(--t1)",
              margin: "0 0 10px",
              lineHeight: 1.3,
              letterSpacing: "-0.02em",
              maxWidth: "22ch",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            If this felt familiar, there&apos;s a reason.
          </h2>

          {/* Ghost CTA — softer, curiosity-driven, mid-intensity */}
          <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => { trackCtaClick("post_testimonial"); goToCta("post_testimonial"); }}
              aria-label="Schedule my 1-1 thyroid fat loss session"
              className="btn-ghost"
              style={{ maxWidth: "min(100%, 24rem)" }}
            >
              <span className="cta-label">This Sounds Like Me. Schedule My Call</span>
              <span className="cta-sub">60 minutes, one to one with Swapnil · free</span>
            </button>
          </div>

          {/* No-pressure trust line */}
          <p
            style={{
              marginTop: 14,
              fontSize: 11,
              fontWeight: 500,
              color: "var(--t4)",
              letterSpacing: "0.035em",
            }}
          >
            No pressure, no obligation.
          </p>
        </div>
      </div>
    </section>
  );
}
