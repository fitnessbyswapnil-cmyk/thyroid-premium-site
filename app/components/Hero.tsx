// Hero.tsx — Mobile-first premium thyroid fat-loss coaching hero
// Stack: Next.js · React · Tailwind CSS v4
// Design: Black + Purple luxury wellness funnel
"use client";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-black text-white">

      {/* ── Background Glow ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-8%] h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-purple-600/[0.14] blur-[100px] md:h-[650px] md:w-[650px] md:blur-[140px]" />
      </div>

      {/* ── Main Container ── */}
      <div className="hero-container relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">

        {/* ── 1. URGENCY BADGE ── */}
        <div className="badge-pill" role="status" aria-live="polite">
          <span className="badge-dot" aria-hidden="true" />
          <span>Only 5 Spots Left This Month</span>
        </div>

        {/* ── 2. EYEBROW ── */}
        <p className="eyebrow">
          For Indian women with hypothyroidism
        </p>

        {/* ── 3. MAIN HEADLINE ── */}
        <h1 className="headline">
          Lose the
          <span className="headline-accent">Belly Fat.</span>
          <span className="headline-white">In 90 Days.</span>
        </h1>

        {/* ── 4. SUB-HEADLINE ── */}
        <p className="subheadline">
          India&apos;s #1 thyroid fat-loss coaching.{" "}
          <strong className="subheadline-strong">
            10–15 kg lost. Clothes fitting. Energy back.
          </strong>
        </p>

        {/* ── 5. STAT CHIPS ROW ── */}
        <div className="stat-row" aria-label="Program statistics">
          <div className="stat-chip">
            <span className="stat-num">200+</span>
            <span className="stat-label">Women Transformed</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-chip">
            <span className="stat-num">90</span>
            <span className="stat-label">Day Program</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-chip">
            <span className="stat-num">10–15</span>
            <span className="stat-label">Kg Fat Loss</span>
          </div>
        </div>

        {/* ── 6. OUTCOME BULLETS ── */}
        <ul className="outcome-list" aria-label="What you will achieve">
          {[
            "Stubborn belly fat visibly reduced",
            "Clothes fitting better within weeks",
            "No starvation — real food protocol",
            "Energy & confidence fully restored",
          ].map((item) => (
            <li key={item} className="outcome-item">
              <span className="outcome-check" aria-hidden="true">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* ── 7. PRIMARY CTA ── */}
        <div className="cta-wrap">
          <button
            id="cta-hero"
            type="button"
            aria-label="Book your free 60-minute thyroid fat-loss consultation call"
            className="cta-button"
            onClick={() =>
              (window.location.href =
                "https://swapnilumbarkarfitness.in/case-studies/#cta")
            }
          >
            🔥 Book FREE Consultation Call
            <span className="cta-sub">60 Min · Free · Limited Spots</span>
          </button>

          <p className="micro-trust">
            ★★★★★ Trusted by 200+ hypothyroid women across India
          </p>
        </div>

      </div>
    </section>
  );
}