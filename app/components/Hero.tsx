"use client";
export default function Hero() {
  return (
    <section className="relative min-h-screen bg-black text-white overflow-hidden flex items-center justify-center px-6">

      {/* Background Glow */}
      <div className="absolute top-[-150px] w-[700px] h-[700px] bg-purple-600/20 blur-[140px] rounded-full"></div>

      <div className="relative z-10 max-w-6xl mx-auto text-center">

        {/* Urgency Badge */}
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8">
          <span className="text-sm tracking-wide text-gray-300">
            ⚡ ONLY 5 SPOTS LEFT THIS MONTH
          </span>
        </div>

        {/* Supporting Text */}
        <p className="text-gray-400 text-sm md:text-base mb-6">
          ✓ For busy Indian women with hypothyroidism
        </p>

        {/* Main Heading */}
        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-8">

          End

          <span className="block text-purple-400">
            Thyroid Fat Struggle
          </span>

          in

          <span className="block text-white">
            90 Days
          </span>

        </h1>

        {/* Subheading */}
        <p className="max-w-3xl mx-auto text-lg md:text-2xl text-gray-400 leading-relaxed mb-10">
          Personalized coaching that addresses your unique thyroid type.
          Not generic diets.

          <span className="block mt-3 text-white font-semibold">
            10–15 kg weight loss + restored energy.
          </span>
        </p>

        {/* Benefits */}
        <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-12 text-left">

          <div className="flex gap-3 p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
            <span className="text-purple-400">✓</span>
            <p>
              <strong>Flatten stubborn belly fat</strong> despite hypothyroidism
            </p>
          </div>

          <div className="flex gap-3 p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
            <span className="text-purple-400">✓</span>
            <p>
              <strong>All-day energy restoration</strong> — no more brain fog
            </p>
          </div>

          <div className="flex gap-3 p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
            <span className="text-purple-400">✓</span>
            <p>
              <strong>Indian home food you love</strong> — no starvation diets
            </p>
          </div>

          <div className="flex gap-3 p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
            <span className="text-purple-400">✓</span>
            <p>
              <strong>Lab-guided coaching</strong> optimized to your thyroid type
            </p>
          </div>

        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-5">

          <button
            id="cta-hero"
            className="px-8 py-5 rounded-2xl bg-purple-500 hover:bg-purple-400 transition-all duration-300 text-lg font-semibold shadow-[0_0_50px_rgba(168,85,247,0.4)]"
            onClick={() =>
              window.location.href =
                "https://swapnilumbarkarfitness.in/case-studies/#cta"
            }
          >
            🔥 Book FREE Call (5 Spots Left)

            <span className="block text-xs font-normal mt-1 opacity-80">
              60 MIN • FREE • ACT NOW
            </span>
          </button>

          <button className="px-8 py-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all duration-300 text-lg">
            View Transformations
          </button>

        </div>

        {/* Trust Text */}
        <p className="mt-8 text-gray-500 text-sm">
          Trusted by 200+ hypothyroid women across India
        </p>

      </div>
    </section>
  );
}