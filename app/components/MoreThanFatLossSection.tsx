"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const stories = [
  {
    image: "/MoreThanFatLossSection/heenal.png",
    title: "Balanced Hormones & Better Productivity",
    description:
      "Lost 15 kg naturally while improving hormonal balance and daily energy.",
    tags: ["Hormone Balance", "Better Energy"],
  },
  {
    image: "/MoreThanFatLossSection/surekha.png",
    title: "From Fatigue & Bloating → Better Energy",
    description:
      "Reduced bloating and improved thyroid-focused recovery naturally.",
    tags: ["Thyroid Support", "Less Bloating"],
  },
  {
    image: "/MoreThanFatLossSection/ajay.png",
    title: "More Energy & Better Sleep",
    description:
      "Lost 6 kg in 30 days while improving sleep and daily recovery.",
    tags: ["Better Sleep", "More Energy"],
  },
  {
    image: "/MoreThanFatLossSection/nitin.png",
    title: "Better Digestion & Recovery",
    description:
      "Night-shift fatigue and digestion issues improved within 60 days.",
    tags: ["Digestion", "Recovery"],
  },
  {
    image: "/MoreThanFatLossSection/ashish.png",
    title: "Reduced Bloating & Better Insulin Response",
    description:
      "Improved body composition and reduced water retention naturally.",
    tags: ["Insulin Support", "Fat Loss"],
  },
];

export default function MoreThanFatLossSection() {
  return (
    <section className="relative py-28 bg-black overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_40%)]" />

      <div className="relative z-10">
        {/* Heading */}
        <div className="max-w-5xl mx-auto px-6 text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-300 text-sm font-medium mb-6">
            REAL CLIENT TRANSFORMATIONS
          </div>

          <h2 className="text-4xl md:text-6xl font-bold text-white leading-tight">
            More Than Just
            <span className="text-purple-400"> Fat Loss</span>
          </h2>

          <p className="mt-6 text-lg text-gray-400 leading-relaxed max-w-3xl mx-auto">
            Real Indian professionals improving thyroid health, digestion,
            bloating, sleep, energy, and lifestyle consistency naturally.
          </p>
        </div>

        {/* Infinite Moving Slider */}
        <div className="relative overflow-hidden">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              repeat: Infinity,
              duration: 35,
              ease: "linear",
            }}
            className="flex gap-8 w-max"
          >
            {[...stories, ...stories].map((story, index) => (
              <div
                key={index}
                className="group w-[340px] md:w-[380px] flex-shrink-0 rounded-[32px] overflow-hidden border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_40px_rgba(139,92,246,0.12)] hover:shadow-[0_0_60px_rgba(139,92,246,0.22)] transition-all duration-500"
              >
                {/* Image */}
                <div className="relative overflow-hidden">
                  <Image
                    src={story.image}
                    alt={story.title}
                    width={500}
                    height={900}
                    className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-700"
                  />

                  {/* Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                </div>

                {/* Content */}
                <div className="p-7">
                  <h3 className="text-2xl font-bold text-white leading-snug mb-4">
                    {story.title}
                  </h3>

                  <p className="text-gray-400 leading-relaxed text-base mb-6">
                    {story.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-3">
                    {story.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-200 text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Left Fade */}
          <div className="absolute left-0 top-0 w-32 h-full bg-gradient-to-r from-black to-transparent z-20 pointer-events-none" />

          {/* Right Fade */}
          <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-black to-transparent z-20 pointer-events-none" />
        </div>

        {/* Bottom Line */}
        <div className="text-center mt-14 px-6">
          <p className="text-gray-500 text-sm md:text-base max-w-3xl mx-auto">
            Not fitness models. Not fake ads. Real thyroid-focused client
            transformations with sustainable Indian nutrition and lifestyle
            support.
          </p>
        </div>
      </div>
    </section>
  );
}