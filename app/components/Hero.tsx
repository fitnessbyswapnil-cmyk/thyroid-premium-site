"use client";

import CtaButton from "./CtaButton";
import HeroVideo from "./HeroVideo";
import HeroProofStrip from "./HeroProofStrip";

// VSL hero — approved Claude Design "final" port: gold-diamond eyebrow and
// credential chips, gradient-ring video frame, tactile pill CTA, drifting
// aurora glows. Primary CTA books the Rs 299 consultation directly (see
// ScarcityProvider.goToCta → Cashfree form); a soft secondary link offers
// the free Thyroid Score quiz so hesitant visitors still become leads.

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[var(--bg-page)] text-white"
      aria-labelledby="hero-heading"
    >
      {/* Atmospheric glow — slow-drifting aurora (approved design port) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(70vw,440px)] overflow-hidden sm:h-[520px]"
      >
        <div className="hero-aurora-1 absolute left-1/2 top-[-22%] h-[min(82vw,340px)] w-[min(82vw,340px)] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.11] blur-[120px]" />
        <div className="hero-aurora-2 absolute left-1/2 top-[10%] h-[140px] w-[min(88vw,420px)] -translate-x-1/2 rounded-full bg-[#7c3aed]/[0.06] blur-[90px]" />
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

        {/* a) Eyebrow — gold diamond marker (approved design port) */}
        <div className="hero-rise flex w-full items-center justify-center gap-2" style={{ animationDelay: "0ms" }}>
          <span aria-hidden="true" style={{ color: "#d5b765", fontSize: 7, lineHeight: 1 }}>◆</span>
          <p className="max-w-[34ch] text-[11px] font-semibold uppercase leading-[1.5] tracking-[0.2em] text-[var(--t3)] sm:max-w-none sm:text-[11.5px] sm:tracking-[0.22em]">
            For working women 28+ with hypothyroidism
          </p>
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
          Finally &mdash; a Thyroid-Specific Plan
          <br className="hidden sm:block" />{" "}
          to{" "}
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

        {/* d) Credential strip — gold diamonds before each chip (design port) */}
        <div
          className="hero-rise mt-[26px] flex flex-wrap items-center justify-center gap-x-[18px] gap-y-2"
          style={{ animationDelay: "300ms" }}
          aria-label="Credentials"
        >
          {["ACE & INFS Certified", "Thyroid-Only", "By Private Intake"].map((c) => (
            <span key={c} className="inline-flex items-center gap-[7px]">
              <span aria-hidden="true" style={{ color: "#d5b765", fontSize: 6, lineHeight: 1 }}>◆</span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--t3)]">
                {c}
              </span>
            </span>
          ))}
        </div>

        {/* e) VSL video frame — purple→gold gradient ring + deep shadow (design port) */}
        <div
          className="hero-rise w-full"
          style={{
            animationDelay: "400ms",
            borderRadius: 22,
            padding: 1,
            background:
              "linear-gradient(165deg, rgba(199,147,255,0.42), rgba(38,36,44,0.95) 28%, rgba(38,36,44,0.95) 72%, rgba(213,183,101,0.28))",
            boxShadow:
              "0 34px 80px -24px rgba(0,0,0,0.75), 0 20px 60px -14px rgba(168,85,247,0.16)",
            overflow: "hidden",
          }}
        >
          <HeroVideo />
        </div>

        {/* f) Social-proof strip */}
        <div className="hero-rise w-full" style={{ animationDelay: "520ms" }}>
          <HeroProofStrip />
        </div>

        {/* g) Primary CTA — books the Rs 299 consultation directly. Price is
            stated up front: the click lands on a payment form, and a surprise
            price is a burned click. */}
        <div className="hero-rise mt-[40px] w-full max-w-[430px]" style={{ animationDelay: "620ms" }}>
          <CtaButton
            variant="primary"
            className="relative z-[1] w-full"
            label="Book My Thyroid Consultation — ₹299"
            sublabel="60-min private 1-on-1 with Swapnil · Fully adjusted against your plan · Limited weekly slots"
            ariaLabel="Book your private thyroid consultation call for 299 rupees"
            location="hero"
            showArrow
          />
          {/* Soft secondary path — hesitant visitors become leads via the free quiz */}
          <a
            href="/assessment"
            className="mt-4 inline-block text-[12px] font-medium text-[var(--t3)] underline decoration-[rgba(168,85,247,0.4)] underline-offset-4 transition-colors hover:text-[var(--p400)]"
          >
            Not sure yet? Get your free Thyroid Score first →
          </a>
        </div>

        {/* Reassurance line removed per audit — the credential chips above
            already say Thyroid-Only + By Private Intake. */}

      </div>
    </section>
  );
}
