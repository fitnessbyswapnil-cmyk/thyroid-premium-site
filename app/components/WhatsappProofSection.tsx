"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const testimonials = [
  {
    image: "/whatsapp-proof/Heenal R4.png",
    headline: "TSH Down + Energy Back Naturally",
    subtext:
      "Reduced TSH from 6.2 → 2.9 while improving fatigue, mood swings, and brain fog.",
    gender: "female",
  },

  {
    image: "/whatsapp-proof/Namarata R9.png",
    headline: "No More Constant Tiredness",
    subtext:
      "TSH improved from 7.8 → 3.1 with better energy, focus, and thyroid support.",
    gender: "female",
  },

  {
    image: "/whatsapp-proof/Sima R1.png",
    headline: "4 Kg Fat Loss Despite Thyroid",
    subtext:
      "Visible fat loss in just 1 week while managing thyroid-related weight struggles.",
    gender: "female",
  },

  {
    image: "/whatsapp-proof/Jay R6.png",
    headline: "6 Kg Fat Loss In 30 Days",
    subtext:
      "Consistent fat loss with structured nutrition and accountability.",
    gender: "male",
  },

  {
    image: "/whatsapp-proof/Guitar R8.png",
    headline: "4 Kg Fat Loss In 45 Days",
    subtext:
      "Steady fat loss with sustainable dieting and better consistency.",
    gender: "male",
  },

  {
    image: "/whatsapp-proof/Rakesh R3.png",
    headline: "Visible Belly Fat Reduction",
    subtext:
      "Dropped 4.1 kg in 18 days with visible body changes.",
    gender: "male",
  },

  {
    image: "/whatsapp-proof/Nitin R10.png",
    headline: "14 Kg Fat Loss + Confidence Boost",
    subtext:
      "Massive body transformation with improved confidence and consistency.",
    gender: "male",
  },

  {
    image: "/whatsapp-proof/Nishant R7.png",
    headline: "Muscle Gain + Better Physique",
    subtext:
      "Improved body composition and lean muscle naturally.",
    gender: "male",
  },

  {
    image: "/whatsapp-proof/Nahamia R5.png",
    headline: "Lean Transformation + Gym Confidence",
    subtext:
      "Better physique and confidence after visible transformation.",
    gender: "male",
  },

  {
    image: "/whatsapp-proof/Rozal R2.png",
    headline: "Visible 6-Pack Abs & Lean Muscle",
    subtext:
      "Achieved ripped physique and visible abs with proper structure.",
    gender: "male",
  },
];

export default function WhatsappProofSection() {
  return (
    <section className="relative overflow-hidden bg-black py-24">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#18002e,transparent_45%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        {/* Heading */}
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center rounded-full border border-green-500/20 bg-green-500/10 px-5 py-2">
            <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-400"></span>

            <span className="text-sm font-semibold tracking-wide text-green-400">
              REAL CLIENT CONVERSATIONS
            </span>
          </div>

          <h2 className="text-4xl font-black leading-tight text-white md:text-6xl">
            Real WhatsApp Messages.
            <br />

            <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 bg-clip-text text-transparent">
              Real Fat Loss & Thyroid Results.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-400">
            Real Indian clients improving thyroid health, fat loss, energy,
            confidence, digestion, muscle definition, and lifestyle consistency
            naturally through structured coaching and accountability.
          </p>
        </div>

        {/* Infinite Scroll */}
        <div className="relative overflow-hidden">
          <motion.div
            animate={{
              x: ["0%", "-50%"],
            }}
            transition={{
              duration: 18,
              ease: "linear",
              repeat: Infinity,
            }}
            className="flex gap-8"
          >
            {[...testimonials, ...testimonials].map((item, index) => (
              <div
                key={index}
                className="min-w-[340px] max-w-[340px] rounded-[34px] border border-white/10 bg-gradient-to-b from-zinc-900 to-black p-4 shadow-[0_0_40px_rgba(0,255,120,0.08)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-green-400/20 hover:shadow-[0_0_60px_rgba(0,255,120,0.15)]"
              >
                {/* Screenshot */}
                <div className="overflow-hidden rounded-[26px] border border-white/10 bg-black">
                  <Image
                    src={item.image}
                    alt={item.headline}
                    width={400}
                    height={800}
                    className="h-auto w-full object-cover"
                    priority
                  />
                </div>

                {/* Content */}
                <div className="pt-6">
                  <div
                    className={`mb-4 inline-flex rounded-full px-4 py-1 text-xs font-semibold tracking-wide ${
                      item.gender === "female"
                        ? "bg-pink-500/15 text-pink-300"
                        : "bg-blue-500/15 text-blue-300"
                    }`}
                  >
                    {item.gender === "female"
                      ? "Women Transformation"
                      : "Men Transformation"}
                  </div>

                  <h3 className="text-2xl font-bold leading-snug text-white">
                    {item.headline}
                  </h3>

                  <p className="mt-4 text-base leading-relaxed text-gray-400">
                    {item.subtext}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Left Fade */}
          <div className="absolute left-0 top-0 h-full w-32 bg-gradient-to-r from-black to-transparent" />

          {/* Right Fade */}
          <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-black to-transparent" />
        </div>

        {/* Bottom Trust Line */}
        <div className="mt-16 text-center">
          <p className="mx-auto max-w-4xl text-base leading-relaxed text-gray-500 md:text-lg">
            No fake reviews. No stock screenshots. Just real Indian clients
            sharing real progress through consistent nutrition, training,
            thyroid-focused fat loss systems, and long-term accountability.
          </p>
        </div>
      </div>
    </section>
  );
}