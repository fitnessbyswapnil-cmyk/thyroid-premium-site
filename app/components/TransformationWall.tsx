"use client";

import Image from "next/image";

import { useInView } from "../lib/useInView";

// Transformation wall — the owner's chosen card design (13-Sep), taken from a
// competitor page he sent: white card, occupation pill, a Title Case claim
// headline, one line of detail, then the before/after image.
//
// It replaced the stacked "case records" layout from the morning. The card
// version wins on one thing that matters more than elegance here: the claim is
// the first thing read on every card, at the same size, in the same place —
// so four cards scan as four claims, not four documents.
//
// The 1080x1920 composites carry the visual message: the red "Before: 72 kg"
// and green "After: 60 kg" chips are burned INTO the artwork, which is why no
// labels are drawn over them here. Two sets would collide. (Those green
// chips are also the one sanctioned use of green on this page — an "After"
// label is green because green means after, not because green is decorative.)
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
// `occupation` is the ALL-CAPS pill at the top of the card. The competitor
// page has one on every card — ENTREPRENEUR, WORKING PROFESSIONAL, MANAGER.
// We have ONE, because only one of these four occupations is actually known:
// Heenal's caption already said "IT professional". The rest ship with no pill
// until the owner confirms theirs. A missing pill is a gap; an invented one is
// a lie about a real person, and this page's entire claim is that it is real.
//
// `condition` is the phrase the headline ends on, set on a yellow highlight.
// Yellow, not the competitor's red: red is this page's button colour, and the
// moment red appears as display type every red button stops reading as a
// button.
const WALL = [
  {
    src: "/transformations/Vaidehi 1.png",
    name: "Vaidehi",
    occupation: "",
    condition: "Hypothyroidism",
    tag: "72 kg → 60 kg",
    kg: "12 kg",
    story: "Balanced her thyroid naturally. Down from 72 kg to 60 kg.",
    alt: "Vaidehi, before and after, lost 12 kg in 90 days",
  },
  {
    src: "/transformations/Surekha 3.png",
    name: "Surekha",
    occupation: "",
    condition: "Hypothyroidism",
    tag: "Bloating & fatigue",
    kg: "12 kg",
    story: "Bloating and afternoon fatigue, gone.",
    alt: "Surekha, before and after, lost 12 kg in 90 days",
  },
  {
    src: "/transformations/Namrata 5.png",
    name: "Namrata",
    occupation: "",
    condition: "Hypothyroidism",
    tag: "Constant tiredness",
    kg: "16 kg",
    story: "16 kg down, and the all-day tiredness went with it.",
    alt: "Namrata, before and after, lost 16 kg in 90 days",
  },
  {
    src: "/transformations/Heenal 7.png",
    name: "Heenal",
    occupation: "IT Professional",
    condition: "Hypothyroidism",
    tag: "IT professional · Bengaluru",
    kg: "15 kg",
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

function Card({ entry, index }: { entry: WallEntry; index: number }) {
  const { ref, visible } = useInView(0.08);
  return (
    <figure
      ref={ref}
      className="proof-card m-0 flex flex-col overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.55s var(--ease) ${index * 60}ms, transform 0.55s var(--ease) ${index * 60}ms`,
      }}
    >
      <figcaption className="px-5 pb-1 pt-6 text-center sm:px-6">
        {entry.occupation ? (
          <span className="proof-tag">{entry.occupation}</span>
        ) : null}

        {/* The claim, first and biggest. Title Case, because this is the one
            line a visitor reads on every card and sentence case makes it read
            as a note rather than a result. */}
        <h3
          className={`mx-auto max-w-[var(--measure-caption)] text-[length:var(--fs-lg)] font-bold leading-[var(--lh-heading)] tracking-[var(--ls-heading)] text-[var(--t1)] ${
            entry.occupation ? "mt-4" : "mt-0"
          }`}
        >
          {/* `kg` is stored lowercase because it is also read into the alt
              text, where "12 Kg" would be wrong. Title Case is a property of
              this headline, not of the data. */}
          Lost {entry.kg.replace(" kg", " Kg")} In 90 Days Despite{" "}
          <span className="proof-cond">{entry.condition}</span>
        </h3>

        <p className="mx-auto mb-0 mt-3 max-w-[var(--measure-caption)] text-[length:var(--fs-xs)] leading-[var(--lh-body)] text-[var(--t2)]">
          {entry.name} &mdash; {entry.story}
        </p>
      </figcaption>

      {/* The composites already carry their own red Before / green After chips
          burned in, so none are drawn over them — two sets would collide. */}
      <div className="relative mt-5 aspect-[9/16] overflow-hidden">
        <Image
          src={entry.src}
          alt={entry.alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
      </div>
    </figure>
  );
}

export default function TransformationWall() {
  return (
    <section
      className="cv-auto section-pad-tight relative bg-[var(--bg-elevated)]"
      aria-labelledby="transformations-heading"
    >
      <div className="container-default relative z-10">
        <header className="section-header">
          <p className="section-label">The Proof</p>
          {/* The count is DERIVED. This heading read "Real women. Real
              reports. Real results." — the most templated construction in the
              category, and near-identical to the WhatsApp heading two sections
              down. Naming the number is the opposite move: a specific,
              checkable claim about what is directly below it, which means it
              has to change when the wall does. */}
          <h2
            id="transformations-heading"
            className="section-title mx-auto text-balance"
            style={{ maxWidth: "22ch" }}
          >
            {COUNT_WORD} Women. {COUNT_WORD} Reports.
          </h2>
          <p className="mx-auto mt-3 max-w-[var(--measure-caption)] text-center text-[length:var(--fs-xs)] leading-[var(--lh-body)] text-[var(--t3)]">
            100+ Indian women with hypothyroidism coached, one to one.
          </p>
        </header>

        {/* Grid at every breakpoint — never a rail. This was a horizontal
            scroll-snap rail on mobile, which showed ~1.3 of the cards to the
            ~80% of traffic that is mobile and hid the rest behind a sideways
            swipe most people never discover. Proof only works by accumulation:
            one before/after is an anecdote, four seen together are a pattern,
            so all four must sit in the vertical scroll path. */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">
          {WALL.map((entry, i) => (
            <Card key={entry.src} entry={entry} index={i} />
          ))}
        </div>

        <p className="mt-6 text-center text-[length:var(--fs-3xs)] leading-[var(--lh-tight)] text-[var(--t5)]">
          Individual results vary. Not a substitute for medical advice.
        </p>
      </div>
    </section>
  );
}
