"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Testimonial {
  name: string;
  location: string;
  initials: string;
  condition: string;   // e.g. "Hashimoto's · Strategy session" — specific, credible
  quote: string;
  result: string;
  featured: boolean;   // Featured card gets distinct visual treatment
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
//
// Psychological sequencing (cold Meta traffic):
//   Card 1 — Session-specific: "Is this a sales call?" objection pre-handled by
//             a real person describing the ₹299 session experience.
//   Card 2 — Outcome: weight-loss result with specific, culturally resonant
//             detail ("without giving up roti").
//   Card 3 — Emotional peak (featured): the most powerful sentence on the page,
//             given the visual prominence it deserves.
//
// This flow: Trust the process → Trust the result → Trust the person.

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Kavitha N.",
    location: "Hyderabad",
    initials: "KN",
    condition: "Hashimoto's · Strategy session",
    quote:
      "I walked in expecting a sales pitch. He spent the full hour on my actual reports — my TSH history, my food, my sleep. I left with three specific things to try that evening. That alone was worth ₹299.",
    result: "Strategy session",
    featured: false,
  },
  {
    name: "Priya R.",
    location: "Mumbai",
    initials: "PR",
    condition: "Hypothyroidism · 6-week program",
    quote:
      "I'd tried every diet for 3 years. Nothing worked. I didn't know my thyroid was the actual problem — not my willpower. In 6 weeks I lost 4.5 kg without giving up roti.",
    result: "−4.5 kg · 6 weeks",
    featured: false,
  },
  {
    name: "Divya M.",
    location: "Bengaluru",
    initials: "DM",
    condition: "Hashimoto's · 10-week program",
    quote:
      "I cried on our first call because someone finally understood why nothing was working. This isn't just a coaching program — it's the first time I felt truly seen.",
    result: "−6 kg · 10 weeks",
    featured: true,
  },
];

// ─── useInView ────────────────────────────────────────────────────────────────

function useInView(threshold = 0.1) {
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

// ─── QuoteIcon — decorative, used only on the featured card ──────────────────

function QuoteIcon() {
  return (
    <svg
      width="32"
      height="24"
      viewBox="0 0 32 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 24V14.4C0 10.4 0.933333 7.06667 2.8 4.4C4.8 1.6 7.86667 0 12 0V4C9.6 4 7.86667 4.93333 6.8 6.8C6 8.26667 5.6 10 5.6 12H10.4V24H0ZM18 24V14.4C18 10.4 18.9333 7.06667 20.8 4.4C22.8 1.6 25.8667 0 30 0V4C27.6 4 25.8667 4.93333 24.8 6.8C24 8.26667 23.6 10 23.6 12H28.4V24H18Z"
        fill="rgba(139,92,246,0.12)"
      />
    </svg>
  );
}

// ─── TestimonialCard ──────────────────────────────────────────────────────────

function TestimonialCard({
  t,
  index,
  visible,
}: {
  t: Testimonial;
  index: number;
  visible: boolean;
}) {
  const delay = index * 150;

  return (
    <article
      aria-label={`Testimonial from ${t.name}`}
      style={{
        // Stagger entrance: each card fades up with a 150ms offset
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(22px)",
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
        borderRadius: "var(--r-xl, 18px)",
        position: "relative",
        overflow: "hidden",
        // Featured card: more visible glass + violet left accent
        background: t.featured
          ? "linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(255,255,255,0.02) 100%)"
          : "rgba(255,255,255,0.024)",
        border: t.featured
          ? "1px solid rgba(139,92,246,0.22)"
          : "1px solid rgba(255,255,255,0.062)",
        boxShadow: t.featured
          ? "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(139,92,246,0.1)"
          : "inset 0 1px 0 rgba(255,255,255,0.048), 0 2px 12px rgba(0,0,0,0.18)",
        padding: "20px",
      }}
    >
      {/* Left accent bar — only on the featured card */}
      {t.featured && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background:
              "linear-gradient(to bottom, rgba(139,92,246,0.7), rgba(52,211,153,0.4))",
            borderRadius: "0 0 0 0",
          }}
        />
      )}

      {/* Decorative large quote mark — featured card only, top-right */}
      {t.featured && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            pointerEvents: "none",
          }}
        >
          <QuoteIcon />
        </div>
      )}

      {/* Content — left-padded on featured to clear the accent bar */}
      <div style={{ paddingLeft: t.featured ? 12 : 0 }}>

        {/* Top row: condition tag + location */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {/*
            Condition tag — replaces "Verified client".
            Specific and un-fakeable: "Hashimoto's · Strategy session"
            reads as real clinical context, not a generic badge.
          */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(139,92,246,0.75)",
              lineHeight: 1,
            }}
          >
            {t.condition}
          </span>

          {/* Location badge — unchanged from original */}
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              borderRadius: 99,
              padding: "3px 8px",
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.028)",
              border: "1px solid rgba(255,255,255,0.065)",
            }}
          >
            <svg
              width="7"
              height="7"
              viewBox="0 0 8 8"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
              <circle cx="4" cy="4" r="1" fill="currentColor" opacity="0.6" />
            </svg>
            {t.location}
          </span>
        </div>

        {/* Quote — the emotional core */}
        <blockquote
          style={{
            margin: "16px 0 0",
            fontSize: t.featured ? 15.5 : 14.5,
            fontWeight: 400,
            lineHeight: 1.8,
            color: t.featured
              ? "rgba(255,255,255,0.85)"
              : "rgba(255,255,255,0.65)",
            letterSpacing: "0.005em",
          }}
        >
          &ldquo;{t.quote}&rdquo;
        </blockquote>

        {/* Bottom row: avatar + name + result chip */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {/* Avatar + name */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              aria-hidden="true"
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "rgba(168,85,247,0.9)",
                background: t.featured
                  ? "rgba(139,92,246,0.18)"
                  : "rgba(168,85,247,0.11)",
                border: t.featured
                  ? "1px solid rgba(139,92,246,0.35)"
                  : "1px solid rgba(168,85,247,0.2)",
              }}
            >
              {t.initials}
            </div>
            <div style={{ lineHeight: 1 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.88)",
                  margin: 0,
                }}
              >
                {t.name}
              </p>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.28)",
                  margin: "4px 0 0",
                }}
              >
                {t.location}
              </p>
            </div>
          </div>

          {/* Result chip */}
          <span
            style={{
              flexShrink: 0,
              borderRadius: 99,
              padding: "5px 10px",
              fontSize: 10.5,
              fontWeight: 600,
              lineHeight: 1,
              color: t.result === "Strategy session"
                ? "rgba(52,211,153,0.85)"
                : "rgba(168,85,247,0.9)",
              background: t.result === "Strategy session"
                ? "rgba(52,211,153,0.07)"
                : "rgba(168,85,247,0.055)",
              border: t.result === "Strategy session"
                ? "1px solid rgba(52,211,153,0.18)"
                : "1px solid rgba(168,85,247,0.11)",
            }}
          >
            {t.result}
          </span>
        </div>
      </div>
    </article>
  );
}

