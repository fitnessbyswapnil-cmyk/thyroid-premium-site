'use client'

import { useState, useRef, useEffect } from 'react'

import CtaButton from './CtaButton'

const faqs = [
  {
    q: 'I\'m already on thyroid medication. Can I still join?',
    a: 'Yes. This program works alongside your medication. We focus on nutrition, lifestyle, and fat loss — not replacing your doctor.',
  },
  {
    q: 'What happens in the ₹299 strategy session?',
    a: 'We review your thyroid history, struggles, and goals — then map whether premium coaching is the right fit. No pressure, no hard sell.',
  },
  {
    q: 'How fast will I see results?',
    a: 'Most clients notice energy and bloating improvements in Week 1–2. Visible fat and inch loss typically starts Week 3–4.',
  },
  {
    q: 'Is this suitable for Hashimoto\'s?',
    a: 'Absolutely. The system is designed for both hypothyroidism and Hashimoto\'s — with anti-inflammatory nutrition built in.',
  },
  {
    q: 'Will I have to follow a strict diet?',
    a: 'No starvation. Real Indian meals. We adapt your existing food culture — no foreign foods, no extreme calorie cutting.',
  },
]

function AccordionItem({
  faq, index, isOpen, onToggle,
}: {
  faq: { q: string; a: string }
  index: number
  isOpen: boolean
  onToggle: () => void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const panelId = `faq-panel-${index}`
  const btnId   = `faq-btn-${index}`

  /* Smooth height animation — 0 → scrollHeight (260ms open, 220ms close) */
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    if (isOpen) {
      el.style.height = '0px'
      el.style.overflow = 'hidden'
      requestAnimationFrame(() => {
        el.style.transition = 'height 260ms cubic-bezier(0.16,1,0.3,1)'
        el.style.height = el.scrollHeight + 'px'
        el.addEventListener('transitionend', () => {
          el.style.height = 'auto'
          el.style.overflow = 'visible'
        }, { once: true })
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
      style={{
        borderBottom: '1px solid var(--b-soft)',
        background: isOpen ? 'rgba(255,255,255,0.018)' : 'transparent',
        transition: 'background 200ms ease',
      }}
    >
      <button
        id={btnId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 text-left"
        style={{
          minHeight: 56,          /* ≥44px touch target guaranteed */
          padding: '0 1.25rem',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          color: isOpen ? 'var(--t1)' : 'var(--t2)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          transition: 'color 180ms ease',
        }}
      >
        <span>{faq.q}</span>
        {/* Chevron pill — flips 180° on open */}
        <span
          aria-hidden="true"
          className="flex-shrink-0 flex items-center justify-center rounded-full"
          style={{
            width: 26, height: 26,
            background: isOpen ? 'var(--p-tint)' : 'var(--s2)',
            border: `1px solid ${isOpen ? 'var(--p-border)' : 'var(--b-soft)'}`,
            transition: 'transform 240ms cubic-bezier(0.16,1,0.3,1), background 180ms ease, border-color 180ms ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: isOpen ? 'var(--p400)' : 'var(--t3)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 4l4 4 4-4" />
          </svg>
        </span>
      </button>

      {/* Animated answer panel */}
      <div ref={bodyRef} id={panelId} role="region" aria-labelledby={btnId} style={{ height: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0 1.25rem 1rem' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--t3)', lineHeight: 1.65, maxWidth: '52ch' }}>
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
    <section className="section-pad">
      <div className="container-narrow">

        {/* Header */}
        <div className="mb-6 text-center">
          <p className="section-label">FAQs</p>
          <h2 className="section-title mx-auto" style={{ maxWidth: '20ch' }}>
            Common Questions
          </h2>
        </div>

        {/* Accordion */}
        <div style={{ borderRadius: 'var(--r-xl)', border: '1px solid var(--b-soft)', overflow: 'hidden' }}>
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

        {/* Bottom CTA card */}
        <div
          className="mt-5 text-center"
          style={{
            borderRadius: 'var(--r-xl)',
            border: '1px solid var(--p-border)',
            background: 'var(--p-subtle)',
            padding: 'clamp(1.25rem, 4vw, 1.75rem)',
          }}
        >
          <p className="mb-1 font-semibold" style={{ fontSize: 'var(--text-base)', color: 'var(--t1)' }}>
            Still have questions?
          </p>
          <p className="mb-5" style={{ fontSize: 'var(--text-xs)', color: 'var(--t4)' }}>
            Get clarity on your thyroid fat-loss path in a private ₹299 session.
          </p>
          <CtaButton
            variant="secondary"
            style={{ maxWidth: 280 }}
            label="Book Your ₹299 Thyroid Assessment"
            sublabel="See if this program fits you"
            ariaLabel="Book your 299 rupee thyroid assessment"
          />
          <p className="mt-3 micro-trust">ACE · FITR · INFS Certified · 200+ Clients</p>
        </div>

      </div>
    </section>
  )
}