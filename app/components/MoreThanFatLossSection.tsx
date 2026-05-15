"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const stories = [
  {
    image: "/MoreThanFatLossSection/heenal.png",
    name: "Heenal S.",
    result: "15 kg Lost",
    tags: ["Belly Fat ↓", "Hormones Stable", "Energy Up"],
    quote: "Finally lost the weight thyroid stole from me for 4 years.",
  },
  {
    image: "/MoreThanFatLossSection/surekha.png",
    name: "Surekha M.",
    result: "Bloating Gone",
    tags: ["Flat Stomach", "Thyroid Fat Lost", "No Fatigue"],
    quote: "My clothes fit again. I feel like myself.",
  },
  {
    image: "/MoreThanFatLossSection/ashish.png",
    name: "Priya K.",
    result: "8 kg Lost",
    tags: ["Waist Reduced", "Fat Loss", "Confident"],
    quote: "Belly fat reduced in just 3 weeks. I'm shocked.",
  },
  {
    image: "/MoreThanFatLossSection/nitin.png",
    name: "Kavita R.",
    result: "Inches Lost",
    tags: ["Less Bloating", "Better Energy", "Clothes Fit"],
    quote: "I stopped hiding in baggy clothes. 60 days changed everything.",
  },
  {
    image: "/MoreThanFatLossSection/heenal.png",
    name: "Anjali T.",
    result: "6 kg Lost",
    tags: ["Flat Belly", "No Starvation", "Thyroid Fat ↓"],
    quote: "Real food. Real results. No gym needed.",
  },
];

export default function MoreThanFatLossSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="section-pad bg-black overflow-hidden">

      {/* ── Atmospheric glow — consistent with page depth hierarchy ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[400px] overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-purple-600/[0.07] blur-[100px] md:h-[580px] md:w-[580px] md:blur-[130px]" />
      </div>

      <div className="relative z-10">

        {/* ── Section header — fat-loss first ── */}
        <div className="container-default mb-8 text-center">
          <p className="section-label">Real Client Transformations</p>

          <h2 className="section-title mx-auto max-w-[22ch]">
            Real Women.{" "}
            <span className="text-gradient">Real Fat Loss.</span>
          </h2>

          <p className="mx-auto max-w-[36ch] text-[length:var(--text-sm)] text-gray-400 leading-relaxed">
            Indian women with hypothyroidism — losing belly fat, fitting old clothes,
            and feeling confident again.
          </p>
        </div>

        {/* ── Horizontal drag slider ── */}
        <div className="relative overflow-hidden">
          <motion.div
            drag={shouldReduceMotion ? false : "x"}
            dragConstraints={{ right: 0, left: -(stories.length * 300) }}
            animate={shouldReduceMotion ? {} : { x: ["0%", "-50%"] }}
            transition={
              shouldReduceMotion
                ? {}
                : { repeat: Infinity, duration: 32, ease: "linear" }
            }
            className="flex gap-4 w-max px-4 cursor-grab active:cursor-grabbing"
            style={{ willChange: "transform" }}
          >
            {[...stories, ...stories].map((story, index) => (
              <div
                key={index}
                className="glass-card w-[260px] sm:w-[300px] flex-shrink-0 overflow-hidden"
              >
                {/* ── Image ── */}
                <div className="relative overflow-hidden rounded-t-[calc(1.25rem-1px)]">
                  <Image
                    src={story.image}
                    alt={`${story.name} thyroid fat loss transformation`}
                    width={300}
                    height={380}
                    loading="lazy"
                    className="w-full object-cover"
                    style={{ aspectRatio: "4/5" }}
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                  {/* ── Result badge overlaid on image ── */}
                  <div className="absolute bottom-3 left-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-black/70 px-3 py-1 backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400" aria-hidden="true" />
                      <span className="text-[length:var(--text-xs)] font-bold text-purple-300">
                        {story.result}
                      </span>
                    </span>
                  </div>
                </div>

                {/* ── Card body — compact ── */}
                <div className="p-4">
                  {/* Tags */}
                  <div className="mb-2.5 flex flex-wrap gap-1.5">
                    {story.tags.map((tag) => (
                      <span key={tag} className="result-badge">{tag}</span>
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="mb-1 text-[length:var(--text-xs)] italic leading-snug text-gray-300">
                    &ldquo;{story.quote}&rdquo;
                  </p>

                  {/* Name */}
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    — {story.name}, Hypothyroid Client
                  </p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* ── Edge fades — narrowed to 64px for maximum content visibility ── */}
          <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-black to-transparent z-20" />
          <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-black to-transparent z-20" />
        </div>

        {/* ── Swipe hint — visible on mobile only ── */}
        <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-gray-600 md:hidden">
          ← swipe to see more →
        </p>

        {/* ── Mid-funnel CTA — captures early-committed visitors ── */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => window.location.assign(CTA_URL)}
            className="btn-ghost"
            aria-label="Book a free thyroid fat-loss consultation call"
          >
            Start Your Transformation →
          </button>
          <p className="mt-2 text-[length:var(--text-xs)] text-gray-600">
            200+ Indian women transformed · Completely free call
          </p>
        </div>

      </div>
    </section>
  );
}