'use client'

import Image from 'next/image'
import { useRef, useState, useEffect } from 'react'

import SectionCta from './SectionCta'
import SectionHeader from './SectionHeader'

const results = [
  {
    id: 'vaidehi',
    name: 'Vaidehi S., 34',
    badges: ['4.8 kg Lost', '2″ Waist ↓', 'Energy Restored'],
    quote: 'Lost more in 6 weeks than in 2 years of trying alone.',
    img: '/transformations/Vaidehi 1.png',
  },
  {
    id: 'surekha',
    name: 'Surekha P., 41',
    badges: ['3.5 kg Lost', 'Belly Fat ↓', 'Confidence Back'],
    quote: 'Finally a plan built for thyroid — not just calories.',
    img: '/transformations/Surekha 3.png',
  },
  {
    id: 'nehamia',
    name: 'Nehamia R., 38',
    badges: ['5.2 kg Lost', '3″ Loss', 'Brain Fog Gone'],
    quote: 'My doctor noticed the difference before I even told her.',
    img: '/transformations/Nehamia 6.png',
  },
  {
    id: 'anjali',
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
    <section className="section-pad relative bg-[var(--bg-section)] text-white">
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        <SectionHeader
          label="Real Transformations"
          title={
            <>
              <span className="text-gradient">Visible Fat Loss.</span> Real
              Women.
            </>
          }
          lead="Not models. Not filters. Real hypothyroid women from Mumbai, Delhi, Bangalore — and across India."
          titleMaxCh="22ch"
        />

        <div className="relative md:hidden">
          <div
            ref={trackRef}
            data-carousel-track
            className="flex gap-3 overflow-x-auto pb-1 -mx-[clamp(1rem,4vw,2rem)] px-[clamp(1rem,4vw,2rem)]"
            style={{ scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain' }}
          >
            {results.map((r) => (
              <div
                key={r.id}
                className="flex-shrink-0"
                style={{ scrollSnapAlign: 'start', width: 'min(82vw, 280px)' }}
              >
                <ResultCard r={r} sizes="82vw" />
              </div>
            ))}
          </div>

          <div className="dot-track mt-4">
            {results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                aria-label={`Go to transformation ${i + 1}`}
                aria-current={activeIdx === i}
                onClick={() => scrollTo(i)}
                className="dot"
                style={{ width: activeIdx === i ? 20 : 8 }}
              />
            ))}
          </div>
        </div>

        <div className="hidden gap-4 md:grid md:grid-cols-4">
          {results.map((r) => (
            <ResultCard key={r.id} r={r} sizes="25vw" />
          ))}
        </div>

        <div className="hidden sm:grid sm:grid-cols-2 gap-3 md:hidden">
          {results.map((r) => (
            <ResultCard key={r.id} r={r} sizes="50vw" />
          ))}
        </div>

        <SectionCta
          label="Start Your Thyroid Transformation"
          sublabel="Begin with a ₹299 private strategy session"
          trust="Premium coaching · Qualified applicants only"
          buttonClassName="w-full"
          style={{ maxWidth: '22rem' }}
          ariaLabel="Start your thyroid transformation"
        />
      </div>
    </section>
  )
}

function ResultCard({
  r,
  sizes,
}: {
  r: (typeof results)[0]
  sizes: string
}) {
  return (
    <article className="result-card h-full">
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '4/5', background: 'var(--s2)' }}
      >
        <Image
          src={r.img}
          alt={`${r.name} thyroid fat loss transformation`}
          fill
          sizes={sizes}
          className="object-cover object-top"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(to top, rgba(15,16,18,0.85) 0%, rgba(15,16,18,0.15) 48%, transparent 100%)',
          }}
        />
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-wrap gap-1">
          {r.badges.slice(0, 2).map((b) => (
            <span key={b} className="result-badge">
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3.5 py-3">
        <p className="text-[length:var(--text-sm)] font-semibold leading-snug text-[var(--t1)]">
          &ldquo;{r.quote}&rdquo;
        </p>
        <p className="mt-2 text-[length:var(--text-xs)] font-medium text-[var(--t4)]">
          {r.name}
        </p>
      </div>

      <div className="result-badges hidden sm:flex">
        {r.badges.slice(0, 3).map((b) => (
          <span key={b} className="result-badge">
            {b}
          </span>
        ))}
      </div>
    </article>
  )
}
