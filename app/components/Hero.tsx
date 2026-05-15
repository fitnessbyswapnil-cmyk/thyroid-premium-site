"use client";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-black text-white">

      {/* Background Glow */}
      <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-purple-600/20 blur-[120px] md:h-[700px] md:w-[700px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-3 py-14 text-center sm:px-5 md:px-8 md:py-24">

        {/* Top Badge */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
          <span className="text-[11px] tracking-wide text-gray-300 sm:text-xs md:text-sm">
            ⚡ ONLY 5 SPOTS LEFT THIS MONTH
          </span>
        </div>

        {/* Supporting Line */}
        <p className="mb-5 text-sm text-gray-400 md:text-base">
          ✓ For Indian women struggling with thyroid fat
        </p>

        {/* Main Headline */}
        <h1 className="max-w-5xl text-[52px] font-bold leading-[0.92] tracking-[-2px] sm:text-6xl md:text-7xl lg:text-8xl">

          End

          <span className="mt-2 block text-purple-400">
            Thyroid Fat
          </span>

          <span className="block text-purple-400">
            Struggle
          </span>

          <span className="mt-3 block text-white">
            in 90 Days
          </span>

        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-[18px] leading-relaxed text-gray-400 sm:text-xl md:mt-8 md:text-2xl">

          Thyroid-specific coaching for stubborn fat loss.

          <span className="mt-3 block font-semibold text-white">
            Lose 10–15 kg. Feel confident again.
          </span>

        </p>

        {/* Benefits */}
        <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 md:mt-10">

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left backdrop-blur-md">
            <span className="text-purple-400">✓</span>

            <p className="text-sm text-gray-200 md:text-base">
              Reduced belly fat
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left backdrop-blur-md">
            <span className="text-purple-400">✓</span>

            <p className="text-sm text-gray-200 md:text-base">
              Faster inch loss
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left backdrop-blur-md">
            <span className="text-purple-400">✓</span>

            <p className="text-sm text-gray-200 md:text-base">
              No starvation diets
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left backdrop-blur-md">
            <span className="text-purple-400">✓</span>

            <p className="text-sm text-gray-200 md:text-base">
              More daily energy
            </p>
          </div>

        </div>

        {/* CTA */}
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row md:mt-10">

          <button
            id="cta-hero"
            className="w-full rounded-3xl bg-purple-500 px-6 py-5 text-lg font-semibold text-white shadow-[0_0_40px_rgba(168,85,247,0.45)] transition-all duration-300 hover:bg-purple-400 sm:w-auto sm:px-10"
            onClick={() =>
              window.location.href =
                "https://swapnilumbarkarfitness.in/case-studies/#cta"
            }
          >
            🔥 Book FREE Call

            <span className="mt-1 block text-xs font-normal opacity-80">
              FREE • LIMITED SPOTS
            </span>
          </button>

          <button className="w-full rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-lg text-white backdrop-blur-md transition-all duration-300 hover:bg-white/10 sm:w-auto sm:px-10">
            View Results
          </button>

        </div>

        {/* Trust Line */}
        <p className="mt-7 text-sm text-gray-500">
          Trusted by 200+ women across India
        </p>

      </div>
    </section>
  );
}