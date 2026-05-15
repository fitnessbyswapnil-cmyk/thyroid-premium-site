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
        <div className="mb-6 text-center">
          <p className="section-label">FAQs</p>
          <h2 className="section-title mx-auto max-w-[20ch]">Common Questions</h2>
        </div>

        {/* Accordion — no overflow-hidden so focus rings are visible */}
        <div className="rounded-2xl border border-white/[0.07]">
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
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-[length:var(--text-sm)] font-semibold text-white bg-none border-none cursor-pointer"
                  style={{ background: "none", border: "none" }}
                >
                  <span>{faq.q}</span>
                  <span
                    className="ml-4 shrink-0 text-purple-400 text-base leading-none transition-transform duration-200"
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
                    className="px-5 pb-4 text-[length:var(--text-sm)] text-gray-400 leading-relaxed max-w-[52ch]"
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom CTA card */}
        <div className="mt-5 rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-5 text-center">
          <p className="mb-1 text-[length:var(--text-sm)] font-semibold text-white">
            Still have questions?
          </p>
          <p className="mb-4 text-[length:var(--text-xs)] text-gray-500">
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
          <p className="mt-2.5 text-[length:var(--text-xs)] text-gray-600">
            ACE · FITR · INFS Certified · 200+ Clients
          </p>
        </div>

      </div>
    </section>
  );
}