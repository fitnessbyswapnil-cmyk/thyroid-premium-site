"use client";

import CtaButton from "./CtaButton";

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

        {/* Subhead — opacity ladder starts here (brightest). One static body
            speaking to all three ad angles (eating less / normal labs / not you). */}
        <p
          className="hero-rise mt-[26px] max-w-[52ch] text-pretty text-[length:clamp(1rem,0.94rem_+_0.4vw,1.16rem)] leading-[1.66] text-[var(--t2)]"
          style={{ animationDelay: "240ms" }}
        >
          Eating less. &lsquo;Normal&rsquo; labs. Doing everything right. The
          weight still won&apos;t move &mdash; because your thyroid was never
          the focus. In one private 60-minute session, see what&apos;s blocking
          your fat loss and the 90-day plan to restart it. Real Indian food, no
          starving.
        </p>

        {/* Credentials — collapsed to one line so the CTA sits above the fold */}
        <p
          className="hero-rise mt-[36px] text-[13px] font-medium leading-[1.5] text-[var(--t3)]"
          style={{ animationDelay: "360ms" }}
          aria-label="Credentials"
        >
          ACE &amp; INFS certified · Thyroid-only · By private intake
        </p>

        {/* CTA — native purple primary (matches every other CTA on the page).
            Label/microcopy updated; original booking link + tracking preserved. */}
        <div className="hero-rise mt-[38px] w-full max-w-[min(100%,23rem)]" style={{ animationDelay: "480ms" }}>
          <CtaButton
            variant="primary"
            className="relative z-[1]"
            label="Book My Free Thyroid Session"
            sublabel="60 minutes, 1-on-1 · Your full case studied before we speak"
            ariaLabel="Book your free private thyroid session"
            location="hero"
          />
        </div>

        {/* Prep line — pays the "read your reports" ad promise, lifts show-up quality */}
        <p
          className="hero-rise mt-[16px] text-[12.5px] font-medium leading-[1.5] text-[var(--t3)]"
          style={{ animationDelay: "540ms" }}
        >
          Have your latest thyroid reports? Keep them handy for the session.
        </p>

        {/* Secondary link — smooth-scrolls (global scroll-behavior) to the
            6-step session breakdown just above the final CTA */}
        <a
          href="#how-it-works"
          className="hero-rise mt-[10px] text-[14px] font-medium text-[var(--t3)] underline decoration-[rgba(168,85,247,0.4)] underline-offset-4 transition-colors hover:text-[var(--t2)]"
          style={{ animationDelay: "570ms" }}
        >
          See how the session works ↓
        </a>

        {/* Proof strip — client quote + trust line */}
        <div
          className="hero-rise mt-[24px] flex flex-col items-center gap-1.5"
          style={{ animationDelay: "600ms" }}
        >
          <p className="max-w-[42ch] text-[13.5px] italic leading-[1.6] text-[var(--t2)]">
            &ldquo;Metabolism feels alive again.&rdquo;{" "}
            <span className="not-italic text-[var(--t3)]">— Priya S.</span>
          </p>
          <p className="flex items-center gap-2 text-[11.5px] font-medium tracking-[0.02em] text-[var(--t4)]">
            <span
              aria-hidden="true"
              className="inline-block h-1 w-1 shrink-0 rounded-full"
              style={{ background: GOLD_DOT }}
            />
            Trusted by 200+ Indian women with hypothyroidism
          </p>
        </div>

        {/* Scarcity — quiet, static, no looping animation */}
        <p
          className="hero-rise mt-[22px] text-[12px] font-medium tracking-[0.01em] text-[var(--t4)]"
          style={{ animationDelay: "660ms" }}
        >
          Private intake is limited each week
        </p>

      </div>
    </section>
  );
}
