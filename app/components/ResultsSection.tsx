'use client'

import Image from 'next/image'
import { useRef, useState, useEffect } from 'react'

import SectionCta from './SectionCta'
import SectionHeader from './SectionHeader'

const results = [
  {
    id: 'vaidehi',
    name: 'Vaidehi S.',
    age: 34,
    headline: 'Lost 4.8 kg in 6 Weeks',
    quote:
      "Lost more in 6 weeks than in two years of trying alone. It wasn't my discipline — it was my untreated thyroid holding me back.",
    method: 'THYROID L.E.A.N. Method',
    img: '/transformations/Vaidehi 1.png',
  },
  {
    id: 'surekha',
    name: 'Surekha P.',
    age: 41,
    headline: 'Lost 3.5 kg in 8 Weeks',
    quote:
      "Finally a plan built for hypothyroid — not just calories. I'd been eating clean for a year and still gaining. Now I finally understand my body.",
    method: 'THYROID L.E.A.N. Method',
    img: '/transformations/Surekha 3.png',
  },
  {
    id: 'nehamia',
    name: 'Nehamia R.',
    age: 38,
    headline: 'Lost 5.2 kg in 10 Weeks',
    quote:
      "My doctor noticed the difference before I even told her. She asked what I changed — I said: everything about how I treat my thyroid.",
    method: 'THYROID L.E.A.N. Method',
    img: '/transformations/Rozal 2.png',
  },
  {
    id: 'anjali',
    name: 'Anjali M.',
    age: 36,
    headline: 'Lost 4.1 kg in 9 Weeks',
    quote:
      "No starvation. Real Indian food — dal, rotis, rice. I couldn't believe the scale moved while I was eating everything I love.",
    method: 'THYROID L.E.A.N. Method',
    img: '/transformations/Heenal 7.png',
  },
] as const

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
      {/* Edge blend from previous section */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-16"
        style={{ background: 'linear-gradient(to bottom, var(--bg-page), transparent)' }}
      />

      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        <SectionHeader
          label="Transformations"
          title={
            <>
              They thought it was{' '}
              <span className="text-gradient">their willpower.</span>
            </>
          }
          lead="Indian women. Hypothyroidism. Years of trying. Finally — treated at the root."
          titleMaxCh="24ch"
        />

        {/* ── Mobile: horizontal snap carousel (< 640 px) ───────── */}
        <div className="relative sm:hidden">
          <div
            ref={trackRef}
            data-carousel-track
            className="flex gap-4 overflow-x-auto pb-2 -mx-[clamp(1rem,4vw,2rem)] px-[clamp(1rem,4vw,2rem)]"
            style={{ scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain' }}
          >
            {results.map((r) => (
              <div
                key={r.id}
                className="flex-shrink-0"
                style={{ scrollSnapAlign: 'start', width: 'min(82vw, 300px)' }}
              >
                <ResultCard r={r} sizes="82vw" />
              </div>
            ))}
          </div>

          <div className="dot-track mt-5">
            {results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                aria-label={`View transformation ${i + 1}`}
                aria-current={activeIdx === i}
                onClick={() => scrollTo(i)}
                className="dot"
                style={{ width: activeIdx === i ? 20 : 8 }}
              />
            ))}
          </div>
        </div>

        {/* ── Tablet: 2-column grid (640 px – 1023 px) ──────────── */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:hidden gap-5">
          {results.map((r) => (
            <ResultCard key={r.id} r={r} sizes="(max-width:1023px) 50vw, 25vw" />
          ))}
        </div>

        {/* ── Desktop: 4-column grid (1024 px +) ───────────────── */}
        <div className="hidden lg:grid lg:grid-cols-4 gap-5">
          {results.map((r) => (
            <ResultCard key={r.id} r={r} sizes="25vw" />
          ))}
        </div>

        {/* Narrative bridge */}
        <div className="mt-10 sm:mt-12 text-center">
          <div
            aria-hidden="true"
            className="mx-auto mb-5 h-px max-w-[4rem]"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          />
          <p className="mx-auto max-w-[36ch] text-[14px] leading-[1.7] text-[var(--t3)]">
            Every transformation above started the same way:{' '}
            <span className="text-[var(--t2)]">
              one honest conversation about the thyroid.
            </span>
          </p>
        </div>

        <SectionCta
          label="Start Your Thyroid Transformation"
          sublabel="Begin with a ₹299 private strategy session"
          trust="Premium coaching · Qualified applicants only"
          buttonClassName="w-full"
          style={{ maxWidth: '22rem' }}
          ariaLabel="Start your thyroid transformation"
          location="results"
        />
      </div>
    </section>
  )
}

function ResultCard({
  r,
  sizes,
}: {
  r: (typeof results)[number]
  sizes: string
}) {
  return (
    <article className="result-card">
      {/* ── Image ── */}
      <div
        className="result-photo relative w-full flex-shrink-0"
        style={{ background: 'var(--s2)' }}
      >
        <Image
          src={r.img}
          alt={`${r.name} thyroid transformation`}
          fill
          sizes={sizes}
          className="object-cover object-top"
          loading="lazy"
        />

        {/* Bottom scrim so badges and name are always readable */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(14,15,18,0.72) 0%, rgba(14,15,18,0.12) 38%, transparent 62%)',
          }}
        />

        {/* Before / After badges — bottom corners */}
        <div
          aria-hidden="true"
          className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none"
        >
          <span className="result-before-badge">Before</span>
          <span className="result-after-badge">
            <span className="result-after-dot" />
            After
          </span>
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-col flex-1 px-4 pt-[14px] pb-4">
        {/* Name + age */}
        <p className="text-[13px] font-semibold leading-none text-[var(--t1)] mb-[6px]">
          {r.name}, {r.age}
        </p>

        {/* Result headline */}
        <p className="result-headline mb-[10px]">{r.headline}</p>

        {/* Quote — grows to equalise card heights */}
        <blockquote className="flex-1 text-[12.5px] leading-[1.74] text-[var(--t3)]">
          &ldquo;{r.quote}&rdquo;
        </blockquote>

        {/* Method line — always at card bottom */}
        <p
          className="mt-[14px] text-[9.5px] font-bold tracking-[0.1em] uppercase"
          style={{ color: 'var(--p400)' }}
        >
          via {r.method}
        </p>
      </div>
    </article>
  )
}
