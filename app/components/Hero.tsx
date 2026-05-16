"use client";

const CTA_URL =
  "https://swapnilumbarkarfitness.in/case-studies/#cta";

const OUTCOMES = [
  "Metabolism-safe fat loss",
  "Indian home nutrition",
  "Sustained daily energy",
] as const;

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[var(--bg-page)] text-[var(--t1)]"
      aria-labelledby="hero-heading"
    >
      {/* 10% accent — minimal ambient light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px] overflow-hidden sm:h-[300px]"
      >
        <div
          className="absolute left-1/2 top-[-24%] h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.045] blur-[72px]"
        />
      </div>

      <div className="container-default relative z-10 flex flex-col items-center pt-8 pb-12 text-center sm:pt-12 sm:pb-16">
        {/* Selective intake — calm scarcity */}
        <div
          className="mb-5 inline-flex min-h-9 max-w-[20rem] items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[0.7rem] font-semibold leading-snug tracking-[0.02em] text-[var(--t2)] sm:mb-6 sm:max-w-none sm:px-4 sm:text-[0.72rem]"
          role="status"
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--p400)]/70"
            aria-hidden="true"
          />
          Private intake · Select applications this month
        </div>

        {/* 30% secondary — audience + credibility frame */}
        <p className="mb-3 max-w-[28ch] text-[0.68rem] font-semibold uppercase leading-[1.5] tracking-[0.16em] text-[var(--t3)] sm:mb-4 sm:max-w-none sm:text-[0.72rem] sm:tracking-[0.18em]">
          Physiology-led coaching · Women 28–50 · Hypothyroidism
        </p>

        {/* Primary headline — transformation, not hype */}
        <h1
          id="hero-heading"
          className="mx-auto max-w-[13.5ch] text-balance text-[clamp(2.15rem,1.55rem+2.6vw,4.25rem)] font-extrabold leading-[1.08] tracking-[-0.04em] text-[var(--t1)] sm:max-w-[15ch] sm:leading-[1.04] sm:tracking-[-0.05em] md:max-w-[17ch]"
        >
          Release the{" "}
          <span
            className="bg-gradient-to-br from-[#f8f6fc] via-[#e8d9f8] to-[#c4a8e8] bg-clip-text text-transparent"
            style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            thyroid weight
          </span>{" "}
          — gently, and for good.
        </h1>

        {/* Emotional + medical intelligence */}
        <p className="mt-5 max-w-[33ch] text-pretty text-[length:var(--text-sm)] font-normal leading-[1.68] text-[var(--t2)] sm:mt-6 sm:max-w-[40ch] sm:text-[length:var(--text-base)] sm:leading-[1.72]">
          A calm, clinician-informed transformation plan for Indian women whose
          metabolism has been overlooked — built around your thyroid, your
          schedule, and real food at home.
        </p>

        {/* Outcome chips — 30% neutral surfaces */}
        <ul
          className="mt-6 flex max-w-[21rem] flex-wrap items-center justify-center gap-2 sm:mt-7 sm:max-w-none"
          aria-label="What your plan is designed for"
        >
          {OUTCOMES.map((item) => (
            <li key={item}>
              <span className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[0.7rem] font-medium leading-none text-[var(--t2)] sm:text-[0.72rem]">
                {item}
              </span>
            </li>
          ))}
        </ul>

        {/* Thumb-zone CTA cluster */}
        <div className="mt-8 w-full max-w-[min(100%,20.5rem)] sm:mt-10 sm:max-w-[22rem]">
          <p className="mb-3 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[var(--t4)]">
            Step 1 · Confidential application
          </p>

          <button
            type="button"
            className="relative flex w-full min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-full border border-white/[0.12] bg-[linear-gradient(180deg,#f7f5fa_0%,#ece8f2_100%)] px-5 py-3.5 text-[#141518] shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_24px_rgba(0,0,0,0.22)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99] hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_12px_28px_rgba(0,0,0,0.26)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--p500)]"
            onClick={() => window.location.assign(CTA_URL)}
          >
            <span className="text-[clamp(0.92rem,2.6vw,0.98rem)] font-bold leading-tight tracking-[-0.02em]">
              Apply for Your Transformation Plan
            </span>
            <span className="max-w-[30ch] text-center text-[0.7rem] font-medium leading-snug text-[#4b4e58]">
              Private review · Fit assessed before acceptance
            </span>
          </button>

          <p className="mx-auto mt-4 max-w-[31ch] text-pretty text-[0.72rem] leading-[1.6] text-[var(--t4)] sm:max-w-[34ch]">
            <span className="text-[var(--p300)]/90" aria-hidden="true">
              ◆
            </span>{" "}
            Trusted by 200+ hypothyroid women across India · No pressure to
            enroll after your review
          </p>
        </div>
      </div>
    </section>
  );
}
