"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const results = [
  { name: "Vaidehi S., 34", badges: ["4.8 kg Lost", "2 Inch Waist ↓", "Energy Restored", "Less Bloating"], quote: "I lost more in 6 weeks than in 2 years of trying alone.", img: "/results/vaidehi.jpg" },
  { name: "Priya M., 41",   badges: ["3.5 kg Lost", "Clothes Fitting", "Belly Fat ↓", "Confidence Back"], quote: "Finally a plan built for thyroid — not just calories.", img: "/results/priya.jpg" },
  { name: "Neha R., 38",    badges: ["5.2 kg Lost", "3 Inch Loss", "Brain Fog Gone", "Sleep Improved"],  quote: "My doctor noticed the difference before I even told her.", img: "/results/neha.jpg" },
  { name: "Sunita K., 45",  badges: ["4.1 kg Lost", "Bloating Gone", "Energy Up", "Cravings Reduced"],   quote: "No starvation. Real food. Real results.", img: "/results/sunita.jpg" },
];

export default function ResultsSection() {
  return (
    <section className="section-pad bg-black text-white">
      <div className="container-default">

        <div className="mb-6 text-center">
          <p className="section-label">Real Transformations</p>
          <h2 className="section-title mx-auto max-w-xs md:max-w-sm">
            <span className="text-gradient">Visible Fat Loss.</span> Real Women.
          </h2>
          <p className="mt-2 text-xs text-gray-500">Not models. Not filters. Real hypothyroid women from India.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {results.map((r) => (
            <div key={r.name} className="result-card">
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-white/[0.04]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.img} alt={`${r.name} transformation`} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="result-badges">
                {r.badges.map((b) => <span key={b} className="result-badge">{b}</span>)}
              </div>
              <div className="result-meta">
                <p className="result-quote">&ldquo;{r.quote}&rdquo;</p>
                <p className="result-name">— {r.name}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button type="button" onClick={() => (window.location.href = CTA_URL)} className="btn-primary">
            🔥 Start Your Transformation
          </button>
          <p className="mt-2 text-xs text-gray-600">Free strategy call · No obligation</p>
        </div>

      </div>
    </section>
  );
}