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
const WALL = [
  {
    src: "/transformations/Vaidehi 1.png",
    name: "Vaidehi",
    stat: "−12 kg · 90 days",
    alt: "Vaidehi, before and after — lost 12 kg in 90 days",
  },
  {
    src: "/transformations/Surekha 3.png",
    name: "Surekha",
    stat: "−12 kg · 90 days",
    alt: "Surekha, before and after — lost 12 kg in 90 days",
  },
  {
    src: "/transformations/Namrata 5.png",
    name: "Namrata",
    stat: "−16 kg · 90 days",
    alt: "Namrata, before and after — lost 16 kg in 90 days",
  },
  {
    src: "/transformations/Heenal 7.png",
    name: "Heenal",
    stat: "−15 kg · 90 days",
    alt: "Heenal, before and after — lost 15 kg in 90 days",
  },
] as const;

type WallEntry = (typeof WALL)[number];

function WallCell({ entry, index }: { entry: WallEntry; index: number }) {
  const { ref, visible } = useInView(0.08);
  return (
    <figure
      ref={ref}
      className="wall-cell w-[78vw] shrink-0 snap-center sm:w-auto"
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
      {/* Caption anatomy: name + stat chip. Stats mirror the numbers burned
          into the composite above — keep them in sync. */}
      <figcaption className="mt-2.5 flex items-center justify-between gap-2 px-1">
        <span className="text-[13px] font-semibold text-[var(--t2)]">{entry.name}</span>
        <span className="rounded-full border border-[var(--p-border)] bg-[var(--p-tint)] px-2.5 py-[3px] text-[10.5px] font-bold tracking-[0.04em] text-[var(--p300)]">
          {entry.stat}
        </span>
      </figcaption>
    </figure>
  );
}

export default function TransformationWall() {
  return (
    <section
      className="cv-auto section-pad relative bg-[var(--bg-page)] text-white"
      aria-labelledby="transformations-heading"
    >
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        {/* Real H2 (was an eyebrow-only <p>) — SEO + screen-reader landmark */}
        <h2 id="transformations-heading" className="section-label text-center">
          Real Clients · Real Results
        </h2>

        {/* Mobile: scroll-snap rail · sm+: grid */}
        <div
          className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4"
          style={{ scrollbarWidth: "none", scrollPaddingInline: "1.25rem" }}
        >
          {WALL.map((entry, i) => (
            <WallCell key={entry.src} entry={entry} index={i} />
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--t5)]">
          Individual results vary. Not a substitute for medical advice.
        </p>
      </div>
    </section>
  );
}
