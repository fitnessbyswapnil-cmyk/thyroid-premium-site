"use client";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-black text-white">

      {/* Background Glow */}
      <div className="absolute left-1/2 top-[-180px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-purple-600/20 blur-[110px] md:h-[750px] md:w-[750px] md:blur-[160px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-4 pt-16 pb-10 text-center sm:px-6 md:pt-24 md:pb-16">

        {/* Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
          <span className="text-[11px] tracking-wide text-gray-300 md:text-sm">
            ⚡ ONLY 5 SPOTS LEFT THIS MONTH
          </span>
        </div>

        {/* Small Supporting Line */}
        <p className="mb-4 text-xs text-gray-400 md:text-base">
          ✓ For Indian women struggling with thyroid fat
        </p>

        {/* Main Heading */}
        <h1 className="max-w-4xl text-[44px] font-black leading-[0.95] tracking-[-2px] sm:text-6xl md:text-7xl">

          End

          <span className="mt-2 block text-purple-400">
            Thyroid Fat
          </span>

          <span className="block text-purple-400">
            Struggle
          </span>

          <span className="mt-2 block text-white">
            in 90 Days
          </span>

        </h1>

        {/* Subheading */}
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-gray-400 sm:text-lg md:mt-7 md:text-2xl">

          Personalized thyroid fat-loss coaching for Indian women.

          <span className="mt-2 block font-semibold text-white">
            10–15 kg fat loss + energy restored.
          </span>

        </p>

        {/* Benefits */}
        <div className="mt-7 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 md:mt-10">

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur-sm">
            <p className="text-sm font-medium text-gray-200 md:text-base">
              ✓ Belly fat reduction despite hypothyroidism
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur-sm">
            <p className="text-sm font-medium text-gray-200 md:text-base">
              ✓ Energy restoration without starvation diets
            </p>
          </div>

        </div>

        {/* CTA */}
        <div className="mt-8 w-full max-w-md md:mt-10">

          <button
            id="cta-hero"
            className="w-full rounded-[28px] bg-gradient-to-r from-purple-500 to-purple-400 px-6 py-5 text-lg font-bold text-white shadow-[0_0_40px_rgba(168,85,247,0.35)] transition-all duration-300 hover:scale-[1.02]"
            onClick={() =>
              window.location.href =
                "https://swapnilumbarkarfitness.in/case-studies/#cta"
            }
          >
            🔥 Book FREE Call

            <span className="mt-1 block text-xs font-normal tracking-wide opacity-90">
              60 MIN • FREE • LIMITED SPOTS
            </span>
          </button>

        </div>

        {/* Trust Line */}
        <p className="mt-6 text-xs text-gray-500 md:text-sm">
          Trusted by 200+ hypothyroid women
        </p>

      </div>
    </section>
  );
}