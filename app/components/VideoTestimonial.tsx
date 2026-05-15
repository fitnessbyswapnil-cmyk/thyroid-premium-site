"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const testimonials = [
  {
    // Scorecard stats — shown as 3 compact metrics above the quote
    stats: [
      { num: "4.2 kg", label: "Lost" },
      { num: "3 Wks", label: "Timeline" },
      { num: "Energy", label: "Restored" },
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
    role: "Thyroid Fat Loss Client",
    videoUrl:
      "https://swapnilumbarkarfitness.in/wp-content/uploads/2026/05/%F0%9F%8C%B8-Fathimas-2-Week-Thyroid-Fat-Loss-Update.mp4",
  },
];

export default function VideoTestimonial() {
  return (
    <section className="section-pad bg-black text-white">

      {/* ── Atmospheric depth — consistent with Hero and ProblemSection ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-56 w-80 -translate-x-1/2 rounded-full bg-purple-600/[0.05] blur-[90px]" />
      </div>

      <div className="container-default relative z-10">

        {/* ── Section Header ── */}
        <div className="mb-5 text-center md:mb-7">
          <p className="section-label">Client Stories</p>
          <h2 className="section-title mx-auto max-w-[28ch]">
            They Were Stuck.{" "}
            <span className="text-gradient">Then This Happened.</span>
          </h2>
          <p className="mx-auto mt-2 max-w-[32ch] text-[length:var(--text-xs)] text-gray-500">
            Real Indian women. Real hypothyroid transformations. No filters.
          </p>
        </div>

        {/* ── Video Cards ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {testimonials.map((t) => (
            <div key={t.name} className="glass-card overflow-hidden">

              {/* 1. Scorecard — stat-row style, mirrors Hero numerics */}
              <div className="flex overflow-hidden border-b border-white/[0.06] bg-white/[0.015]">
                {t.stats.map((s, i) => (
                  <div
                    key={s.label}
                    className={`flex flex-1 flex-col items-center justify-center py-2.5 ${
                      i < t.stats.length - 1 ? "border-r border-white/[0.06]" : ""
                    }`}
                  >
                    <span className="text-[length:var(--text-sm)] font-extrabold leading-tight text-purple-400">
                      {s.num}
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-600">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* 2. Quote — ABOVE video to prime emotional frame */}
              <div className="px-4 pt-3.5 pb-2.5">
                <p className="text-[length:var(--text-sm)] font-semibold leading-snug text-white">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="mt-1 text-[length:var(--text-xs)] text-gray-500">
                  — {t.name}, {t.role}
                </p>
              </div>

              {/* 3. Video — 4:3 mobile, 16:9 desktop. Rounded-lg sits inside rounded-2xl card */}
              <div className="mx-3 mb-3 overflow-hidden rounded-lg bg-white/[0.03] aspect-[4/3] md:aspect-video">
                <video
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  aria-label={`Transformation video: ${t.name}`}
                >
                  <source src={t.videoUrl} type="video/mp4" />
                  Your browser does not support video playback.
                </video>
              </div>

            </div>
          ))}
        </div>

        {/* ── Urgency Strip + CTA ── */}
        <div className="mt-5 flex flex-col items-center gap-3 md:mt-6">
          <p className="text-[length:var(--text-xs)] text-gray-500 text-center">
            ★★★★★ Real results · 200+ women transformed · No filters
          </p>
          <button
            type="button"
            aria-label="Book your free thyroid fat-loss strategy call"
            onClick={() => window.location.assign(CTA_URL)}
            className="cta-button w-full max-w-sm"
          >
            🔥 Start Your Transformation
            <span className="cta-sub">Free 60-Min Call · Limited Spots This Month</span>
          </button>
          <p className="text-[length:var(--text-xs)] text-gray-600">
            No commitment · No upsells · Just clarity
          </p>
        </div>

      </div>
    </section>
  );
}