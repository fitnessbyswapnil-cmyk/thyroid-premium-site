'use client'

import Image from 'next/image'
import { useRef, useState, useEffect } from 'react'

import SectionCta from './SectionCta'
import SectionHeader from './SectionHeader'

const results = [
  {
    id: 'vaidehi',
    name: 'Vaidehi S., 34',
    location: 'Mumbai',
    primaryMetric: '−4.8 kg · 6 wks',
    quote: 'Lost more in 6 weeks than in 2 years of trying alone.',
    img: '/transformations/Vaidehi 1.png',
  },
  {
    id: 'surekha',
    name: 'Surekha P., 41',
    location: 'Pune',
    primaryMetric: '−3.5 kg · 8 wks',
    quote: 'Finally a plan built for thyroid — not just calories.',
    img: '/transformations/Surekha 3.png',
  },
  {
    id: 'nehamia',
    name: 'Nehamia R., 38',
    location: 'Bengaluru',
    primaryMetric: '−5.2 kg · 10 wks',
    quote: 'My doctor noticed the difference before I even told her.',
    img: '/transformations/Nehamia 6.png',
  },
  {
    id: 'anjali',
    name: 'Anjali M., 36',
    location: 'Delhi',
    primaryMetric: '−4.1 kg · 9 wks',
    quote: 'No starvation. Real food. Real results.',
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
      {/* Section edge blend from SocialProof */}
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
          label="Real Transformations"
          title={
            <>
              What happens when{' '}
              <span className="text-gradient">someone finally treats the thyroid.</span>
            </>
          }
          lead="Indian women. Hypothyroid. Real Indian food. No generic plans."
          titleMaxCh="24ch"
        />

        {/* Mobile: horizontal carousel — hidden at sm+ */}
        <div className="relative sm:hidden">
          <div
            ref={trackRef}
            data-carousel-track
            className="flex gap-4 overflow-x-auto pb-1 -mx-[clamp(1rem,4vw,2rem)] px-[clamp(1rem,4vw,2rem)]"
            style={{ scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain' }}
          >
            {results.map((r) => (
              <div
                key={r.id}
                className="flex-shrink-0"
                style={{ scrollSnapAlign: 'start', width: 'min(84vw, 300px)' }}
              >
                <ResultCard r={r} sizes="84vw" />
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

        {/* Narrative bridge — transformation → invitation */}
        <p className="mt-10 text-center text-[13px] leading-[1.65] text-[var(--t3)] mx-auto max-w-[32ch]">
          Each of these women began with one conversation.
        </p>

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
  r: (typeof results)[number]
  sizes: string
}) {
  return (
    <article className="result-card h-full">
      {/* Image — clean, no badge overlay */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '3/4', background: 'var(--s2)' }}
      >
        <Image
          src={r.img}
          alt={`${r.name} thyroid transformation`}
          fill
          sizes={sizes}
          className="object-cover object-center"
          loading="lazy"
        />
        {/* Subtle depth gradient — not text overlay */}
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(to top, rgba(15,16,18,0.52) 0%, rgba(15,16,18,0.06) 38%, transparent 100%)',
          }}
        />
      </div>

      {/* Card body: quote → attribution → metric */}
      <div className="flex flex-1 flex-col px-4 pt-[14px] pb-4">
        <blockquote className="text-[15px] font-normal leading-[1.76] text-[var(--t2)]">
          &ldquo;{r.quote}&rdquo;
        </blockquote>

        <div className="mt-[14px] flex items-start justify-between gap-2">
          <div className="leading-none">
            <p className="text-[13px] font-semibold text-[var(--t1)]">{r.name}</p>
            <p className="mt-[5px] text-[10.5px] text-[var(--t4)]">
              {r.location} · Hypothyroid
            </p>
          </div>
          <span
            className="mt-[1px] shrink-0 rounded-full text-[10.5px] font-semibold leading-none text-[var(--p400)]"
            style={{
              background: 'rgba(168,85,247,0.055)',
              border: '1px solid rgba(168,85,247,0.11)',
              padding: '4px 10px',
            }}
          >
            {r.primaryMetric}
          </span>
        </div>
      </div>
    </article>
  )
}
