"use client";

import CtaButton from "./CtaButton";
import SectionHeader from "./SectionHeader";

const testimonials = [
  {
    stats: [
      { num: "4.2 kg", label: "Lost" },
      { num: "3 Wks", label: "Timeline" },
      { num: "Energy", label: "Back" },
    ],
    quote: "In 3 weeks I saw what 3 years couldn't give me.",
    name: "Rashmi D.",
    role: "Hypothyroid Client",
    videoUrl:
      "https://swapnilumbarkarfitness.in/wp-content/uploads/2025/08/%F0%9F%8E%A5-Rashmis-3-Week-Thyroid-Fat-Loss-Transformation.mp4",
  },
  {
    stats: [
      { num: "3.8 kg", label: "Lost" },
      { num: "2 Inch", label: "Waist ↓" },
      { num: "Bloat", label: "Gone" },
    ],
    quote: "For the first time in years, I feel confident in my body.",
    name: "Fathima P.",
    role: "Thyroid Coaching Client",
    videoUrl:
      "https://swapnilumbarkarfitness.in/wp-content/uploads/2026/05/%F0%9F%8C%B8-Fathimas-2-Week-Thyroid-Fat-Loss-Update.mp4",
  },
];

export default function VideoTestimonial() {
  return (
    <section className="section-pad relative bg-[var(--bg-page)] text-white">
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        <SectionHeader
          label="Client Stories"
          title={
            <>
              They Felt Stuck.{" "}
              <span className="text-gradient">Then Everything Changed.</span>
            </>
          }
          lead="Real Indian women sharing honest thyroid fat-loss progress — in their own words."
          titleMaxCh="20ch"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {testimonials.map((t) => (
            <article
              key={t.name}
              className="glass-card overflow-hidden rounded-[var(--r-xl)]"
            >
              <div className="relative aspect-[4/4.6] overflow-hidden bg-white/[0.03] sm:aspect-[4/5] md:aspect-video">
                <video
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  aria-label={`Transformation video: ${t.name}`}
                >
                  <source src={t.videoUrl} type="video/mp4" />
                </video>

                <div className="absolute inset-x-2.5 top-2.5 flex overflow-hidden rounded-full border border-white/[0.08] bg-black/55 backdrop-blur-md">
                  {t.stats.map((s, i) => (
                    <div
                      key={`${t.name}-${s.label}-${i}`}
                      className={`flex flex-1 flex-col items-center justify-center py-1.5 ${
                        i !== t.stats.length - 1
                          ? "border-r border-white/[0.06]"
                          : ""
                      }`}
                    >
                      <span className="text-[11px] font-bold leading-none text-[var(--p300)]">
                        {s.num}
                      </span>
                      <span className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.14em] text-white/55">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-4 pb-4 pt-3">
                <p className="text-[length:var(--text-sm)] font-semibold leading-snug text-[var(--t1)]">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="mt-1.5 text-[0.72rem] text-[var(--t4)]">
                  — {t.name}, {t.role}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="cta-wrap section-cta mx-auto max-w-sm">
          <p className="micro-trust text-center">
            <span className="text-[var(--p300)]" aria-hidden="true">
              ★★★★★
            </span>{" "}
            200+ women transformed across India
          </p>
          <CtaButton
            variant="primary"
            className="w-full"
            label="Apply For Private Coaching"
            sublabel="₹299 strategy session · Limited coaching intake"
            ariaLabel="Apply for private thyroid coaching"
          />
          <p className="text-center text-[0.72rem] text-[var(--t5)]">
            No pressure · Personalized fit review
          </p>
        </div>
      </div>
    </section>
  );
}
