"use client";
import { useState } from "react";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const faqs = [
  { q: "I'm already on thyroid medication. Can I still join?", a: "Yes. This program works alongside your medication. We focus on nutrition, lifestyle, and fat loss — not replacing your doctor." },
  { q: "How fast will I see results?",                         a: "Most clients notice energy and bloating improvements in week 1–2. Visible fat and inch loss typically starts week 3–4." },
  { q: "Is this suitable for Hashimoto's?",                    a: "Absolutely. The system is specifically designed for both hypothyroidism and Hashimoto's — with anti-inflammatory nutrition built in." },
  { q: "Will I have to follow a strict diet?",                 a: "No starvation. Real Indian meals. We adapt your existing food culture — no foreign foods, no extreme calorie cutting." },
  { q: "What happens on the free strategy call?",              a: "We analyze your current struggles, thyroid history, lifestyle, and goals — then show you exactly how the system would work for you. No pressure." },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="section-pad bg-black text-white">
      <div className="container-narrow">

        <div className="mb-6 text-center">
          <p className="section-label">FAQs</p>
          <h2 className="section-title mx-auto max-w-xs">Common Questions</h2>
        </div>

        <div className="divide-y divide-white/[0.07] rounded-2xl border border-white/[0.07] overflow-hidden">
          {faqs.map((faq, i) => (
            <div key={i}>
              <button type="button" className="faq-question px-4" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <span>{faq.q}</span>
                <span className="ml-3 shrink-0 text-purple-400 text-base leading-none">{open === i ? "−" : "+"}</span>
              </button>
              {open === i && <div className="faq-answer px-4">{faq.a}</div>}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4 text-center">
          <p className="mb-3 text-sm font-semibold text-white">Still have questions?</p>
          <button type="button" onClick={() => (window.location.href = CTA_URL)} className="btn-primary">
            Book a Free Strategy Call →
          </button>
          <p className="mt-2 text-xs text-gray-600">ACE · FITR · INFS Certified · 200+ Clients</p>
        </div>

      </div>
    </section>
  );
}