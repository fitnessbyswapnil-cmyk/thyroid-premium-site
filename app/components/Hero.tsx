"use client";

import { useEffect } from "react";

import { pushDL } from "../lib/analytics";
import CtaButton from "./CtaButton";

export type HeroVariant = "default" | "eatless" | "labs";

// Message-matched copy — H1s are verbatim from the live ad images so each
// clicker lands on the exact promise she tapped. The proof-strip quote is the
// quote from that same ad.
const VARIANTS: Record<
  HeroVariant,
  {
    h1Lead: string;
    h1Accent: string;
    body: string;
    quote: string;
    quoteBy: string;
  }
> = {
  default: {
    h1Lead: "You're not the problem.",
    h1Accent: "Your thyroid is.",
    body: "Doing everything right and the weight still won't move? In a private 60-minute session, see exactly what's blocking your fat loss — and the 90-day plan to restart it. Real Indian food, no crash diets.",
    quote: "Metabolism feels alive again.",
    quoteBy: "Priya S.",
  },
  eatless: {
    h1Lead: "Eating less makes it worse.",
    h1Accent: "It slows your thyroid down.",
    body: "Under-eating pushes a slow thyroid even slower. That's why every diet left you more stuck, not lighter. In a private 60-minute session, see what your metabolism actually needs before fat loss can start. Real food, no starving.",
    quote: "No starvation. Real food. Real results.",
    quoteBy: "Anjali M.",
  },
  labs: {
    h1Lead: "Your labs say “normal.”",
    h1Accent: "But you still feel stuck.",
    body: "Tired all day with a “normal” TSH? Bring your reports. In your 60-minute session we go through your TSH, T3, T4 and iron together — and you'll see what they mean for your fat loss.",
    quote: "My TSH is finally in range.",
    quoteBy: "Shariya S.",
  },
};

const GOLD_DOT = "rgba(213,183,101,0.8)";

export default function Hero({ variant = "default" }: { variant?: HeroVariant }) {
  const v = VARIANTS[variant];

  // Expose the variant on the dataLayer so GTM can attach it to
  // ViewContent/Lead and LP→Lead can be read per ad angle in Events Manager.
  useEffect(() => {
    pushDL({ event: "lp_variant", lp_variant: variant });
  }, [variant]);

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

        {/* Headline (single H1) — message-matched to the ad that was clicked */}
        <h1
          id="hero-heading"
          className="hero-rise mx-auto mt-[30px] max-w-[15ch] text-balance text-[length:clamp(2.4rem,1.75rem_+_2.9vw,4.4rem)] font-black leading-[1.04] tracking-[-0.03em] sm:max-w-[18ch]"
          style={{ animationDelay: "120ms" }}
        >
          {v.h1Lead}{" "}
          <span className="text-gradient italic">{v.h1Accent}</span>
        </h1>

        {/* Subhead — opacity ladder starts here (brightest) */}
        <p
          className="hero-rise mt-[26px] max-w-[52ch] text-pretty text-[length:clamp(1rem,0.94rem_+_0.4vw,1.16rem)] leading-[1.66] text-[var(--t2)]"
          style={{ animationDelay: "240ms" }}
        >
          {v.body}
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

        {/* Prep line — pays AD2's "read your reports" promise, lifts show-up quality */}
        <p
          className="hero-rise mt-[16px] text-[12.5px] font-medium leading-[1.5] text-[var(--t3)]"
          style={{ animationDelay: "540ms" }}
        >
          Have your latest thyroid reports? Keep them handy for the session.
        </p>

        {/* Proof strip — the exact quote from the ad she just tapped */}
        <div
          className="hero-rise mt-[24px] flex flex-col items-center gap-1.5"
          style={{ animationDelay: "600ms" }}
        >
          <p className="max-w-[42ch] text-[13.5px] italic leading-[1.6] text-[var(--t2)]">
            &ldquo;{v.quote}&rdquo;{" "}
            <span className="not-italic text-[var(--t3)]">— {v.quoteBy}</span>
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
