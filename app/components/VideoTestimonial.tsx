"use client";

const CTA_URL =
  "https://swapnilumbarkarfitness.in/case-studies/#cta";

const testimonials = [
  {
    stats: [
      { num: "4.2 kg", label: "Lost" },
      { num: "3 Wks", label: "Timeline" },
      { num: "Energy", label: "Back" },
    ],
    quote:
      "In 3 weeks I saw what 3 years couldn't give me.",
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
    quote:
      "For the first time in years, I feel confident in my body.",
    name: "Fathima P.",
    role: "Thyroid Fat Loss Client",
    videoUrl:
      "https://swapnilumbarkarfitness.in/wp-content/uploads/2026/05/%F0%9F%8C%B8-Fathimas-2-Week-Thyroid-Fat-Loss-Update.mp4",
  },
];

export default function VideoTestimonial() {
  return (
    <section className="section-pad bg-[var(--bg-page)] text-white">

      {/* Reduced atmospheric glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-44 w-64 -translate-x-1/2 rounded-full bg-purple-500/[0.045] blur-[80px]" />
      </div>

      <div className="container-default relative z-10">

        {/* Header */}
        <div className="mb-6 text-center">
          <p className="section-label">
            Client Stories
          </p>

          <h2 className="section-title mx-auto max-w-[20ch]">
            They Felt Stuck.{" "}
            <span className="text-gradient">
              Then Everything Changed.
            </span>
          </h2>

          <p className="mx-auto mt-2 max-w-[30ch] text-xs leading-relaxed text-[var(--t4)]">
            Real Indian women sharing real thyroid fat-loss progress.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          {testimonials.map((t) => (
            <div
              key={t.name}
              className="glass-card overflow-hidden rounded-[1.4rem]"
            >

              {/* VIDEO FIRST — increases visual dominance */}
              <div className="relative overflow-hidden bg-white/[0.03] aspect-[4/4.8] sm:aspect-[4/5] md:aspect-video">

                <video
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  aria-label={`Transformation video: ${t.name}`}
                >
                  <source
                    src={t.videoUrl}
                    type="video/mp4"
                  />
                </video>

                {/* Compact floating stats */}
                <div className="absolute left-2.5 right-2.5 top-2.5 flex overflow-hidden rounded-full border border-white/[0.06] bg-black/60 backdrop-blur-md">

                  {t.stats.map((s, i) => (
                    <div
                      key={s.label}
                      className={`flex flex-1 flex-col items-center justify-center py-1.5 ${
                        i !== t.stats.length - 1
                          ? "border-r border-white/[0.06]"
                          : ""
                      }`}
                    >
                      <span className="text-[11px] font-black leading-none tracking-tight text-purple-300">
                        {s.num}
                      </span>

                      <span className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.16em] text-white/60">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reduced text padding */}
              <div className="px-3.5 pb-3 pt-3">

                <p className="text-sm font-semibold leading-snug text-white">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <p className="mt-1 text-[11px] text-[var(--t4)]">
                  — {t.name}, {t.role}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-6 flex flex-col items-center gap-3">

          <p className="text-center text-xs text-[var(--t4)]">
            ★★★★★ 200+ women transformed across India
          </p>

          <button
            type="button"
            aria-label="Book your free thyroid fat-loss strategy call"
            onClick={() =>
              window.location.assign(CTA_URL)
            }
            className="cta-button w-full max-w-sm"
          >
            🔥 Start Your Transformation

            <span className="cta-sub">
              Free 60-Min Call · Limited Spots
            </span>
          </button>

          <p className="text-[11px] text-[var(--t5)]">
            No pressure · No upsells
          </p>
        </div>

      </div>
    </section>
  );
}