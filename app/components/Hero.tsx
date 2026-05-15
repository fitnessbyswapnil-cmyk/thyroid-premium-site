"use client";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-black text-white">

      {/* Glow */}
      <div className="absolute left-1/2 top-[-250px] h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-purple-600/20 blur-[120px] md:h-[800px] md:w-[800px]" />

      {/* Main Wrapper */}
      <div className="relative z-10 w-full px-0">

        <div className="flex min-h-[92vh] w-full flex-col items-center justify-center text-center">

          {/* Badge */}
          <div className="card-glass mb-5 inline-flex items-center gap-2 px-4 py-2">
            <span className="text-[11px] tracking-wide text-gray-300 sm:text-xs md:text-sm">
              ⚡ ONLY 5 SPOTS LEFT THIS MONTH
            </span>
          </div>

          {/* Supporting Text */}
          <p className="mb-5 px-3 text-sm text-gray-400 md:text-base">
            ✓ For busy Indian women with hypothyroidism
          </p>

          {/* Heading */}
          <h1 className="mobile-tight w-full px-2 text-[42px] font-bold leading-[1.02] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">

            End

            <span className="mt-1 block text-purple-400">
              Thyroid Fat Struggle
            </span>

            <span className="mt-1 block text-white">
              in 90 Days
            </span>

          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-5 w-full max-w-3xl px-4 text-[15px] leading-relaxed text-gray-400 sm:text-lg md:mt-7 md:text-xl">

            Personalized coaching that addresses your unique thyroid type.
            Not generic diets.

            <span className="mt-3 block font-semibold text-white">
              10–15 kg weight loss + restored energy.
            </span>

          </p>

          {/* Benefits */}
          <div className="mt-8 grid w-full grid-cols-1 gap-3 px-3 sm:grid-cols-2 md:mt-10 md:px-6">

            <div className="card-glass flex items-start gap-3 p-4 text-left">
              <span className="mt-1 text-purple-400">✓</span>

              <p className="text-sm leading-relaxed text-gray-200 md:text-base">
                <strong>Flatten stubborn belly fat</strong> despite hypothyroidism
              </p>
            </div>

            <div className="card-glass flex items-start gap-3 p-4 text-left">
              <span className="mt-1 text-purple-400">✓</span>

              <p className="text-sm leading-relaxed text-gray-200 md:text-base">
                <strong>All-day energy restoration</strong> — no more brain fog
              </p>
            </div>

            <div className="card-glass flex items-start gap-3 p-4 text-left">
              <span className="mt-1 text-purple-400">✓</span>

              <p className="text-sm leading-relaxed text-gray-200 md:text-base">
                <strong>Indian home food you love</strong> — no starvation diets
              </p>
            </div>

            <div className="card-glass flex items-start gap-3 p-4 text-left">
              <span className="mt-1 text-purple-400">✓</span>

              <p className="text-sm leading-relaxed text-gray-200 md:text-base">
                <strong>Lab-guided coaching</strong> optimized to your thyroid type
              </p>
            </div>

          </div>

          {/* CTA */}
          <div className="mt-8 flex w-full flex-col gap-3 px-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center md:mt-10">

            <button
              id="cta-hero"
              className="primary-button w-full sm:w-auto"
              onClick={() =>
                window.location.href =
                  "https://swapnilumbarkarfitness.in/case-studies/#cta"
              }
            >
              🔥 Book FREE Call

              <span className="mt-1 block text-xs font-normal opacity-80">
                60 MIN • FREE • LIMITED SPOTS
              </span>
            </button>

            <button className="secondary-button w-full sm:w-auto">
              View Transformations
            </button>

          </div>

          {/* Trust Line */}
          <p className="mt-7 px-3 text-center text-xs text-gray-500 sm:text-sm">
            Trusted by 200+ hypothyroid women across India
          </p>

        </div>

      </div>
    </section>
  );
}