"use client";

import Image from "next/image";

import {
  CERTIFICATIONS,
  COACH_IMAGE,
  COACH_NAME,
} from "../lib/authority";
import SectionCta from "./SectionCta";
import ScarcityBadge from "./ScarcityBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionOutcome {
  icon: string;
  text: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

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

const certChips = CERTIFICATIONS.map((c) => c.short);

const GUARANTEE =
  "Full refund if you don't leave with complete clarity — no questions asked.";

const PRIMARY_CTA_LABEL = "Book My ₹299 Session — I'm Ready";

// ✅ TALLY LINK
const TALLY_LINK = "https://tally.so/r/Xx8yRO";

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinalCTASection() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="section-pad relative overflow-hidden bg-[var(--bg-section)] text-white"
    >
      {/* ── Atmospheric glow ─────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(70vw,440px)] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-20%] h-[min(72vw,280px)] w-[min(72vw,280px)] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.09] blur-[110px]" />
        <div className="absolute left-1/2 top-[15%] h-[80px] w-[min(80vw,360px)] -translate-x-1/2 rounded-full bg-[#c026d3]/[0.035] blur-[72px]" />
      </div>

      <div className="container-narrow relative z-10 text-center">

        {/* ── Headline ───────────────────────────────────────────────────── */}
        <h2
          id="final-cta-heading"
          className="mx-auto mb-4 max-w-[20ch] text-balance text-[length:var(--text-2xl)] font-black leading-[1.08] tracking-[-0.04em] text-[var(--t1)] sm:mb-5 sm:text-[length:var(--text-3xl)]"
        >
          You&apos;ve been doing this alone{" "}
          <span className="text-gradient">long enough.</span>
        </h2>

        {/* ── Supporting Text ───────────────────────────────────────────── */}
        <p className="mx-auto mb-10 max-w-[34ch] text-pretty text-[length:var(--text-sm)] leading-[1.8] text-[var(--t3)] sm:mb-12 sm:max-w-[42ch] sm:text-[length:var(--text-base)]">
          A private thyroid strategy session designed to finally explain why
          nothing has worked — and what changes next.
        </p>

        {/* ── Outcome Chips ─────────────────────────────────────────────── */}
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

        {/* ── Coach Card ────────────────────────────────────────────────── */}
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

              <p className="max-w-[34ch] text-[length:var(--text-xs)] leading-[1.7] text-[var(--t3)]">
                I&apos;ve spent years learning why thyroid weight is different —
                so you don&apos;t have to figure it out alone.
              </p>

              {/* Cert Chips */}
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

        {/* ── CTA Block ─────────────────────────────────────────────────── */}
        <div className="mx-auto mb-5 w-full max-w-[min(100%,22rem)] sm:mb-6">

          {/* ✅ UPDATED CTA WRAPPER */}
          <a
            href={TALLY_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full"
          >
            <SectionCta
              id="cta-final"
              variant="primary"
              className="w-full cta-glow-strong"
              buttonClassName="w-full"
              label={PRIMARY_CTA_LABEL}
              sublabel="60 min · Private · Written plan included"
              ariaLabel="Book your 299 rupee private thyroid strategy session"
            />
          </a>

        </div>

        {/* ── Guarantee ─────────────────────────────────────────────────── */}
        <div
          className="mx-auto mb-6 flex w-fit items-center gap-2.5 rounded-[10px] px-4 py-2.5 sm:mb-7"
          style={{
            background: "rgba(52,211,153,0.06)",
            border: "1px solid rgba(52,211,153,0.14)",
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.5C16.5 22.15 20 17.25 20 12V6l-8-4z"
              stroke="rgba(52,211,153,0.7)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="rgba(52,211,153,0.7)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <p
            className="text-[0.71rem] font-medium leading-[1.5] text-[var(--t4)]"
            style={{ letterSpacing: "0.01em" }}
          >
            {GUARANTEE}
          </p>
        </div>

        {/* ── Scarcity ──────────────────────────────────────────────────── */}
        <ScarcityBadge className="mx-auto mb-8 w-fit sm:mb-10" />

        {/* ── Closing Trust ─────────────────────────────────────────────── */}
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