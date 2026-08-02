'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import CtaButton from './CtaButton'

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
    result: '15 kg over her 90-day program — energy and hormone markers stabilized',
    quote: 'Finally lost the weight thyroid stole from me for 4 years.',
  },
  {
    image: '/MoreThanFatLossSection/surekha.png',
    name: 'Surekha M.',
    meta: 'Hypothyroid client',
    result: 'Bloating gone — no more afternoon fatigue',
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
    id: 'c7',
    image: '/whatsapp-proof/Heenal R4.png',
    tags: ['TSH In Range'],
    headline: 'TSH dropped. Energy came back.',
    client: 'Heenal · Hypothyroid client',
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
const ROW1_COUNT = Math.ceil(ALL_CARDS.length / 2)
const ROW1 = ALL_CARDS.slice(0, ROW1_COUNT)
const ROW2 = ALL_CARDS.slice(ROW1_COUNT)

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
// the rest of the page's purple system.
const ACCENT = 'var(--p500)'
const ACCENT_LIGHT = 'var(--p400)'
const ACCENT_DIM = 'rgba(168,85,247,0.22)'
const ACCENT_GLOW = 'rgba(168,85,247,0.12)'

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
          ? '1px solid rgba(168,85,247,0.35)'
          : `1px solid ${ACCENT_DIM}`,
        background:
          'linear-gradient(160deg, rgba(168,85,247,0.07) 0%, rgba(5,4,4,0.99) 45%, rgba(10,8,4,1) 100%)',
        boxShadow: featured
          ? '0 0 0 1px rgba(168,85,247,0.12), 0 20px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)'
          : `0 0 0 1px rgba(255,255,255,0.04), 0 2px 4px ${ACCENT_GLOW}, 0 20px 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      <div className="grid sm:grid-cols-[180px_1fr]">
        <div className="relative min-h-[220px] sm:min-h-[240px] overflow-hidden">
          <Image
            src={story.image}
            alt={`${story.name} transformation`}
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
                'linear-gradient(to top, rgba(5,4,4,0.7) 0%, transparent 40%)',
            }}
          />
        </div>

        <div className="flex flex-col justify-center p-6">
          {featured && (
            <span
              className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-[5px] text-[0.6rem] font-extrabold uppercase tracking-[0.18em]"
              style={{
                background: 'rgba(168,85,247,0.09)',
                border: '1px solid rgba(168,85,247,0.28)',
                color: ACCENT_LIGHT,
              }}
            >
              Featured story
            </span>
          )}

          <p className="mb-1 text-[0.95rem] font-bold tracking-[-0.01em] text-white/95">
            {story.name}{' '}
            <span className="font-medium text-white/40">· {story.meta}</span>
          </p>

          <p className="mb-3 text-[0.85rem] font-semibold leading-[1.5]" style={{ color: ACCENT_LIGHT }}>
            {story.result}
          </p>

          <p className="text-[0.85rem] italic leading-[1.65] text-white/55">
            &ldquo;{story.quote}&rdquo;
          </p>
        </div>
      </div>
    </article>
  )
}

// ── ProofCard ─────────────────────────────────────────────────────────────────

function ProofCard({ card, isMobile = false }: { card: ProofCard; isMobile?: boolean }) {
  const initial = card.client.charAt(0)

  return (
    <article
      className="group flex flex-col overflow-hidden proof-card"
      style={{
        width: isMobile ? 'clamp(300px, 90vw, 420px)' : '350px',
        flexShrink: 0,
        borderRadius: '28px',
        border: `1px solid ${ACCENT_DIM}`,
        background:
          'linear-gradient(160deg, rgba(168,85,247,0.07) 0%, rgba(5,4,4,0.99) 45%, rgba(10,8,4,1) 100%)',
        boxShadow:
          `0 0 0 1px rgba(255,255,255,0.04), 0 2px 4px ${ACCENT_GLOW}, 0 20px 60px rgba(0,0,0,0.9), 0 60px 120px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)`,
        transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(-8px) scale(1.012)'
        el.style.boxShadow =
          `0 0 0 1px rgba(168,85,247,0.35), 0 2px 4px rgba(168,85,247,0.18), 0 24px 70px rgba(0,0,0,0.92), 0 60px 140px rgba(0,0,0,0.65), 0 0 60px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.08)`
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(0) scale(1)'
        el.style.boxShadow =
          `0 0 0 1px rgba(255,255,255,0.04), 0 2px 4px ${ACCENT_GLOW}, 0 20px 60px rgba(0,0,0,0.9), 0 60px 120px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)`
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
                background: 'rgba(168,85,247,0.09)',
                border: `1px solid rgba(168,85,247,0.28)`,
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
          background: '#050404',
          border: `1px solid rgba(168,85,247,0.10)`,
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        {/* Subtle top glow inside image frame */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8"
          style={{
            background:
              'linear-gradient(to bottom, rgba(168,85,247,0.05) 0%, transparent 100%)',
          }}
        />
        <Image
          src={card.image}
          alt={`WhatsApp screenshot — ${card.headline} (${card.client})`}
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
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-black"
            style={{
              background: `linear-gradient(135deg, ${ACCENT} 0%, var(--p600) 100%)`,
              boxShadow: `0 0 0 2px rgba(168,85,247,0.2), 0 2px 8px rgba(168,85,247,0.3)`,
              color: '#fff',
            }}
            aria-hidden="true"
          >
            {initial}
          </div>
          <p
            className="text-[0.66rem] font-semibold tracking-[0.08em]"
            style={{ color: 'rgba(255,255,255,0.32)' }}
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
  const row1Doubled = [...ROW1, ...ROW1]
  const row2Doubled = [...ROW2, ...ROW2]

  return (
    <section
      className="section-pad relative overflow-hidden"
      style={{ background: 'var(--bg-section)' }}
    >
      {/* ── Ambient background glows ──────────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-6%] h-[min(70vw,420px)] w-[min(70vw,420px)] -translate-x-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(168,85,247,0.09) 0%, transparent 70%)`,
            filter: 'blur(100px)',
          }}
        />
        <div
          className="absolute left-[8%] top-[30%] h-[260px] w-[260px] rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)`,
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute right-[6%] bottom-[14%] h-[240px] w-[240px] rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)`,
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
            Unedited Messages
          </motion.p>
        </motion.div>

        <p className="container-default mb-10 text-center text-[0.7rem] leading-relaxed" style={{ color: 'rgba(255,255,255,0.28)' }}>
          {RESULTS_VARY}
        </p>

        {/* ── MOBILE: wide snap-scroll (single row, all active cards) ─────── */}
        <div className="block md:hidden">
          <div className="relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 z-20 h-full w-12"
              style={{ background: 'linear-gradient(to right, var(--bg-section), transparent)' }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 z-20 h-full w-12"
              style={{ background: 'linear-gradient(to left, var(--bg-section), transparent)' }}
            />
            <div
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto scrollbar-hide"
              style={{ padding: '6px 1.25rem 18px' }}
            >
              {ALL_CARDS.map((card) => (
                <div key={card.id} className="snap-center flex-shrink-0">
                  <ProofCard card={card} isMobile />
                </div>
              ))}
            </div>
          </div>
          <p
            className="mt-3 text-center text-[0.59rem] font-semibold uppercase tracking-[0.18em]"
            style={{ color: 'rgba(255,255,255,0.18)' }}
          >
            Swipe to see more ›
          </p>
        </div>

        {/* ── DESKTOP: 2 cinematic marquee rows ───────────────────────────── */}
        <div className="relative hidden md:block">

          {/* Edge fades */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-20 h-full"
            style={{
              width: 'clamp(3rem, 7vw, 7rem)',
              background: 'linear-gradient(to right, var(--bg-section) 0%, transparent 100%)',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 z-20 h-full"
            style={{
              width: 'clamp(3rem, 7vw, 7rem)',
              background: 'linear-gradient(to left, var(--bg-section) 0%, transparent 100%)',
            }}
          />

          <div className="space-y-6 overflow-hidden py-3">

            {/* Row 1 — moves left */}
            <div className="marquee-rail overflow-hidden">
              <div className="marquee-track-l flex gap-5 w-max">
                {row1Doubled.map((card, i) => (
                  <ProofCard key={`r1-${card.id}-${i}`} card={card} />
                ))}
              </div>
            </div>

            {/* Row 2 — moves right */}
            <div className="marquee-rail overflow-hidden">
              <div className="marquee-track-r flex gap-5 w-max">
                {row2Doubled.map((card, i) => (
                  <ProofCard key={`r2-${card.id}-${i}`} card={card} />
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  )
}
