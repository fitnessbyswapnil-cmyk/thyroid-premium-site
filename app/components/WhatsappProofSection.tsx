'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import CtaButton from './CtaButton'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProofCard = {
  id: string
  image: string
  badge: string
  headline: string
  client: string
}

// ── Card data — exact prescribed order ────────────────────────────────────────
// Row 1 → items 1-8  (marquee moves LEFT)
// Row 2 → items 9-15 (marquee moves RIGHT)
// Remaining files: Heenal R4, Nahamia R5, Namarata R9, Nishant R7

const ALL_CARDS: ProofCard[] = [
  // ── 1 ──────────────────────────────────────────────────────────────────────
  {
    id: 'c1',
    image: '/whatsapp-proof/4DEA6E92-C155-449F-98FD-56C56FB41C95_1_105_c.jpeg',
    badge: 'Energy Back',
    headline: 'Finally getting my energy back.',
    client: 'PRIYA K · THYROID CLIENT',
  },
  // ── 2 ──────────────────────────────────────────────────────────────────────
  {
    id: 'c2',
    image: '/whatsapp-proof/30C8CA81-A315-44E7-BC48-6AAE0856ED9F_1_105_c.jpeg',
    badge: 'TSH Improving',
    headline: 'TSH is finally moving in the right direction.',
    client: 'ANJALI M · HYPOTHYROID CLIENT',
  },
  // ── 3 ──────────────────────────────────────────────────────────────────────
  {
    id: 'c3',
    image: '/whatsapp-proof/A810BC40-CBA2-4438-8FE5-AF8287A0F9A8_1_105_c.jpeg',
    badge: 'Better Sleep',
    headline: 'Sleeping through the night again.',
    client: 'DIVYA S · THYROID CLIENT',
  },
  // ── 4 ──────────────────────────────────────────────────────────────────────
  {
    id: 'c4',
    image: '/whatsapp-proof/992C9693-B6B8-4D3F-809C-E2410E949841_1_105_c.jpeg',
    badge: 'Weight Moving',
    headline: 'Scale finally started moving.',
    client: 'MEENA R · HYPOTHYROID CLIENT',
  },
  // ── 5 ──────────────────────────────────────────────────────────────────────
  {
    id: 'c5',
    image: '/whatsapp-proof/BC4900F6-3176-4580-A158-780B4CCD162F_1_105_c.jpeg',
    badge: 'Bloating Reduced',
    headline: 'Belly bloat down noticeably.',
    client: 'SUNITA P · THYROID CLIENT',
  },
  // ── 6 ──────────────────────────────────────────────────────────────────────
  {
    id: 'c6',
    image: '/whatsapp-proof/Guitar R8.png',
    badge: 'Confidence Back',
    headline: 'Feeling like myself again.',
    client: 'GUITAR C · FAT LOSS CLIENT',
  },
  // ── 7 ──────────────────────────────────────────────────────────────────────
  {
    id: 'c7',
    image: '/whatsapp-proof/Rozal R2.png',
    badge: 'TSH Improved',
    headline: 'My thyroid finally responded.',
    client: 'ROZAL D · HYPOTHYROID CLIENT',
  },
  // ── 8 ──────────────────────────────────────────────────────────────────────
  {
    id: 'c8',
    image: '/whatsapp-proof/Sima R1.png',
    badge: '4 kg Lost',
    headline: 'Weight started moving. Finally.',
    client: 'SIMA P · THYROID CLIENT',
  },
  // ── 9 ──────────────────────────────────────────────────────────────────────
  {
    id: 'c9',
    image: '/whatsapp-proof/Rakesh R3.png',
    badge: 'Clothes Fitting',
    headline: 'Old clothes fitting again.',
    client: 'RAKESH M · FAT LOSS CLIENT',
  },
  // ── 10 ─────────────────────────────────────────────────────────────────────
  {
    id: 'c10',
    image: '/whatsapp-proof/Jay R6.png',
    badge: 'Energy Restored',
    headline: 'Energy came back naturally.',
    client: 'JAY P · THYROID CLIENT',
  },
  // ── 11 ─────────────────────────────────────────────────────────────────────
  {
    id: 'c11',
    image: '/whatsapp-proof/Nitin R10.png',
    badge: 'Mind Fog Gone',
    headline: 'Focus and clarity returned.',
    client: 'NITIN T · FAT LOSS CLIENT',
  },
  // ── 12 ─────────────────────────────────────────────────────────────────────
  {
    id: 'c12',
    image: '/whatsapp-proof/Heenal R4.png',
    badge: 'TSH 6.2 → 2.9',
    headline: 'TSH dropped. Energy came back.',
    client: 'HEENAL R · HYPOTHYROID CLIENT',
  },
  // ── 13 ─────────────────────────────────────────────────────────────────────
  {
    id: 'c13',
    image: '/whatsapp-proof/Nahamia R5.png',
    badge: 'Bloating Down',
    headline: 'Bloating reduced significantly.',
    client: 'NAHAMIA S · THYROID CLIENT',
  },
  // ── 14 ─────────────────────────────────────────────────────────────────────
  {
    id: 'c14',
    image: '/whatsapp-proof/Namarata R9.png',
    badge: 'No More Fatigue',
    headline: 'Finally not tired all day.',
    client: 'NAMARATA S · HYPOTHYROID CLIENT',
  },
  // ── 15 ─────────────────────────────────────────────────────────────────────
  {
    id: 'c15',
    image: '/whatsapp-proof/Nishant R7.png',
    badge: 'Consistent Results',
    headline: 'Results without starving.',
    client: 'NISHANT K · FAT LOSS CLIENT',
  },
]

