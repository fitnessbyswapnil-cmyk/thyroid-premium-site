"use client";

import Image from "next/image";
import { useState } from "react";

import { useInView } from "../lib/useInView";

// Results grid — sits directly under PillarsSection because that section ends on
// "one pillar is broken; the consultation finds which one is yours". These cards
// are the receipt for that claim, so they have to follow it.
//
// WOMEN ONLY. Same rule TransformationWall documents, for the same reason: this
// page targets Indian women 30+ with hypothyroidism. Most of what sits unused in
// public/MoreThanFatLossSection is unused *on purpose* — Ajay, Amol, Ashish,
// Nitin and Raghu are all male clients, and putting them here would undo that
// decision. Exactly four female clients exist across both image directories:
// Heenal, Surekha, Vaidehi and Namrata. One card each, no repeats.
//
// SOURCED BY OPENING EVERY IMAGE, NOT BY FILENAME. The filenames are unreliable:
// nitin.png is captioned "Meet Raghu". Every name, city, weight and timeframe
// below is transcribed from the text burned into the composite. Nothing is
// invented; don't edit a line without reopening the image it belongs to.
//
// Surekha has two composites that disagree with each other: her profile card
// (surekha.png) says 12 kg in 60 days, her before/after says 12 kg in 90 days.
// We use the before/after, because 90 days is what TransformationWall already
// shows for her a few sections below and the page must not contradict itself.
type ResultCard = {
  src: string;
  name: string;
  role: string;
  stat: string;
  detail: string;
  alt: string;
};

const RESULTS: ResultCard[] = [
  {
    src: "/MoreThanFatLossSection/heenal.png",
    name: "Heenal",
    role: "IT professional, Bangalore",
    stat: "15 kg in 90 days",
    detail: "Desk-job fatigue, meal timing and hormonal imbalance. All three addressed together.",
    alt: "Heenal, IT professional from Bangalore: 15 kg lost in 90 days, hormones balanced and more productivity",
  },
  {
    src: "/MoreThanFatLossSection/Surekha 3.png",
    name: "Surekha",
    role: "Homemaker, Nashik, age 36",
    stat: "78 kg to 66 kg",
    detail: "Lost 12 kg in 90 days. TSH and bloating both improved.",
    alt: "Surekha, age 36, before and after: 78 kg down to 66 kg, 12 kg lost in 90 days",
  },
  {
    src: "/transformations/Vaidehi 1.png",
    name: "Vaidehi",
    role: "90-day program",
    stat: "72 kg to 60 kg",
    detail: "Balanced her thyroid naturally, 12 kg down over 90 days.",
    alt: "Vaidehi, before and after: 72 kg down to 60 kg, 12 kg lost in 90 days",
  },
  {
    src: "/transformations/Namrata 5.png",
    name: "Namrata",
    role: "90-day program",
    stat: "16 kg in 90 days",
    detail: "16 kg down, and the all-day tiredness went with it.",
    alt: "Namrata, before and after: 16 kg lost in 90 days",
  },
];

const INITIAL_COUNT = 6;

function ResultCell({ card, index }: { card: ResultCard; index: number }) {
  const { ref, visible } = useInView(0.08);

  return (
    <figure
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        // Stagger by column position so a row settles left-to-right rather than
        // the whole grid arriving at once.
        transition: `opacity 0.55s var(--ease) ${(index % 3) * 70}ms, transform 0.55s var(--ease) ${(index % 3) * 70}ms`,
      }}
    >
      <div className="relative overflow-hidden rounded-[var(--r-lg)] border border-[var(--b-soft)] bg-[var(--bg-elevated)]">
        {/* These composites carry burned-in text (weights, panels, captions), so
            object-contain is mandatory: object-cover would crop the numbers off
            and leave an unreadable, unverifiable claim on screen. */}
        <Image
          src={card.src}
          alt={card.alt}
          width={1080}
          height={1920}
          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 340px"
          loading="lazy"
          className="h-auto w-full object-contain"
        />
      </div>

      <figcaption className="mt-2.5 px-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-[var(--t2)]">{card.name}</span>
          <span className="rounded-full border border-[var(--p-border)] bg-[var(--p-tint)] px-2.5 py-[3px] text-[10.5px] font-bold tracking-[0.04em] text-[var(--p300)]">
            {card.stat}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-[var(--t4)]">{card.role}</p>
        <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--t2)]">{card.detail}</p>
      </figcaption>
    </figure>
  );
}

export default function ResultsGrid() {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? RESULTS : RESULTS.slice(0, INITIAL_COUNT);
  const remaining = RESULTS.length - INITIAL_COUNT;

  return (
    <section
      className="cv-auto section-pad relative bg-[var(--bg-page)]"
      aria-labelledby="results-grid-heading"
    >
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        <header className="section-header">
          <p className="section-label">Client Results</p>
          <h2
            id="results-grid-heading"
            className="section-title mx-auto text-balance"
            style={{ maxWidth: "24ch" }}
          >
            What it looks like when the right pillar gets fixed.
          </h2>
        </header>

        <div
          id="results-grid-items"
          className="mx-auto grid max-w-[1080px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {shown.map((card, i) => (
            <ResultCell key={card.src} card={card} index={i} />
          ))}
        </div>

        {remaining > 0 && !expanded ? (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="btn-ghost"
              style={{ maxWidth: "min(100%, 22rem)" }}
              aria-expanded={false}
              aria-controls="results-grid-items"
            >
              <span className="cta-label">See more results</span>
              <span className="cta-sub">{remaining} more client stories</span>
            </button>
          </div>
        ) : null}

        <p className="mt-6 text-center text-[11px] text-[var(--t5)]">
          Individual results vary. Not a substitute for medical advice.
        </p>
      </div>
    </section>
  );
}
