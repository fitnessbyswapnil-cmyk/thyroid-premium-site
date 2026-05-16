"use client";

import CtaButton from "./CtaButton";
import ScarcityBadge from "./ScarcityBadge";

const OUTCOMES = [
  "10–15 kg sustainable fat loss",
  "Real Indian food",
  "Energy & confidence back",
] as const;

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[var(--bg-page)] text-white"
      aria-labelledby="hero-heading"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(58vw,340px)] overflow-hidden sm:h-[400px]"
      >
        <div className="absolute left-1/2 top-[-22%] h-[min(78vw,290px)] w-[min(78vw,290px)] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.11] blur-[88px]" />
        <div className="absolute left-1/2 top-[6%] h-[120px] w-[min(92vw,440px)] -translate-x-1/2 rounded-full bg-[#c026d3]/[0.06] blur-[70px]" />
      </div>

      <div className="container-default relative z-10 flex flex-col items-center pt-[clamp(2rem,5.5vw,3.25rem)] pb-[clamp(2.75rem,7vw,4.5rem)] text-center sm:pt-14 sm:pb-20">
        <ScarcityBadge className="mb-5 sm:mb-6" />

        <p className="section-label !mb-4 max-w-[24ch] leading-[1.55] sm:max-w-none">
          Premium thyroid fat-loss coaching for Indian women
        </p>

        <h1
          id="hero-heading"
          className="mx-auto max-w-[14ch] text-balance text-[length:var(--text-hero)] font-black leading-[1.03] tracking-[-0.045em] text-white sm:max-w-[16ch] sm:leading-[0.98] sm:tracking-[-0.06em] md:max-w-[18ch] md:leading-[0.94]"
        >
          Finally Lose the{" "}
          <span className="text-gradient">Thyroid Belly Fat</span> — and feel
          lighter again.
        </h1>

        <p className="mt-5 max-w-[34ch] text-pretty text-[length:var(--text-sm)] leading-[1.68] text-[var(--t2)] sm:mt-6 sm:max-w-[40ch] sm:text-[length:var(--text-base)] sm:leading-[1.72]">
          Someone who gets why thyroid weight loss feels impossible — with
          personalized coaching, real Indian food, and step-by-step guidance so
          you stay consistent and see results you can keep.
        </p>

        <ul
          className="mt-6 flex max-w-[22rem] flex-wrap items-center justify-center gap-2 sm:mt-7 sm:max-w-none"
          aria-label="What you can expect"
        >
          {OUTCOMES.map((item) => (
            <li key={item}>
              <span className="inline-flex items-center rounded-full border border-[var(--p-border)] bg-[var(--p-subtle)] px-3 py-2 text-[0.71rem] font-semibold leading-none text-[var(--p300)] backdrop-blur-sm sm:text-[0.74rem]">
                {item}
              </span>
            </li>
          ))}
        </ul>

        <div className="cta-wrap relative mt-8 w-full max-w-[min(100%,21.5rem)] sm:mt-10 sm:max-w-sm">
          <CtaButton
            variant="primary"
            className="relative z-[1] min-h-[58px]"
            label="Apply For Your ₹299 Strategy Session"
            sublabel="Private thyroid consultation · Fit reviewed before coaching"
            ariaLabel="Apply for your 299 rupee thyroid strategy session"
          />

          <p className="micro-trust mx-auto mt-4 max-w-[33ch] text-pretty leading-[1.58] sm:max-w-[36ch]">
            <span
              className="mr-1 tracking-widest text-[var(--p300)]"
              aria-hidden="true"
            >
              ★★★★★
            </span>
            <span className="text-[var(--t3)]">
              Trusted by 200+ hypothyroid women · Led by Swapnil Umbarkar,
              thyroid fat-loss specialist
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
