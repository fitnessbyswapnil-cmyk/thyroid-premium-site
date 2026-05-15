'use client'

import Image from 'next/image'
import { useRef, useEffect } from 'react'

const CTA_URL = 'https://swapnilumbarkarfitness.in/case-studies/cta'

const testimonials = [
  {
    image: '/whatsapp-proof/Heenal R4.png',
    result: 'TSH 6.2 → 2.9',
    tags: ['Thyroid Improved', 'Energy Up'],
    headline: 'TSH Dropped. Energy Came Back.',
    name: 'Heenal R.',
  },
  {
    image: '/whatsapp-proof/Namarata R9.png',
    result: 'TSH 7.8 → 3.1',
    tags: ['No More Fatigue', 'Focus Restored'],
    headline: 'Finally Not Tired All The Time.',
    name: 'Namarata S.',
  },
  {
    image: '/whatsapp-proof/Sima R1.png',
    result: '4 kg Lost',
    tags: ['Belly Fat ↓', '1 Week Results'],
    headline: '4 kg Gone. Despite Thyroid.',
    name: 'Sima P.',
  },
  {
    image: '/whatsapp-proof/Heenal R4.png',
    result: 'Inches Lost',
    tags: ['Clothes Fit', 'Confidence Up'],
    headline: 'Old Clothes Fit Again.',
    name: 'Priya K.',
  },
  {
    image: '/whatsapp-proof/Namarata R9.png',
    result: '6 kg Lost',
    tags: ['No Starvation', 'Real Food'],
    headline: 'Lost 6 kg. Eating Real Indian Food.',
    name: 'Anjali M.',
  },
]

const ITEMS = [...testimonials, ...testimonials]

export default function WhatsappProofSection() {
  const trackRef  = useRef<HTMLDivElement>(null)
  const pauseRef  = useRef(false)
  const posRef    = useRef(0)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const speed = 0.42

    const tick = () => {
      if (!pauseRef.current && el) {
        posRef.current += speed
        if (posRef.current >= el.scrollWidth / 2) posRef.current = 0
        el.scrollLeft = posRef.current
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    const pause  = () => { pauseRef.current = true }
    const resume = () => { pauseRef.current = false }

    el.addEventListener('pointerenter', pause)
    el.addEventListener('pointerleave', resume)
    el.addEventListener('touchstart',   pause,  { passive: true })
    el.addEventListener('touchend',     resume, { passive: true })

    return () => {
      cancelAnimationFrame(rafRef.current)
      el.removeEventListener('pointerenter', pause)
      el.removeEventListener('pointerleave', resume)
      el.removeEventListener('touchstart',   pause)
      el.removeEventListener('touchend',     resume)
    }
  }, [])

  return (
    <section className="section-pad" style={{ background: 'var(--bg-section)' }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height: 220 }}>
        <div className="glow-section" />
      </div>

      <div className="relative z-10">

        {/* Header */}
        <div className="container-default mb-7 text-center">
          <div className="badge-pill mx-auto mb-3 w-fit" role="status">
            <span className="badge-dot" aria-hidden="true" />
            Real Client Conversations
          </div>
          <p className="section-label">WhatsApp Proof</p>
          <h2 className="section-title mx-auto" style={{ maxWidth: '22ch' }}>
            Real Messages. <span className="text-gradient">Real Thyroid Fat Loss.</span>
          </h2>
          <p className="mx-auto mt-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--t4)', maxWidth: '36ch', lineHeight: 1.6 }}>
            Indian women sharing real progress — belly fat gone, energy back, clothes fitting again.
          </p>
        </div>

        {/* Slider */}
        <div className="relative overflow-hidden">
          <div
            ref={trackRef}
            data-carousel-track
            className="flex gap-3"
            style={{
              overflowX: 'scroll',
              scrollBehavior: 'auto',
              paddingInline: '1.25rem',
              cursor: 'grab',
            }}
          >
            {ITEMS.map((item, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 glass-card overflow-hidden"
                style={{ width: 'min(240px, 70vw)', borderRadius: 'var(--r-xl)' }}
              >
                {/* Screenshot — 9:13 ratio shows full WhatsApp message content */}
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
                    sizes="min(240px, 70vw)"
                    className="object-cover object-top"
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-0"
                    aria-hidden="true"
                    style={{ background: 'linear-gradient(to top, rgba(13,13,15,0.75) 0%, transparent 45%)' }}
                  />
                  {/* Result chip — inside image, compact */}
                  <div className="absolute bottom-2.5 left-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full backdrop-blur-sm"
                      style={{
                        border: '1px solid var(--p-border)',
                        background: 'rgba(13,13,15,0.72)',
                        padding: '0.14rem 0.5rem',
                      }}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--p400)' }} aria-hidden="true" />
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--p300)', lineHeight: 1.5 }}>
                        {item.result}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: '0.75rem 0.875rem 0.875rem' }}>
                  {/* Max 2 tags — was 3, caused wrapping in narrow cards */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {item.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="result-badge">{tag}</span>
                    ))}
                  </div>
                  <p className="mb-1 font-bold leading-snug" style={{ fontSize: 'var(--text-sm)', color: 'var(--t1)' }}>
                    {item.headline}
                  </p>
                  <p style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t4)' }}>
                    {item.name} · Hypothyroid Client
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Edge fades — clamp so 360px sees more content */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 h-full z-20"
            style={{ width: 'clamp(2.5rem, 5vw, 5rem)', background: 'linear-gradient(to right, var(--bg-section), transparent)' }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 h-full z-20"
            style={{ width: 'clamp(2.5rem, 5vw, 5rem)', background: 'linear-gradient(to left, var(--bg-section), transparent)' }}
          />
        </div>

        {/* Swipe hint */}
        <p className="mt-3 text-center md:hidden" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--t5)' }}>
          swipe to see more
        </p>

        {/* CTA */}
        <div className="container-default mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.assign(CTA_URL)}
            className="btn-ghost w-full"
            style={{ maxWidth: '22rem' }}
            aria-label="Book a free thyroid fat-loss consultation call"
          >
            Book Your Free Call
          </button>
          <p className="micro-trust">See how this system can work for your thyroid</p>
        </div>

      </div>
    </section>
  )
}