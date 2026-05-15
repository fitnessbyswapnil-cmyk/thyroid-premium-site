'use client'

const CTA_URL = 'https://swapnilumbarkarfitness.in/case-studies/cta'

const includes = [
  'Personalized thyroid fat-loss protocol',
  'Indian nutrition plan for your metabolism',
  'Weekly tracking — weight, inches & energy',
  'Direct WhatsApp accountability support',
  'Symptom & confidence recovery roadmap',
]

const certs = ['ACE Certified', 'FITR Certified', 'INFS Certified']

const objections = ['No credit card', 'Completely free', 'No commitment']

export default function FinalCTASection() {
  return (
    <section className="section-pad" style={{ background: 'var(--bg-section)' }}>
      {/* Strongest glow — conversion climax signal */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height: 360 }}>
        <div className="glow-hero" />
      </div>

      <div className="container-narrow relative z-10 text-center">

        {/* 1. Urgency badge */}
        <div className="badge-pill mx-auto mb-5 w-fit" role="status" aria-live="polite">
          <span className="badge-dot" aria-hidden="true" />
          Only 5 Spots Left This Month
        </div>

        {/* 2. Headline — max-w 18ch prevents mid-word wraps on 360px */}
        <p className="section-label mb-2">Start Today</p>
        <h2 className="section-title mx-auto mb-3" style={{ maxWidth: '18ch' }}>
          Your Thyroid Transformation{' '}
          <span className="text-gradient">Starts Here.</span>
        </h2>
        <p className="mx-auto mb-6" style={{ fontSize: 'var(--text-sm)', color: 'var(--t3)', maxWidth: '32ch', lineHeight: 1.6 }}>
          Book a free 60-min strategy call.{' '}
          <strong style={{ color: 'var(--t2)', fontWeight: 600 }}>
            No pressure. No upsells. Just clarity.
          </strong>
        </p>

        {/* 3. Coach authority card */}
        <div className="glass-card mb-5 overflow-hidden text-left" style={{ padding: 'clamp(1rem, 4vw, 1.25rem)' }}>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:text-left">
            {/* Avatar — clamp prevents it consuming vertical space on mobile */}
            <div
              className="relative flex-shrink-0 overflow-hidden rounded-full"
              style={{
                width:  'clamp(3rem, 8vw, 3.5rem)',
                height: 'clamp(3rem, 8vw, 3.5rem)',
                border: '2px solid rgba(168,85,247,0.35)',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(147,51,234,0.15))',
              }}
            >
              {/* Replace with <Image src="/coach.jpg" fill className="object-cover" alt="Swapnil Umbarkar" /> */}
              <div
                className="flex h-full w-full items-center justify-center font-black"
                style={{ fontSize: 'var(--text-base)', color: 'var(--p300)' }}
              >
                SU
              </div>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wider" style={{ fontSize: 'var(--text-xs)', color: 'var(--p400)', marginBottom: 2 }}>
                India's Leading Thyroid Fat-Loss Coach
              </p>
              <p className="font-bold" style={{ fontSize: 'var(--text-base)', color: 'var(--t1)', marginBottom: '0.5rem' }}>
                Swapnil Umbarkar
              </p>
              <div className="chip-list sm:justify-start">
                {certs.map((c) => <span key={c} className="chip">{c}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* 4. What's included */}
        <div
          className="mb-5 text-left"
          style={{
            borderRadius: 'var(--r-xl)',
            border: '1px solid var(--p-border)',
            background: 'var(--p-subtle)',
            padding: 'clamp(0.875rem, 4vw, 1.125rem)',
          }}
        >
          <p className="mb-3 font-semibold uppercase tracking-wider" style={{ fontSize: 'var(--text-xs)', color: 'var(--p400)' }}>
            Your Free Call Includes
          </p>
          <ul className="space-y-2">
            {includes.map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="shrink-0 font-bold leading-none" style={{ color: 'var(--p500)', fontSize: 'var(--text-sm)' }}>✓</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--t2)', lineHeight: 1.5 }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 5. Primary CTA */}
        <div className="cta-wrap mx-auto mb-5">
          <button
            id="cta-final"
            type="button"
            aria-label="Book your free thyroid fat-loss strategy call"
            className="cta-button"
            onClick={() => window.location.assign(CTA_URL)}
          >
            Book FREE Strategy Call
            <span className="cta-sub">60 Min Free · Limited Spots This Month</span>
          </button>
        </div>

        {/* 6. Objection handler */}
        <div className="flex items-center justify-center gap-2.5 mb-5 flex-wrap">
          {objections.map((obj, i) => (
            <span key={obj} className="flex items-center gap-1.5">
              {i > 0 && <span className="h-3 w-px" style={{ background: 'var(--b-soft)' }} aria-hidden="true" />}
              <span
                style={{
                  fontSize: 'clamp(9px, 1.8vw, 10px)',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--t4)',
                }}
              >
                {obj}
              </span>
            </span>
          ))}
        </div>

        {/* 7. Micro-trust */}
        <p className="micro-trust">200 thyroid women transformed across India</p>

      </div>
    </section>
  )
}