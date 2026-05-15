"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const stats = [
  { num: "200+",   label: "Thyroid Clients" },
  { num: "10–15kg",label: "Avg Fat Loss" },
  { num: "93%",    label: "Better Energy" },
  { num: "1-on-1", label: "Personalized" },
];

const pillars = [
  { icon: "🧬", title: "Lab-Guided Protocol",  desc: "Personalized using your thyroid biomarkers, deficiencies, and hormonal patterns." },
  { icon: "🍱", title: "Indian Nutrition",      desc: "Real dals, rotis, and sabzi — adapted for thyroid fat loss. No foreign diets." },
  { icon: "📊", title: "Weekly Tracking",       desc: "Weight, inches, energy, sleep, and symptoms — adjusted every week." },
  { icon: "💬", title: "WhatsApp Support",      desc: "Direct access. Real answers. Not a chatbot." },
];

export default function AuthoritySection() {
  return (
    <section className="section-pad bg-black text-white">
      <div className="container-default">

        <div className="mb-6 text-center">
          <p className="section-label">Why This Works</p>
          <h2 className="section-title mx-auto max-w-xs md:max-w-sm">
            Not a Diet Plan. <span className="text-gradient">A Complete System.</span>
          </h2>
        </div>

        <div className="mb-6 grid grid-cols-4 overflow-hidden rounded-2xl border border-white/[0.07]">
          {stats.map((s, i) => (
            <div key={s.label} className={`flex flex-col items-center justify-center py-4 px-2 ${i < stats.length - 1 ? "border-r border-white/[0.07]" : ""}`}>
              <span className="text-xl font-extrabold text-purple-400 leading-none">{s.num}</span>
              <span className="mt-1 text-center text-[10px] text-gray-500 leading-tight">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pillars.map((p) => (
            <div key={p.title} className="glass-card-sm flex gap-3 p-4">
              <span className="mt-0.5 text-lg leading-none">{p.icon}</span>
              <div>
                <p className="mb-1 text-sm font-semibold text-white">{p.title}</p>
                <p className="text-xs leading-relaxed text-gray-400">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <p className="mb-3 text-xs text-gray-500">Limited coaching spots available this month</p>
          <button type="button" onClick={() => (window.location.href = CTA_URL)} className="btn-primary">
            🔥 Claim Your Spot
          </button>
        </div>

      </div>
    </section>
  );
}