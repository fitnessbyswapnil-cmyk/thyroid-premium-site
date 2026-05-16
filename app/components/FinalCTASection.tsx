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
import SectionHeader from "./SectionHeader";

const includes = [
  "Personalized thyroid fat-loss roadmap",
  "Indian nutrition plan for your lifestyle",
  "Weekly tracking — weight, inches & energy",
  "Direct WhatsApp accountability support",
  "Clarity on your 90-day transformation path",
];

const certChips = CERTIFICATIONS.map((c) => c.short);

const objections = [
  "₹299 consultation",
  "Qualified intake",
  "No obligation",
];

export default function FinalCTASection() {
  const { scarcityShort } = useScarcity();

  return (
    <section className="section-pad relative bg-[var(--bg-section)] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
        style={{ height: 320 }}
      >
        <div className="glow-hero" />
      </div>

      <div className="container-narrow relative z-10 text-center">
        <ScarcityBadge className="mx-auto mb-5 w-fit" />

        <SectionHeader
          className="!mb-6"
          label="Private Coaching Intake"
          title={
            <>
              Your Thyroid Transformation{" "}
              <span className="text-gradient">Starts Here.</span>
            </>
          }
          lead="Reserve a private ₹299 strategy session — no pressure, no upsells, just clarity on your next step."
          titleMaxCh="18ch"
        />

        <article className="glass-card mb-5 overflow-hidden rounded-[var(--r-xl)] p-[clamp(1rem,4vw,1.25rem)] text-left">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:text-left">
            <div className="relative h-[clamp(3.25rem,9vw,3.75rem)] w-[clamp(3.25rem,9vw,3.75rem)] shrink-0 overflow-hidden rounded-full border-2 border-[var(--p-border)] bg-[var(--s2)]">
              <Image
                src={COACH_IMAGE}
                alt={COACH_NAME}
                fill
                sizes="64px"
                className="object-cover object-top"
              />
            </div>
            <div>
              <p className="mb-0.5 text-[length:var(--text-xs)] font-semibold uppercase tracking-wider text-[var(--p400)]">
                Thyroid Fat-Loss Specialist
              </p>
              <p className="mb-2 text-[length:var(--text-base)] font-bold text-[var(--t1)]">
                {COACH_NAME}
              </p>
              <div className="chip-list sm:justify-start">
                {certChips.map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </article>

        <div className="mb-5 rounded-[var(--r-xl)] border border-[var(--p-border)] bg-[var(--p-subtle)] p-[clamp(0.875rem,4vw,1.125rem)] text-left">
          <p className="mb-3 text-[length:var(--text-xs)] font-semibold uppercase tracking-wider text-[var(--p400)]">
            Your ₹299 Session Includes
          </p>
          <ul className="space-y-2.5">
            {includes.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span
                  className="shrink-0 font-bold leading-none text-[var(--p500)]"
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  ✓
                </span>
                <span className="text-[length:var(--text-xs)] leading-relaxed text-[var(--t2)]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <SectionCta
          id="cta-final"
          variant="primary"
          className="mx-auto mb-5"
          buttonClassName="w-full"
          label="Reserve Your Thyroid Consultation"
          sublabel={`₹299 private session · ${scarcityShort}`}
          ariaLabel="Reserve your 299 rupee thyroid consultation"
        />

        <div className="mb-5 flex flex-wrap items-center justify-center gap-2.5">
          {objections.map((obj, i) => (
            <span key={obj} className="flex items-center gap-1.5">
              {i > 0 ? (
                <span
                  className="h-3 w-px bg-[var(--b-soft)]"
                  aria-hidden="true"
                />
              ) : null}
              <span className="text-[clamp(9px,1.8vw,10px)] font-medium uppercase tracking-[0.08em] text-[var(--t4)]">
                {obj}
              </span>
            </span>
          ))}
        </div>

        <p className="micro-trust">
          200+ thyroid women transformed across India
        </p>
      </div>
    </section>
  );
}
