"use client";

import Image from "next/image";

import {
  CERTIFICATIONS,
  COACH_IMAGE,
  COACH_NAME,
} from "../lib/authority";
import { useScarcity } from "../context/ScarcityProvider";
import SectionCta from "./SectionCta";
import ScarcityBadge from "./ScarcityBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionOutcome {
  icon: string;
  text: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
//
// Design intent: replace the SaaS-style "includes" checklist with 3 specific
// *outcome* chips. The distinction matters psychologically:
//
//   Features list  →  reactivates Neocortex evaluation ("do I need all this?")
//   Outcome chips  →  speak to Limbic desire ("that's exactly what I want")
//
// Each outcome is phrased as what the visitor *experiences*, not what she
// receives. This is the difference between "Indian nutrition plan" (feature)
// and "know exactly what to eat — without giving up your food" (desire).
//
// Three chips only. Brevity signals confidence.

const SESSION_OUTCOMES: SessionOutcome[] = [
  {
    icon: "→",
    text: "Leave with a plan — not more confusion",
  },
  {
    icon: "→",
    text: "Understand why nothing worked before",
  },
  {
    icon: "→",
    text: "Know your next 30 days, step by step",
  },
];

// Short cert labels for the coach card — pulled from authority constants
const certChips = CERTIFICATIONS.map((c) => c.short);

// ─── Guarantee seal — replaces the 3-chip "objections row" ───────────────────
//
// "₹299 consultation · Qualified intake · No obligation" had two problems:
//   1. "Qualified intake" is insider jargon — creates ambiguity ("do I need
//      to qualify?") right before the purchase moment.
//   2. Three micro-chips of equal weight compete with each other and land
//      with less force than a single clean sentence.
//
// A single guarantee sentence does more psychological work: it names the risk
// (the money), removes it (full refund), and names the benefit (clarity) — all
// in one breath. This is the Framework's "Consequence of NOT acting" inverted
// into a "zero-risk to try" frame.

