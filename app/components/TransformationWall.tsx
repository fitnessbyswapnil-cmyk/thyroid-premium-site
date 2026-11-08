"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

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
// `before` / `after` are CROPS of the composite in `src`, not new photographs.
// Every composite is the same 1080x1920 template: red/green weight chips at
// the top, the two photographs clean in the middle, then her name, age and a
// claim set in a brand name this site no longer uses. The middle band is the
// only part worth showing, so it is cut out and the card is rebuilt in HTML.
//
// That buys four things at once. The white ground stops cutting a bright
// rectangle into a near-black page, because there is no longer a white ground.
// The claim becomes live text that can be corrected without a design tool.
// The old artwork's "T.H.Y.R.O.I.D. Lean Method" stops contradicting the
// method name used everywhere else on the site. And the proof images go from
// 5.6 MB to 608 KB, on traffic that is 82% mobile.
//
// `src` stays, and is now the ZOOM target: tapping a card opens the original
// composite, chips, name, age and all. The clean card makes the claim; the
// untouched original corroborates it.
//
// `from` / `to` are read off those same chips and are published facts, not new
// ones: 72 -> 60, 78 -> 66, 84 -> 68, 82 -> 67. Each one's difference equals
// the `kg` value that was already here, which is the check that they were read
// correctly. They also retire the `claim` field: every card now leads with its
// own two numbers, so no two cards can print the same sentence again.
//
// `condition` is the phrase the headline ends on, set on a yellow highlight.
// Yellow, not the competitor's red: red is this page's button colour, and the
// moment red appears as display type every red button stops reading as a
// button.
const WALL = [
  {
    src: "/transformations/Vaidehi 1.png",
    before: "/transformations/cards/vaidehi-before.jpg",
    after: "/transformations/cards/vaidehi-after.jpg",
    name: "Vaidehi",
    occupation: "",
    condition: "Hypothyroidism",
    from: "72 kg",
    to: "60 kg",
    kg: "12 kg",
    story: "Balanced her thyroid naturally.",
    alt: "Vaidehi, before and after, lost 12 kg in 90 days",
  },
  {
    src: "/transformations/Surekha 3.png",
    before: "/transformations/cards/surekha-before.jpg",
    after: "/transformations/cards/surekha-after.jpg",
    name: "Surekha",
    occupation: "",
    condition: "Hypothyroidism",
    from: "78 kg",
    to: "66 kg",
    kg: "12 kg",
    story: "Bloating and afternoon fatigue, gone.",
    alt: "Surekha, before and after, lost 12 kg in 90 days",
  },
  {
    src: "/transformations/Namrata 5.png",
    before: "/transformations/cards/namrata-before.jpg",
    after: "/transformations/cards/namrata-after.jpg",
    name: "Namrata",
    occupation: "",
    condition: "Hypothyroidism",
    from: "84 kg",
    to: "68 kg",
    kg: "16 kg",
    story: "The all-day tiredness went with it.",
    alt: "Namrata, before and after, lost 16 kg in 90 days",
  },
  {
    src: "/transformations/Heenal 7.png",
    before: "/transformations/cards/heenal-before.jpg",
    after: "/transformations/cards/heenal-after.jpg",
    name: "Heenal",
    occupation: "IT Professional",
    condition: "Hypothyroidism",
    from: "82 kg",
    to: "67 kg",
    kg: "15 kg",
    story: "Her blocker was in Pillar 1. The root, not her diet.",
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
  // Clarity, 14 days to 21-Sep: on /decode mobile both dead-click leaders were
  // these images (4 taps each, 53% of all dead taps between them) and four of
  // the top ten taps on the whole page were non-interactive photos. Women expect
  // a before/after composite to open. It now does.
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

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
      {/* PHOTOS FIRST. The claim used to lead and the picture followed, which
          is the order a document uses, not the order a proof card is read in:
          the eye goes to the face either way, so putting type above it only
          delays the thing being looked at. Tapping opens the untouched
          original composite — Clarity, 14 days to 21-Sep: these images were
          both dead-click leaders on mobile, 53% of all dead taps between them,
          because women expect a before/after to open. */}
      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label={`View the original photo for ${entry.name}`}
        className="block w-full border-0 p-0"
        style={{ background: "transparent", cursor: "zoom-in" }}
      >
        <span className="grid grid-cols-2 gap-px">
          {([["before", entry.before, entry.from], ["after", entry.after, entry.to]] as const).map(
            ([side, img, weight]) => (
              <span key={side} className="block">
                {/* FULL-WIDTH BAND, ABOVE THE PHOTO, CARRYING THE WEIGHT — the
                    shape the burned-in artwork used, rebuilt in CSS. It first
                    came back as a small chip in the photo's corner saying only
                    "Before", which lost the two things the original band had:
                    it was the full width of the photo, so it could not be
                    missed, and it carried the NUMBER, so the eye found it
                    where it already was instead of dropping to another line.

                    Red to green is kept. The rule this page runs on is that
                    the button's colour may not be spent on type, and that
                    holds — but here red and green are not decoration, they are
                    the two ends of a scale, and they sit inside a photo frame
                    with the word "Before" on them. Nothing about that reads as
                    something to press. The red is #b3261e, deeper than the
                    button's #dc3434 on purpose, so the two are not the same
                    red at a glance. */}
                <span className={`wall-band wall-band-${side}`}>
                  {side === "before" ? "Before" : "After"}: {weight}
                </span>
                <span className="relative block aspect-[501/789] overflow-hidden">
                  <Image
                    src={img}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 17vw"
                    className="object-cover"
                  />
                </span>
              </span>
            ),
          )}
        </span>
      </button>

      <figcaption className="px-5 pb-6 pt-5 sm:px-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="m-0 text-[length:var(--fs-base)] font-bold leading-[var(--lh-heading)] tracking-[var(--ls-heading)] text-[var(--t1)]">
            {entry.name}
          </h3>
          {entry.occupation ? <span className="proof-tag">{entry.occupation}</span> : null}
        </div>

        {/* The two numbers, and they are the card. "Lost 12 Kg" was the same
            sentence on two cards until one of them was given its range; giving
            every card its own pair means no two can ever collide again, and a
            range is the more concrete claim in any case. Both numbers are off
            the original artwork's own chips. */}
        <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <span className="wall-figure">
            {entry.from} &rarr; {entry.to}
          </span>
          <span className="wall-delta">&minus;{entry.kg}</span>
        </p>

        <p className="mt-3 text-[length:var(--fs-xs)] leading-[var(--lh-body)] text-[var(--t2)]">
          In 90 days, despite <span className="proof-cond">{entry.condition}</span>
        </p>

        <p className="mt-2 text-[length:var(--fs-xs)] leading-[var(--lh-body)] text-[var(--t2)]">
          {entry.story}
        </p>
      </figcaption>

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${entry.name}: full photo`}
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)" }}
        >
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label="Close photo"
            className="absolute right-3 top-3 rounded-full px-4 py-2 text-[length:var(--fs-2xs)] font-bold"
            style={{ background: "rgba(255,255,255,0.14)", color: "#fff", minHeight: 44, minWidth: 44 }}
          >
            Close
          </button>
          <span className="relative block h-full w-full" style={{ maxWidth: 520 }}>
            <Image src={entry.src} alt={entry.alt} fill sizes="100vw" className="object-contain" />
          </span>
        </div>
      )}
    </figure>
  );
}

/** `compact`: drops the line under the heading (the 100+ claim, already in the
 *  /decode hero). The cards and their words are never touched. Default off. */
export default function TransformationWall({ compact = false }: { compact?: boolean } = {}) {
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
          {/* Shown in compact mode too, deliberately. Every card headline carries
              a kilogram figure and a 90-day timeframe, and Meta's Health and
              Wellness standard allows a specific outcome in a set timeframe only
              with a disclaimer or qualifier attached. This is that qualifier, and
              it has to stay wherever these cards render. */}
          <p className="mx-auto mt-3 max-w-[var(--measure-caption)] text-center text-[length:var(--fs-3xs)] leading-[var(--lh-body)] text-[var(--t3)]">
            Each card is one client&apos;s own outcome, not a typical result.
          </p>
          {!compact && (
            <p className="mx-auto mt-3 max-w-[var(--measure-caption)] text-center text-[length:var(--fs-xs)] leading-[var(--lh-body)] text-[var(--t3)]">
              100+ Indian women with hypothyroidism coached, one to one.
            </p>
          )}
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

        {/* The second disclaimer that used to sit here — "Individual results
            vary. Not a substitute for medical advice." — went on 08-Nov-2026.
            It was word-for-word the page's own closing line, two screens
            apart, and the qualifier above already covers these cards where
            their claims actually are. Six of these had accumulated across the
            page; two remain, which is the point. */}
      </div>
    </section>
  );
}
