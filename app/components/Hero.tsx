"use client";

import CtaButton from "./CtaButton";

// Proof chips — one row, wraps on mobile, separated by small gold dots.
const PROOF_CHIPS = [
  "ACE & INFS certified",
  "Thyroid specialist, not general fitness",
  "By private intake",
] as const;

// Warm champagne-gold text accent (the ONLY non-purple highlight) — used solely
// for the "8–10 kg of fat" number. Gold against the site's violet is a classic
// premium pairing; restraint (one purple + one gold accent) is the premium signal.
const GOLD_TEXT: React.CSSProperties = {
  backgroundImage: "linear-gradient(135deg,#f3d99b 0%,#d8b765 52%,#c5a24d 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  fontWeight: 500,
};

const GOLD_DOT = "rgba(213,183,101,0.8)";

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

      <div className="container-default relative z-10 mx-auto flex max-w-[680px] flex-col items-center pb-[clamp(4rem,11vw,6rem)] pt-[clamp(3.25rem,8vw,5rem)] text-center">

        {/* Eyebrow — gold hairline rules each side (sm+), muted uppercase text */}
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

        {/* Headline (single H1) */}
        <h1
          id="hero-heading"
          className="hero-rise mx-auto mt-[30px] max-w-[15ch] text-balance text-[length:clamp(2.4rem,1.75rem_+_2.9vw,4.4rem)] font-black leading-[1.04] tracking-[-0.03em] sm:max-w-[18ch]"
          style={{ animationDelay: "120ms" }}
        >
          You&apos;re not the problem.{" "}
          <span className="text-gradient italic">Your thyroid is.</span>
        </h1>

        {/* Subhead — opacity ladder starts here (brightest) */}
        <p
          className="hero-rise mt-[26px] max-w-[52ch] text-pretty text-[length:clamp(1rem,0.94rem_+_0.4vw,1.16rem)] leading-[1.66] text-[var(--t2)]"
          style={{ animationDelay: "240ms" }}
        >
          You&apos;ve tried every diet. The weight won&apos;t move because your
          thyroid was never the focus. In a private 60-minute session, see exactly
          why &mdash; and how clients typically lose{" "}
          <span style={GOLD_TEXT}>8&ndash;10&nbsp;kg of fat</span> in 3 months,
          eating real Indian food.
        </p>

        {/* Proof chips — gold-dot separators */}
        <ul
          className="hero-rise mt-[40px] flex max-w-[34rem] flex-wrap items-center justify-center gap-x-2.5 gap-y-2"
          style={{ animationDelay: "360ms" }}
          aria-label="Credentials"
        >
          {PROOF_CHIPS.map((chip, i) => (
            <li key={chip} className="flex items-center gap-2.5 text-[13px] font-medium leading-none text-[var(--t3)]">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="inline-block h-1 w-1 shrink-0 rounded-full"
                  style={{ background: GOLD_DOT }}
                />
              )}
              {chip}
            </li>
          ))}
        </ul>

        {/* CTA — native purple primary (matches every other CTA on the page).
            Label/microcopy updated; original booking link + tracking preserved. */}
        <div className="hero-rise mt-[42px] w-full max-w-[min(100%,23rem)]" style={{ animationDelay: "480ms" }}>
          <CtaButton
            variant="primary"
            className="relative z-[1]"
            label="Book Your Private Thyroid Session — ₹299"
            sublabel="60 minutes, 1-on-1 · Your full case studied before we speak"
            ariaLabel="Book your private thyroid session for 299 rupees"
            location="hero"
          />
        </div>

        {/* Scarcity — quiet, static, no looping animation */}
        <p
          className="hero-rise mt-[26px] text-[12px] font-medium tracking-[0.01em] text-[var(--t4)]"
          style={{ animationDelay: "600ms" }}
        >
          Private intake is limited each week
        </p>

      </div>
    </section>
  );
}
