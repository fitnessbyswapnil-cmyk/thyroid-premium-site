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

      {/* ── Strongest support-section glow — signals conversion climax ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[480px] overflow-hidden">
        <div className="absolute left-1/2 top-[-5%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-purple-600/[0.10] blur-[110px] md:h-[680px] md:w-[680px] md:blur-[150px]" />
      </div>

      <div className="container-narrow relative z-10 text-center">

        {/* ── 1. Urgency badge — prominent, not a footnote ── */}
        <div className="badge-pill mx-auto mb-4 w-fit" role="status" aria-live="polite">
          <span className="badge-dot" aria-hidden="true" />
          <span>Only 5 Spots Left This Month</span>
        </div>

        {/* ── 2. Declarative close headline — assumes decision is made ── */}
        <p className="section-label mb-2">Start Today</p>
        <h2 className="section-title mx-auto mb-3 max-w-[24ch]">
          Your Thyroid Transformation{" "}
          <span className="text-gradient">Starts Here.</span>
        </h2>

        <p className="mx-auto mb-6 max-w-[30ch] text-[length:var(--text-sm)] text-gray-400 leading-relaxed">
          Book a free 60-min strategy call.{" "}
          <strong className="text-gray-200 font-semibold">No pressure. No upsells. Just clarity.</strong>
        </p>

        {/* ── 3. Coach authority card — glass-card for stronger visual weight ── */}
        <div className="glass-card mb-4 overflow-hidden">
          <div className="flex flex-col items-center gap-3 p-5 sm:flex-row sm:text-left">

            {/* Coach photo — replace src with real image path */}
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-purple-500/40">
              {/* Real photo: replace this div with <Image src="/coach.jpg" alt="Swapnil Umbarkar" fill className="object-cover" /> */}
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/30 to-purple-600/20 text-lg font-black text-purple-300">
                SU
              </div>
            </div>

            <div>
              {/* Authority-first positioning */}
              <p className="text-[length:var(--text-xs)] font-semibold uppercase tracking-wider text-purple-400">
                India&apos;s Leading Thyroid Fat-Loss Coach
              </p>
              <p className="mt-0.5 text-[length:var(--text-base)] font-bold text-white">
                Swapnil Umbarkar
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 sm:justify-start justify-center">
                {certs.map((c) => (
                  <span key={c} className="chip">{c}</span>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── 4. What's included — secondary weight to coach card ── */}
        <div className="mb-6 rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4 text-left">
          <p className="mb-3 text-[length:var(--text-xs)] font-semibold uppercase tracking-wider text-purple-400">
            Your Free Call Includes
          </p>
          <ul className="space-y-2.5">
            {includes.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 font-bold leading-none text-purple-500">✓</span>
                <span className="text-[length:var(--text-xs)] leading-snug text-gray-300">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── 5. Primary CTA block ── */}
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

          {/* ── 6. Objection handler — addresses cost, commitment, legitimacy ── */}
          <div className="flex items-center justify-center gap-3">
            {["No credit card", "Completely free", "No commitment"].map((obj, i) => (
              <span key={obj} className="flex items-center gap-1.5">
                {i > 0 && <span className="h-3 w-px bg-white/10" aria-hidden="true" />}
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-600">
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