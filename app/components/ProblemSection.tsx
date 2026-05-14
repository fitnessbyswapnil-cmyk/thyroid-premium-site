"use client";
export default function ProblemSection() {
  return (
    <section className="relative bg-black text-white py-28 px-5 overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-purple-700/10 blur-[180px] rounded-full"></div>

      <div className="relative max-w-7xl mx-auto">

        {/* Heading */}
        <div className="text-center mb-20">

          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-300 text-sm tracking-wide mb-6">
            ⚠️ WHY MOST THYROID DIETS FAIL
          </div>

          <h2 className="text-4xl md:text-6xl font-bold leading-tight mb-8">

            Your Body Is Not Broken. <br />

            <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
              Your Strategy Was.
            </span>

          </h2>

          <p className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">

            Most hypothyroid women are following generic fat loss advice
            that completely ignores hormones, inflammation, cortisol,
            nutrient deficiencies, gut health, and thyroid metabolism.

          </p>

        </div>

        {/* Problem Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-24">

          {/* Card 1 */}
          <div className="group rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 hover:border-purple-500/30 transition-all duration-300">

            <div className="text-5xl mb-6">
              😔
            </div>

            <h3 className="text-2xl font-bold mb-4">
              You eat less… but still gain weight
            </h3>

            <p className="text-gray-400 leading-relaxed text-lg">
              Severe calorie restriction slows thyroid output even more.
              Your metabolism adapts, fat loss stalls, and your body starts
              conserving energy instead of burning fat.
            </p>

          </div>

          {/* Card 2 */}
          <div className="group rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 hover:border-purple-500/30 transition-all duration-300">

            <div className="text-5xl mb-6">
              😴
            </div>

            <h3 className="text-2xl font-bold mb-4">
              Constant fatigue & brain fog
            </h3>

            <p className="text-gray-400 leading-relaxed text-lg">
              Low thyroid function affects cellular energy production,
              recovery, mood, focus, and daily motivation — making even
              simple tasks feel exhausting.
            </p>

          </div>

          {/* Card 3 */}
          <div className="group rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 hover:border-purple-500/30 transition-all duration-300">

            <div className="text-5xl mb-6">
              🍔
            </div>

            <h3 className="text-2xl font-bold mb-4">
              Cravings, bloating & emotional eating
            </h3>

            <p className="text-gray-400 leading-relaxed text-lg">
              Hormonal imbalance and unstable blood sugar create intense
              cravings, water retention, digestive issues, and emotional
              eating cycles that generic diets never address.
            </p>

          </div>

          {/* Card 4 */}
          <div className="group rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 hover:border-purple-500/30 transition-all duration-300">

            <div className="text-5xl mb-6">
              💔
            </div>

            <h3 className="text-2xl font-bold mb-4">
              You feel like nothing works anymore
            </h3>

            <p className="text-gray-400 leading-relaxed text-lg">
              Keto failed. Fasting failed. Gym trainers blamed consistency.
              Doctors only adjusted medication. You’re left frustrated,
              confused, and emotionally drained.
            </p>

          </div>

        </div>

        {/* Education Block */}
        <div className="rounded-[40px] border border-purple-500/20 bg-gradient-to-b from-purple-900/20 to-black p-10 md:p-16 text-center mb-20 shadow-[0_0_80px_rgba(168,85,247,0.12)]">

          <div className="text-purple-400 text-sm tracking-[0.25em] uppercase mb-6">
            The Real Root Cause
          </div>

          <h3 className="text-3xl md:text-5xl font-bold mb-8 leading-tight">

            Thyroid Fat Loss Is <br />

            <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
              Hormonal.
            </span>

            <span className="text-white">
              Not Willpower.
            </span>

          </h3>

          <p className="text-gray-300 text-lg md:text-xl leading-relaxed max-w-4xl mx-auto">

            Real thyroid transformation requires fixing inflammation,
            metabolism, recovery, nutrient deficiencies, stress response,
            digestion, and thyroid optimization together —
            not starving yourself harder.

          </p>

        </div>

        {/* CTA */}
        <div className="text-center">

          <button
            onClick={() =>
              window.location.href =
                "https://swapnilumbarkarfitness.in/case-studies/#cta"
            }
            className="bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white text-xl font-semibold px-10 py-6 rounded-2xl shadow-[0_0_40px_rgba(168,85,247,0.45)] transition-all duration-300 hover:scale-[1.02]"
          >
            🔥 Book My Free Thyroid Strategy Call
          </button>

          <p className="text-gray-500 mt-5">
            Limited spots available this month for personalized coaching.
          </p>

        </div>

      </div>

    </section>
  );
}