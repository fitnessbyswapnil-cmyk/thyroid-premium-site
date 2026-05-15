"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const testimonials = [
  { badges: ["4.2 kg Lost", "Belly Fat ↓", "Energy Up", "Better Sleep"],  quote: "In 3 weeks I saw what 3 years couldn't give me.", name: "Ananya D., Hypothyroid Client", videoId: "YOUR_VIDEO_ID_1" },
  { badges: ["3.8 kg Lost", "2 Inch Waist ↓", "Bloating Gone", "Clothes Fit"], quote: "For the first time in years, I feel confident in my body.", name: "Rekha P., Thyroid Fat Loss Client", videoId: "YOUR_VIDEO_ID_2" },
];

export default function VideoTestimonial() {
  return (
    <section className="section-pad bg-black text-white">
      <div className="container-default">

        <div className="mb-6 text-center">
          <p className="section-label">Client Stories</p>
          <h2 className="section-title mx-auto max-w-xs">
            They Were Stuck. Then <span className="text-gradient">This Happened.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {testimonials.map((t) => (
            <div key={t.name} className="glass-card overflow-hidden">
              <div className="flex flex-wrap gap-2 px-4 pt-4 pb-3">
                {t.badges.map((b) => <span key={b} className="result-badge">{b}</span>)}
              </div>
              <div className="relative mx-4 mb-3 aspect-video w-[calc(100%-2rem)] overflow-hidden rounded-xl bg-white/[0.04]">
                <iframe
                  src={`https://www.youtube.com/embed/${t.videoId}`}
                  title={t.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen loading="lazy"
                  className="h-full w-full border-0"
                />
              </div>
              <div className="px-4 pb-4">
                <p className="mb-1 text-xs italic text-gray-400">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-xs font-medium text-gray-600">— {t.name}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button type="button" onClick={() => (window.location.href = CTA_URL)} className="btn-primary">
            Book Your Free Strategy Call →
          </button>
        </div>

      </div>
    </section>
  );
}