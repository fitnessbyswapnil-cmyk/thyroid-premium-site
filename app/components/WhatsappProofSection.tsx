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

// ── Card data ─────────────────────────────────────────────────────────────────
// Image → identity mapping verified against filenames per brief.
// Every image appears EXACTLY ONCE. No duplicates.
//
// ROW 1 (cards 1-8)  → marquee moves LEFT
// ROW 2 (cards 9-15) → marquee moves RIGHT

const ALL_CARDS: ProofCard[] = [
  // ── 1 — Heenal (JPEG screenshot) ──────────────────────────────────────────
  {
    id: 'c1',
    image: '/whatsapp-proof/4DEA6E92-C155-449F-98FD-56C56FB41C95_1_105_c.jpeg',
    tags: ['TSH Improved', 'Energy Back'],
    headline: 'TSH finally improving.',
    client: 'HEENAL · HYPOTHYROID CLIENT',
  },
  // ── 2 — Sima (JPEG screenshot) ────────────────────────────────────────────
  {
    id: 'c2',
    image: '/whatsapp-proof/30C8CA81-A315-44E7-BC48-6AAE0856ED9F_1_105_c.jpeg',
    tags: ['Weight Moving', 'Bloating Down'],
    headline: 'Weight finally started moving.',
    client: 'SIMA · THYROID CLIENT',
  },
  // ── 3 — Guitar (JPEG screenshot) ──────────────────────────────────────────
  {
    id: 'c3',
    image: '/whatsapp-proof/A810BC40-CBA2-4438-8FE5-AF8287A0F9A8_1_105_c.jpeg',
    tags: ['Body Fat Down', 'Strength Up'],
    headline: 'Body fat finally came down.',
    client: 'GUITAR · FAT LOSS CLIENT',
  },
  // ── 4 — Namrata (JPEG screenshot) ─────────────────────────────────────────
  {
    id: 'c4',
    image: '/whatsapp-proof/992C9693-B6B8-4D3F-809C-E2410E949841_1_105_c.jpeg',
    tags: ['TSH Improved', 'No More Fatigue'],
    headline: 'Finally not tired all day.',
    client: 'NAMRATA · HYPOTHYROID CLIENT',
  },
  // ── 5 — Nahamia (JPEG screenshot) ─────────────────────────────────────────
  {
    id: 'c5',
    image: '/whatsapp-proof/BC4900F6-3176-4580-A158-780B4CCD162F_1_105_c.jpeg',
    tags: ['Confidence Back', 'Clothes Fitting'],
    headline: 'Clothes fitting again.',
    client: 'NAHAMIA · THYROID CLIENT',
  },
  // ── 6 — Guitar R8 (PNG proof) ─────────────────────────────────────────────
  {
    id: 'c6',
    image: '/whatsapp-proof/Guitar R8.png',
    tags: ['Body Fat Down'],
    headline: 'Feeling like myself again.',
    client: 'GUITAR · FAT LOSS CLIENT',
  },
  // ── 7 — Rozal R2 ──────────────────────────────────────────────────────────
  {
    id: 'c7',
    image: '/whatsapp-proof/Rozal R2.png',
    tags: ['TSH Improved'],
    headline: 'My thyroid finally responded.',
    client: 'ROZAL · HYPOTHYROID CLIENT',
  },
  // ── 8 — Sima R1 (PNG proof) ───────────────────────────────────────────────
  {
    id: 'c8',
    image: '/whatsapp-proof/Sima R1.png',
    tags: ['4 kg Lost'],
    headline: 'Weight started moving. Finally.',
    client: 'SIMA · THYROID CLIENT',
  },
  // ── 9 — Rakesh R3 ─────────────────────────────────────────────────────────
  {
    id: 'c9',
    image: '/whatsapp-proof/Rakesh R3.png',
    tags: ['Clothes Fitting'],
    headline: 'Old clothes fitting again.',
    client: 'RAKESH · FAT LOSS CLIENT',
  },
  // ── 10 — Jay R6 ───────────────────────────────────────────────────────────
  {
    id: 'c10',
    image: '/whatsapp-proof/Jay R6.png',
    tags: ['Energy Restored'],
    headline: 'Energy came back naturally.',
    client: 'JAY · THYROID CLIENT',
  },
  // ── 11 — Nitin R10 ────────────────────────────────────────────────────────
  {
    id: 'c11',
    image: '/whatsapp-proof/Nitin R10.png',
    tags: ['Mind Fog Gone'],
    headline: 'Focus and clarity returned.',
    client: 'NITIN · FAT LOSS CLIENT',
  },
  // ── 12 — Heenal R4 (PNG proof) ────────────────────────────────────────────
  {
    id: 'c12',
    image: '/whatsapp-proof/Heenal R4.png',
    tags: ['TSH 6.2 → 2.9'],
    headline: 'TSH dropped. Energy came back.',
    client: 'HEENAL · HYPOTHYROID CLIENT',
  },
  // ── 13 — Nahamia R5 (PNG proof) ───────────────────────────────────────────
  {
    id: 'c13',
    image: '/whatsapp-proof/Nahamia R5.png',
    tags: ['Bloating Down'],
    headline: 'Bloating reduced significantly.',
    client: 'NAHAMIA · THYROID CLIENT',
  },
  // ── 14 — Namarata R9 (PNG proof) ──────────────────────────────────────────
  {
    id: 'c14',
    image: '/whatsapp-proof/Namarata R9.png',
    tags: ['No More Fatigue'],
    headline: 'Finally not tired all day.',
    client: 'NAMRATA · HYPOTHYROID CLIENT',
  },
  // ── 15 — Nishant R7 ───────────────────────────────────────────────────────
  {
    id: 'c15',
    image: '/whatsapp-proof/Nishant R7.png',
    tags: ['Consistent Results'],
    headline: 'Results without starving.',
    client: 'NISHANT · FAT LOSS CLIENT',
  },
]

