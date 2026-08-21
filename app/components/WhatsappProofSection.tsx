'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import SectionCta from './SectionCta'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProofCard = {
  id: string
  image: string
  tags: string[]
  headline: string
  client: string
}

// ── Featured stories ──────────────────────────────────────────────────────────
// All three live ads cite Heenal's result as headline proof, so she leads this
// section (folded in from the removed "More Than Weight Loss" section, together
// with Surekha). The results-vary line below the block appears once and covers
// every number on the page.

const FEATURED = [
  {
    image: '/MoreThanFatLossSection/heenal.png',
    name: 'Heenal S.',
    meta: 'IT professional, Bengaluru',
    result: '15 kg over her 90-day program, energy and hormone markers stabilized',
    quote: 'Finally lost the weight thyroid stole from me for 4 years.',
  },
  {
    image: '/MoreThanFatLossSection/surekha.png',
    name: 'Surekha M.',
    meta: 'Hypothyroid client',
    result: 'Bloating gone, no more afternoon fatigue',
    quote: 'My clothes fit again. I finally feel like myself.',
  },
] as const

const RESULTS_VARY =
  'Individual results vary with condition, consistency, and starting point.'

// ── Card data ─────────────────────────────────────────────────────────────────
// Trimmed to the strongest 8 for mobile length (proof-fatigue reduction).
// Women only — this page speaks to hypothyroid women, so the proof does too.
// Image legibility / authenticity was NOT assessed — the screenshots can't be
// seen from here, so verify the 8 visually and swap from REMOVED_FOR_LENGTH if
// a kept one is weak.
//
// Card count drives both views automatically:
//   DESKTOP → split in half into 2 marquee rows (see ROW1/ROW2 below)
//   MOBILE  → single snap-scroll over every card

const ALL_CARDS: ProofCard[] = [
  {
    id: 'c1',
    image: '/whatsapp-proof/Shariya-Sultana.jpeg',
    tags: ['TSH Improved', 'Energy Back'],
    headline: 'TSH is finally in range.',
    client: 'Shariya Sultana · Thyroid client',
  },
  {
    id: 'c3',
    image: '/whatsapp-proof/Pooja-Sharma.jpeg',
    tags: ['Hair Fall Stopped', 'Thyroid Healing'],
    headline: 'Hair loss finally stopped.',
    client: 'Pooja Sharma · Hypothyroid client',
  },
  {
    id: 'c4',
    image: '/whatsapp-proof/Priya-Shree.jpeg',
    tags: ['Metabolism Fixed', 'Feeling Lighter'],
    headline: 'Metabolism feels alive again.',
    client: 'Priya Shree · Thyroid client',
  },
  {
    id: 'c5',
    image: '/whatsapp-proof/Ritika-Deshmukh.jpeg',
    tags: ['Fatigue Gone', 'Strength Restored'],
    headline: 'No more morning exhaustion.',
    client: 'Ritika Deshmukh · Thyroid client',
  },
  {
    id: 'c15',
    image: '/whatsapp-proof/Sima R1.png',
    tags: ['4 kg Lost'],
    headline: 'Weight started moving. Finally.',
    client: 'Sima · Thyroid client',
  },
  {
    id: 'c2',
    image: '/whatsapp-proof/Sruthi-Reddy.jpeg',
    tags: ['Weight Moving', 'Bloating Down'],
    headline: 'Weight started moving again.',
    client: 'Sruthi Reddy · Thyroid client',
  },
  {
    id: 'c10',
    image: '/whatsapp-proof/Namarata R9.png',
    tags: ['No More Fatigue'],
    headline: 'Finally not tired all day.',
    client: 'Namrata · Hypothyroid client',
  },
]

