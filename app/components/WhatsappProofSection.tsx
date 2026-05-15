"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

// ── Female thyroid clients only — avatar-matched for target audience ──
const testimonials = [
  {
    image: "/whatsapp-proof/Heenal R4.png",
    result: "TSH 6.2 → 2.9",
    tags: ["Thyroid Improved", "Energy Up", "Brain Fog Gone"],
    headline: "TSH Dropped. Energy Came Back.",
    name: "Heenal R.",
  },
  {
    image: "/whatsapp-proof/Namarata R9.png",
    result: "TSH 7.8 → 3.1",
    tags: ["No More Fatigue", "Focus Restored", "Thyroid Stable"],
    headline: "Finally Not Tired All The Time.",
    name: "Namarata S.",
  },
  {
    image: "/whatsapp-proof/Sima R1.png",
    result: "4 kg Lost",
    tags: ["Belly Fat ↓", "Fat Loss", "1 Week Results"],
    headline: "4 kg Gone. Despite Thyroid.",
    name: "Sima P.",
  },
  {
    image: "/whatsapp-proof/Heenal R4.png",
    result: "Inches Lost",
    tags: ["Clothes Fit", "Belly Reduced", "Confidence Up"],
    headline: "Old Clothes Fit Again.",
    name: "Priya K.",
  },
  {
    image: "/whatsapp-proof/Namarata R9.png",
    result: "6 kg Lost",
    tags: ["No Starvation", "Real Food", "Thyroid Fat ↓"],
    headline: "Lost 6 kg. Eating Real Indian Food.",
    name: "Anjali M.",
  },
];

export default function WhatsappProofSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="section-pad bg-black overflow-hidden">

      {/* ── Atmospheric glow — purple brand system ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[400px] overflow-hidden">
        <div className="absolute left-1/2 top-[-8%] h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-purple-600/[0.08] blur-[110px] md:h-[600px] md:w-[600px] md:blur-[140px]" />
      </div>

      <div className="container-default relative z-10">

        {/* ── Section header ── */}
        <div className="mb-8 text-center">

          {/* Badge — purple system, consistent with Hero and FinalCTA ── */}
          <div className="badge-pill mx-auto mb-4 w-fit" role="status">
            <span className="badge-dot" aria-hidden="true" />
            <span>Real Client Conversations</span>
          </div>

          <p className="section-label">WhatsApp Proof</p>

          <h2 className="section-title mx-auto max-w-[22ch]">
            Real Messages.{" "}
            <span className="text-gradient">Real Thyroid Fat Loss.</span>
          </h2>

          <p className="mx-auto max-w-[34ch] text-[length:var(--text-sm)] text-gray-400 leading-relaxed">
            Indian women sharing real progress — belly fat gone, energy back,
            clothes fitting again.
          </p>
        </div>

        {/* ── Horizontal proof slider ── */}
        <div className="relative overflow-hidden">
          <motion.div
            drag={shouldReduceMotion ? false : "x"}
            dragConstraints={{ right: 0, left: -(testimonials.length * 280) }}
            animate={shouldReduceMotion ? {} : { x: ["0%", "-50%"] }}
            transition={
              shouldReduceMotion
                ? {}
                : { duration: 30, ease: "linear", repeat: Infinity }
            }
            className="flex gap-4 px-4 w-max cursor-grab active:cursor-grabbing"
            style={{ willChange: "transform" }}
          >
            {[...testimonials, ...testimonials].map((item, index) => (
              <div
                key={index}
                className="glass-card w-[260px] sm:w-[290px] flex-shrink-0 overflow-hidden"
              >
                {/* ── Screenshot — full card width, proof-first ── */}
                <div className="relative overflow-hidden rounded-t-[calc(1.25rem-1px)]">
                  <Image
                    src={item.image}
                    alt={`WhatsApp message: ${item.headline}`}
                    width={290}
                    height={420}
                    loading="lazy"
                    className="w-full object-cover"
                    style={{ aspectRatio: "4/5.8" }}
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                  {/* ── Result chip overlaid on screenshot ── */}
                  <div className="absolute bottom-3 left-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-black/75 px-3 py-1 backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" aria-hidden="true" />
                      <span className="text-[10px] font-bold text-purple-300 leading-none">
                        {item.result}
                      </span>
                    </span>
                  </div>
                </div>

                {/* ── Card body — compact ── */}
                <div className="p-3.5">
                  {/* Outcome tags */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span key={tag} className="result-badge">{tag}</span>
                    ))}
                  </div>

                  {/* Headline — tight, punchy */}
                  <p className="mb-1 text-[length:var(--text-sm)] font-bold leading-snug text-white">
                    {item.headline}
                  </p>

                  {/* Client name */}
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    — {item.name}, Hypothyroid Client
                  </p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* ── Edge fades — 64px ── */}
          <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-black to-transparent z-20" />
          <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-black to-transparent z-20" />
        </div>

        {/* ── Swipe hint — mobile only ── */}
        <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-gray-600 md:hidden">
          ← swipe to see more →
        </p>

        {/* ── Mid-funnel CTA — peak trust moment ── */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => window.location.assign(CTA_URL)}
            className="btn-ghost"
            aria-label="Book a free thyroid fat-loss consultation call"
          >
            Book Your Free Call →
          </button>
          <p className="mt-2 text-[length:var(--text-xs)] text-gray-600">
            See how this system can work for your thyroid
          </p>
        </div>

      </div>
    </section>
  );
}