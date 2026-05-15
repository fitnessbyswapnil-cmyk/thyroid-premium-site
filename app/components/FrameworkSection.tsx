"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const steps = [
  { letter: "L", label: "Lab Analysis",      desc: "Find what's actually blocking your fat loss." },
  { letter: "E", label: "Energy First",       desc: "Restore energy before fat loss begins." },
  { letter: "A", label: "Adaptive Nutrition", desc: "Real Indian meals. No starvation." },
  { letter: "N", label: "Navigate & Track",   desc: "Weekly tweaks based on your real data." },
];

const timeline = [
  { weeks: "Weeks 1–3",  result: "Energy up. Bloating down. Cravings stabilize." },
  { weeks: "Weeks 4–8",  result: "Visible inch loss. Fat loss accelerates." },
  { weeks: "Weeks 9–12", result: "Confident body. Sustainable habits locked in." },
];

export default function FrameworkSection() {
  return (
    <section className="section-pad bg-black text-white">
      <div className="container-default">

        {/* Header */}
        <div className="mb-6 text-center">
          <p className="section-label">The Method</p>
          <h2 className="section-title mx-auto max-w-[24ch]">
            The Thyroid{" "}
            <span className="text-gradient">L.E.A.N. Method</span>™
          </h2>
          {/* Emotional anchor — outcome-first language */}
          <p className="mx-auto mt-2 max-w-[34ch] text-[length:var(--text-xs)] text-gray-500 leading-relaxed">
            Built specifically for hypothyroid women.{" "}
            <span className="text-gray-400 font-medium">The exact 4-step system that works when everything else has failed.</span>
          </p>
        </div>

        {/* L.E.A.N. Step cards — 2-col mobile, 4-col desktop */}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
          {steps.map((s) => (
            <div key={s.letter} className="glass-card-sm p-4 text-center">
              <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/15 text-base font-black text-purple-400 ring-1 ring-purple-500/25">
                {s.letter}
              </div>
              <p className="mb-1 text-[length:var(--text-xs)] font-semibold text-white leading-snug">
                {s.label}
              </p>
              <p className="text-[length:var(--text-xs)] leading-relaxed text-gray-500">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Timeline bar */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07] md:mt-5">
          <div className="flex flex-col divide-y divide-white/[0.07] sm:flex-row sm:divide-x sm:divide-y-0">
            {timeline.map((t) => (
              <div key={t.weeks} className="flex-1 px-4 py-3.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-purple-500">
                  {t.weeks}
                </p>
                <p className="text-[length:var(--text-xs)] text-gray-300 leading-relaxed">
                  {t.result}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA — outcome language */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => window.location.assign(CTA_URL)}
            className="btn-primary"
            aria-label="Book your free thyroid fat-loss strategy call"
          >
            Book Free Call — See It Work For You →
          </button>
          <p className="mt-2 text-[length:var(--text-xs)] text-gray-600">
            Free call · No commitment
          </p>
        </div>

      </div>
    </section>
  );
}