// Trimmed from carousel for mobile length. Re-add the strongest if needed.
// (Removed mostly because each duplicates a result type already covered by a
// kept card, reads as vague, or — Nitin/Rakesh/Nishant/Jay/Guitar — is a male
// fat-loss client on a page speaking to hypothyroid women.) Nothing here is
// deleted — restore by moving an object back up into ALL_CARDS.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for easy restore
const REMOVED_FOR_LENGTH: ProofCard[] = [
  {
    // Removed per audit: Heenal already appears twice on the page (hero
    // avatar strip + transformation wall) — cap any one client at 2 placements.
    id: 'c7',
    image: '/whatsapp-proof/Heenal R4.png',
    tags: ['TSH In Range'],
    headline: 'TSH dropped. Energy came back.',
    client: 'Heenal · Hypothyroid client',
  },
  {
    id: 'c6',
    image: '/whatsapp-proof/Rozal R2.png',
    tags: ['TSH Improved'],
    headline: 'My thyroid finally responded.',
    client: 'Rozal · Hypothyroid client',
  },
  {
    id: 'c8',
    image: '/whatsapp-proof/Jay R6.png',
    tags: ['Energy Restored'],
    headline: 'Energy came back naturally.',
    client: 'Jay · Thyroid client',
  },
  {
    id: 'c9',
    image: '/whatsapp-proof/Nahamia R5.png',
    tags: ['Bloating Down'],
    headline: 'Bloating reduced significantly.',
    client: 'Nahamia · Thyroid client',
  },
  {
    id: 'c12',
    image: '/whatsapp-proof/Nitin R10.png',
    tags: ['Mind Fog Gone'],
    headline: 'Focus and clarity returned.',
    client: 'Nitin · Fat loss client',
  },
  {
    id: 'c13',
    image: '/whatsapp-proof/Rakesh R3.png',
    tags: ['Clothes Fitting'],
    headline: 'Old clothes fitting again.',
    client: 'Rakesh · Fat loss client',
  },
  {
    id: 'c11',
    image: '/whatsapp-proof/Nishant R7.png',
    tags: ['Consistent Results'],
    headline: 'Results without starving.',
    client: 'Nishant · Fat loss client',
  },
  {
    id: 'c14',
    image: '/whatsapp-proof/Guitar R8.png',
    tags: ['Body Fat Down'],
    headline: 'Feeling like myself again.',
    client: 'Guitar · Fat loss client',
  },
]

// Split the active cards in half across the two desktop marquee rows.
// Derived from ALL_CARDS.length so the rows stay balanced if the count changes.
// ROW 1 → marquee moves left (90 s) · ROW 2 → marquee moves right (85 s)
// (Marquee ROW1/ROW2 split removed with the marquee itself — the unified
// snap gallery below renders ALL_CARDS once, no clones.)

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

// ── Violet brand accent constants ─────────────────────────────────────────────
// Reuses the shared design tokens (--p400/--p500/--p600) so this section matches
// the rest of the page's teal system.
const ACCENT = 'var(--p500)'
const ACCENT_LIGHT = 'var(--p300)'
const ACCENT_DIM = 'rgba(163, 114, 32,0.28)'
const ACCENT_GLOW = 'rgba(163, 114, 32,0.1)'

// ── FeaturedStoryCard ─────────────────────────────────────────────────────────

