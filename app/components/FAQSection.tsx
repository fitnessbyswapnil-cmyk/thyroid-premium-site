"use client";

import { useState } from "react";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const faqs = [
  {
    q: "I'm already on thyroid medication. Can I still join?",
    a: "Yes. This program works alongside your medication. We focus on nutrition, lifestyle, and fat loss — not replacing your doctor.",
  },
  {
    q: "What happens on the free strategy call?",
    a: "We analyse your current struggles, thyroid history, and goals — then show you exactly how the system works for you. No pressure, no sales pitch.",
  },
  {
    q: "How fast will I see results?",
    a: "Most clients notice energy and bloating improvements in Week 1–2. Visible fat and inch loss typically starts Week 3–4.",
  },
  {
    q: "Is this suitable for Hashimoto's?",
    a: "Absolutely. The system is designed for both hypothyroidism and Hashimoto's — with anti-inflammatory nutrition built in.",
  },
  {
    q: "Will I have to follow a strict diet?",
    a: "No starvation. Real Indian meals. We adapt your existing food culture — no foreign foods, no extreme calorie cutting.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="section-pad bg-black text-white">
      <div className="container-narrow">

        {/* Header */}
        <div className="mb-5 text-center">
          <p className="section-label">FAQs</p>
          <h2 className="section-title mx-auto max-w-[20ch]">Common Questions</h2>
        </div>

        {/* Accordion */}
        <div className="rounded-[18px] border border-white/[0.07]">
          {faqs.map((faq, i) => {
            const panelId = `faq-panel-${i}`;
            const isOpen = open === i;
            return (
              <div
                key={i}
                className={i < faqs.length - 1 ? "border-b border-white/[0.07]" : ""}
              >
                <button
                  type="button"
                  id={`faq-btn-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between px-4 py-4 text-left font-semibold text-white"
                  style={{ fontSize: "var(--text-sm)", background: "none", border: "none" }}
                >
                  <span className="pr-2 leading-snug">{faq.q}</span>
                  <span
                    className="shrink-0 text-purple-400 text-lg leading-none transition-transform duration-200"
                    aria-hidden="true"
                    style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
                  >
                    +
                  </span>
                </button>

                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={`faq-btn-${i}`}
                    className="px-4 pb-4 text-gray-400 leading-relaxed"
                    style={{ fontSize: "var(--text-sm)" }}
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom CTA card */}
        <div className="mt-4 rounded-[18px] border border-purple-500/20 bg-purple-500/[0.06] p-4 text-center">
          <p className="mb-1 font-semibold text-white" style={{ fontSize: "var(--text-sm)" }}>
            Still have questions?
          </p>
          <p className="mb-4 text-gray-500" style={{ fontSize: "var(--text-xs)" }}>
            I&apos;ll answer everything on a free 60-minute call.
          </p>
          <button
            type="button"
            onClick={() => window.location.assign(CTA_URL)}
            className="btn-primary"
            aria-label="Book a free thyroid fat-loss strategy call"
          >
            Book a Free Strategy Call →
          </button>
          <p className="mt-2.5 text-gray-600" style={{ fontSize: "var(--text-xs)" }}>
            ACE · FITR · INFS Certified · 200+ Clients
          </p>
        </div>

      </div>
    </section>
  );
}