const GUARANTEE =
  "Full refund if you don't leave with complete clarity — no questions asked.";

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinalCTASection() {
  const { spotsLeft } = useScarcity();

  return (
    <section
      aria-labelledby="final-cta-heading"
      className="section-pad relative overflow-hidden bg-[var(--bg-section)] text-white"
    >
      {/* ── Atmospheric glow — matches Hero's two-layer treatment ─────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(70vw,440px)] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-20%] h-[min(72vw,280px)] w-[min(72vw,280px)] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.09] blur-[110px]" />
        <div className="absolute left-1/2 top-[15%] h-[80px] w-[min(80vw,360px)] -translate-x-1/2 rounded-full bg-[#c026d3]/[0.035] blur-[72px]" />
      </div>

      <div className="container-narrow relative z-10 text-center">

        {/* ── 1. Emotional opening line ─────────────────────────────────────
            This is the line the section was missing entirely. After a full
            page of being understood, the visitor needs one sentence that names
            where she is right now — and frames the booking as the natural
            next step, not a transaction.

            "You've been doing this alone long enough." does three things:
              a) Acknowledges the emotional state (Limbic validation)
              b) Frames the CTA as relief, not commitment (Croc safety)
              c) Creates contrast: alone → not alone (identity shift)

            Positioned before everything else so it sets the emotional key for
            the entire section.                                               */}
        <p
          className="mx-auto mb-6 max-w-[26ch] text-balance text-[length:var(--text-base)] font-medium leading-[1.7] text-[var(--t2)] sm:mb-8 sm:max-w-[32ch] sm:text-[length:var(--text-lg)]"
          style={{ letterSpacing: "-0.01em" }}
        >
          You&apos;ve been doing this alone{" "}
          <span className="text-[var(--t1)] font-semibold">
            long enough.
          </span>
        </p>

        {/* ── 2. Section headline ───────────────────────────────────────────
            Kept tighter than original — the emotional line above does the
            heavy lifting, so the headline just confirms the action.
            "text-balance" prevents awkward line breaks on 320px.           */}
        <h2
          id="final-cta-heading"
          className="mx-auto mb-3 max-w-[18ch] text-balance text-[length:var(--text-2xl)] font-black leading-[1.05] tracking-[-0.04em] text-[var(--t1)] sm:text-[length:var(--text-3xl)]"
        >
          Your Thyroid Transformation{" "}
          <span className="text-gradient">Starts Here.</span>
        </h2>

        {/* ── 3. Subline — offer clarity without feature-listing ────────────
            One sentence. Does not repeat what's "included" — that's handled
            by the outcome chips below. Just names the price and the intent:
            private, no-pressure, 60 minutes.                               */}
        <p className="mx-auto mb-10 max-w-[32ch] text-pretty text-[length:var(--text-sm)] leading-[1.75] text-[var(--t3)] sm:mb-12 sm:max-w-[40ch] sm:text-[length:var(--text-base)]">
          A private ₹299 session — 60 minutes of focused clarity on your
          thyroid, your weight, and your exact next step.
        </p>

        {/* ── 4. Outcome chips — desire-led, not feature-led ────────────────
            Three outcomes, styled as directional arrows not checkmarks.
            Arrow → implies forward motion (you're going somewhere).
            Checkmark ✓ implies a list (you're getting something).

            The psychological difference: arrow = journey, check = contract.
            For a woman who has been stuck for years, "going somewhere"
            is more emotionally activating than "receiving a deliverable."  */}
        <ul
          className="mx-auto mb-10 flex max-w-[min(100%,26rem)] flex-col gap-3 text-left sm:mb-12"
          aria-label="What you'll get from the session"
        >
          {SESSION_OUTCOMES.map((outcome) => (
            <li
              key={outcome.text}
              className="flex items-start gap-3 rounded-[12px] border border-[var(--p-border)] bg-[var(--p-subtle)] px-4 py-3"
            >
              <span
                aria-hidden="true"
                className="shrink-0 font-bold leading-[1.6] text-[var(--p400)]"
                style={{ fontSize: "var(--text-sm)" }}
              >
                {outcome.icon}
              </span>
              <span className="text-[length:var(--text-sm)] font-medium leading-[1.65] text-[var(--t2)]">
                {outcome.text}
              </span>
            </li>
          ))}
        </ul>

        {/* ── 5. Coach card — human, not administrative ─────────────────────
            The original coach card was: photo + title badge + cert chips.
            No sentence. No humanity. Just credentials.

            The redesign adds a single first-person line from the coach that
            names her audience specifically. This does two things:
              a) Transforms the card from an "about me" block into an
                 "I see you" moment (Limbic resonance)
              b) The cert chips are still there for Neocortex proof, but
                 now they're supporting a human claim, not leading alone.

            "I've spent years learning why thyroid weight is different —
            so you don't have to figure it out alone." is the pivot line:
            it connects the coach's effort to the visitor's relief.         */}
        <div
          className="mb-10 overflow-hidden rounded-[var(--r-xl)] sm:mb-12"
          style={{
            background: "rgba(255,255,255,0.024)",
            border: "1px solid rgba(255,255,255,0.062)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.048), 0 2px 12px rgba(0,0,0,0.18)",
          }}
        >
          <div className="flex flex-col items-center gap-4 p-[clamp(1.125rem,4.5vw,1.5rem)] sm:flex-row sm:items-start sm:text-left">

            {/* Avatar */}
            <div className="relative h-[clamp(3.5rem,9vw,4rem)] w-[clamp(3.5rem,9vw,4rem)] shrink-0 overflow-hidden rounded-full border-2 border-[var(--p-border)] bg-[var(--s2)]">
              <Image
                src={COACH_IMAGE}
                alt={COACH_NAME}
                fill
                sizes="64px"
                className="object-cover object-top"
              />
            </div>

            {/* Text */}
            <div className="flex flex-col gap-2 text-center sm:text-left">
              <div>
                <p className="text-[length:var(--text-xs)] font-semibold uppercase tracking-wider text-[var(--p400)]">
                  Thyroid Fat-Loss Specialist
                </p>
                <p className="mt-0.5 text-[length:var(--text-base)] font-bold leading-none text-[var(--t1)]">
                  {COACH_NAME}
                </p>
              </div>

              {/*
                The human line — this is the most important addition to the card.
                It speaks directly to the visitor's situation and positions the
                coach as a guide, not a service provider.
              */}
              <p className="max-w-[34ch] text-[length:var(--text-xs)] leading-[1.7] text-[var(--t3)]">
                I&apos;ve spent years learning why thyroid weight is different —
                so you don&apos;t have to figure it out alone.
              </p>

              {/* Cert chips — Neocortex proof, now in a supporting role */}
              <div className="chip-list sm:justify-start">
                {certChips.map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 6. CTA block ──────────────────────────────────────────────────
            CTA label rewritten: "Reserve Your Thyroid Consultation" (clinical,
            third-person) → "Book My ₹299 Session — I'm Ready" (first-person,
            decisive, emotionally committed).

            First-person CTA copy performs consistently better in high-ticket
            service booking because it completes the decision the visitor has
            already been building toward — it reads as HER words, not a
            company's command.

            sublabel split: price on one line, scarcity on the next via the
            wrapper below — rather than crammed into the same micro-sentence.

            The scarcity wrapper (spotsLeft) appears below the risk reversal,
            not above the CTA — same rationale as the Hero redesign: urgency
            after intent, never before.                                      */}
        <div className="mx-auto mb-6 w-full max-w-[min(100%,22rem)] sm:mb-7">
          <SectionCta
            id="cta-final"
            variant="primary"
            className="w-full"
            buttonClassName="w-full"
            label="Book My ₹299 Session — I'm Ready"
            sublabel="60 min · Private · Written plan included"
            ariaLabel="Book your 299 rupee thyroid strategy session"
          />
        </div>

        {/* ── 7. Guarantee — single sentence, full-width ────────────────────
            Replaces the three-chip objections row ("₹299 consultation ·
            Qualified intake · No obligation").

            "Qualified intake" was removed: it's jargon that creates ambiguity
            ("do I need to qualify?") at the worst possible moment — right
            before a purchase decision.

            One clean guarantee sentence does more psychological work than
            three micro-chips:
              - Names the risk clearly (the ₹299)
              - Removes it unconditionally (full refund)
              - Names the benefit specifically (complete clarity)
              - "no questions asked" removes the secondary fear of
                the awkward refund conversation                             */}
        <p
          className="mx-auto mb-6 max-w-[36ch] text-center text-[0.72rem] font-medium leading-[1.6] text-[var(--t4)] sm:mb-7"
          style={{ letterSpacing: "0.01em" }}
        >
          <span className="mr-1.5 text-emerald-400/70" aria-hidden="true">
            &#10003;
          </span>
          {GUARANTEE}
        </p>

        {/* ── 8. ScarcityBadge — closing push, after intent ─────────────────
            Same rationale as the Hero section redesign: premium brands never
            lead with urgency. Urgency positioned here — after the visitor
            has formed intent through the emotional opening, the outcome chips,
            the coach humanity moment, and the CTA — functions as a closing
            push for the visitor who is *already considering* but hasn't tapped.

            This is the correct psychological moment for "2 spots left this
            week." Earlier in the section it reads as pressure; here it reads
            as practical information.                                        */}
        <ScarcityBadge className="mx-auto mb-8 w-fit sm:mb-10" />

        {/* ── 9. Closing micro-trust — specific, not repeated ───────────────
            "200+ thyroid women transformed across India" has appeared in the
            Hero stats and the SocialProof footer. By the third occurrence,
            it's invisible — the brain pattern-matches and skips it.

            The new line is specific to the closing moment: it names the
            *condition* (Indian thyroid women), the *struggle* (alone, without
            a plan), and the *transformation* (now have one). This is different
            from every other social proof line on the page because it names the
            *process* of change, not just a number.

            It also uses "finally" — a high-resonance word for this audience
            who has been "finally" waiting for this.                         */}
        <p
          className="mx-auto max-w-[32ch] text-center text-[0.67rem] font-medium leading-[1.55] text-[var(--t5)]"
          style={{ letterSpacing: "0.01em" }}
        >
          Indian women with thyroid conditions who were struggling alone —
          and finally have a plan.
        </p>

      </div>
    </section>
  );
}