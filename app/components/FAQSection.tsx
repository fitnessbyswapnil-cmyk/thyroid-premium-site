"use client";

import { useState } from "react";

const faqs = [
  {
    question: "Will this work if I already failed multiple diets?",
    answer:
      "Yes. Most thyroid clients fail because they follow generic fat loss advice that ignores hormones, inflammation, stress, recovery, digestion, and thyroid metabolism. The T.H.Y.R.O.I.D. Lean Method is designed specifically for hypothyroid and Hashimoto’s clients.",
  },
  {
    question: "Can I still eat Indian food during coaching?",
    answer:
      "Absolutely. This system is built around sustainable Indian meals and real family lifestyle routines. No extreme restriction, starvation dieting, or unrealistic meal plans.",
  },
  {
    question: "Do I need gym or intense workouts?",
    answer:
      "No. Your movement strategy is customized according to your recovery, energy, thyroid condition, stress levels, and current lifestyle. Many clients start with walking, recovery-focused movement, and low-stress strength training.",
  },
  {
    question: "Is this suitable for Hashimoto’s and hypothyroidism?",
    answer:
      "Yes. The coaching is specifically designed for thyroid-related fat loss resistance, metabolism slowdown, fatigue, bloating, hormonal imbalance, and recovery optimization.",
  },
  {
    question: "Is the coaching personalized to my reports and symptoms?",
    answer:
      "Yes. Every client receives a customized strategy based on thyroid labs, symptoms, recovery capacity, lifestyle, food preferences, digestion, cravings, sleep quality, and progress tracking data.",
  },
  {
    question: "Do you work with both women and men?",
    answer:
      "Yes. While many thyroid clients are women, we also work with men struggling with thyroid fat gain, fatigue, low metabolism, poor recovery, and hormonal health issues.",
  },
  {
    question: "How quickly can I expect results?",
    answer:
      "Most clients begin noticing improvements in energy, bloating, recovery, sleep quality, and body measurements within the first few weeks when they follow the system consistently.",
  },
  {
    question: "What support do I receive during coaching?",
    answer:
      "Clients receive personalized nutrition guidance, progress tracking, weekly reviews, accountability support, strategy adjustments, and direct communication support throughout the coaching journey.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="relative overflow-hidden bg-black py-28 px-6">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.14),transparent_65%)]" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center rounded-full border border-purple-500/20 bg-purple-500/10 px-5 py-2 text-sm text-purple-200 mb-6">
            FREQUENTLY ASKED QUESTIONS
          </div>

          <h2 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
            Everything You Need To Know
            <span className="block bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
              Before Joining
            </span>
          </h2>

          <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
            Most thyroid clients have already tried multiple diets, workouts,
            medications, and inconsistent plans before joining. Here are the
            most common questions we receive before starting coaching.
          </p>
        </div>

        {/* FAQ Cards */}
        <div className="space-y-5">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={index}
                className="overflow-hidden rounded-[28px] border border-purple-500/10 bg-gradient-to-b from-[#12071f] to-black transition-all duration-300"
              >
                <button
                  onClick={() =>
                    setOpenIndex(isOpen ? null : index)
                  }
                  className="flex w-full items-center justify-between px-8 py-7 text-left"
                >
                  <span className="text-lg md:text-xl font-semibold text-white pr-6">
                    {faq.question}
                  </span>

                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10 text-purple-300 text-2xl">
                    {isOpen ? "−" : "+"}
                  </div>
                </button>

                <div
                  className={`grid transition-all duration-500 ease-in-out ${
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-8 pb-8 text-gray-400 leading-relaxed text-base md:text-lg">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Trust Strip */}
        <div className="mt-20 rounded-[32px] border border-purple-500/20 bg-gradient-to-b from-[#13071f] to-black p-10 text-center shadow-[0_0_60px_rgba(168,85,247,0.12)]">
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-5">
            Still Unsure If This Is Right For You?
          </h3>

          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            Book a free thyroid strategy consultation and we’ll analyze your
            current struggles, metabolism challenges, symptoms, and goals to
            see whether this coaching is the right fit for you.
          </p>

          <button
            onClick={() =>
              window.open(
                "https://wa.me/91XXXXXXXXXX",
                "_blank"
              )
            }
            className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-10 py-5 text-lg font-bold text-white shadow-[0_0_40px_rgba(168,85,247,0.4)] transition-all duration-300 hover:scale-105"
          >
            🔥 Book Free Strategy Call
          </button>

          <p className="mt-5 text-sm text-gray-500">
            ACE • FITR • INFS Certified • 200+ Thyroid Clients Helped
          </p>
        </div>
      </div>
    </section>
  );
}