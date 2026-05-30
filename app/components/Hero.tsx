"use client";

import CtaButton from "./CtaButton";
import ScarcityBadge from "./ScarcityBadge";

const OUTCOMES = [
  "4–10 kg thyroid fat loss",
  "Real Indian food only",
  "Energy & hormones restored",
] as const;

const PROOF_STATS = [
  { num: "200+", label: "Women helped" },
  { num: "4.2 kg", label: "Avg. first month" },
  { num: "4.9 ★", label: "Client rating" },
] as const;

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[var(--bg-page)] text-white"
      aria-labelledby="hero-heading"
    >
      {/* Atmospheric glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(70vw,440px)] overflow-hidden sm:h-[500px]"
      >
        <div className="absolute left-1/2 top-[-20%] h-[min(78vw,300px)] w-[min(78vw,300px)] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.10] blur-[110px]" />
        <div className="absolute left-1/2 top-[12%] h-[90px] w-[min(88vw,400px)] -translate-x-1/2 rounded-full bg-[#c026d3]/[0.045] blur-[72px]" />
      </div>

      <div className="container-default relative z-10 flex flex-col items-center pb-[clamp(4rem,9vw,6rem)] pt-[clamp(3rem,7vw,4.5rem)] text-center">

        {/* Category pill */}
        <p className="section-label !mb-3 tracking-[0.065em] sm:!mb-4">
          Thyroid fat-loss specialist&nbsp;&middot;&nbsp;Indian women
        </p>

        {/* Headline */}
        <h1
          id="hero-heading"
          className="mx-auto max-w-[14ch] text-balance text-[length:var(--text-hero)] font-black leading-[1.04] tracking-[-0.045em] sm:max-w-[17ch] sm:leading-[1.0] sm:tracking-[-0.055em]"
        >
          Your Thyroid Weight{" "}
          <span className="text-gradient">Isn&apos;t Stubborn.</span>{" "}
          It&apos;s Untreated.
        </h1>

        {/* Subheadline */}
        <p className="mt-4 max-w-[30ch] text-pretty text-[length:var(--text-sm)] leading-[1.75] text-[var(--t2)] sm:mt-5 sm:max-w-[38ch] sm:text-[length:var(--text-base)]">
          You&apos;ve done everything right. The weight stayed because your
          thyroid was never the focus.
        </p>

        {/* CTA block — aspiration-led, LOW glow intensity */}
        <div className="cta-wrap relative mt-6 w-full max-w-[min(100%,21rem)] sm:mt-7 sm:max-w-sm">
          <CtaButton
            variant="primary"
            className="relative z-[1]"
            label="Book My ₹299 Thyroid Session"
            sublabel="60-min private 1-on-1 · Full refund if you don't get clarity"
            ariaLabel="Start understanding your thyroid — book a private 299 rupee session"
            location="hero"
          />

          {/* Risk reversal */}
          <p className="mt-3.5 text-center text-[0.67rem] font-medium leading-[1.5] text-[var(--t4)]">
            <span className="mr-1 text-emerald-400/70" aria-hidden="true">
              &#10003;
            </span>
            Full refund if you don&apos;t leave with clarity &mdash; no questions asked
          </p>
        </div>

        {/* Outcome chips — pain → mechanism → what you get → proof → act */}
        <ul
          className="mt-8 flex max-w-[22rem] flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:mt-9 sm:max-w-none"
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

        {/* Proof stats */}
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

        {/* Scarcity badge — placed after CTA, urgency only after intent is formed */}
        <ScarcityBadge className="mt-5 sm:mt-6" />

        {/* Scroll cue */}
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
