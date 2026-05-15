"use client";

const CTA_URL =
  "https://swapnilumbarkarfitness.in/case-studies/#cta";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[var(--bg-page)] text-white">
      
      {/* Softer premium glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-20%] h-[280px] w-[280px] -translate-x-1/2 rounded-full bg-purple-500/10 blur-[90px]" />
      </div>

      {/* MAIN CONTAINER */}
      <div className="container-default relative z-10 flex flex-col items-center pt-10 pb-14 text-center sm:pt-14 sm:pb-20">

        {/* Badge */}
        <div className="badge-pill mb-5">
          <span className="badge-dot" />
          Only 5 Spots Left This Month
        </div>

        {/* Eyebrow */}
        <p className="section-label !mb-4 max-w-[22ch] leading-relaxed">
          For Indian women with hypothyroidism
        </p>

        {/* Headline */}
        <h1 className="max-w-[10ch] text-[length:var(--text-hero)] font-black leading-[0.9] tracking-[-0.07em] text-white">
          Lose The{" "}
          <span className="text-gradient">
            Thyroid Belly Fat.
          </span>{" "}
          Sustainably.
        </h1>

        {/* Subheadline */}
        <p className="mt-5 max-w-[30ch] text-[length:var(--text-sm)] leading-[1.75] text-[var(--t2)] sm:text-[length:var(--text-base)]">
          India’s premium thyroid fat-loss coaching for women
          exhausted by failed diets, low energy, and stubborn
          weight gain.
        </p>

        {/* Pills */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {[
            "10–15 kg fat loss",
            "Real Indian food",
            "Energy restored",
          ].map((item) => (
            <div
              key={item}
              className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3.5 py-2 text-[11px] font-semibold text-[var(--t2)] backdrop-blur-sm"
            >
              {item}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8 w-full max-w-sm">
          <button
            className="cta-button"
            onClick={() => window.location.assign(CTA_URL)}
          >
            🔥 Book FREE Strategy Call

            <span className="cta-sub">
              60 Min Consultation · Limited Spots
            </span>
          </button>

          <p className="micro-trust mt-3">
            ★★★★★ Trusted by 200+ hypothyroid women across India
          </p>
        </div>
      </div>
    </section>
  );
}