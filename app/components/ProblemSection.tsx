"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const problems = [
  {
    icon: "⚡",
    title: "Generic Diets Keep Failing",
    body: "Advice built for healthy hormones won't move thyroid fat.",
  },
  {
    icon: "🔥",
    title: "Cutting Calories Backfires",
    body: "Less food slows thyroid output — fat loss stalls further.",
  },
  {
    icon: "😓",
    title: "Energy Disappears First",
    body: "No energy means no consistency. It's not your willpower.",
  },
  {
    icon: "🎯",
    title: "No One Fixed the Root",
    body: "Doctors adjusted meds. Trainers blamed effort. Nothing changed.",
  },
];

export default function ProblemSection() {
  return (
    <section className="section-pad bg-black text-white">

      {/* Subtle atmospheric glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-48 w-72 -translate-x-1/2 rounded-full bg-purple-600/[0.06] blur-[80px]" />
      </div>

      <div className="container-default relative z-10">

        {/* Header */}
        <div className="mb-5 text-center md:mb-7">
          <p className="section-label">Why You&apos;re Stuck</p>
          <h2 className="section-title mx-auto max-w-[22ch]">
            The Real Reason{" "}
            <span className="text-gradient">Thyroid Fat Won&apos;t Move</span>
          </h2>
          <p className="mx-auto mt-2 max-w-[30ch] text-[length:var(--text-sm)] text-gray-400 leading-relaxed">
            You did everything right. The problem was never you.
          </p>
        </div>

        {/* 2×2 grid */}
        <div className="grid grid-cols-2 gap-2.5 md:gap-3.5">
          {problems.map((p) => (
            <div key={p.title} className="glass-card-sm flex flex-col gap-2 p-3.5 md:p-5">
              <span className="text-base leading-none md:text-lg" role="img" aria-hidden="true">
                {p.icon}
              </span>
              <p className="text-[length:var(--text-sm)] font-semibold leading-snug text-white">
                {p.title}
              </p>
              <p className="text-[length:var(--text-xs)] leading-relaxed text-gray-500">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        {/* Validation strip */}
        <div className="mt-4 flex items-center justify-center gap-2 md:mt-5">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <p className="shrink-0 px-3 text-center text-[length:var(--text-xs)] text-gray-600">
            Thyroid fat loss requires a{" "}
            <span className="font-semibold text-gray-400">different system entirely</span>
          </p>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>

        {/* CTA — btn-primary (not cta-button) to preserve hierarchy */}
        <div className="mt-5 text-center md:mt-6">
          <button
            type="button"
            onClick={() => window.location.assign(CTA_URL)}
            className="btn-primary w-full max-w-sm"
            aria-label="Book your free thyroid fat-loss strategy call"
          >
            🔥 Start Losing the Belly Fat
          </button>
          <p className="mt-2 text-[length:var(--text-xs)] text-gray-600">
            Free 60-min call · No commitment · No upsells
          </p>
        </div>

      </div>
    </section>
  );
}