"use client";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-black text-white">

      {/* Background Glow */}
      <div className="absolute left-1/2 top-[-200px] h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-purple-600/20 blur-[120px] md:h-[800px] md:w-[800px]" />

      <div className="relative z-10 section-padding">

        <div className="section-container flex min-h-screen flex-col items-center justify-center text-center">

          {/* Badge */}
          <div className="card-glass mb-7 inline-flex items-center gap-2 px-5 py-2.5">
            <span className="text-[11px] tracking-wide text-gray-300 md:text-sm">
              ⚡ ONLY 5 SPOTS LEFT THIS MONTH
            </span>
          </div>

          {/* Supporting Text */}
          <p className="mb-6 text-sm text-gray-400 md:text-base">
            ✓ For busy Indian women with hypothyroidism
          </p>

          {/* Heading */}
          <h1 className="max-w-5xl text-[44px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-5xl md:text-6xl lg:text-7xl">

            End

            <span className="mt-2 block text-purple-400">
              Thyroid Fat Struggle
            </span>

            <span className="mt-2 block text-white">
              in 90 Days
            </span>

          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-7 max-w-3xl text-[16px] leading-[1.7] text-gray-400 sm:text-lg md:mt-8 md:text-2xl">

            Personalized coaching that addresses your unique thyroid type.
            Not generic diets.

            <span className="mt-4 block font-semibold text-white">
              10–15 kg weight loss + restored energy.
            </span>

          </p>

          {/* Benefits */}
          <div className="mt-10 grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 md:mt-14">

            <div className="card-glass flex items-start gap-3 p-5 text-left">
              <span className="mt-1 text-purple-400">✓</span>

              <p className="text-sm leading-[1.7] text-gray-200 md:text-base">
                <strong>Flatten stubborn belly fat</strong> despite hypothyroidism
              </p>
            </div>

            <div className="card-glass flex items-start gap-3 p-5 text-left">
              <span className="mt-1 text-purple-400">✓</span>

              <p className="text-sm leading-[1.7] text-gray-200 md:text-base">
                <strong>All-day energy restoration</strong> — no more brain fog
              </p>
            </div>

            <div className="card-glass flex items-start gap-3 p-5 text-left">
              <span className="mt-1 text-purple-400">✓</span>

              <p className="text-sm leading-[1.7] text-gray-200 md:text-base">
                <strong>Indian home food you love</strong> — no starvation diets
              </p>
            </div>

            <div className="card-glass flex items-start gap-3 p-5 text-left">
              <span className="mt-1 text-purple-400">✓</span>

              <p className="text-sm leading-[1.7] text-gray-200 md:text-base">
                <strong>Lab-guided coaching</strong> optimized to your thyroid type
              </p>
            </div>

          </div>

          {/* CTA */}
          <div className="mt-10 flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:justify-center md:mt-14">

            <button
              id="cta-hero"
              className="primary-button w-full px-8 py-5 text-base shadow-[0_0_50px_rgba(168,85,247,0.35)] sm:w-auto sm:text-lg"
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

            <button className="secondary-button w-full px-8 py-5 text-base sm:w-auto sm:text-lg">
              View Transformations
            </button>

          </div>

          {/* Trust */}
          <p className="mt-8 text-center text-sm text-gray-500">
            Trusted by 200+ hypothyroid women across India
          </p>

        </div>

      </div>
    </section>
  );
}