"use client";

const transformations = [
  {
    name: "Vaidehi",
    age: "34",
    result: "Lost 12 kg in 90 Days",
    image: "/transformations/Vaidehi 1.png",
  },
  {
    name: "Rozal",
    age: "29",
    result: "Lost 9 kg & improved thyroid energy",
    image: "/transformations/Rozal 2.png",
  },
  {
    name: "Surekha",
    age: "41",
    result: "Reduced belly fat & bloating naturally",
    image: "/transformations/Surekha 3.png",
  },
  {
    name: "Kishore",
    age: "38",
    result: "Recovered energy & lost stubborn fat",
    image: "/transformations/Kishore 4.png",
  },
  {
    name: "Namrata",
    age: "32",
    result: "Improved confidence & body composition",
    image: "/transformations/Namrata 5.png",
  },
  {
    name: "Nehamia",
    age: "36",
    result: "Lost thyroid weight sustainably",
    image: "/transformations/Nehamia 6.png",
  },
];

export default function ResultsSection() {
  return (
    <section className="relative overflow-hidden bg-black py-28 px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.18),transparent_65%)]" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <div className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-5 py-2 text-sm text-purple-200 mb-6">
            REAL CLIENT TRANSFORMATIONS
          </div>

          <h2 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
            Real Thyroid Fat Loss
            <span className="block bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
              Success Stories
            </span>
          </h2>

          <p className="text-gray-400 text-lg md:text-xl leading-relaxed">
            These clients struggled with stubborn thyroid fat gain, low energy,
            bloating, cravings, fatigue, and hormonal imbalance before joining
            the T.H.Y.R.O.I.D. Lean Method.
          </p>
        </div>

        {/* Featured Transformation */}
        <div className="mb-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center rounded-[32px] border border-purple-500/20 bg-gradient-to-b from-[#12071f] to-black p-8 md:p-12 shadow-[0_0_60px_rgba(168,85,247,0.12)]">
            <div>
              <img
                src="/transformations/Vaidehi 1.png"
                alt="Vaidehi Transformation"
                className="w-full rounded-3xl object-cover"
              />
            </div>

            <div>
              <div className="inline-flex items-center rounded-full bg-purple-500/10 border border-purple-500/20 px-4 py-2 text-purple-300 text-sm mb-6">
                FEATURED TRANSFORMATION
              </div>

              <h3 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Lost 12 kg
                <span className="block text-purple-400">
                  In 90 Days Naturally
                </span>
              </h3>

              <p className="text-gray-300 text-lg leading-relaxed mb-8">
                Vaidehi struggled with stubborn thyroid fat gain, bloating,
                fatigue, and low confidence for years before following the
                T.H.Y.R.O.I.D. Lean Method.
              </p>

              <div className="space-y-4 mb-10">
                <div className="flex items-center gap-3 text-gray-200">
                  ✅ Better energy & recovery
                </div>

                <div className="flex items-center gap-3 text-gray-200">
                  ✅ Sustainable Indian diet approach
                </div>

                <div className="flex items-center gap-3 text-gray-200">
                  ✅ Reduced belly fat & bloating
                </div>

                <div className="flex items-center gap-3 text-gray-200">
                  ✅ No starvation or crash dieting
                </div>
              </div>

              <button
                onClick={() =>
                  window.open(
                    "https://wa.me/919876543210",
                    "_blank"
                  )
                }
                className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-8 py-5 text-lg font-semibold text-white shadow-[0_0_40px_rgba(168,85,247,0.4)] transition-all duration-300 hover:scale-105"
              >
                🔥 Book My Free Strategy Call
              </button>
            </div>
          </div>
        </div>

        {/* Grid Transformations */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {transformations.map((item, index) => (
            <div
              key={index}
              className="group overflow-hidden rounded-[28px] border border-purple-500/10 bg-gradient-to-b from-[#0f0a18] to-black transition-all duration-500 hover:-translate-y-2 hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(168,85,247,0.18)]"
            >
              <div className="overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>

              <div className="p-6">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {item.name}
                </h3>

                <p className="text-purple-300 mb-4">
                  Age {item.age}
                </p>

                <p className="text-gray-300 leading-relaxed">
                  {item.result}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <button
            onClick={() =>
              window.open(
                "https://wa.me/917987880954",
                "_blank"
              )
            }
            className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-10 py-6 text-xl font-bold text-white shadow-[0_0_50px_rgba(168,85,247,0.4)] transition-all duration-300 hover:scale-105"
          >
            🚀 Start Your Thyroid Transformation
          </button>

          <p className="mt-4 text-gray-500">
            Limited personalized coaching spots available this month.
          </p>
        </div>
      </div>
    </section>
  );
}