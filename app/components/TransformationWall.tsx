"use client";

import Image from "next/image";

import { useInView } from "../lib/useInView";

// Transformation wall — the 1080×1920 composites carry the visual message
// (Before/After labels and numbers are burned into the artwork), and each
// card now carries its own caption anatomy (name + stat) for the DOM/SEO/
// screen-reader layer the composites can't provide.
//
// WOMEN ONLY, VERIFIED BY OPENING EVERY IMAGE (not by filename): the brief's
// original list included "Rozal 2.png" and "Nehamia 6.png", but both are MALE
// clients (labelled "Rozal | 29" and "Nehamia | 28" in the composites). This
// page targets Indian women with hypothyroidism, so the wall uses exactly the
// four genuinely female composites and nothing else.
//
// Names + stats below are transcribed from the numbers burned into each
// composite — NOT invented. Don't edit one without the other.
//
// `story`/`quote` are composed ONLY from facts already published elsewhere
// on this site: Vaidehi's composite text ("balanced her thyroid naturally"),
// Surekha's and Heenal's featured cards in the WhatsApp-proof section
// (their real quotes), Namrata's fatigue result from her proof card. No
// per-client details are invented — quotes appear only where a real quote
// exists in the site's own data.
const WALL = [
  {
    src: "/transformations/Vaidehi 1.png",
    name: "Vaidehi",
    stat: "−12 kg · 90 days",
    story: "Balanced her thyroid naturally. Down from 72 kg to 60 kg.",
    quote: "",
    alt: "Vaidehi, before and after, lost 12 kg in 90 days",
  },
  {
    src: "/transformations/Surekha 3.png",
    name: "Surekha",
    stat: "−12 kg · 90 days",
    story: "Bloating and afternoon fatigue, gone.",
    quote: "My clothes fit again. I finally feel like myself.",
    alt: "Surekha, before and after, lost 12 kg in 90 days",
  },
  {
    src: "/transformations/Namrata 5.png",
    name: "Namrata",
    stat: "−16 kg · 90 days",
    story: "16 kg down, and the all-day tiredness went with it.",
    quote: "",
    alt: "Namrata, before and after, lost 16 kg in 90 days",
  },
  {
    src: "/transformations/Heenal 7.png",
    name: "Heenal",
    stat: "−15 kg · 90 days",
    story: "IT professional, Bengaluru. Her blocker was in Pillar 1. The root, not her diet.",
    quote: "Finally lost the weight thyroid stole from me for 4 years.",
    alt: "Heenal, before and after, lost 15 kg in 90 days",
  },
] as const;

type WallEntry = (typeof WALL)[number];

function WallCell({ entry, index }: { entry: WallEntry; index: number }) {
  const { ref, visible } = useInView(0.08);
  return (
    <figure
      ref={ref}
      className="wall-cell"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.55s var(--ease) ${index * 60}ms, transform 0.55s var(--ease) ${index * 60}ms`,
      }}
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-[var(--r-lg)] border border-[var(--b-soft)] bg-[var(--bg-elevated)]">
        <Image
          src={entry.src}
          alt={entry.alt}
          fill
          sizes="(max-width:640px) 78vw, (max-width:1024px) 46vw, 340px"
          className="object-cover"
          loading="lazy"
          fetchPriority={index < 2 ? "high" : "auto"}
        />
      </div>
      {/* Caption anatomy: name + stat chip, then the story line — her
          highlighted result in coral, her own words (where a real quote
          exists) as a small teal serif quote. */}
      <figcaption className="mt-2.5 px-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[length:var(--text-xs)] font-semibold text-[var(--t2)]">{entry.name}</span>
          <span className="rounded-full border border-[var(--p-border)] bg-[var(--p-tint)] px-2.5 py-[3px] text-[length:var(--text-2xs)] font-bold tracking-[0.04em] text-[var(--p300)]">
            {entry.stat}
          </span>
        </div>
        <p className="mt-1.5 text-[length:var(--text-xs)] font-semibold leading-[1.5] text-[var(--t2)]">
          {entry.story}
        </p>
        {entry.quote ? (
          <p
            className="mt-1 text-[length:var(--text-xs)] italic leading-[1.55] text-[var(--p300)]"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            &ldquo;{entry.quote}&rdquo;
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}

export default function TransformationWall() {
  return (
    <section
      className="cv-auto section-pad-tight relative bg-[var(--bg-elevated)]"
      aria-labelledby="transformations-heading"
    >
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        {/* Direct claim as the title; every number is verified by the
            composites below it. */}
        <header className="section-header">
          <p className="section-label">Real Clients · Real Results</p>
          <h2
            id="transformations-heading"
            className="section-title mx-auto text-balance"
            style={{ maxWidth: "22ch" }}
          >
            Real women. 12&ndash;16 kg down in 90 days.
          </h2>
          <p className="mx-auto mt-3 max-w-[34ch] text-center text-[length:var(--text-sm)] leading-[1.6] text-[var(--t3)]">
            100+ Indian women with hypothyroidism coached, one to one.
          </p>
        </header>

        {/* Grid at every breakpoint — never a rail.
            This was a horizontal scroll-snap rail on mobile, which showed ~1.3
            of the four cards to the ~80% of traffic that is mobile and hid the
            rest behind a sideways swipe most people never discover. Proof only
            works by accumulation: one before/after is an anecdote, four seen
            together are a pattern, so all four must sit in the vertical scroll
            path. 2-up rather than 1-up on mobile because these are 9:16
            portraits — stacked full-width they would run ~2,700px and get
            abandoned, while 2x2 puts the whole wall on roughly one screen. */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {WALL.map((entry, i) => (
            <WallCell key={entry.src} entry={entry} index={i} />
          ))}
        </div>

        <p className="mt-6 text-center text-[length:var(--text-2xs)] text-[var(--t5)]">
          Individual results vary. Not a substitute for medical advice.
        </p>
      </div>
    </section>
  );
}
