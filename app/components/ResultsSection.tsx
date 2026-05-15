"use client";

import Image from "next/image";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const results = [
  {
    name: "Vaidehi S., 34",
    badges: ["4.8 kg Lost", "2 Inch Waist ↓", "Energy Restored"],
    quote: "Lost more in 6 weeks than in 2 years of trying alone.",
    img: "/transformations/Vaidehi 1.png",
  },
  {
    name: "Surekha P., 41",
    badges: ["3.5 kg Lost", "Belly Fat ↓", "Confidence Back"],
    quote: "Finally a plan built for thyroid — not just calories.",
    img: "/transformations/Surekha 3.png",
  },
  {
    name: "Nehamia R., 38",
    badges: ["5.2 kg Lost", "3 Inch Loss", "Brain Fog Gone"],
    quote: "My doctor noticed the difference before I even told her.",
    img: "/transformations/Nehamia 6.png",
  },
  {
    name: "Anjali M., 36",
    badges: ["4.1 kg Lost", "Bloating Gone", "Cravings Reduced"],
    quote: "No starvation. Real food. Real results.",
    img: "/transformations/Nehamia 6.png",
  },
];

export default function ResultsSection() {
  return (
    <section className="section-pad bg-black text-white">
      <div className="container-default">

        {/* ── Header ── */}
        <div className="mb-6 text-center">
          <p className="section-label">Real Transformations</p>
          <h2 className="section-title mx-auto max-w-[22ch]">
            <span className="text-gradient">Visible Fat Loss.</span> Real Women.
          </h2>
          <p className="mt-1.5 text-[length:var(--text-xs)] text-gray-500">
            Not models. Not filters. Real hypothyroid women from India.
          </p>
        </div>

        {/* ── Cards: 1-col mobile → 2-col sm → 4-col md ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4">
          {results.map((r) => (
            <div key={r.name} className="result-card">

              {/* Photo */}
              <div className="relative w-full overflow-hidden bg-white/[0.04]"
                   style={{ aspectRatio: "3/4" }}>
                <Image
                  src={r.img}
                  alt={`${r.name} thyroid fat loss transformation`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                  loading="lazy"
                />
              </div>

              {/* Quote — emotion first, largest text in card */}
              <div className="px-3 pt-3 pb-1">
                <p className="text-[length:var(--text-sm)] font-medium leading-snug text-white">
                  &ldquo;{r.quote}&rdquo;
                </p>
                <p className="mt-1 text-[length:var(--text-xs)] text-gray-500 font-medium">
                  — {r.name}
                </p>
              </div>

              {/* Badges — max 3, single row with overflow clip */}
              <div className="result-badges">
                {r.badges.slice(0, 3).map((b) => (
                  <span key={b} className="result-badge">{b}</span>
                ))}
              </div>

            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => window.location.assign(CTA_URL)}
            className="btn-primary"
            aria-label="Book a free thyroid fat-loss strategy call"
          >
            🔥 Start Your Transformation
          </button>
          <p className="mt-2 text-[length:var(--text-xs)] text-gray-600">
            Free strategy call · No obligation
          </p>
        </div>

      </div>
    </section>
  );
}