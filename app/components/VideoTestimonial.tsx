"use client";

export default function VideoTestimonial() {
  return (
    <section className="bg-black text-white py-24 px-5">

      <div className="max-w-6xl mx-auto">

        {/* Heading */}
        <div className="text-center mb-16">

          <p className="text-purple-400 uppercase tracking-[0.3em] text-sm mb-4">
            REAL CLIENT RESULTS
          </p>

          <h2 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Real Women. <br />
            Real Thyroid Transformation.
          </h2>

          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            These women struggled for years with stubborn thyroid weight,
            fatigue, bloating, and failed diets — until they followed a
            thyroid-specific approach.
          </p>

        </div>

        {/* TESTIMONIAL 1 */}
        <div className="rounded-[36px] overflow-hidden border border-white/10 bg-gradient-to-b from-purple-900/20 to-black backdrop-blur-xl shadow-[0_0_80px_rgba(168,85,247,0.12)] mb-16">

          {/* Video */}
          <div className="bg-black">

            <video
              controls
              preload="metadata"
              playsInline
              className="w-full aspect-video object-contain bg-black"
            >
              <source
                src="https://swapnilumbarkarfitness.in/wp-content/uploads/2025/08/%F0%9F%8E%A5-Rashmis-3-Week-Thyroid-Fat-Loss-Transformation.mp4"
                type="video/mp4"
              />
            </video>

          </div>

          {/* Content */}
          <div className="p-8 md:p-14 text-center">

            <div className="text-purple-400 text-6xl mb-6">
              “
            </div>

            <p className="text-2xl md:text-4xl font-medium leading-relaxed text-white mb-10 max-w-4xl mx-auto">
              In just 3 weeks, I saw changes I couldn’t achieve in 3 years.
              My energy improved, bloating reduced, and I finally felt
              confident again.
            </p>

            <div className="space-y-2 mb-10">

              <h3 className="text-3xl font-bold">
                Rashmi
              </h3>

              <p className="text-gray-400 text-lg">
                Hypothyroid Fat Loss Client
              </p>

            </div>

            <div className="grid md:grid-cols-3 gap-4">

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                ✓ Reduced stubborn belly fat
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                ✓ Improved daily energy levels
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                ✓ No starvation or crash dieting
              </div>

            </div>

          </div>

        </div>

        {/* TESTIMONIAL 2 */}
        <div className="rounded-[36px] overflow-hidden border border-white/10 bg-gradient-to-b from-purple-900/20 to-black backdrop-blur-xl shadow-[0_0_80px_rgba(168,85,247,0.12)]">

          {/* Video */}
          <div className="bg-black">

            <video
              controls
              preload="metadata"
              playsInline
              className="w-full aspect-video object-contain bg-black"
            >
              <source
                src="https://swapnilumbarkarfitness.in/wp-content/uploads/2026/05/%F0%9F%8C%B8-Fathimas-2-Week-Thyroid-Fat-Loss-Update.mp4"
                type="video/mp4"
              />
            </video>

          </div>

          {/* Content */}
          <div className="p-8 md:p-14 text-center">

            <div className="text-purple-400 text-6xl mb-6">
              “
            </div>

            <p className="text-2xl md:text-4xl font-medium leading-relaxed text-white mb-10 max-w-4xl mx-auto">
              For the first time in years, I feel lighter, more energetic,
              and emotionally confident in my body.
            </p>

            <div className="space-y-2 mb-10">

              <h3 className="text-3xl font-bold">
                Fathima
              </h3>

              <p className="text-gray-400 text-lg">
                Thyroid Fat Loss Coaching Client
              </p>

            </div>

            <div className="grid md:grid-cols-3 gap-4">

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                ✓ Better energy & mood
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                ✓ Visible inch loss naturally
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                ✓ Felt confident again
              </div>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}