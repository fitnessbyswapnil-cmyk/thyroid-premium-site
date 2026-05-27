'use client'

import Image from 'next/image'
import { useRef, useEffect } from 'react'

import SectionCta from './SectionCta'
import SectionHeader from './SectionHeader'

const testimonials = [
  {
    id: 'heenal',
    image: '/whatsapp-proof/Heenal R4.png',
    result: 'TSH 6.2 → 2.9',
    tags: ['Thyroid Improved', 'Energy Up'],
    headline: 'TSH Dropped. Energy Came Back.',
    name: 'Heenal R.',
  },
  {
    id: 'namarata',
    image: '/whatsapp-proof/Namarata R9.png',
    result: 'TSH 7.8 → 3.1',
    tags: ['No More Fatigue', 'Focus Restored'],
    headline: 'Finally Not Tired All The Time.',
    name: 'Namarata S.',
  },
  {
    id: 'sima',
    image: '/whatsapp-proof/Sima R1.png',
    result: '4 kg Lost',
    tags: ['Belly Fat ↓', '1 Week Results'],
    headline: '4 kg Gone. Despite Thyroid.',
    name: 'Sima P.',
  },
  {
    id: 'priya',
    // TODO: Replace with Priya K.'s own WhatsApp screenshot — upload to /public/whatsapp-proof/Priya K R.png
    image: '/whatsapp-proof/Nahamia R5.png',
    result: 'Inches Lost',
    tags: ['Clothes Fit', 'Confidence Up'],
    headline: 'Old Clothes Fit Again.',
    name: 'Priya K.',
  },
  {
    id: 'anjali',
    // TODO: Replace with Anjali M.'s own WhatsApp screenshot — upload to /public/whatsapp-proof/Anjali M R.png
    image: '/whatsapp-proof/Rozal R2.png',
    result: '6 kg Lost',
    tags: ['No Starvation', 'Real Food'],
    headline: 'Lost 6 kg. Eating Real Indian Food.',
    name: 'Anjali M.',
  },
]

const ITEMS = [...testimonials, ...testimonials]

