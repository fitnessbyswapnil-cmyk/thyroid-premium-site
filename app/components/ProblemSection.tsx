"use client";

const CTA_URL =
  "https://swapnilumbarkarfitness.in/case-studies/#cta";

const problems = [
  {
    icon: "⚡",
    title: "Generic Diets Keep Failing",
    body: "Advice built for healthy hormones won't move thyroid fat.",
  },
  {
    icon: "🔥",
    title: "Cutting Calories Backfires",
    body: "Less food slows thyroid output and stalls fat loss.",
  },
  {
    icon: "😓",
    title: "Energy Disappears First",
    body: "Low energy destroys consistency and motivation.",
  },
  {
    icon: "🎯",
    title: "Nobody Fixed the Root Cause",
    body: "Medication changed. Plans changed. Results never did.",
  },
];

export default function ProblemSection() {
  return (
    <section className="section-pad bg-[var(--bg-page)] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-52 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-44 w-64 -translate-x-1/2 rounded-full bg-purple-500/[0.05] blur-[80px]" />
      </div>

      <div className="container-default relative z-10">
        <div className="mb-7 text-center">
          <p className="section-label">
            Why You Feel Stuck
          </p>

          <h2 className="section-title mx-auto max-w-[18ch]">
            The Real Reason{" "}
            <span className="text-gradient">
              Thyroid Fat Won’t Move
            </span>
          </h2>

          <p className="mx-auto mt-3 max-w-[31ch] text-sm leading-relaxed text-[var(--t3)]">
            It was never laziness. Your body needed a
            different system.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {problems.map((p) => (
            <div
              key={p.title}
              className="glass-card-sm rounded-2xl p-4"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/[0.08] text-lg">
                {p.icon}
              </div>

              <p className="mb-1.5 text-sm font-bold leading-snug text-white">
                {p.title}
              </p>

              <p className="text-xs leading-relaxed text-[var(--t3)]">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-7 text-center">
          <button
            type="button"
            onClick={() => window.location.assign(CTA_URL)}
            className="btn-primary w-full max-w-sm"
          >
            🔥 Start Your Transformation
          </button>

          <p className="mt-2 text-xs text-[var(--t4)]">
            Free consultation · No pressure
          </p>
        </div>
      </div>
    </section>
  );
}