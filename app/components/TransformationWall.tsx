"use client";

import Image from "next/image";

import SectionCta from "./SectionCta";
import { useInView } from "../lib/useInView";

// Wordless transformation wall — the 1080×1920 composites carry the whole
// message (numbers are burned in). No headlines, quotes, ages or cards.
//
// WOMEN ONLY, VERIFIED BY OPENING EVERY IMAGE (not by filename): the brief's
// original list included "Rozal 2.png" and "Nehamia 6.png", but both are MALE
// clients (labelled "Rozal | 29" and "Nehamia | 28" in the composites). This
// page targets Indian women with hypothyroidism, so the wall uses exactly the
// four genuinely female composites and nothing else.
const WALL = [
  "/transformations/Vaidehi 1.png",
  "/transformations/Surekha 3.png",
  "/transformations/Namrata 5.png",
  "/transformations/Heenal 7.png",
] as const;

function WallCell({ src, index }: { src: string; index: number }) {
  const { ref, visible } = useInView(0.08);
  return (
    <div
      ref={ref}
      className="wall-cell relative aspect-[9/16] shrink-0 snap-center overflow-hidden rounded-[var(--r-lg)] border border-[var(--b-soft)] bg-[var(--bg-elevated)] w-[78vw] sm:w-auto"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.55s var(--ease) ${index * 60}ms, transform 0.55s var(--ease) ${index * 60}ms, border-color 260ms var(--ease)`,
      }}
    >
      <Image
        src={src}
        alt="Client before and after transformation"
        fill
        sizes="(max-width:640px) 78vw, (max-width:1024px) 46vw, 340px"
        className="object-cover"
        loading="lazy"
        fetchPriority={index < 2 ? "high" : "auto"}
      />
    </div>
  );
}

export default function TransformationWall() {
  return (
    <section className="section-pad relative bg-[var(--bg-page)] text-white" aria-label="Client transformations">
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        <p className="section-label text-center">Real Clients · Real Results</p>

        {/* Mobile: scroll-snap rail · sm+: grid */}
        <div
          className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4"
          style={{ scrollbarWidth: "none", scrollPaddingInline: "1.25rem" }}
        >
          {WALL.map((src, i) => (
            <WallCell key={src} src={src} index={i} />
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--t5)]">
          Individual results vary. Not a substitute for medical advice.
        </p>

        <SectionCta
          variant="primary"
          className="mx-auto max-w-sm"
          buttonClassName="w-full"
          label="Book My Free Thyroid Session"
          ariaLabel="Book your free private thyroid session"
          location="transformations"
        />
      </div>
    </section>
  );
}
