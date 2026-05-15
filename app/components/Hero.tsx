"use client";

const CTA_URL =
  "https://swapnilumbarkarfitness.in/case-studies/#cta";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[var(--bg-page)] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      <div className="container-default relative z-10 flex min-h-screen flex-col items-center justify-center py-24 text-center md:py-32">
        <div className="badge-pill mb-6">
          <span className="badge-dot" />
          Only 5 Spots Left This Month
        </div>

        <p className="section-label">
          For Indian women with hypothyroidism
        </p>

        <h1 className="max-w-[11ch] text-[length:var(--text-hero)] font-black leading-[0.92] tracking-[-0.06em] text-white">
          Lose The{" "}
          <span className="text-gradient">
            Thyroid Belly Fat.
          </span>{" "}
          Sustainably.
        </h1>

        <p className="mt-6 max-w-[34ch] text-[length:var(--text-base)] leading-relaxed text-[var(--t2)]">
          India’s premium thyroid fat-loss coaching for women
          who are exhausted by failed diets, low energy, and
          stubborn weight gain.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {[
            "10–15 kg fat loss",
            "Real Indian food",
            "Energy restored",
          ].map((item) => (
            <div
              key={item}
              className="rounded-full border border-white/6 bg-white/5 px-4 py-2 text-[0.78rem] font-semibold text-[var(--t2)]"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="mt-10 w-full max-w-md">
          <button
            className="cta-button"
            onClick={() => window.location.assign(CTA_URL)}
          >
            🔥 Book FREE Strategy Call
            <span className="cta-sub">
              60 Min Consultation · Limited Spots
            </span>
          </button>

          <p className="micro-trust mt-4">
            ★★★★★ Trusted by 200+ hypothyroid women across
            India
          </p>
        </div>
      </div>
    </section>
  );
}