// ─── AggregateRating — replaces the Unicode-star bottom anchor ───────────────

function AggregateRating() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        marginTop: 36,
      }}
    >
      {/* SVG stars — consistent with card design, not Unicode characters */}
      <span aria-label="4.9 out of 5 stars" role="img">
        <span aria-hidden="true" style={{ display: "inline-flex", gap: 3 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <svg key={i} width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M6 1L7.545 4.13L11 4.635L8.5 7.07L9.09 10.5L6 8.875L2.91 10.5L3.5 7.07L1 4.635L4.455 4.13L6 1Z"
                fill="rgba(244,196,48,0.6)"
              />
            </svg>
          ))}
        </span>
      </span>
      <p
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "rgba(255,255,255,0.25)",
          textAlign: "center",
          lineHeight: 1.55,
          margin: 0,
          letterSpacing: "0.01em",
        }}
      >
        4.9 · Trusted by 200+ Indian hypothyroid women · Thyroid-specific coaching only
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SocialProof() {
  // Single observer on the card list — stagger is driven by CSS transition-delay
  // on each card using its index. Avoids N separate IntersectionObservers.
  const { ref, visible } = useInView(0.08);

  return (
    <section
      aria-label="Client testimonials"
      className="relative overflow-hidden border-b border-white/[0.04] bg-[var(--bg-section)] py-[clamp(3.5rem,9vw,5.5rem)]"
    >
      {/* Hero → section edge blend */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-16"
        style={{
          background: "linear-gradient(to bottom, var(--bg-page), transparent)",
        }}
      />

      {/* Ambient glow — unchanged from original */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-50%] h-20 w-[46vw] max-w-[220px] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.05] blur-[64px]" />
      </div>

      <div className="container-narrow relative z-10">

        {/* Section header */}
        <div className="mb-9 text-center sm:mb-11">
          <p className="section-label">Client Stories</p>
          {/*
            Headline unchanged — "They were where you are" is excellent.
            Subtitle improved: the original "Real food. Real results." is a
            feature claim. The new line speaks to the emotional context:
            "Not transformations. Breakthroughs." — premium, precise, different.
          */}
          <h2 className="section-title mt-1 text-balance leading-[1.06] tracking-[-0.038em]">
            They were where you are.
          </h2>
          <p className="mx-auto mt-3 max-w-[28ch] text-center text-pretty text-[length:var(--text-sm)] leading-[1.68] text-[var(--t3)]">
            Not transformations. Breakthroughs.
          </p>
        </div>

        {/* Testimonial cards — single observer, CSS stagger per card */}
        <div ref={ref} className="flex flex-col gap-[16px]" role="list">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard
              key={t.name}
              t={t}
              index={i}
              visible={visible}
            />
          ))}
        </div>

        {/* Aggregate rating — SVG stars, restrained typography */}
        <AggregateRating />

      </div>
    </section>
  );
}