const ROW1 = ALL_CARDS.slice(0, 8)   // moves left  (45 s)
const ROW2 = ALL_CARDS.slice(8)      // moves right (40 s)

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
        width: wide ? 'min(320px, 84vw)' : '272px',
        flexShrink: 0,
        borderRadius: '28px',
        border: '1px solid rgba(255,255,255,0.07)',
        background:
          'linear-gradient(155deg, rgba(139,92,246,0.07) 0%, rgba(12,10,25,0.96) 100%)',
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.055), 0 32px 72px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)',
        transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.transform = 'translateY(-5px)')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.transform = 'translateY(0)')
      }
    >
      {/* ── Badge ──────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-[5px]"
          style={{
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.28)',
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
            {card.badge}
          </span>
        </div>
      </div>

      {/* ── Headline ───────────────────────────────────────────────────────── */}
      <div className="px-5 pb-4 pt-2.5">
        <p
          className="text-[0.9rem] font-bold leading-[1.28] tracking-[-0.01em]"
          style={{ color: 'rgba(255,255,255,0.9)' }}
        >
          {card.headline}
        </p>
      </div>

      {/* ── Screenshot ─────────────────────────────────────────────────────── */}
      {/* object-contain preserves full screenshot — no cropping */}
      <div
        className="relative mx-4 overflow-hidden"
        style={{
          aspectRatio: '9 / 14',
          borderRadius: '18px',
          background: '#07060e',
          border: '1px solid rgba(255,255,255,0.065)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 36px rgba(0,0,0,0.55)',
        }}
      >
        {/* Ambient purple glow behind image */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 25%, rgba(139,92,246,0.09) 0%, transparent 60%)',
          }}
        />
        {/* Subtle glass shimmer top-left */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.035) 0%, transparent 38%)',
          }}
        />
        <Image
          src={card.image}
          alt={`WhatsApp conversation: ${card.headline}`}
          fill
          sizes="(max-width: 767px) 84vw, 272px"
          className="object-contain"
          draggable={false}
          loading="lazy"
        />
      </div>

      {/* ── Trust footer ───────────────────────────────────────────────────── */}
      <div className="px-5 pb-5 pt-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.58rem] font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #a855f7, #6d28d9)',
              boxShadow: '0 0 0 1.5px rgba(139,92,246,0.3)',
            }}
            aria-hidden="true"
          >
            {initial}
          </div>
          <p
            className="text-[0.6rem] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'rgba(255,255,255,0.28)' }}
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
          className="absolute left-1/2 top-[-8%] h-[min(65vw,340px)] w-[min(65vw,340px)] -translate-x-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute left-[15%] top-[30%] h-[200px] w-[200px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(109,40,217,0.07) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute right-[10%] bottom-[20%] h-[180px] w-[180px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)',
            filter: 'blur(50px)',
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
          {/* Live badge */}
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

          {/* Headline */}
          <motion.h2
            variants={fadeUp}
            className="section-title mx-auto"
            style={{ maxWidth: '22ch' }}
          >
            Real Conversations.{' '}
            <span className="text-gradient">Real Thyroid Progress.</span>
          </motion.h2>

          {/* Lead */}
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
        {/* Single scrollable row, 84vw cards, full screenshots visible      */}
        <div className="block md:hidden">
          <div className="relative overflow-hidden">
            {/* Left fade */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 z-20 h-full w-8"
              style={{ background: 'linear-gradient(to right, var(--bg-section), transparent)' }}
            />
            {/* Right fade */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 z-20 h-full w-8"
              style={{ background: 'linear-gradient(to left, var(--bg-section), transparent)' }}
            />
            <div
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto scrollbar-hide"
              style={{ padding: '4px 1rem 12px' }}
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

        {/* ── DESKTOP: dual-row infinite marquee ────────────────────────── */}
        {/* Row 1 → scrolls left | Row 2 → scrolls right                    */}
        <div className="relative hidden md:block">

          {/* Edge fades — sit above both rows */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-20 h-full"
            style={{
              width: 'clamp(2rem, 5vw, 5rem)',
              background: 'linear-gradient(to right, var(--bg-section) 0%, transparent 100%)',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 z-20 h-full"
            style={{
              width: 'clamp(2rem, 5vw, 5rem)',
              background: 'linear-gradient(to left, var(--bg-section) 0%, transparent 100%)',
            }}
          />

          <div className="space-y-5 overflow-hidden py-2">

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

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <motion.div
          className="container-default mt-12 text-center"
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
