"use client";

import Image from "next/image";

import { useInView } from "../lib/useInView";

// Transformation wall — DESIGN 1B, "case records, stacked rows".
//
// Replaced a 2x2 grid of cards. The grid asked a visitor to compare four
// things at once and gave her no way in; a record does the opposite — it is
// read one at a time, top to bottom, and each one is a small argument with the
// evidence on the left and the reading of it on the right. It also suits what
// this actually is: a clinical file, not a gallery.
//
// The 1080x1920 composites carry the visual message (Before/After labels and
// numbers are burned into the artwork). The mock this was built from had
// SEPARATE before and after slots; ours are single composites that already
// contain both, so each record shows one image rather than a pair. The yellow
// rule under it is the mock's "after" accent, kept as the record's own edge.
//
// EVERY NUMBER AND NAME ON THIS PAGE IS REAL. The design mock arrived carrying
// invented clients — "Rajya Lakshmi, Hyderabad", TSH 8.0 → 1.0, blood sugar
// back in range — and none of it shipped. What is below is transcribed from
// the composites and from captions already published on this site. The house
// rule is absolute: never invent a client name, weight, timeframe, occupation
// or marker.
//
// WOMEN ONLY, VERIFIED BY OPENING EVERY IMAGE (not by filename): the brief's
// original list included "Rozal 2.png" and "Nehamia 6.png", but both are MALE
// clients (labelled "Rozal | 29" and "Nehamia | 28" in the composites). This
// page targets Indian women with hypothyroidism, so the wall uses exactly the
// four genuinely female composites and nothing else.
//
// `story` is composed ONLY from facts already published elsewhere on this
// site: Vaidehi's composite text ("balanced her thyroid naturally"), Surekha's
// and Heenal's featured cards in the WhatsApp-proof section, Namrata's fatigue
// result from her proof card.
//
// `metrics` is the bordered strip from the mock. Only cells we can evidence
// exist: weight and duration come off the composites, and the third cell is
// the symptom the client's own published card names. There is no TSH cell,
// because we do not hold TSH numbers for these four.
const WALL = [
  {
    src: "/transformations/Vaidehi 1.png",
    name: "Vaidehi",
    tag: "72 kg → 60 kg",
    kg: "12 kg",
    metrics: [
      { label: "Weight", value: "−12 kg" },
      { label: "Duration", value: "90 days" },
      { label: "Thyroid", value: "Balanced naturally" },
    ],
    story: "Balanced her thyroid naturally. Down from 72 kg to 60 kg.",
    alt: "Vaidehi, before and after, lost 12 kg in 90 days",
  },
  {
    src: "/transformations/Surekha 3.png",
    name: "Surekha",
    tag: "Bloating & fatigue",
    kg: "12 kg",
    metrics: [
      { label: "Weight", value: "−12 kg" },
      { label: "Duration", value: "90 days" },
      { label: "Symptoms", value: "Bloating gone" },
    ],
    story: "Bloating and afternoon fatigue, gone.",
    alt: "Surekha, before and after, lost 12 kg in 90 days",
  },
  {
    src: "/transformations/Namrata 5.png",
    name: "Namrata",
    tag: "Constant tiredness",
    kg: "16 kg",
    metrics: [
      { label: "Weight", value: "−16 kg" },
      { label: "Duration", value: "90 days" },
      { label: "Energy", value: "Tiredness gone" },
    ],
    story: "16 kg down, and the all-day tiredness went with it.",
    alt: "Namrata, before and after, lost 16 kg in 90 days",
  },
  {
    src: "/transformations/Heenal 7.png",
    name: "Heenal",
    tag: "IT professional · Bengaluru",
    kg: "15 kg",
    metrics: [
      { label: "Weight", value: "−15 kg" },
      { label: "Duration", value: "90 days" },
      { label: "Blocker", value: "Found in Pillar 1" },
    ],
    story: "IT professional, Bengaluru. Her blocker was in Pillar 1. The root, not her diet.",
    alt: "Heenal, before and after, lost 15 kg in 90 days",
  },
] as const;

type WallEntry = (typeof WALL)[number];

// Spelled out because the heading is a sentence, not a stat. Falls back to the
// digits past nine, which the wall will never reach — but a wrong word in a
// heading is worse than a digit.
const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const COUNT_WORD = NUMBER_WORDS[WALL.length] ?? String(WALL.length);

/** "01", "02" … The record number is part of the file conceit, and it is also
 *  the only thing telling a reader how far through the set she is. */
const recordNo = (i: number) => String(i + 1).padStart(2, "0");

