'use client'

import Image from 'next/image'
import { useRef, useState, useEffect } from 'react'

import CtaButton from './CtaButton'

const results = [
  {
    name: 'Vaidehi S., 34',
    badges: ['4.8 kg Lost', '2″ Waist ↓', 'Energy Restored'],
    quote: 'Lost more in 6 weeks than in 2 years of trying alone.',
    img: '/transformations/Vaidehi 1.png',
  },
  {
    name: 'Surekha P., 41',
    badges: ['3.5 kg Lost', 'Belly Fat ↓', 'Confidence Back'],
    quote: 'Finally a plan built for thyroid — not just calories.',
    img: '/transformations/Surekha 3.png',
  },
  {
    name: 'Nehamia R., 38',
    badges: ['5.2 kg Lost', '3″ Loss', 'Brain Fog Gone'],
    quote: 'My doctor noticed the difference before I even told her.',
    img: '/transformations/Nehamia 6.png',
  },
  {
    name: 'Anjali M., 36',
    badges: ['4.1 kg Lost', 'Bloating Gone', 'Cravings Reduced'],
    quote: 'No starvation. Real food. Real results.',
    img: '/transformations/Nehamia 6.png',
  },
]

export default function ResultsSection() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const handler = () => {
      const cardW = el.scrollWidth / results.length
      setActiveIdx(Math.round(el.scrollLeft / cardW))
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [])

  const scrollTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    const cardW = el.scrollWidth / results.length
    el.scrollTo({ left: cardW * i, behavior: 'smooth' })
    setActiveIdx(i)
  }

  return (
    <section className="section-pad" style={{ background: 'var(--bg-section)' }}>
      {/* Subtle glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height: 240 }}>
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">

        {/* Header */}
        <div className="mb-7 text-center">
          <p className="section-label">Real Transformations</p>
          <h2 className="section-title mx-auto" style={{ maxWidth: '22ch' }}>
            <span className="text-gradient">Visible Fat Loss.</span> Real Women.
          </h2>
          <p className="mx-auto mt-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--t4)', maxWidth: '36ch' }}>
            Not models. Not filters. Real hypothyroid women from India.
          </p>
        </div>

        {/* MOBILE: native snap-scroll carousel */}
        <div className="md:hidden relative">
          <div
            ref={trackRef}
            data-carousel-track
            className="flex gap-3 overflow-x-scroll pb-1"
            style={{
              scrollSnapType: 'x mandatory',
              overscrollBehaviorX: 'contain',
              WebkitOverflowScrolling: 'touch',
              paddingInline: 'clamp(1rem, 4vw, 1.5rem)',
            }}
          >
            {results.map((r) => (
              <div
                key={r.name}
                className="flex-shrink-0"
                style={{ scrollSnapAlign: 'start', width: '82vw', maxWidth: 280 }}
              >
                <MobileCard r={r} />
              </div>
            ))}
          </div>

          {/* Dot indicators */}
          <div className="dot-track mt-4">
            {results.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to card ${i + 1}`}
                onClick={() => scrollTo(i)}
                className="dot"
                style={{ width: activeIdx === i ? 20 : 8 }}
              />
            ))}
          </div>
        </div>

        {/* DESKTOP: 4-col grid */}
        <div className="hidden md:grid md:grid-cols-4 gap-4">
          {results.map((r) => <DesktopCard key={r.name} r={r} />)}
        </div>
        {/* TABLET: 2-col grid */}
        <div className="hidden sm:grid sm:grid-cols-2 gap-3 md:hidden">
          {results.map((r) => <DesktopCard key={r.name} r={r} />)}
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <CtaButton
            variant="secondary"
            className="w-full"
            style={{ maxWidth: '22rem' }}
            label="Start Your Thyroid Transformation"
            sublabel="Begin with a ₹299 private strategy session"
            ariaLabel="Start your thyroid transformation"
          />
          <p className="micro-trust">Premium coaching · Qualified applicants only</p>
        </div>

      </div>
    </section>
  )
}

function MobileCard({ r }: { r: (typeof results)[0] }) {
  return (
    <div className="result-card" style={{ borderRadius: 'var(--r-xl)' }}>
      {/* 4:5 ratio — shows face, not zoomed crop */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4/5', background: 'var(--s2)' }}>
        <Image
          src={r.img}
          alt={`${r.name} thyroid fat loss transformation`}
          fill sizes="82vw"
          className="object-cover object-top"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(13,13,15,0.82) 0%, rgba(13,13,15,0.12) 50%, transparent 100%)' }}
          aria-hidden="true"
        />
        {/* Badges inside image — no external stack fighting */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5">
          <div className="flex flex-wrap gap-1">
            {r.badges.slice(0, 2).map((b) => (
              <span
                key={b}
                style={{
                  fontSize: 'var(--text-xs)',
                  background: 'rgba(13,13,15,0.75)',
                  border: '1px solid var(--p-border)',
                  borderRadius: 'var(--r-full)',
                  padding: '0.16rem 0.5rem',
                  color: 'var(--p400)',
                  fontWeight: 600,
                  backdropFilter: 'blur(4px)',
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quote + name */}
      <div className="px-3 pt-3 pb-2.5">
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--t1)', lineHeight: 1.45 }}>
          &ldquo;{r.quote}&rdquo;
        </p>
        <p className="mt-1.5" style={{ fontSize: 'var(--text-xs)', color: 'var(--t4)', fontWeight: 500 }}>
          {r.name}
        </p>
      </div>
    </div>
  )
}

function DesktopCard({ r }: { r: (typeof results)[0] }) {
  return (
    <div className="result-card">
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4/5', background: 'var(--s2)' }}>
        <Image
          src={r.img}
          alt={`${r.name} thyroid fat loss transformation`}
          fill sizes="(max-width:640px) 50vw, 25vw"
          className="object-cover object-top"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(13,13,15,0.78) 0%, transparent 55%)' }}
          aria-hidden="true"
        />
      </div>
      <div className="px-3 pt-3 pb-1.5">
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--t1)', lineHeight: 1.5 }}>
          &ldquo;{r.quote}&rdquo;
        </p>
        <p className="mt-1.5" style={{ fontSize: 'var(--text-xs)', color: 'var(--t4)', fontWeight: 500 }}>
          {r.name}
        </p>
      </div>
      <div className="result-badges">
        {r.badges.slice(0, 3).map((b) => (
          <span key={b} className="result-badge">{b}</span>
        ))}
      </div>
    </div>
  )
}