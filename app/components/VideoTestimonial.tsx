"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const testimonials = [
  {
    badges: [
      "4.2 kg Lost",
      "Belly Fat ↓",
      "Energy Up",
      "Better Sleep",
    ],
    quote: "In 3 weeks I saw what 3 years couldn't give me.",
    name: "Rashmi D., Hypothyroid Client",
    videoUrl:
      "https://swapnilumbarkarfitness.in/wp-content/uploads/2025/08/%F0%9F%8E%A5-Rashmis-3-Week-Thyroid-Fat-Loss-Transformation.mp4",
  },

  {
    badges: [
      "3.8 kg Lost",
      "2 Inch Waist ↓",
      "Bloating Gone",
      "Clothes Fit",
    ],
    quote: "For the first time in years, I feel confident in my body.",
    name: "Fathima P., Thyroid Fat Loss Client",
    videoUrl:
      "https://swapnilumbarkarfitness.in/wp-content/uploads/2026/05/%F0%9F%8C%B8-Fathimas-2-Week-Thyroid-Fat-Loss-Update.mp4",
  },
];

export default function VideoTestimonial() {
  return (
    <section className="section-pad bg-black text-white">
      <div className="container-default">

        <div className="mb-6 text-center">
          <p className="section-label">Client Stories</p>

          <h2 className="section-title mx-auto max-w-xs">
            They Were Stuck. Then{" "}
            <span className="text-gradient">This Happened.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="glass-card overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 px-4 pt-4 pb-3">
                {t.badges.map((b) => (
                  <span
                    key={b}
                    className="result-badge"
                  >
                    {b}
                  </span>
                ))}
              </div>

              <div className="relative mx-4 mb-3 aspect-video w-[calc(100%-2rem)] overflow-hidden rounded-xl bg-white/[0.04]">
                <video
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                >
                  <source
                    src={t.videoUrl}
                    type="video/mp4"
                  />
                </video>
              </div>

              <div className="px-4 pb-4">
                <p className="mb-1 text-xs italic text-gray-400">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <p className="text-xs font-medium text-gray-500">
                  — {t.name}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => (window.location.href = CTA_URL)}
            className="btn-primary"
          >
            Book Your Free Strategy Call →
          </button>
        </div>

      </div>
    </section>
  );
}