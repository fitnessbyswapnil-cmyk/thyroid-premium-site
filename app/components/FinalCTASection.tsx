"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const includes = [
  "Personalized thyroid fat-loss protocol",
  "Indian nutrition plan for your metabolism",
  "Weekly tracking — weight, inches & energy",
  "Direct WhatsApp accountability support",
  "Symptom & confidence recovery roadmap",
];

const certs = ["ACE Certified", "FITR Certified", "INFS Certified"];

export default function FinalCTASection() {
  return (
    <section className="section-pad bg-black text-white">

      {/* Strongest glow — conversion climax */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[500px]">
        <div className="absolute left-1/2 top-[-5%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-purple-600/[0.12] blur-[120px] md:h-[700px] md:w-[700px] md:blur-[160px]" />
      </div>

      <div className="container-narrow relative z-10 text-center">

        {/* 1. Urgency badge */}
        <div className="badge-pill mx-auto mb-4 w-fit" role="status" aria-live="polite">
          <span className="badge-dot" aria-hidden="true" />
          <span>Only 5 Spots Left This Month</span>
        </div>

        {/* 2. Close headline */}
        <p className="section-label mb-2">Start Today</p>
        <h2 className="section-title mx-auto mb-3 max-w-[24ch]">
          Your Thyroid Transformation{" "}
          <span className="text-gradient">Starts Here.</span>
        </h2>

        <p
          className="mx-auto mb-5 max-w-[30ch] text-gray-400"
          style={{ fontSize: "var(--text-sm)", lineHeight: 1.6 }}
        >
          Book a free 60-min strategy call.{" "}
          <strong className="font-semibold text-gray-200">
            No pressure. No upsells. Just clarity.
          </strong>
        </p>

        {/* 3. Coach authority card */}
        <div className="glass-card mb-4 overflow-hidden">
          <div className="flex flex-col items-center gap-3 p-4 sm:flex-row sm:text-left">

            {/* Coach avatar */}
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-purple-500/40">
              {/* Replace with: <Image src="/coach.jpg" alt="Swapnil Umbarkar" fill className="object-cover" /> */}
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/30 to-purple-600/20 font-black text-purple-300"
                style={{ fontSize: "var(--text-md)" }}
              >
                SU
              </div>
            </div>

            <div>
              <p
                className="font-semibold uppercase tracking-wider text-purple-400"
                style={{ fontSize: "var(--text-xs)" }}
              >
                India&apos;s Leading Thyroid Fat-Loss Coach
              </p>
              <p className="mt-0.5 font-bold text-white" style={{ fontSize: "var(--text-base)" }}>
                Swapnil Umbarkar
              </p>
              <div className="mt-1.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {certs.map((c) => (
                  <span key={c} className="chip">{c}</span>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* 4. What's included */}
        <div className="mb-5 rounded-[18px] border border-purple-500/20 bg-purple-500/[0.06] p-4 text-left">
          <p
            className="mb-3 font-semibold uppercase tracking-wider text-purple-400"
            style={{ fontSize: "var(--text-xs)" }}
          >
            Your Free Call Includes
          </p>
          <ul className="space-y-2">
            {includes.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 font-bold leading-none text-purple-500">✓</span>
                <span className="leading-snug text-gray-300" style={{ fontSize: "var(--text-xs)" }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 5. Primary CTA block */}
        <div className="cta-wrap mx-auto">
          <button
            id="cta-final"
            type="button"
            aria-label="Book your free thyroid fat-loss strategy call"
            className="cta-button"
            onClick={() => window.location.assign(CTA_URL)}
          >
            🔥 Book FREE Strategy Call
            <span className="cta-sub">60 Min · Free · Limited Spots This Month</span>
          </button>

          {/* 6. Objection handler */}
          <div className="flex items-center justify-center gap-2">
            {["No credit card", "Completely free", "No commitment"].map((obj, i) => (
              <span key={obj} className="flex items-center gap-2">
                {i > 0 && <span className="h-3 w-px bg-white/10" aria-hidden="true" />}
                <span className="text-[9px] font-medium uppercase tracking-wider text-gray-600">
                  {obj}
                </span>
              </span>
            ))}
          </div>

          <p className="micro-trust">★★★★★ 200+ thyroid women transformed across India</p>
        </div>

      </div>
    </section>
  );
}