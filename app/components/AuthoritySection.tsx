'use client'

import Image from 'next/image'
import { Fragment } from 'react'

import { CERTIFICATIONS, COACH_IMAGE, COACH_NAME } from '../lib/authority'
import SectionCta from './SectionCta'

const stats = [
  { num: '5+', label: 'Years Experience' },
  { num: '200+', label: 'Clients Transformed' },
  { num: '93%', label: 'See Real Results' },
]

const trustPoints = [
  'Specialized in thyroid-friendly fat loss — not generic diet advice',
  'Personalized weekly accountability designed around Indian lifestyle',
  'Evidence-based protocol built for hypothyroid Indian women',
]

const credBadges = ['ACE Certified', 'INFS Certified', 'AIHM Certified', 'AHA BLS']

export default function AuthoritySection() {
  return (
    <section
      className="section-pad relative bg-[var(--bg-page)] text-white"
      aria-labelledby="authority-heading"
    >
      {/* ambient page glow */}
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">

        {/* ── MAIN TWO-COLUMN LAYOUT ────────────────────────── */}
        <div className="authority-layout">

          {/* ── LEFT: PORTRAIT ─────────────────────────────── */}
          <div className="authority-portrait-col">

            {/* ambient glow halo behind the card */}
            <div className="authority-portrait-halo" aria-hidden="true" />

            {/* gradient-border frame */}
            <div className="authority-portrait-frame">
              <div className="authority-portrait-inner">

                {/* photo */}
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '1/1' }}>
                  <Image
                    src={COACH_IMAGE}
                    alt={`${COACH_NAME}, ACE & INFS Certified Thyroid Fat-Loss Specialist`}
                    fill
                    sizes="(max-width: 640px) 82vw, (max-width: 1024px) 50vw, 360px"
                    className="object-cover object-center"
                    priority
                  />
                  {/* bottom scrim — subtle depth under the name badge */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(to top, rgba(12,13,15,0.72) 0%, rgba(12,13,15,0.0) 38%)',
                    }}
                  />
                </div>

                {/* name badge */}
                <div className="authority-name-badge">
                  <p className="text-[13.5px] font-bold tracking-[-0.01em] text-[var(--t1)]">
                    {COACH_NAME}
                  </p>
                  <p className="mt-[3px] text-[0.64rem] font-semibold uppercase tracking-[0.15em] text-[var(--p400)]">
                    Thyroid Fat-Loss Specialist
                  </p>
                  {/* verified pill */}
                  <div className="authority-verified-pill" aria-label="Certified coach">
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                      <path
                        d="M1.5 4.8L3.4 6.8L7.5 2.2"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Certified Coach
                  </div>
                </div>

              </div>
            </div>

            {/* credential badge pills */}
            <div className="mt-4 flex flex-wrap justify-center gap-1.5 lg:justify-start">
              {credBadges.map((c) => (
                <span key={c} className="authority-cred-pill">{c}</span>
              ))}
            </div>

          </div>

          {/* ── RIGHT: AUTHORITY CONTENT ───────────────────── */}
          <div className="authority-content-col">

            <p className="section-label">Meet Your Coach</p>

            <h2
              id="authority-heading"
              className="authority-coach-name"
            >
              {COACH_NAME}
            </h2>

            <p className="authority-coach-title">
              ACE &amp; INFS Certified Thyroid Fat Loss Specialist
            </p>

            <p className="authority-bio">
              For years, Indian women with hypothyroidism were told their labs
              look &ldquo;normal&rdquo; — and sent home to struggle alone. Swapnil
              built the <strong className="text-[var(--t1)]">THYROID L.E.A.N. Method</strong> to
              fix that: a science-backed protocol that addresses your thyroid
              biology at the root, so the weight finally moves — without
              starvation or generic calorie targets.
            </p>

            {/* trust points */}
            <ul className="authority-trust-list" aria-label="Why clients trust Swapnil">
              {trustPoints.map((point) => (
                <li key={point} className="authority-trust-item">
                  <span className="authority-trust-dot" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>

            {/* stat row */}
            <div
              className="stat-row mx-auto mt-7 lg:mx-0"
              style={{ maxWidth: '28rem' }}
              aria-label="Coach statistics"
            >
              {stats.map((s, i) => (
                <Fragment key={s.label}>
                  <div className="stat-chip">
                    <span className="stat-num">{s.num}</span>
                    <span className="stat-label">{s.label}</span>
                  </div>
                  {i < stats.length - 1 && (
                    <div className="stat-divider" aria-hidden="true" />
                  )}
                </Fragment>
              ))}
            </div>

            {/* CTA */}
            <SectionCta
              className="mx-auto max-w-sm lg:mx-0 lg:items-start"
              buttonClassName="w-full"
              label="Book My ₹299 Thyroid Session"
              sublabel="60-min private 1-on-1 · Full refund if you don't get clarity"
              trust="Private 60-min session · Limited weekly intake"
              ariaLabel="Apply for private thyroid coaching"
              location="authority"
            />

          </div>
        </div>

        {/* ── CERTIFICATIONS GRID ──────────────────────────── */}
        <div className="authority-cert-section">

          <div className="authority-cert-header">
            <span className="authority-cert-header-line" aria-hidden="true" />
            <p className="section-label" style={{ margin: 0 }}>Curated Credentials</p>
            <span className="authority-cert-header-line" aria-hidden="true" />
          </div>

          <div
            className="authority-cert-grid"
            role="list"
            aria-label="Certifications"
          >
            {CERTIFICATIONS.map((cert) => (
              <figure
                key={cert.id}
                className="authority-cert-card"
                role="listitem"
              >
                {/* image area */}
                <div className="authority-cert-img-wrap">
                  <Image
                    src={cert.image}
                    alt={cert.title}
                    fill
                    sizes="(max-width: 640px) 44vw, (max-width: 1024px) 22vw, 260px"
                    className="object-contain p-3"
                    loading="lazy"
                  />
                  {/* subtle inner glow on hover (handled via CSS) */}
                  <div className="authority-cert-img-overlay" aria-hidden="true" />
                </div>

                {/* label */}
                <figcaption className="authority-cert-label">
                  {cert.title}
                </figcaption>
              </figure>
            ))}
          </div>

          <p className="mt-5 text-center text-[0.7rem] leading-relaxed text-[var(--t5)]">
            Credentials support your coaching — not a substitute for medical care.
          </p>

        </div>

      </div>
    </section>
  )
}