export default function WhatsappProofSection() {
  const trackRef = useRef<HTMLDivElement>(null)
  const pauseRef = useRef(false)
  const posRef = useRef(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const speed = 0.38

    const tick = () => {
      if (!pauseRef.current) {
        posRef.current += speed
        if (posRef.current >= el.scrollWidth / 2) {
          posRef.current = 0
        }
        el.scrollLeft = posRef.current
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    const pause = () => { pauseRef.current = true }
    const resume = () => { pauseRef.current = false }

    el.addEventListener('pointerenter', pause)
    el.addEventListener('pointerleave', resume)
    el.addEventListener('touchstart', pause, { passive: true })
    el.addEventListener('touchend', resume)

    return () => {
      cancelAnimationFrame(rafRef.current)
      el.removeEventListener('pointerenter', pause)
      el.removeEventListener('pointerleave', resume)
      el.removeEventListener('touchstart', pause)
      el.removeEventListener('touchend', resume)
    }
  }, [])

  return (
    <section className="section-pad relative overflow-hidden bg-[var(--bg-section)] text-white">
      {/* BACKGROUND GLOW */}
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="relative z-10">
        {/* HEADER */}
        <div className="container-default mb-7 text-center">
          <div className="badge-pill mx-auto mb-4 w-fit" role="status">
            <span className="badge-dot shrink-0" aria-hidden="true" />
            Real Client Conversations
          </div>
          <SectionHeader
            className="!mb-0"
            label="WhatsApp Proof"
            title={
              <>
                Real Messages.{' '}
                <span className="text-gradient">Real Thyroid Fat Loss.</span>
              </>
            }
            lead="Indian women sharing real progress — belly fat down, energy back, clothes fitting again."
            titleMaxCh="22ch"
          />
        </div>

        {/* CAROUSEL */}
        <div className="relative overflow-hidden">
          <div
            ref={trackRef}
            data-carousel-track
            className="flex gap-4 overflow-x-auto px-[clamp(1rem,4vw,2rem)] pb-2 scrollbar-hide"
          >
            {ITEMS.map((item, idx) => (
              <article
                key={`${item.id}-${idx}`}
                className="flex-shrink-0 overflow-hidden"
                style={{
                  width: 'min(255px, 74vw)',
                  borderRadius: '28px',
                  background:
                    'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 100%)',
                  boxShadow:
                    '0 0 0 1px rgba(255,255,255,0.07), 0 24px 56px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.09)',
                }}
              >

                {/* ① METRIC CHIP — above image, zero overlap */}
                <div className="px-4 pt-4">
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-[6px]"
                    style={{
                      background: 'rgba(139,92,246,0.14)',
                      border: '1px solid rgba(139,92,246,0.3)',
                    }}
                  >
                    <span
                      className="h-[6px] w-[6px] shrink-0 rounded-full"
                      style={{
                        background: 'var(--p300)',
                        boxShadow: '0 0 6px var(--p300)',
                      }}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[10.5px] font-extrabold tracking-[0.14em] text-[var(--p300)]">
                      {item.result}
                    </span>
                  </div>
                </div>

                {/* ② HEADLINE — above image, full readability */}
                <div className="px-4 pb-3 pt-2.5">
                  <p className="text-[14.5px] font-bold leading-[1.25] text-[var(--t1)]">
                    {item.headline}
                  </p>
                </div>

                {/* ③ SCREENSHOT — full-bleed, object-cover, zero black bars
                    ─────────────────────────────────────────────────────────
                    KEY FIX: `object-cover object-top` fills the frame edge-
                    to-edge. The screenshot is the uneditable social proof —
                    no text overlaid so the chat content is fully legible.
                    Subtle bottom vignette only to blend into the card footer.
                ──────────────────────────────────────────────────────────── */}
                <div
                  className="relative mx-3 overflow-hidden"
                  style={{
                    aspectRatio: '9 / 14',
                    borderRadius: '18px',
                    background: '#07060f',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow:
                      'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  {/* Screen-glass shimmer — pure CSS, no extra image */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-10"
                    style={{
                      background:
                        'linear-gradient(130deg, rgba(255,255,255,0.05) 0%, transparent 38%)',
                    }}
                  />

                  {/* Bottom vignette only — blends into card footer */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16"
                    style={{
                      background:
                        'linear-gradient(to top, rgba(8,6,20,0.82) 0%, transparent 100%)',
                    }}
                  />

                  {/* Actual WhatsApp screenshot
                      object-cover  → fills container, no black bars
                      object-top    → anchors to top of image (key chat
                                      messages are usually near the top)   */}
                  <Image
                    src={item.image}
                    alt={`WhatsApp proof: ${item.headline}`}
                    fill
                    sizes="(max-width: 768px) 74vw, 255px"
                    className="object-cover object-top"
                    draggable={false}
                    loading="lazy"
                  />
                </div>

                {/* ④ TAGS + CLIENT — below image, clean reading zone */}
                <div className="px-4 pb-4 pt-3">

                  {/* Tags */}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {item.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-2.5 py-[5px] text-[10px] font-medium"
                        style={{
                          background: 'rgba(139,92,246,0.10)',
                          border: '1px solid rgba(139,92,246,0.20)',
                          color: 'rgba(196,181,253,0.85)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Client identity */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--p300), #7c3aed)',
                        boxShadow: '0 0 0 1.5px rgba(139,92,246,0.25)',
                      }}
                      aria-hidden="true"
                    >
                      {item.name.charAt(0)}
                    </div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--t4)]">
                      {item.name} · Hypothyroid Client
                    </p>
                  </div>

                </div>
              </article>
            ))}
          </div>

          {/* LEFT EDGE FADE */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-20 h-full w-[clamp(1.5rem,4vw,3rem)]"
            style={{
              background: 'linear-gradient(to right, var(--bg-section), transparent)',
            }}
          />

          {/* RIGHT EDGE FADE */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 z-20 h-full w-[clamp(1.5rem,4vw,3rem)]"
            style={{
              background: 'linear-gradient(to left, var(--bg-section), transparent)',
            }}
          />
        </div>

        {/* MOBILE HINT */}
        <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--t5)] md:hidden">
          Swipe to see more
        </p>

        {/* CTA */}
        <div className="container-default">
          <SectionCta
            variant="ghost"
            className="mx-auto"
            buttonClassName="w-full"
            style={{ maxWidth: '22rem' }}
            label="Apply For Your ₹299 Strategy Session"
            sublabel="See if this coaching program fits you"
            trust="Premium thyroid coaching · Not a diet plan PDF"
            ariaLabel="Apply for your 299 rupee strategy session"
            location="whatsapp_proof"
          />
        </div>
      </div>
    </section>
  )
}