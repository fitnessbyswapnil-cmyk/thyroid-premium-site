"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-black text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] overflow-hidden">
        <div className="absolute left-1/2 top-[-8%] h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-purple-600/[0.14] blur-[100px] md:h-[650px] md:w-[650px] md:blur-[140px]" />
      </div>

      <div className="hero-container relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">

        <div className="badge-pill" role="status" aria-live="polite">
          <span className="badge-dot" aria-hidden="true" />
          <span>Only 5 Spots Left This Month</span>
        </div>

        <p className="eyebrow">For Indian women with hypothyroidism</p>

        <h1 className="headline">
          Lose the
          <span className="headline-accent">Belly Fat.</span>
          <span className="headline-white">In 90 Days.</span>
        </h1>

        <p className="subheadline">
          India&apos;s #1 thyroid fat-loss coaching.{" "}
          <strong className="subheadline-strong">10–15 kg lost. Clothes fitting. Energy back.</strong>
        </p>

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

        <ul className="outcome-list" aria-label="What you will achieve">
          {[
            "Stubborn belly fat visibly reduced",
            "Clothes fitting better within weeks",
            "No starvation — real Indian food",
            "Energy & confidence fully restored",
          ].map((item) => (
            <li key={item} className="outcome-item">
              <span className="outcome-check" aria-hidden="true">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="cta-wrap">
          <button
            id="cta-hero"
            type="button"
            aria-label="Book your free 60-minute thyroid fat-loss consultation call"
            className="cta-button"
            onClick={() => (window.location.href = CTA_URL)}
          >
            🔥 Book FREE Consultation Call
            <span className="cta-sub">60 Min · Free · Limited Spots</span>
          </button>
          <p className="micro-trust">★★★★★ Trusted by 200+ hypothyroid women across India</p>
        </div>

      </div>
    </section>
  );
}