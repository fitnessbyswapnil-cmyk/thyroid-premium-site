"use client";

import CtaButton from "./CtaButton";
import HeroVideo from "./HeroVideo";
import HeroProofStrip from "./HeroProofStrip";

// VSL hero — mockup layout: eyebrow → serif headline → subhead → credential
// strip → video frame → social-proof strip → CTA → reassurance line.
// Free-session copy matches the sitewide free funnel (every other CTA, FAQ,
// sticky bar — the paid ₹299 flow no longer exists anywhere on this site).

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[var(--bg-page)] text-white"
      aria-labelledby="hero-heading"
    >
      {/* Atmospheric glow (native purple) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(70vw,440px)] overflow-hidden sm:h-[520px]"
      >
        <div className="absolute left-1/2 top-[-22%] h-[min(82vw,340px)] w-[min(82vw,340px)] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.11] blur-[120px]" />
        <div className="absolute left-1/2 top-[10%] h-[100px] w-[min(88vw,420px)] -translate-x-1/2 rounded-full bg-[#c026d3]/[0.045] blur-[78px]" />
      </div>

      {/* Film-grain texture — ~4% opacity, barely perceptible, adds richness */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="container-default relative z-10 mx-auto flex flex-col items-center pb-[clamp(4rem,11vw,6rem)] pt-[clamp(3.25rem,8vw,5rem)] text-center">

        {/* a) Eyebrow — unchanged */}
        <div className="hero-rise flex w-full items-center justify-center gap-3" style={{ animationDelay: "0ms" }}>
          <span
            aria-hidden="true"
            className="hidden h-px w-8 shrink-0 sm:block sm:w-10"
            style={{ background: "linear-gradient(90deg,transparent,rgba(213,183,101,0.55))" }}
          />
          <p className="max-w-[34ch] text-[11px] font-semibold uppercase leading-[1.5] tracking-[0.2em] text-[var(--t3)] sm:max-w-none sm:text-[11.5px] sm:tracking-[0.22em]">
            For busy working women, 28+, living with hypothyroidism
          </p>
          <span
            aria-hidden="true"
            className="hidden h-px w-8 shrink-0 sm:block sm:w-10"
            style={{ background: "linear-gradient(90deg,rgba(213,183,101,0.55),transparent)" }}
          />
        </div>

        {/* b) Headline */}
        <h1
          id="hero-heading"
          className="hero-rise mx-auto mt-[30px] max-w-[20ch] text-balance font-bold leading-[1.06] tracking-[-0.02em] sm:max-w-[24ch]"
          style={{
            animationDelay: "100ms",
            fontSize: "clamp(2.05rem, 1.5rem + 2.6vw, 3.9rem)",
            fontFamily: "var(--font-display), Georgia, serif",
          }}
        >
          Finally, a Thyroid-Specific Plan
          <br className="hidden sm:block" />{" "}
          That Helps You{" "}
          <span className="text-gradient italic">
            Lose Weight &amp; Get Your Energy Back.
          </span>
        </h1>

        {/* c) Subhead */}
        <p
          className="hero-rise mt-[22px] max-w-[46ch] text-pretty leading-[1.6] text-[var(--t2)]"
          style={{ animationDelay: "200ms", fontSize: "clamp(0.98rem, 0.94rem + 0.35vw, 1.1rem)" }}
        >
          One private 60-minute session to find your root cause and get your
          90-day plan.
          <span className="mt-1 block">Real Indian food. No starving.</span>
        </p>

        {/* d) Credential strip */}
        <div
          className="hero-rise mt-[26px] flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
          style={{ animationDelay: "300ms" }}
          aria-label="Credentials"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--p400)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.5 4.5-1.35 8-6.25 8-11.5V6l-8-4z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          {["ACE & INFS Certified", "Thyroid-Only", "By Private Intake"].map((c, i) => (
            <span key={c} className="flex items-center gap-x-3">
              {i > 0 && <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[var(--t5)]" />}
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--t3)]">
                {c}
              </span>
            </span>
          ))}
        </div>

        {/* e) VSL video frame */}
        <div className="hero-rise w-full" style={{ animationDelay: "400ms" }}>
          <HeroVideo />
        </div>

        {/* f) Social-proof strip */}
        <div className="hero-rise w-full" style={{ animationDelay: "520ms" }}>
          <HeroProofStrip />
        </div>

        {/* g) Primary CTA */}
        <div className="hero-rise mt-[40px] w-full max-w-[720px]" style={{ animationDelay: "620ms" }}>
          <CtaButton
            variant="primary"
            className="relative z-[1] w-full"
            label="Book My Free Thyroid Session"
            sublabel="60-min private 1-on-1 · Free, no card needed · Limited weekly intake"
            ariaLabel="Book your free private thyroid session"
            location="hero"
            showArrow
          />
        </div>

        {/* h) Reassurance line */}
        <p
          className="hero-rise mt-[18px] flex items-center gap-2 text-[12px] text-[var(--t4)]"
          style={{ animationDelay: "720ms" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          Private. Personalised. Built around YOUR thyroid.
        </p>

      </div>
    </section>
  );
}