function FeaturedStoryCard({
  story,
  featured,
}: {
  story: (typeof FEATURED)[number]
  featured?: boolean
}) {
  return (
    <article
      className="overflow-hidden rounded-[28px]"
      style={{
        border: featured
          ? '1px solid rgba(163, 114, 32,0.4)'
          : '1px solid #ede7dd',
        background: 'var(--surface-page)',
        boxShadow: featured
          ? '0 0 0 1px rgba(163, 114, 32,0.08), 0 20px 50px rgba(36, 31, 26,0.12)'
          : '0 1px 2px rgba(36, 31, 26,0.04), 0 20px 50px rgba(36, 31, 26,0.08)',
      }}
    >
      <div className="grid sm:grid-cols-[180px_1fr]">
        <div className="relative min-h-[220px] sm:min-h-[240px] overflow-hidden">
          <Image
            src={story.image}
            alt={`${story.name} before and after`}
            fill
            sizes="(max-width: 640px) 90vw, 180px"
            className="object-cover object-top"
            loading="lazy"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to top, rgba(36, 31, 26,0.3) 0%, transparent 40%)',
            }}
          />
        </div>

        <div className="flex flex-col justify-center p-6">
          {featured && (
            <span
              className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-[5px] text-[0.6rem] font-extrabold uppercase tracking-[0.18em]"
              style={{
                background: 'var(--p-subtle)',
                border: '1px solid var(--p-border)',
                color: ACCENT_LIGHT,
              }}
            >
              Featured story
            </span>
          )}

          <p className="mb-1 text-[0.95rem] font-bold tracking-[-0.01em] text-[var(--t1)]">
            {story.name}{' '}
            <span className="font-medium text-[var(--t3)]">· {story.meta}</span>
          </p>

          <p className="mb-3 text-[0.85rem] font-semibold leading-[1.5]" style={{ color: ACCENT_LIGHT }}>
            {story.result}
          </p>

          <p className="text-[0.85rem] italic leading-[1.65] text-[var(--t2)]">
            &ldquo;{story.quote}&rdquo;
          </p>
        </div>
      </div>
    </article>
  )
}

// ── ProofCard ─────────────────────────────────────────────────────────────────

