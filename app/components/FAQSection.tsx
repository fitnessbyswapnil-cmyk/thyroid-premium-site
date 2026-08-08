'use client'

import { useState, useRef, useEffect } from 'react'

import SectionCta from './SectionCta'
import SectionHeader from './SectionHeader'

const faqs = [
  {
    q: "I'm already on thyroid medication. Can I still join?",
    a: 'Yes. Coaching works alongside your medication — we focus on nutrition, lifestyle, and sustainable fat loss, not replacing your doctor.',
  },
  {
    q: 'What happens in the consultation call?',
    a: "I review your intake before we speak. In 60 minutes you'll understand exactly why the fat isn't moving, what your thyroid actually needs, and what reversing it involves — with a written summary in 24 hours.",
  },
  {
    q: 'Is the Thyroid Score assessment free?',
    a: "Yes — the 60-second quiz and your score are completely free. Decoding what your score actually means for you happens on the private 1-on-1 call.",
  },
  {
    q: 'Why is there a booking amount for the call?',
    a: "₹299 reserves a private 60-minute slot just for you and keeps the calendar for women who are serious about fixing this. It's fully adjusted against your plan if you join coaching.",
  },
  {
    q: 'How fast will I see results?',
    a: 'Most clients notice energy and bloating improvements in Weeks 1–2. Visible fat and inch loss often begins around Weeks 3–4.',
  },
  {
    q: "Is this suitable for Hashimoto's?",
    a: "Absolutely. The system supports both hypothyroidism and Hashimoto's — with practical, anti-inflammatory Indian nutrition.",
  },
  {
    q: 'Will I have to follow a strict diet?',
    a: 'No starvation. Real Indian meals at home — adapted to your culture, schedule, and thyroid needs.',
  },
  {
    q: "I've tried coaching before and it didn't work. How is this different?",
    a: "Generic programs give thyroid clients the same deficits as everyone else. This is built only around hypothyroid fat-loss physiology — the consultation call shows you that difference for your case.",
  },
  {
    q: 'Will you offer me coaching on the call?',
    a: "Yes — if you're a fit. The first 45 minutes are your diagnosis, and that's yours to keep either way. In the last 15, if I believe my 3-month reversal program is what you need, I'll show you exactly what it involves and what it costs for your case. One conversation, no chasing afterwards.",
  },
  {
    q: 'What does the 3-month program cost?',
    a: "It depends on what your case actually needs — how far your thyroid has drifted, and how much support and monitoring that requires. I quote it on the call once I've seen your reports and your answers, never before. The ₹299 you pay for the consultation is adjusted against it if you join.",
  },
  {
    q: 'How much time does coaching take each week?',
    a: 'Around 30–40 minutes of movement, 3–4 days a week, plus a 10-minute weekly check-in. Meals are built from what your kitchen already cooks.',
  },
  {
    q: 'What should I bring to the session?',
    a: "Your most recent thyroid reports if you have them — TSH, T3, T4, and iron if tested. No reports? Come anyway; we'll map what to test.",
  },
]

function AccordionItem({
  faq,
  index,
  isOpen,
  onToggle,
}: {
  faq: { q: string; a: string }
  index: number
  isOpen: boolean
  onToggle: () => void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const panelId = `faq-panel-${index}`
  const btnId = `faq-btn-${index}`

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    if (isOpen) {
      el.style.height = '0px'
      el.style.overflow = 'hidden'
      requestAnimationFrame(() => {
        el.style.transition = 'height 260ms cubic-bezier(0.16,1,0.3,1)'
        el.style.height = el.scrollHeight + 'px'
        el.addEventListener(
          'transitionend',
          () => {
            el.style.height = 'auto'
            el.style.overflow = 'visible'
          },
          { once: true }
        )
      })
    } else {
      el.style.height = el.scrollHeight + 'px'
      el.style.overflow = 'hidden'
      requestAnimationFrame(() => {
        el.style.transition = 'height 220ms cubic-bezier(0.16,1,0.3,1)'
        el.style.height = '0px'
      })
    }
  }, [isOpen])

  return (
    <div
      className="border-b border-[var(--b-soft)] last:border-b-0"
      style={{
        background: isOpen ? 'rgba(168,85,247,0.04)' : 'transparent',
        transition: 'background 200ms ease',
      }}
    >
      <button
        id={btnId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full min-h-[56px] items-center justify-between gap-4 px-4 text-left sm:px-5"
        style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          color: isOpen ? 'var(--t1)' : 'var(--t2)',
          background: 'none',
        }}
      >
        <span className="text-pretty pr-2">{faq.q}</span>
        <span
          aria-hidden="true"
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border"
          style={{
            background: isOpen ? 'var(--p-tint)' : 'var(--s1)',
            borderColor: isOpen ? 'var(--p-border)' : 'var(--b-soft)',
            color: isOpen ? 'var(--p400)' : 'var(--t3)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 240ms var(--ease), background 180ms ease, border-color 180ms ease',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 4l4 4 4-4" />
          </svg>
        </span>
      </button>

      <div ref={bodyRef} id={panelId} role="region" aria-labelledby={btnId} style={{ height: 0, overflow: 'hidden' }}>
        <div className="px-4 pb-4 sm:px-5">
          <p className="max-w-[52ch] text-pretty text-[length:var(--text-sm)] leading-[1.65] text-[var(--t3)]">
            {faq.a}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="section-pad relative bg-[var(--bg-page)] text-white">
      <div className="container-narrow relative z-10">
        <SectionHeader
          label="FAQs"
          title="Common Questions"
          lead="Everything to know before your consultation call."
          titleMaxCh="20ch"
        />

        <div className="glass-card-sm overflow-hidden rounded-[var(--r-xl)] border border-[var(--b-soft)]">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={faq.q}
              faq={faq}
              index={i}
              isOpen={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            />
          ))}
        </div>

        <div className="mt-5 rounded-[var(--r-xl)] border border-[var(--p-border)] bg-[var(--p-subtle)] p-[clamp(1.25rem,4vw,1.75rem)] text-center">
          <p className="mb-1 text-[length:var(--text-base)] font-semibold text-[var(--t1)]">
            Still have questions?
          </p>
          <p className="mb-5 text-[length:var(--text-xs)] text-[var(--t4)]">
            Take the free assessment and get clarity on your thyroid fat-loss path.
          </p>
          <SectionCta
            className="!mt-0"
            buttonClassName="mx-auto w-full"
            style={{ maxWidth: 280 }}
            label="Get My Free Thyroid Score"
            sublabel="60-second quiz · Then decode it live on a private call"
            trust="ACE · INFS Certified · 200+ Clients"
            ariaLabel="Take the free thyroid score assessment"
            location="faq"
          />
        </div>
      </div>
    </section>
  )
}
