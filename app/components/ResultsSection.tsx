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
    location: 'Mumbai',
    result: '−4.8 kg · 6 weeks',
    struggleTag: '2 yrs, no progress',
    quote:
      "Lost more in 6 weeks than in two years of trying alone. For the first time I understood what was actually stopping me — it wasn't my discipline.",
    img: '/transformations/Vaidehi 1.png',
  },
  {
    id: 'surekha',
    name: 'Surekha P.',
    age: 41,
    location: 'Pune',
    result: '−3.5 kg · 8 weeks',
    struggleTag: 'TSH "normal" for years',
    quote:
      "Finally a plan built for hypothyroid — not just calories. I'd been eating clean for a year and still gaining weight. Now I understand my body.",
    img: '/transformations/Surekha 3.png',
  },
  {
    id: 'nehamia',
    name: 'Nehamia R.',
    age: 38,
    location: 'Bengaluru',
    result: '−5.2 kg · 10 weeks',
    struggleTag: "Doctor said 'you're fine'",
    quote:
      "My doctor noticed the difference before I even told her. She asked what I changed — I told her: everything about how I treat my thyroid.",
    img: '/transformations/Nehamia 6.png',
  },
  {
    id: 'anjali',
    name: 'Anjali M.',
    age: 36,
    location: 'Delhi',
    result: '−4.1 kg · 9 weeks',
    struggleTag: 'Scared to eat carbs',
    quote:
      "No starvation. Real Indian food — dal, rotis, rice. I couldn't believe the scale moved while I was eating everything I love.",
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
      {/* Edge blend from SocialProof */}
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

        {/* Mobile: horizontal carousel — hidden at sm+ */}
        <div className="relative sm:hidden">
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
                style={{ scrollSnapAlign: 'start', width: 'min(80vw, 296px)' }}
              >
                <ResultCard r={r} sizes="80vw" />
              </div>
            ))}
          </div>

          <div className="dot-track mt-4">
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

        {/* Tablet: 2-column grid */}
        <div className="hidden sm:grid sm:grid-cols-2 gap-4 md:hidden">
          {results.map((r) => (
            <ResultCard key={r.id} r={r} sizes="50vw" />
          ))}
        </div>

        {/* Desktop: 2×2 grid */}
        <div className="hidden md:grid md:grid-cols-2 gap-5">
          {results.map((r) => (
            <ResultCard key={r.id} r={r} sizes="50vw" />
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
    <article className="result-card h-full">
      {/* Identity strip — above photo so you meet the person before the result */}
      <div className="px-4 pt-[15px] pb-[13px] flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-none text-[var(--t1)]">
            {r.name}, {r.age}
          </p>
          <p className="mt-[5px] text-[10.5px] text-[var(--t4)]">
            {r.location} · Hypothyroid
          </p>
        </div>
        {/* Struggle tag — the "that was me" hook */}
        <span
          className="shrink-0 mt-px rounded-full text-[9px] font-semibold tracking-[0.05em] uppercase leading-none text-[var(--t4)]"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.052)',
            padding: '4px 8px',
          }}
        >
          {r.struggleTag}
        </span>
      </div>

      {/* Photo — 1:1 on mobile for readable card heights, 3:4 on desktop */}
      <div
        className="relative w-full overflow-hidden result-photo"
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
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(15,16,18,0.55) 0%, rgba(15,16,18,0.06) 42%, transparent 100%)',
          }}
        />
      </div>

      {/* Card body: quote then result — emotional truth before the number */}
      <div className="flex flex-1 flex-col px-4 pt-[14px] pb-4 gap-[10px]">
        <blockquote className="text-[14px] font-normal leading-[1.72] text-[var(--t2)]">
          &ldquo;{r.quote}&rdquo;
        </blockquote>
        <p className="text-[10.5px] tracking-[0.01em] text-[var(--t4)]">
          {r.result}
        </p>
      </div>
    </article>
  )
}