function Record({ entry, index }: { entry: WallEntry; index: number }) {
  const { ref, visible } = useInView(0.08);
  const first = index === 0;
  return (
    <article
      ref={ref}
      className="record grid grid-cols-1 gap-7 py-8 md:grid-cols-[300px_minmax(0,1fr)] md:gap-10 md:py-9"
      style={{
        // The first record takes the heavy rule; the rest are hairlines, so
        // the set reads as one table rather than four stacked boxes.
        borderTop: first ? "2px solid var(--t1)" : "1px solid var(--border-hairline)",
        borderBottom: index === WALL.length - 1 ? "1px solid var(--border-hairline)" : undefined,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.55s var(--ease) ${index * 60}ms, transform 0.55s var(--ease) ${index * 60}ms`,
      }}
    >
      {/* Evidence. The composite carries its own Before/After labels, so none
          are drawn over it — two sets would collide. */}
      <figure className="m-0">
        <div
          className="relative aspect-[9/16] w-full overflow-hidden"
          style={{ borderBottom: "4px solid var(--accent-yellow)" }}
        >
          <Image
            src={entry.src}
            alt={entry.alt}
            fill
            sizes="(max-width: 767px) 100vw, 300px"
            className="object-cover"
          />
        </div>
        <figcaption className="record-label mt-2">Before and after · 90 days</figcaption>
      </figure>

      {/* The reading of it. */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="record-label">Record {recordNo(index)}</span>
          <span className="record-label">{entry.tag}</span>
        </div>

        <h3 className="mb-0 mt-2.5 text-[length:var(--fs-xl)] font-bold leading-[var(--lh-heading)] tracking-[var(--ls-heading)] text-[var(--t1)]">
          {entry.name}
        </h3>
        <p className="mb-0 mt-1 text-[length:var(--fs-sm)] leading-[var(--lh-body)] text-[var(--t2)]">
          Lost {entry.kg} in 90 days despite hypothyroidism
        </p>

        {/* The metric strip. One border, cells divided by hairlines — the
            numbers are tabular so they sit on the same rhythm across records
            rather than each one shuffling to its own width. */}
        <dl
          className="m-0 mt-5 grid grid-cols-3"
          style={{ border: "1px solid var(--border-hairline)" }}
        >
          {entry.metrics.map((m, i) => (
            <div
              key={m.label}
              className="px-3 py-3.5 md:px-4"
              style={{
                borderRight:
                  i < entry.metrics.length - 1 ? "1px solid var(--border-hairline)" : undefined,
              }}
            >
              <dt className="record-label">{m.label}</dt>
              <dd className="record-metric m-0 mt-1.5 text-[length:var(--fs-lg)] font-bold leading-[var(--lh-heading)] tracking-[var(--ls-heading)] text-[var(--t1)]">
                {m.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mb-0 mt-4 text-[length:var(--fs-sm)] leading-[var(--lh-body)] text-[var(--t2)]">
          {entry.story}
        </p>
      </div>
    </article>
  );
}

export default function TransformationWall() {
  return (
    <section
      className="cv-auto section-pad-tight relative bg-[var(--bg-elevated)]"
      aria-labelledby="transformations-heading"
    >
      <div className="container-default relative z-10">
        {/* File header: a label, a rule, and the claim. */}
        <div className="flex items-baseline gap-4">
          <p className="record-label m-0 whitespace-nowrap">
            Client records &nbsp;01&ndash;{recordNo(WALL.length - 1)}
          </p>
          <span aria-hidden="true" className="h-px flex-1" style={{ background: "var(--border-hairline)" }} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-end md:gap-10">
          {/* The count is DERIVED. This heading read "Real women. Real
              reports. Real results." — the most templated construction in the
              category, and near-identical to the WhatsApp heading two sections
              down. Naming the number is the opposite move: a specific,
              checkable claim about what is directly below it, which means it
              has to change when the wall does. */}
          <h2
            id="transformations-heading"
            className="m-0 text-[length:var(--fs-2xl)] font-bold leading-[var(--lh-display)] tracking-[var(--ls-display)] text-[var(--t1)]"
          >
            {COUNT_WORD} women. {COUNT_WORD} reports.
          </h2>
          <p className="m-0 text-[length:var(--fs-sm)] leading-[var(--lh-body)] text-[var(--t2)] md:pb-1.5">
            Each of these started with the blood report and the symptom pattern.
            The diet was built afterwards, around the blocker. 100+ Indian women
            with hypothyroidism coached, one to one.
          </p>
        </div>

        <div className="mt-9 flex flex-col">
          {WALL.map((entry, i) => (
            <Record key={entry.src} entry={entry} index={i} />
          ))}
        </div>

        <p className="mt-6 text-[length:var(--fs-3xs)] leading-[var(--lh-tight)] text-[var(--t5)]">
          Individual results vary. Not a substitute for medical advice.
        </p>
      </div>
    </section>
  );
}
