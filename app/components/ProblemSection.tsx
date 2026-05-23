"use client";

import SectionCta from "./SectionCta";
import SectionHeader from "./SectionHeader";

const problems = [
  {
    icon: "🥗",
    title: "Generic Diets Keep Failing",
    body: "Plans built for healthy hormones rarely move stubborn thyroid fat.",
  },
  {
    icon: "⚖️",
    title: "Cutting Calories Backfires",
    body: "Eating less can slow your thyroid further — and stall progress.",
  },
  {
    icon: "😴",
    title: "Energy Drops First",
    body: "When you're exhausted, consistency feels impossible every week.",
  },
  {
    icon: "💜",
    title: "Nobody Addressed the Root",
    body: "Medication changed. Diets changed. Your body still didn't respond.",
  },
];

export default function ProblemSection() {
  return (
    <section className="section-pad relative bg-[var(--bg-page)] text-white">
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        <SectionHeader
          label="Why You Feel Stuck"
          title={
            <>
              The Real Reason{" "}
              <span className="text-gradient">Thyroid Fat Won&apos;t Move</span>
            </>
          }
          lead="It was never laziness. Your body needed a coach who understands hypothyroid fat loss."
          titleMaxCh="18ch"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {problems.map((p) => (
            <article key={p.title} className="glass-card-sm rounded-[var(--r-xl)] p-4">
              <div className="icon-ring mb-3">{p.icon}</div>
              <p className="mb-1.5 text-sm font-bold leading-snug text-[var(--t1)]">
                {p.title}
              </p>
              <p className="text-xs leading-relaxed text-[var(--t3)]">{p.body}</p>
            </article>
          ))}
        </div>

        <SectionCta
          className="mx-auto max-w-sm"
          buttonClassName="w-full"
          label="Book Your ₹299 Thyroid Assessment"
          sublabel="Private consultation · Limited weekly slots"
          trust="Qualified intake · No obligation after your session"
          ariaLabel="Book your 299 rupee thyroid assessment"
          location="problem"
        />
      </div>
    </section>
  );
}
