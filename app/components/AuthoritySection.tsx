"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

// 3-stat row (removes overflow at any viewport)
const stats = [
  { num: "200+",   label: "Thyroid Clients" },
  { num: "10–15kg", label: "Avg Fat Loss" },
  { num: "93%",    label: "Better Energy" },
];

const pillars = [
  { icon: "🧬", title: "Lab-Guided Protocol",  desc: "Personalized to your biomarkers. Not generic advice." },
  { icon: "🍱", title: "Indian Nutrition",      desc: "Real dals, rotis, sabzi — adapted for thyroid fat loss." },
  { icon: "📊", title: "Weekly Tracking",       desc: "Weight, inches, energy — adjusted every single week." },
  { icon: "💬", title: "WhatsApp Support",      desc: "Direct access. Real answers. Not a chatbot." },
];

export default function AuthoritySection() {
  return (
    <section className="section-pad bg-black text-white">
      <div className="container-default">

        {/* Header */}
        <div className="mb-6 text-center">
          <p className="section-label">Why This Works</p>
          <h2 className="section-title mx-auto max-w-[22ch]">
            Not a Diet Plan.{" "}
            <span className="text-gradient">A Complete System.</span>
          </h2>
        </div>

        {/* Stat row — Hero pattern, 3 stats, no overflow */}
        <div className="stat-row mx-auto mb-6">
          {stats.map((s, i) => (
            <>
              <div key={s.label} className="stat-chip">
                <span className="stat-num">{s.num}</span>
                <span className="stat-label">{s.label}</span>
              </div>
              {i < stats.length - 1 && (
                <div key={`div-${i}`} className="stat-divider" aria-hidden="true" />
              )}
            </>
          ))}
        </div>

        {/* Pillar cards — 2×2 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pillars.map((p) => (
            <div key={p.title} className="glass-card-sm flex gap-3 p-4">
              <span className="mt-0.5 shrink-0 text-lg leading-none" role="img" aria-hidden="true">
                {p.icon}
              </span>
              <div>
                <p className="mb-1 text-[length:var(--text-sm)] font-semibold text-white">
                  {p.title}
                </p>
                <p className="text-[length:var(--text-xs)] leading-relaxed text-gray-400">
                  {p.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA — scarcity below button, not above */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => window.location.assign(CTA_URL)}
            className="btn-primary"
            aria-label="Claim your free thyroid fat-loss consultation spot"
          >
            🔥 Claim Your Spot
          </button>
          <p className="mt-2 text-[length:var(--text-xs)] text-gray-600">
            Limited coaching spots available this month
          </p>
        </div>

      </div>
    </section>
  );
}