const ROW1 = ALL_CARDS.slice(0, 8)  // marquee left  (75 s)
const ROW2 = ALL_CARDS.slice(8)     // marquee right (70 s)

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

// ── ProofCard ─────────────────────────────────────────────────────────────────

function ProofCard({ card, wide = false }: { card: ProofCard; wide?: boolean }) {
  const initial = card.client.charAt(0)

  return (
    <article
      className="group flex flex-col overflow-hidden"
      style={{
        width: wide ? 'clamp(280px, 90vw, 380px)' : '340px',
        flexShrink: 0,
        borderRadius: '28px',
        border: '1px solid rgba(255,255,255,0.08)',
        background:
          'linear-gradient(155deg, rgba(139,92,246,0.09) 0%, rgba(10,8,22,0.97) 100%)',
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.055), 0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.transform = 'translateY(0)')
      }
    >
      {/* ── Tags ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 px-5 pt-5">
        {card.tags.map((tag) => (
          <div
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-[5px]"
            style={{
              background: 'rgba(139,92,246,0.13)',
              border: '1px solid rgba(139,92,246,0.3)',
            }}
          >
            <span
              className="h-[5px] w-[5px] shrink-0 rounded-full"
              style={{
                background: '#c084fc',
                boxShadow: '0 0 7px rgba(192,132,252,0.9)',
              }}
              aria-hidden="true"
            />
            <span
              className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em]"
              style={{ color: '#c084fc' }}
            >
              {tag}
            </span>
          </div>
        ))}
      </div>

      {/* ── Headline ───────────────────────────────────────────────────────── */}
      <div className="px-5 pb-4 pt-3">
        <p
          className="text-[0.92rem] font-bold leading-[1.28] tracking-[-0.01em]"
          style={{ color: 'rgba(255,255,255,0.92)' }}
        >
          {card.headline}
        </p>
      </div>

      {/* ── Screenshot — object-contain preserves full image, no cropping ── */}
      <div
        className="relative mx-4 overflow-hidden"
        style={{
          aspectRatio: '9 / 14',
          borderRadius: '18px',
          background: '#06050d',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.6)',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 20%, rgba(139,92,246,0.1) 0%, transparent 60%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
          }}
        />
        <Image
          src={card.image}
          alt={`WhatsApp screenshot — ${card.headline} (${card.client})`}
          fill
          sizes="(max-width: 767px) 90vw, 340px"
          className="object-contain"
          draggable={false}
          loading="lazy"
        />
      </div>

      {/* ── Trust footer ───────────────────────────────────────────────────── */}
      <div className="px-5 pb-5 pt-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.58rem] font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #a855f7, #6d28d9)',
              boxShadow: '0 0 0 1.5px rgba(139,92,246,0.35)',
            }}
            aria-hidden="true"
          >
            {initial}
          </div>
          <p
            className="text-[0.6rem] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'rgba(255,255,255,0.3)' }}
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
      {/* ── Ambient background glows ─────────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-8%] h-[min(65vw,360px)] w-[min(65vw,360px)] -translate-x-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.11) 0%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />
        <div
          className="absolute left-[12%] top-[35%] h-[220px] w-[220px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(109,40,217,0.07) 0%, transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
        <div
          className="absolute right-[8%] bottom-[18%] h-[200px] w-[200px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      <div className="relative z-10">

        {/* ── Section header ─────────────────────────────────────────────── */}
        <motion.div
          className="container-default mb-10 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="mb-5 flex justify-center">
            <div
              className="inline-flex items-center gap-2.5 rounded-full px-4 py-2"
              style={{
                background: 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.22)',
              }}
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{
                  background: '#c084fc',
                  boxShadow: '0 0 8px rgba(192,132,252,0.9)',
                }}
                aria-hidden="true"
              />
              <span
                className="text-[0.62rem] font-bold uppercase tracking-[0.2em]"
                style={{ color: '#c084fc' }}
              >
                Real Client Conversations
              </span>
            </div>
          </motion.div>

          <motion.h2
            variants={fadeUp}
            className="section-title mx-auto"
            style={{ maxWidth: '22ch' }}
          >
            Real Conversations.{' '}
            <span className="text-gradient">Real Thyroid Progress.</span>
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="section-lead mx-auto mt-4 text-pretty"
            style={{ maxWidth: '46ch' }}
          >
            These are actual messages from clients finally seeing their body respond again —
            real people, real thyroid struggles, real results.
          </motion.p>
        </motion.div>

        {/* ── MOBILE: wide snap-scroll row ──────────────────────────────── */}
        <div className="block md:hidden">
          <div className="relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 z-20 h-full w-10"
              style={{ background: 'linear-gradient(to right, var(--bg-section), transparent)' }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 z-20 h-full w-10"
              style={{ background: 'linear-gradient(to left, var(--bg-section), transparent)' }}
            />
            <div
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto scrollbar-hide"
              style={{ padding: '4px 1rem 14px' }}
            >
              {ALL_CARDS.map((card) => (
                <div key={card.id} className="snap-center flex-shrink-0">
                  <ProofCard card={card} wide />
                </div>
              ))}
            </div>
          </div>
          <p
            className="mt-3 text-center text-[0.6rem] font-semibold uppercase tracking-[0.16em]"
            style={{ color: 'rgba(255,255,255,0.18)' }}
          >
            Swipe to see more ›
          </p>
        </div>

        {/* ── DESKTOP: 2 cinematic marquee rows only ────────────────────── */}
        {/* Row 1 → scrolls left  (75 s)                                    */}
        {/* Row 2 → scrolls right (70 s)                                    */}
        <div className="relative hidden md:block">

          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-20 h-full"
            style={{
              width: 'clamp(2.5rem, 6vw, 6rem)',
              background: 'linear-gradient(to right, var(--bg-section) 0%, transparent 100%)',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 z-20 h-full"
            style={{
              width: 'clamp(2.5rem, 6vw, 6rem)',
              background: 'linear-gradient(to left, var(--bg-section) 0%, transparent 100%)',
            }}
          />

          <div className="space-y-6 overflow-hidden py-2">

            {/* Row 1 — moves left */}
            <div className="marquee-rail overflow-hidden">
              <div className="marquee-track-l flex gap-6 w-max">
                {row1Doubled.map((card, i) => (
                  <ProofCard key={`r1-${card.id}-${i}`} card={card} />
                ))}
              </div>
            </div>

            {/* Row 2 — moves right */}
            <div className="marquee-rail overflow-hidden">
              <div className="marquee-track-r flex gap-6 w-max">
                {row2Doubled.map((card, i) => (
                  <ProofCard key={`r2-${card.id}-${i}`} card={card} />
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <motion.div
          className="container-default mt-14 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
        >
          <motion.p
            variants={fadeUp}
            className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.2em]"
            style={{ color: 'rgba(255,255,255,0.22)' }}
          >
            Your results could be next
          </motion.p>

          <motion.h3
            variants={fadeUp}
            className="mb-7 text-[1.6rem] font-black leading-[1.08] tracking-[-0.04em] text-white sm:text-[2rem]"
          >
            Your Thyroid Story{' '}
            <span className="text-gradient">Could Be Next.</span>
          </motion.h3>

          <motion.div
            variants={fadeUp}
            className="mx-auto"
            style={{ maxWidth: '22rem' }}
          >
            <div className="section-cta">
              <CtaButton
                variant="primary"
                label="Reserve My Private Thyroid Strategy Session"
                sublabel="60-minute private consultation with Swapnil"
                ariaLabel="Reserve your private thyroid strategy session"
                location="whatsapp_proof_cta"
              />
              <p
                className="text-center text-[0.68rem]"
                style={{ color: 'rgba(255,255,255,0.28)' }}
              >
                ₹299 · Fully refundable if no clarity · Limited slots weekly
              </p>
            </div>
          </motion.div>
        </motion.div>

      </div>
    </section>
  )
}