function ProofCard({
  card,
  isMobile = false,
  ariaHidden = false,
}: {
  card: ProofCard
  isMobile?: boolean
  // Marquee clone copies are presentation-only — hide them from the
  // accessibility tree so screen readers announce each client exactly once.
  ariaHidden?: boolean
}) {
  const initial = card.client.charAt(0)

  return (
    <article
      aria-hidden={ariaHidden || undefined}
      className="group flex flex-col overflow-hidden proof-card"
      style={{
        width: isMobile ? 'clamp(300px, 90vw, 420px)' : '350px',
        flexShrink: 0,
        borderRadius: '28px',
        border: '1px solid #ede7dd',
        background: 'var(--surface-page)',
        // One shadow, not two stacked 60/120px blurs — blur radius is the
        // single most expensive thing to composite; ~half the paint cost per
        // card. Hover animates transform ONLY (GPU-cheap), never box-shadow.
        boxShadow:
          '0 1px 2px rgba(36, 31, 26,0.04), 0 26px 54px -14px rgba(36, 31, 26,0.12)',
        transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(-8px) scale(1.012)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(0) scale(1)'
      }}
    >
      {/* ── Header: Tags + Headline ─────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          {card.tags.map((tag) => (
            <div
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-[5px]"
              style={{
                background: 'var(--p-subtle)',
                border: '1px solid var(--p-border)',
              }}
            >
              <span
                className="h-[5px] w-[5px] shrink-0 rounded-full"
                style={{
                  background: ACCENT,
                  boxShadow: `0 0 8px ${ACCENT}`,
                }}
                aria-hidden="true"
              />
              <span
                className="text-[0.6rem] font-extrabold uppercase tracking-[0.18em]"
                style={{ color: ACCENT_LIGHT }}
              >
                {tag}
              </span>
            </div>
          ))}
        </div>

      </div>

      {/* ── Screenshot ── */}
      <div
        className="relative overflow-hidden mx-3"
        style={{
          aspectRatio: '9 / 15',
          borderRadius: '18px',
          background: '#fdf6e4',
          border: '1px solid #ede7dd',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 6px 20px rgba(36, 31, 26,0.08)',
        }}
      >
        <Image
          src={card.image}
          alt={`WhatsApp screenshot, ${card.headline} (${card.client})`}
          fill
          sizes="(max-width: 767px) 90vw, 350px"
          className="object-contain z-0"
          draggable={false}
          loading="lazy"
        />
      </div>

      {/* ── Trust footer ────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 mt-auto">
        <div
          className="flex items-center gap-2.5 pt-3"
          style={{ borderTop: '1px solid #efe8db' }}
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-black"
            style={{
              background: 'var(--p400)',
              boxShadow: '0 0 0 2px rgba(163, 114, 32,0.18), 0 2px 8px rgba(163, 114, 32,0.25)',
              color: '#fff',
            }}
            aria-hidden="true"
          >
            {initial}
          </div>
          <p
            className="text-[0.66rem] font-semibold tracking-[0.08em]"
            style={{ color: 'var(--t3)' }}
          >
            {card.client}
          </p>
        </div>
      </div>
    </article>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function WhatsappProofSection() {
  return (
    // White is mandatory here: WhatsApp green against a yellow wash plus a red
    // CTA makes a red-yellow-green traffic light, on the calmest section of the
    // page. Keep yellow at least 32px clear of every screenshot.
    <section
      className="cv-auto section-pad-tight relative overflow-hidden"
      style={{ background: 'var(--bg-page)' }}
      aria-labelledby="whatsapp-proof-heading"
    >
      {/* ── Ambient background glows ──────────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-6%] h-[min(70vw,420px)] w-[min(70vw,420px)] -translate-x-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(163, 114, 32,0.05) 0%, transparent 70%)`,
            filter: 'blur(100px)',
          }}
        />
        <div
          className="absolute left-[8%] top-[30%] h-[260px] w-[260px] rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(184, 50, 43,0.04) 0%, transparent 70%)`,
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute right-[6%] bottom-[14%] h-[240px] w-[240px] rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(163, 114, 32,0.04) 0%, transparent 70%)`,
            filter: 'blur(70px)',
          }}
        />
      </div>

      <div className="relative z-10">

        {/* ── Section header ──────────────────────────────────────────────── */}
        <motion.div
          className="container-default mb-12 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <motion.p variants={fadeUp} className="section-label">
            Unedited Screenshots
          </motion.p>
          <motion.h2
            id="whatsapp-proof-heading"
            variants={fadeUp}
            className="section-title mx-auto text-balance"
            style={{ maxWidth: "20ch" }}
          >
            Straight from their WhatsApp.
          </motion.h2>
        </motion.div>

        <p className="container-default mb-10 text-center text-[0.7rem] leading-relaxed" style={{ color: 'var(--t4)' }}>
          {RESULTS_VARY}
        </p>

        {/* ── ALL BREAKPOINTS: one curated snap gallery ─────────────────────
            Replaces the desktop double-marquee. The marquee animated ~28
            image cards (originals + seamless-loop clones) with stacked
            60/120px blur shadows FOREVER — the single biggest source of
            scroll jank on the page. A draggable snap rail renders each
            client once, only paints on interaction, and matches the
            approved design's "screenshots casually laid down" look. */}
        {/* The two edge fades that used to sit here were scroll hints for the
            rail. There is no horizontal scroll any more, and they painted
            --bg-section (lemon wash) across a section that is deliberately
            white, so they are gone rather than recoloured. */}
        <div className="relative">
          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6"
            style={{ padding: '14px 1.25rem 22px' }}
          >
            {ALL_CARDS.map((card) => (
              // Straight, not tilted (owner call): these cards contain real
              // screenshots of readable chat text, and rotation makes that
              // text visibly crooked. The tilt suited empty placeholders in
              // the prototype; it fights legibility with actual content.
              <div key={card.id}>
                <ProofCard card={card} isMobile />
              </div>
            ))}
          </div>
        </div>
        <p
          className="mt-3 text-center text-[0.59rem] font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--t5)' }}
        >
          Swipe to see more ›
        </p>

        {/* THE single stack CTA — the one conversion point after the whole
            proof stack (moved here from the removed More Than Fat Loss
            section; hero + sticky bar are the other two touchpoints). */}
        <div className="container-default">
          <SectionCta
            variant="primary"
            className="mx-auto mt-12 max-w-sm"
            buttonClassName="w-full"
            label="Show Me What's Blocking It"
            sublabel="Free · 60 minutes · one to one"
            ariaLabel="Schedule my 1-1 thyroid fat loss session"
            location="transformations"
          />
        </div>

      </div>
    </section>
  )
}
