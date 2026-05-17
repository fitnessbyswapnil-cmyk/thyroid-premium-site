"use client";

import CtaButton from "./CtaButton";
import ScarcityBadge from "./ScarcityBadge";

// ─── Data ────────────────────────────────────────────────────────────────────

// Outcome chips live ABOVE proof stats so the sequence reads:
//   Promise (headline) → What you'll get (chips) → Proof it works (stats) → Act (CTA)
// This prevents re-opening the "what do I get?" loop between stats and the button.
const OUTCOMES = [
  "4–10 kg thyroid fat loss",
  "Real Indian food only",
  "Energy & hormones restored",
] as const;

// Proof stats unchanged — only their position in the hierarchy changes.
const PROOF_STATS = [
  { num: "200+", label: "Women helped" },
  { num: "4.2 kg", label: "Avg. first month" },
  { num: "4.9 ★", label: "Client rating" },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[var(--bg-page)] text-white"
      aria-labelledby="hero-heading"
    >
      {/* ── Atmospheric glow — two-layer, unchanged ───────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(70vw,440px)] overflow-hidden sm:h-[500px]"
      >
        <div className="absolute left-1/2 top-[-20%] h-[min(78vw,300px)] w-[min(78vw,300px)] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.10] blur-[110px]" />
        <div className="absolute left-1/2 top-[12%] h-[90px] w-[min(88vw,400px)] -translate-x-1/2 rounded-full bg-[#c026d3]/[0.045] blur-[72px]" />
      </div>

      <div className="container-default relative z-10 flex flex-col items-center pb-[clamp(4rem,9vw,6rem)] pt-[clamp(3rem,7vw,4.5rem)] text-center">

        {/* ── 1. Category pill ─────────────────────────────────────────────────
            Credible double-anchor: specialism + audience. Superlatives like
            "only" are unverifiable and trigger silent rejection in educated
            women. The · separator keeps this compact on a single line at
            320px.                                                            */}
        <p className="section-label !mb-4 tracking-[0.065em] sm:!mb-5">
          Thyroid fat-loss specialist&nbsp;·&nbsp;Indian women
        </p>

        {/* ── 2. Headline ──────────────────────────────────────────────────────
            KEPT: "Your Thyroid Weight Isn't Stubborn. It's Untreated."
            This is the strongest element on the page — a two-beat reframe
            that moves the locus of blame from the woman to the diagnosis.
            Croc Brain hook: problem named → responsibility lifted.          */}
        <h1
          id="hero-heading"
          className="mx-auto max-w-[14ch] text-balance text-[length:var(--text-hero)] font-black leading-[1.04] tracking-[-0.045em] sm:max-w-[17ch] sm:leading-[1.0] sm:tracking-[-0.055em]"
        >
          Your Thyroid Weight{" "}
          <span className="text-gradient">Isn&apos;t Stubborn.</span>{" "}
          It&apos;s Untreated.
        </h1>

        {/* ── 3. Subheadline ───────────────────────────────────────────────────
            CHANGE 1: "Built for Indian women with hypothyroidism" removed
            from the end — it broke the emotional sentence with a clinical
            label. Audience signal is already in the category pill.

            CHANGE 2: Sentence 2 rewritten to be more specific and
            consequential. "The problem was always the plan" is vague.
            "Your thyroid was never the focus of the plan" is precise —
            it names the mechanism of failure, which is Limbic validation
            (the woman can now explain why it failed) AND Neocortex
            credibility (there IS a specific, addressable root cause).       */}
        <p className="mt-5 max-w-[30ch] text-pretty text-[length:var(--text-sm)] leading-[1.75] text-[var(--t2)] sm:mt-6 sm:max-w-[38ch] sm:text-[length:var(--text-base)]">
          You&apos;ve followed every diet. Taken every medication. Done
          everything right. The weight stayed because your thyroid was never
          actually the focus of the plan.
        </p>

        {/* ── 4. Outcome chips ─────────────────────────────────────────────────
            CHANGE: Moved from between proof-stats and CTA to HERE — directly
            after the subheadline. Correct psychological sequence:
              Pain (headline) → Why it failed (subheadline) →
              What you'll get (chips) → Proof others got it (stats) → Act (CTA)

            Previously: chips appeared after stats, which re-opened the
            "what am I getting?" question right before the button — a second
            decision loop that stalled conversion intent.                     */}
        <ul
          className="mt-5 flex max-w-[22rem] flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:mt-6 sm:max-w-none"
          aria-label="What you can expect"
        >
          {OUTCOMES.map((item) => (
            <li key={item}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--p-border)] bg-[var(--p-subtle)] px-3 py-[7px] text-[0.71rem] font-semibold leading-none text-[var(--p300)] backdrop-blur-sm sm:text-[0.74rem]">
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 9 9"
                  fill="none"
                  aria-hidden="true"
                  className="shrink-0 opacity-75"
                >
                  <path
                    d="M1.5 4.5L3.5 6.5L7.5 2.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {item}
              </span>
            </li>
          ))}
        </ul>

        {/* ── 5. Proof stats ───────────────────────────────────────────────────
            KEPT: Design and data unchanged. Position change only — now sits
            AFTER the outcome chips (validating the promise just made) rather
            than before them. Glassmorphism container, divider borders, font
            weights all preserved exactly.                                   */}
        <div
          className="mt-6 flex w-full max-w-[min(100%,19.5rem)] overflow-hidden rounded-2xl sm:mt-7 sm:max-w-[23rem]"
          style={{
            background: "rgba(255,255,255,0.036)",
            border: "1px solid rgba(255,255,255,0.075)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.2)",
          }}
        >
          {PROOF_STATS.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-1 flex-col items-center justify-center py-3.5 sm:py-4 ${
                i !== PROOF_STATS.length - 1
                  ? "border-r border-white/[0.06]"
                  : ""
              }`}
            >
              <span className="font-mono text-[13.5px] font-extrabold leading-none tracking-tight text-[var(--p300)] sm:text-[15px]">
                {s.num}
              </span>
              <span className="mt-[6px] text-[9px] font-semibold uppercase tracking-[0.1em] text-white/[0.32] sm:text-[9.5px]">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── 6. CTA block ─────────────────────────────────────────────────────
            Five key fixes in this block:
            1. sublabel duration corrected to match every other page reference
            2. "Written plan included" added — pre-handles Uncertainty Objection
               without stating it explicitly
            3. Risk reversal now speaks to value (clarity), not price — removes
               the double price-mention that created transaction anxiety
            4. The duplicate social proof line below the button is removed —
               the proof stats widget directly above already carries that claim
            5. mt tightened (mt-10 → mt-8 mobile) to keep emotional momentum
               from the subheadline alive through to the button                */
        <div className="cta-wrap relative mt-8 w-full max-w-[min(100%,21rem)] sm:mt-9 sm:max-w-sm">
          <CtaButton
            variant="primary"
            className="relative z-[1]"
            label="Book My ₹299 Thyroid Strategy Session"
            sublabel="60 min · Private · Written plan included"
            ariaLabel="Book your 299 rupee thyroid strategy session"
          />

          {/* Risk reversal — single clean line. Speaks to outcome not price. */}
          <p className="mt-3.5 text-center text-[0.67rem] font-medium leading-[1.5] text-[var(--t4)]">
            <span className="mr-1 text-emerald-400/70" aria-hidden="true">
              &#10003;
            </span>
            Full refund if you don&apos;t leave with clarity &mdash; no questions asked
          </p>
        </div>

        {/* ── 7. Scarcity badge ────────────────────────────────────────────────
            CHANGE: Moved from the very top of the hero (position 1) to here
            (position 7, after the CTA).

            WHY THIS MATTERS:
            Premium brands never open with urgency. Apple, Aesop, and luxury
            wellness brands open with identity and transformation — urgency
            appears only after the visitor has already formed intent.

            Leading with a scarcity badge signals "we're going to sell you
            something" before the headline has had a chance to make the
            visitor feel understood. The Croc Brain pattern-matches this as
            pressure and activates the exit filter.

            Placed here, after the CTA, it functions as a closing push for
            the visitor who is already considering but hasn't tapped yet —
            which is exactly the right psychological moment for urgency.    */}
        <ScarcityBadge className="mt-5 sm:mt-6" />

        {/* ── 8. Scroll cue — unchanged ────────────────────────────────────── */}
        <div
          className="mt-10 flex flex-col items-center gap-1.5 sm:mt-12"
          aria-hidden="true"
        >
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/[0.18]">
            See real results
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 15 15"
            fill="none"
            className="animate-bounce text-white/[0.16]"
          >
            <path
              d="M2.5 5.5L7.5 10.5L12.5 5.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

      </div>
    </section>
  );
}