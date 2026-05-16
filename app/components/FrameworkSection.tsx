'use client'

import CtaButton from './CtaButton'

const steps = [
  { letter: 'L', label: 'Lab Analysis',      desc: 'Find what\'s actually blocking your fat loss.' },
  { letter: 'E', label: 'Energy First',       desc: 'Restore energy before fat loss begins.' },
  { letter: 'A', label: 'Adaptive Nutrition', desc: 'Real Indian meals. No starvation.' },
  { letter: 'N', label: 'Navigate & Track',   desc: 'Weekly tweaks based on your real data.' },
]

const timeline = [
  { weeks: 'Weeks 1–3',  result: 'Energy up. Bloating down. Cravings stabilize.' },
  { weeks: 'Weeks 4–8',  result: 'Visible inch loss. Fat loss accelerates.' },
  { weeks: 'Weeks 9–12', result: 'Confident body. Sustainable habits locked in.' },
]

export default function FrameworkSection() {
  return (
    <section className="section-pad">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height: 220 }}>
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">

        {/* Header */}
        <div className="mb-6 text-center">
          <p className="section-label">The Method</p>
          <h2 className="section-title mx-auto" style={{ maxWidth: '24ch' }}>
            The Thyroid <span className="text-gradient">L.E.A.N. Method</span>
          </h2>
          <p className="mx-auto mt-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--t4)', maxWidth: '36ch', lineHeight: 1.6 }}>
            Built specifically for hypothyroid women.{' '}
            <span style={{ color: 'var(--t3)', fontWeight: 500 }}>
              The exact 4-step system that works when everything else has failed.
            </span>
          </p>
        </div>

        {/* L.E.A.N. Cards — 2-col mobile, 4-col desktop */}
        <div
          className="grid grid-cols-2 md:grid-cols-4"
          style={{ gap: 'clamp(0.5rem, 2vw, 1rem)' }}
        >
          {steps.map((s) => (
            <div
              key={s.letter}
              className="glass-card-sm text-center"
              style={{ padding: 'clamp(0.75rem, 3vw, 1.25rem)' }}
            >
              {/* Letter badge — clamp so it never dominates on mobile */}
              <div
                className="mx-auto mb-2.5 flex items-center justify-center rounded-full font-black"
                style={{
                  width:    'clamp(2.125rem, 5vw, 2.5rem)',
                  height:   'clamp(2.125rem, 5vw, 2.5rem)',
                  fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                  background: 'var(--p-tint)',
                  color: 'var(--p400)',
                  border: '1px solid var(--p-border)',
                }}
              >
                {s.letter}
              </div>
              <p className="mb-1 font-semibold leading-snug" style={{ fontSize: 'var(--text-xs)', color: 'var(--t1)' }}>
                {s.label}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--t4)', lineHeight: 1.55 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Timeline — vertical on mobile (fixes cramped text wrapping), horizontal sm+ */}
        <div
          className="mt-4 overflow-hidden"
          style={{ borderRadius: 'var(--r-xl)', border: '1px solid var(--b-soft)' }}
        >
          <div className="flex flex-col sm:flex-row">
            {timeline.map((t, i) => (
              <div
                key={t.weeks}
                className="flex-1"
                style={{
                  padding: 'clamp(0.75rem, 3vw, 1.125rem) clamp(0.875rem, 3.5vw, 1.25rem)',
                  borderBottom: i < timeline.length - 1 ? '1px solid var(--b-soft)' : 'none',
                  borderRight: undefined,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
                    style={{
                      width: 20, height: 20, fontSize: 10,
                      background: 'var(--p-tint)',
                      color: 'var(--p400)',
                      border: '1px solid var(--p-border)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <p
                    className="font-semibold uppercase tracking-widest"
                    style={{ fontSize: 10, color: 'var(--p500)', letterSpacing: '0.10em' }}
                  >
                    {t.weeks}
                  </p>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--t2)', lineHeight: 1.6 }}>
                  {t.result}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA — capped at 320px, not full-width stretch */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <CtaButton
            variant="secondary"
            style={{ maxWidth: 320 }}
            label="Reserve Your Thyroid Consultation"
            sublabel="₹299 session · See how coaching fits your life"
            ariaLabel="Reserve your thyroid consultation"
          />
          <p className="micro-trust">Applications closing soon · Limited intake</p>
        </div>

      </div>
    </section>
  )
}