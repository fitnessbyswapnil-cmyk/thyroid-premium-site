"use client";

export default function FinalCTASection() {
  return (
    <section className="relative overflow-hidden bg-black py-24 px-6">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.16),transparent_70%)]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Heading */}
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-5 py-2 text-sm tracking-wide text-violet-300 backdrop-blur-sm">
            ⚡ LIMITED THYROID TRANSFORMATION SPOTS
          </div>

          <h2 className="text-4xl font-bold leading-tight text-white md:text-6xl">
            Start Your{" "}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
              Thyroid Fat Loss
            </span>{" "}
            Transformation
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-zinc-400 md:text-xl">
            Personalized thyroid-focused coaching designed for sustainable fat
            loss, hormone support, better energy, improved recovery, and real
            lifestyle transformation.
          </p>
        </div>

        {/* MAIN CARD */}
        <div className="grid gap-10 rounded-[32px] border border-violet-500/20 bg-gradient-to-b from-zinc-950 to-black p-8 shadow-[0_0_80px_rgba(139,92,246,0.12)] md:grid-cols-2 md:p-12">
          
          {/* LEFT */}
          <div className="flex flex-col">
            {/* Image */}
            <div className="overflow-hidden rounded-[28px] border border-violet-500/20 bg-zinc-950">
              <img
                src="https://swapnilumbarkarfitness.in/wp-content/uploads/2025/05/Swapnil-2.png"
                alt="Swapnil Umbarkar"
                className="h-full w-full object-cover"
              />
            </div>

            {/* Details */}
            <div className="mt-8">
              <h3 className="text-4xl font-bold text-white">
                Swapnil Umbarkar
              </h3>

              <p className="mt-2 text-lg text-violet-300">
                Thyroid Fat Loss Specialist
              </p>

              <p className="mt-5 leading-relaxed text-zinc-400">
                Specialized in thyroid-focused fat loss, metabolism restoration,
                hormonal recovery, sustainable Indian nutrition, and long-term
                transformation systems for hypothyroid and Hashimoto’s clients.
              </p>

              {/* Certifications */}
              <div className="mt-8 grid gap-4">
                
                <div className="rounded-2xl border border-violet-500/20 bg-zinc-950/80 p-5 transition-all duration-300 hover:border-violet-400/40">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-xl">🧠</div>

                    <div>
                      <h4 className="text-lg font-semibold text-white">
                        Certified in Nutrition for Hashimoto’s Thyroiditis
                      </h4>

                      <p className="mt-1 text-sm text-zinc-400">
                        Specialized thyroid nutrition and autoimmune recovery education.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-xl">🏆</div>

                    <div>
                      <h4 className="text-lg font-semibold text-white">
                        ACE Certified Personal Trainer
                      </h4>

                      <p className="mt-1 text-sm text-zinc-400">
                        Internationally recognized fitness and exercise science certification.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-xl">🥗</div>

                    <div>
                      <h4 className="text-lg font-semibold text-white">
                        INFS Certified Nutrition Coach
                      </h4>

                      <p className="mt-1 text-sm text-zinc-400">
                        Evidence-based nutrition coaching and fat loss specialization.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-xl">❤️</div>

                    <div>
                      <h4 className="text-lg font-semibold text-white">
                        BLS Certified
                      </h4>

                      <p className="mt-1 text-sm text-zinc-400">
                        Certified in emergency response and basic life support systems.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col justify-center">
            <div className="rounded-[28px] border border-violet-500/20 bg-zinc-950/80 p-8">
              <h3 className="text-4xl font-bold text-white">
                What You’ll Get
              </h3>

              <div className="mt-8 grid gap-5">
                <div className="rounded-2xl border border-zinc-800 bg-black/60 p-6">
                  <h4 className="text-xl font-semibold text-white">
                    Personalized Thyroid Nutrition
                  </h4>

                  <p className="mt-3 leading-relaxed text-zinc-400">
                    Customized Indian meal plans optimized for thyroid recovery,
                    fat loss, gut health, digestion, hormones, and sustainable
                    adherence.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-black/60 p-6">
                  <h4 className="text-xl font-semibold text-white">
                    Weekly Monitoring & Adjustments
                  </h4>

                  <p className="mt-3 leading-relaxed text-zinc-400">
                    Continuous optimization using progress tracking, recovery,
                    sleep, symptoms, digestion, energy, and lifestyle data.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-black/60 p-6">
                  <h4 className="text-xl font-semibold text-white">
                    Direct WhatsApp Support
                  </h4>

                  <p className="mt-3 leading-relaxed text-zinc-400">
                    Get accountability, direct support, coaching guidance, and
                    personalized adjustments throughout your transformation.
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div className="mt-10">
                <a
                  href="#cta"
                  className="group flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-8 py-5 text-center text-lg font-semibold text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(168,85,247,0.45)]"
                >
                  🔥 Book Your Free Thyroid Strategy Call
                </a>

                <p className="mt-4 text-center text-sm text-zinc-500">
                  Limited personalized coaching spots available this month.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CERTIFICATIONS */}
        <div className="mt-28">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <h3 className="text-4xl font-bold text-white md:text-5xl">
              Certifications & Clinical Education
            </h3>

            <p className="mt-5 text-lg leading-relaxed text-zinc-400">
              Specialized education in thyroid nutrition, metabolism,
              sustainable fat loss systems, hormonal health, recovery, and
              evidence-based coaching.
            </p>
          </div>

          {/* Premium Equal Grid */}
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Nutrition for Hashimoto’s Thyroiditis",
                image:
                  "https://swapnilumbarkarfitness.in/wp-content/uploads/2026/05/ChatGPT-Image-May-12-2026-11_50_26-PM.png",
              },
              {
                title: "ACE Certified",
                image:
                  "https://swapnilumbarkarfitness.in/wp-content/uploads/2026/02/Screenshot_2023-05-23-16-43-53-01_e2d5b3f32b79de1d45acd1fad96fbb0f-1.jpg",
              },
              {
                title: "INFS Certified Nutrition Coach",
                image:
                  "https://swapnilumbarkarfitness.in/wp-content/uploads/2026/02/Screenshot_2023-05-23-16-43-33-18_e2d5b3f32b79de1d45acd1fad96fbb0f-1.jpg",
              },
              {
                title: "BLS Certified",
                image:
                  "https://swapnilumbarkarfitness.in/wp-content/uploads/2026/02/Screenshot_2023-05-23-16-43-14-95_e2d5b3f32b79de1d45acd1fad96fbb0f-1.jpg",
              },
            ].map((cert, index) => (
              <div
                key={index}
                className="group overflow-hidden rounded-[28px] border border-violet-500/20 bg-zinc-950 transition-all duration-500 hover:-translate-y-2 hover:border-violet-400/40 hover:shadow-[0_0_50px_rgba(139,92,246,0.18)]"
              >
                {/* IMAGE AREA */}
                <div className="flex h-[320px] items-center justify-center bg-white p-4">
                  <img
                    src={cert.image}
                    alt={cert.title}
                    className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                </div>

                {/* TEXT AREA */}
                <div className="flex min-h-[110px] items-center p-6">
                  <h4 className="text-xl font-semibold leading-snug text-white">
                    {cert.title}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mx-auto mt-20 max-w-4xl text-center text-sm leading-relaxed text-zinc-500">
          This coaching is designed to support thyroid-friendly fat loss,
          recovery, metabolism, energy, and sustainable lifestyle
          transformation. It does not replace medical advice or prescribed
          thyroid treatment.
        </div>
      </div>
    </section>
  );
}