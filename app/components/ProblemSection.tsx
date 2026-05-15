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

      {/* Subtle purple depth layer — matches Hero atmosphere */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-48 w-72 -translate-x-1/2 rounded-full bg-purple-600/[0.06] blur-[80px]" />
      </div>

      <div className="container-default relative z-10">

        {/* Section header */}
        <div className="mb-5 text-center md:mb-7">
          <p className="section-label">Why You&apos;re Stuck</p>
          <h2 className="section-title mx-auto max-w-[22ch]">
            The Real Reason <span className="text-gradient">Thyroid Fat Won&apos;t Move</span>
          </h2>
          {/* Empathy mirror — creates identity match for cold traffic */}
          <p className="mx-auto mt-2 max-w-[30ch] text-[var(--text-sm)] text-gray-400 leading-relaxed">
            You did everything right. The problem was never you.
          </p>
        </div>

        {/* 2×2 card grid — 40% shorter on mobile vs 1-column */}
        <div className="grid grid-cols-2 gap-2.5 md:gap-3.5">
          {problems.map((p) => (
            <div key={p.title} className="glass-card-sm flex flex-col gap-2 p-3.5 md:p-5">
              <span className="text-base leading-none md:text-lg">{p.icon}</span>
              <p className="text-[length:var(--text-sm)] font-semibold leading-snug text-white">
                {p.title}
              </p>
              <p className="text-[length:var(--text-xs)] leading-relaxed text-gray-500">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        {/* Validation strip — reassures before CTA */}
        <div className="mt-4 flex items-center justify-center gap-2 md:mt-5">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <p className="shrink-0 px-3 text-[length:var(--text-xs)] text-gray-600 text-center">
            Thyroid fat loss requires a{" "}
            <span className="font-semibold text-gray-400">different system entirely</span>
          </p>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>

        {/* CTA — transformation-first language, full-width on mobile */}
        <div className="mt-5 text-center md:mt-6">
          <button
            type="button"
            onClick={() => (window.location.href = CTA_URL)}
            className="cta-button w-full max-w-sm mx-auto"
            aria-label="Book your free thyroid fat-loss strategy call"
          >
            🔥 Start Losing the Belly Fat
            <span className="cta-sub">Free 60-Min Strategy Call · Limited Spots</span>
          </button>
          <p className="mt-2.5 text-[length:var(--text-xs)] text-gray-600">
            No commitment · No upsells · Just clarity
          </p>
        </div>

      </div>
    </section>
  );
}