'use client'

import SectionCta from './SectionCta'
import SectionHeader from './SectionHeader'

const steps = [
  { letter: 'L', label: 'Listen & Assess', desc: 'Understand what has been blocking your fat loss.' },
  { letter: 'E', label: 'Energy First', desc: 'Restore daily energy before pushing fat loss.' },
  { letter: 'A', label: 'Adaptive Nutrition', desc: 'Real Indian meals. No starvation.' },
  { letter: 'N', label: 'Navigate & Track', desc: 'Weekly coaching tweaks based on your progress.' },
]

const timeline = [
  { weeks: 'Weeks 1–3', result: 'Energy up. Bloating down. Cravings stabilize.' },
  { weeks: 'Weeks 4–8', result: 'Visible inch loss. Fat loss accelerates.' },
  { weeks: 'Weeks 9–12', result: 'Confident body. Sustainable habits locked in.' },
]

export default function FrameworkSection() {
  return (
    <section className="section-pad relative bg-[var(--bg-section)] text-white">
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        <SectionHeader
          label="The Method"
          title={
            <>
              The Thyroid <span className="text-gradient">L.E.A.N. Method</span>
            </>
          }
          lead="Built for hypothyroid women who need structure, accountability, and real Indian food — not another crash diet."
          titleMaxCh="24ch"
        />

        <div
          className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3"
        >
          {steps.map((s) => (
            <article
              key={s.letter}
              className="glass-card-sm text-center"
              style={{ padding: 'clamp(0.85rem, 3vw, 1.15rem)' }}
            >
              <div
                className="mx-auto mb-2.5 flex items-center justify-center rounded-full font-black"
                style={{
                  width: 'clamp(2.125rem, 5vw, 2.5rem)',
                  height: 'clamp(2.125rem, 5vw, 2.5rem)',
                  fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                  background: 'var(--p-tint)',
                  color: 'var(--p400)',
                  border: '1px solid var(--p-border)',
                }}
              >
                {s.letter}
              </div>
              <p
                className="mb-1 font-semibold leading-snug"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--t1)' }}
              >
                {s.label}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--t4)', lineHeight: 1.55 }}>
                {s.desc}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-[var(--r-xl)] border border-[var(--b-soft)] bg-[var(--s1)]">
          <div className="flex flex-col sm:flex-row">
            {timeline.map((t, i) => (
              <div
                key={t.weeks}
                className="flex-1 border-[var(--b-soft)] sm:border-b-0 sm:border-r last:sm:border-r-0"
                style={{
                  padding: 'clamp(0.85rem, 3vw, 1.1rem) clamp(0.9rem, 3.5vw, 1.2rem)',
                  borderBottom:
                    i < timeline.length - 1 ? '1px solid var(--b-soft)' : undefined,
                }}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      background: 'var(--p-tint)',
                      color: 'var(--p400)',
                      border: '1px solid var(--p-border)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--p400)]">
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

        <SectionCta
          style={{ maxWidth: 320 }}
          label="Reserve Your Thyroid Consultation"
          sublabel="₹299 session · See how coaching fits your life"
          trust="Applications closing soon · Limited intake"
          ariaLabel="Reserve your thyroid consultation"
          location="framework"
        />
      </div>
    </section>
  )
}
