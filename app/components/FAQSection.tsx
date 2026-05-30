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
    q: 'What happens in the ₹299 strategy session?',
    a: "Swapnil reviews your intake personally before the call — your thyroid history, symptoms, and what you've already tried. In 60 minutes, you'll understand exactly why fat isn't moving, what your thyroid specifically needs, and what your next 3 steps are. A written summary arrives within 24 hours. Whether or not you continue to coaching, this session stands completely on its own.",
  },
  {
    q: 'Is the ₹299 fully refundable?',
    a: "Yes. If you complete the 60-minute session and don't leave with at least one specific, actionable step forward for your thyroid — you get every rupee back. No forms, no waiting, no questions. In 3 years and 200+ sessions, we've never had a refund request.",
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
    a: "Most coaching programs treat thyroid clients exactly like everyone else — same calorie deficits, same exercise plans. This coaching is built specifically around hypothyroid fat-loss physiology. The approach is different because the problem is different. The ₹299 session exists precisely to show you what that difference looks like for your specific case — before you commit to anything further.",
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
          lead="Everything you want to know before applying for your private ₹299 session."
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
            Get clarity on your thyroid fat-loss path in a private ₹299 session.
          </p>
          <SectionCta
            className="!mt-0"
            buttonClassName="mx-auto w-full"
            style={{ maxWidth: 280 }}
            label="Book My ₹299 Thyroid Session"
            sublabel="60-min private 1-on-1 · Full refund if you don't get clarity"
            trust="ACE · FITR · INFS Certified · 200+ Clients"
            ariaLabel="Book your 299 rupee thyroid assessment"
            location="faq"
          />
        </div>
      </div>
    </section>
  )
}
