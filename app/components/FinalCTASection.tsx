"use client";

import CtaButton from "./CtaButton";
import ScarcityBadge from "./ScarcityBadge";
import { useScarcity } from "../context/ScarcityProvider";

const includes = [
  "Personalized thyroid fat-loss roadmap",
  "Indian nutrition plan for your lifestyle",
  "Weekly tracking — weight, inches & energy",
  "Direct WhatsApp accountability support",
  "Clarity on your 90-day transformation path",
];

const certs = ["ACE Certified", "FITR Certified", "INFS Certified"];

const objections = [
  "₹299 consultation",
  "Qualified intake",
  "No obligation",
];

export default function FinalCTASection() {
  const { scarcityShort } = useScarcity();

  return (
    <section className="section-pad" style={{ background: "var(--bg-section)" }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
        style={{ height: 360 }}
      >
        <div className="glow-hero" />
      </div>

      <div className="container-narrow relative z-10 text-center">
        <ScarcityBadge className="mx-auto mb-5 w-fit" />

        <p className="section-label mb-2">Private Coaching Intake</p>
        <h2 className="section-title mx-auto mb-3" style={{ maxWidth: "18ch" }}>
          Your Thyroid Transformation{" "}
          <span className="text-gradient">Starts Here.</span>
        </h2>
        <p
          className="mx-auto mb-6"
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--t3)",
            maxWidth: "34ch",
            lineHeight: 1.65,
          }}
        >
          Reserve a private ₹299 strategy session.{" "}
          <strong style={{ color: "var(--t2)", fontWeight: 600 }}>
            No pressure. No upsells. Just clarity on your next step.
          </strong>
        </p>

        <div
          className="glass-card mb-5 overflow-hidden text-left"
          style={{ padding: "clamp(1rem, 4vw, 1.25rem)" }}
        >
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:text-left">
            <div
              className="relative flex-shrink-0 overflow-hidden rounded-full"
              style={{
                width: "clamp(3rem, 8vw, 3.5rem)",
                height: "clamp(3rem, 8vw, 3.5rem)",
                border: "2px solid rgba(168,85,247,0.35)",
                background:
                  "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(147,51,234,0.15))",
              }}
            >
              <div
                className="flex h-full w-full items-center justify-center font-black"
                style={{ fontSize: "var(--text-base)", color: "var(--p300)" }}
              >
                SU
              </div>
            </div>
            <div>
              <p
                className="font-semibold uppercase tracking-wider"
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--p400)",
                  marginBottom: 2,
                }}
              >
                India&apos;s Leading Thyroid Fat-Loss Coach
              </p>
              <p
                className="font-bold"
                style={{
                  fontSize: "var(--text-base)",
                  color: "var(--t1)",
                  marginBottom: "0.5rem",
                }}
              >
                Swapnil Umbarkar
              </p>
              <div className="chip-list sm:justify-start">
                {certs.map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className="mb-5 text-left"
          style={{
            borderRadius: "var(--r-xl)",
            border: "1px solid var(--p-border)",
            background: "var(--p-subtle)",
            padding: "clamp(0.875rem, 4vw, 1.125rem)",
          }}
        >
          <p
            className="mb-3 font-semibold uppercase tracking-wider"
            style={{ fontSize: "var(--text-xs)", color: "var(--p400)" }}
          >
            Your ₹299 Session Includes
          </p>
          <ul className="space-y-2">
            {includes.map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span
                  className="shrink-0 font-bold leading-none"
                  style={{ color: "var(--p500)", fontSize: "var(--text-sm)" }}
                >
                  ✓
                </span>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--t2)",
                    lineHeight: 1.5,
                  }}
                >
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="cta-wrap mx-auto mb-5">
          <CtaButton
            id="cta-final"
            variant="primary"
            label="Reserve Your Thyroid Consultation"
            sublabel={`₹299 private session · ${scarcityShort}`}
            ariaLabel="Reserve your 299 rupee thyroid consultation"
          />
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-center gap-2.5">
          {objections.map((obj, i) => (
            <span key={obj} className="flex items-center gap-1.5">
              {i > 0 && (
                <span
                  className="h-3 w-px"
                  style={{ background: "var(--b-soft)" }}
                  aria-hidden="true"
                />
              )}
              <span
                style={{
                  fontSize: "clamp(9px, 1.8vw, 10px)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--t4)",
                }}
              >
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
