'use client'

import Image from 'next/image'
import Reveal from './Reveal'
import SectionCta from './SectionCta'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProofCard = {
  id: string
  image: string
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
    headline: 'TSH is finally in range.',
    client: 'Shariya Sultana · Thyroid client',
  },
  {
    id: 'c3',
    image: '/whatsapp-proof/Pooja-Sharma.jpeg',
    headline: 'Hair loss finally stopped.',
    client: 'Pooja Sharma · Hypothyroid client',
  },
  {
    id: 'c4',
    image: '/whatsapp-proof/Priya-Shree.jpeg',
    headline: 'Metabolism feels alive again.',
    client: 'Priya Shree · Thyroid client',
  },
  {
    id: 'c5',
    image: '/whatsapp-proof/Ritika-Deshmukh.jpeg',
    headline: 'No more morning exhaustion.',
    client: 'Ritika Deshmukh · Thyroid client',
  },
  {
    id: 'c15',
    image: '/whatsapp-proof/Sima R1.png',
    headline: 'Weight started moving. Finally.',
    client: 'Sima · Thyroid client',
  },
  {
    id: 'c2',
    image: '/whatsapp-proof/Sruthi-Reddy.jpeg',
    headline: 'Weight started moving again.',
    client: 'Sruthi Reddy · Thyroid client',
  },
  {
    id: 'c10',
    image: '/whatsapp-proof/Namarata R9.png',
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
    headline: 'TSH dropped. Energy came back.',
    client: 'Heenal · Hypothyroid client',
  },
  {
    id: 'c6',
    image: '/whatsapp-proof/Rozal R2.png',
    headline: 'My thyroid finally responded.',
    client: 'Rozal · Hypothyroid client',
  },
  {
    id: 'c8',
    image: '/whatsapp-proof/Jay R6.png',
    headline: 'Energy came back naturally.',
    client: 'Jay · Thyroid client',
  },
  {
    id: 'c9',
    image: '/whatsapp-proof/Nahamia R5.png',
    headline: 'Bloating reduced significantly.',
    client: 'Nahamia · Thyroid client',
  },
  {
    id: 'c12',
    image: '/whatsapp-proof/Nitin R10.png',
    headline: 'Focus and clarity returned.',
    client: 'Nitin · Fat loss client',
  },
  {
    id: 'c13',
    image: '/whatsapp-proof/Rakesh R3.png',
    headline: 'Old clothes fitting again.',
    client: 'Rakesh · Fat loss client',
  },
  {
    id: 'c11',
    image: '/whatsapp-proof/Nishant R7.png',
    headline: 'Results without starving.',
    client: 'Nishant · Fat loss client',
  },
  {
    id: 'c14',
    image: '/whatsapp-proof/Guitar R8.png',
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

// Motion variants removed with framer-motion — the fade-up now lives in the
// .reveal rule in globals.css, the stagger is a per-child transitionDelay.

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
              className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-[5px] text-[length:var(--fs-3xs)] font-bold uppercase tracking-[var(--ls-caps)]"
              style={{
                background: 'var(--p-subtle)',
                border: '1px solid var(--p-border)',
                color: ACCENT_LIGHT,
              }}
            >
              Featured story
            </span>
          )}

          <p className="mb-1 text-[length:var(--fs-2xs)] font-bold tracking-[var(--ls-heading)] text-[var(--t1)]">
            {story.name}{' '}
            <span className="font-medium text-[var(--t3)]">· {story.meta}</span>
          </p>

          <p className="mb-3 text-[length:var(--fs-3xs)] font-medium leading-[var(--lh-tight)]" style={{ color: ACCENT_LIGHT }}>
            {story.result}
          </p>

          <p className="text-[length:var(--fs-3xs)] italic leading-[var(--lh-body)] text-[var(--t2)]">
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
      {/* NO BADGES. Each card used to carry one or two of our own labels —
          "TSH Improved", "Metabolism Fixed" — printed on top of somebody's
          actual message. The screenshot is evidence; the badge was our reading
          of it, set in marketing type, which is precisely what makes real
          evidence look staged. The heading over this section says "unedited
          screenshots" and the badges argued with it. The header block they
          lived in is gone rather than emptied — an empty container leaves the
          spacing behind. */}

      {/* ── Screenshot ── */}
      <div
        className="relative overflow-hidden mx-3 mt-5"
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

      {/* ── Caption ─────────────────────────────────────────────────────────
          One plain line. The coloured circle with her first initial that used
          to sit beside it was a placeholder pretending to be a portrait — the
          single most recognisable template component there is, and on a page
          whose whole claim is that this is real, a fake avatar is an odd thing
          to put next to a real name. */}
      <div className="px-5 pb-5 pt-4 mt-auto">
        <p className="m-0 text-[length:var(--fs-3xs)] leading-[var(--lh-tight)] pt-3" style={{ borderTop: '1px solid #efe8db', color: '#57514b' }}>
          {card.client}
        </p>
      </div>
    </article>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

/**
 * `hideCta`: the closing SectionCta routes to the FREE booking flow. /decode
 * reuses this proof block but must not hand paid-intent traffic to that flow,
 * so it renders the screenshots without the button. Default false — the home
 * page is unchanged.
 */
export default function WhatsappProofSection({
  hideCta = false,
  limit,
}: { hideCta?: boolean; limit?: number } = {}) {
  // `limit`: /decode shows three screenshots, not eight. Proof works by
  // accumulation up to a point and then stops — a woman deciding on a Rs 299
  // call is convinced by six proof units or she is gone, and the page was
  // carrying twenty-two. Cutting the count is what shortens the page; cutting
  // the ARGUMENT would cost a sale. Default undefined = all of them, so the
  // home page is unchanged.
  const cards = typeof limit === "number" ? ALL_CARDS.slice(0, limit) : ALL_CARDS
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
        <div className="container-default mb-12 text-center">
          <Reveal as="p" className="section-label">
            Unedited screenshots
          </Reveal>
          <Reveal
            as="h2"
            id="whatsapp-proof-heading"
            delay={0.12}
            className="section-title mx-auto text-balance"
            style={{ maxWidth: "20ch" }}
          >
            What they sent afterwards.
          </Reveal>
        </div>

        <p className="container-default mb-10 text-center text-[length:var(--fs-3xs)] leading-[var(--lh-body)]" style={{ color: 'var(--t4)' }}>
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
            {cards.map((card) => (
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
        {cards.length === ALL_CARDS.length && (
          <p
            className="mt-3 text-center text-[length:var(--fs-3xs)] font-semibold uppercase tracking-[var(--ls-caps)]"
            style={{ color: 'var(--t5)' }}
          >
            Swipe to see more ›
          </p>
        )}

        {/* THE single stack CTA — the one conversion point after the whole
            proof stack (moved here from the removed More Than Fat Loss
            section; hero + sticky bar are the other two touchpoints). */}
        <div className="container-default">
          {!hideCta && (
            <SectionCta
              variant="primary"
              className="mx-auto mt-12 max-w-sm"
              buttonClassName=""
              label="Schedule My 1-1 Thyroid Consultation"
              sublabel="₹299 · 60 minutes · one to one"
              ariaLabel="Schedule my 1-1 thyroid fat loss session"
              location="transformations"
            />
          )}
        </div>

      </div>
    </section>
  )
}
