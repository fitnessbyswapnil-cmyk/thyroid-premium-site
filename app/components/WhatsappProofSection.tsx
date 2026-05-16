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
    image: '/whatsapp-proof/Heenal R4.png',
    result: 'Inches Lost',
    tags: ['Clothes Fit', 'Confidence Up'],
    headline: 'Old Clothes Fit Again.',
    name: 'Priya K.',
  },
  {
    id: 'anjali',
    image: '/whatsapp-proof/Namarata R9.png',
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
        if (posRef.current >= el.scrollWidth / 2) posRef.current = 0
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
    el.addEventListener('touchend', resume, { passive: true })

    return () => {
      cancelAnimationFrame(rafRef.current)
      el.removeEventListener('pointerenter', pause)
      el.removeEventListener('pointerleave', resume)
      el.removeEventListener('touchstart', pause)
      el.removeEventListener('touchend', resume)
    }
  }, [])

  return (
    <section className="section-pad relative bg-[var(--bg-section)] text-white">
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="relative z-10">
        <div className="container-default mb-6 text-center md:mb-7">
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

        <div className="relative overflow-hidden">
          <div
            ref={trackRef}
            data-carousel-track
            className="flex gap-3 overflow-x-auto px-[clamp(1rem,4vw,2rem)]"
          >
            {ITEMS.map((item, idx) => (
              <article
                key={`${item.id}-${idx}`}
                className="glass-card flex-shrink-0 overflow-hidden"
                style={{ width: 'min(240px, 72vw)', borderRadius: 'var(--r-xl)' }}
              >
                <div
                  className="relative overflow-hidden"
                  style={{
                    aspectRatio: '9/13',
                    borderRadius: 'calc(var(--r-xl) - 1px) calc(var(--r-xl) - 1px) 0 0',
                    background: 'var(--s2)',
                  }}
                >
                  <Image
                    src={item.image}
                    alt={`WhatsApp message — ${item.headline}`}
                    fill
                    sizes="min(240px, 72vw)"
                    className="object-cover object-top"
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-0"
                    aria-hidden="true"
                    style={{
                      background:
                        'linear-gradient(to top, rgba(15,16,18,0.78) 0%, transparent 48%)',
                    }}
                  />
                  <div className="absolute bottom-2.5 left-2.5">
                    <span className="premium-chip">
                      <span className="premium-chip-dot" aria-hidden="true" />
                      {item.result}
                    </span>
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {item.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="result-badge">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mb-1 text-sm font-bold leading-snug text-[var(--t1)]">
                    {item.headline}
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--t4)]">
                    {item.name} · Hypothyroid Client
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-20 h-full w-[clamp(1.5rem,4vw,3rem)]"
            style={{
              background: 'linear-gradient(to right, var(--bg-section), transparent)',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 z-20 h-full w-[clamp(1.5rem,4vw,3rem)]"
            style={{
              background: 'linear-gradient(to left, var(--bg-section), transparent)',
            }}
          />
        </div>

        <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--t5)] md:hidden">
          Swipe to see more
        </p>

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
          />
        </div>
      </div>
    </section>
  )
}
