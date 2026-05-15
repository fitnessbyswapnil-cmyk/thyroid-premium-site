"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const problems = [
  { icon: "⚡", title: "Diets Keep Failing You", body: "Keto. Fasting. 1200 cal. None of it works when your thyroid is the real blocker." },
  { icon: "🔥", title: "Metabolism Won't Budge", body: "Cutting calories slows thyroid output further. Fat loss stalls. Your body fights back." },
  { icon: "😓", title: "Zero Energy Left", body: "Hypothyroidism drains cellular energy — making workouts and daily life feel impossible." },
  { icon: "🎯", title: "No One Addresses the Root", body: "Doctors adjust meds. Trainers blame effort. Nobody fixes hormones, inflammation, and fat loss together." },
];

export default function ProblemSection() {
  return (
    <section className="section-pad bg-black text-white">
      <div className="container-default">

        <div className="mb-6 text-center md:mb-8">
          <p className="section-label">Why You&apos;re Stuck</p>
          <h2 className="section-title mx-auto max-w-xs md:max-w-md">
            Generic Advice Doesn&apos;t Work for{" "}
            <span className="text-gradient">Thyroid Fat Loss</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
          {problems.map((p) => (
            <div key={p.title} className="glass-card-sm flex gap-3 p-4">
              <span className="mt-0.5 text-lg leading-none">{p.icon}</span>
              <div>
                <p className="mb-1 text-sm font-semibold text-white">{p.title}</p>
                <p className="text-xs leading-relaxed text-gray-400">{p.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4 text-center md:mt-8">
          <p className="mb-3 text-sm font-semibold text-white">
            Real thyroid fat loss needs a system — not just another diet.
          </p>
          <button type="button" onClick={() => (window.location.href = CTA_URL)} className="btn-primary">
            See How the System Works →
          </button>
        </div>

      </div>
    </section>
  );
}