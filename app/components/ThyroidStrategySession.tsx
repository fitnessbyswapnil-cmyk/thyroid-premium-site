"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import SectionCta from "./SectionCta";

// ─────────────────────────────────────────────────────────────────────────────
// "How your consultation works" — the merged session section.
// Design language of the original strategy-session section (gradient headline,
// glowing icon tiles, per-step eyebrows, ghost numerals, spine dots) carrying
// the verbatim 6-step Root-Cause content (with time pills) that previously
// lived in the bottom HowItWorksSection. id="how-it-works" lives here so the
// hero's "See how the session works ↓" link targets this section.
//
// PRICE-NEUTRAL by design: no free/₹ language anywhere (paid-session cutover
// safe). No kg/timeframe claims.
//
// Interactivity (scroll-driven, nothing hidden, taps not required):
//  • IntersectionObserver tracks the step nearest the viewport center.
//  • The spine fills progressively (scaleY transform) with scroll.
//  • Active card: brighter border/glow, subtle lift, pulsing dot, brighter
//    pill; inactive cards stay fully readable (all text ≥ AA in BOTH states —
//    verified programmatically over the brightest card-gradient corner:
//    body 70%/88% white = 8.9–14.3:1, STEP label 55% = 6.0:1, full-hex
//    eyebrows 4.6–10.4:1, pill 6.9–7.8:1).
//  • Ghost numerals get a slow parallax drift (transform/opacity only).
//  • Mobile-only "session clock" bar pinned to the section top fills 0→60.
//  • prefers-reduced-motion: everything static and fully visible.
// All animation is transform/opacity — zero layout shift.
// ─────────────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  eyebrow: string;
  time: string;
  title: string;
  body: string;
  chip?: string;
  rgb: string;
  hex: string;
  hexTo: string;
  paths: string[];
}

const STEPS: Step[] = [
  {
    id: "01",
    eyebrow: "Your Numbers",
    time: "0–10 MIN",
    title: "Thyroid Reports Review",
    body: "TSH, T3, T4, antibodies — whatever you have.",
    chip: "No reports? We start from your symptoms.",
    rgb: "168,85,247",
    hex: "#a855f7",
    hexTo: "#7c3aed",
    paths: ["M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"],
  },
  {
    id: "02",
    eyebrow: "Your Story",
    time: "10–20 MIN",
    title: "Symptom History Mapping",
    body: "Energy, sleep, cravings, hair, periods, mood — the patterns tell the story.",
    rgb: "232,121,249",
    hex: "#e879f9",
    hexTo: "#a855f7",
    paths: ["M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"],
  },
  {
    id: "03",
    eyebrow: "Your Routine",
    time: "20–30 MIN",
    title: "Lifestyle Audit",
    body: "Food timing, stress, sleep, movement — what's helping, what's hurting.",
    rgb: "251,113,133",
    hex: "#fb7185",
    hexTo: "#e11d48",
    paths: [
      "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5",
    ],
  },
  {
    id: "04",
    eyebrow: "What Failed & Why",
    time: "30–40 MIN",
    title: "Past Approaches Review",
    body: "Every diet and plan you've tried — and why each one stalled.",
    rgb: "251,191,36",
    hex: "#fbbf24",
    hexTo: "#d97706",
    paths: ["M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"],
  },
  {
    id: "05",
    eyebrow: "The Hidden Layer",
    time: "40–50 MIN",
    title: "Hidden Factor Screen",
    body: "Gut, cortisol, insulin, deficiencies, conversion — the usual suspects.",
    rgb: "52,211,153",
    hex: "#34d399",
    hexTo: "#059669",
    paths: ["M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"],
  },
  {
    id: "06",
    eyebrow: "Your Answer",
    time: "50–60 MIN",
    title: "Your Root-Cause Map",
    body: "The exact reason your fat loss is stuck — and your next step forward.",
    rgb: "96,165,250",
    hex: "#60a5fa",
    hexTo: "#3b82f6",
    paths: ["M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"],
  },
];

const SPINE_GRADIENT =
  "linear-gradient(to bottom, rgba(168,85,247,0.9) 0%, rgba(232,121,249,0.75) 20%, rgba(251,113,133,0.65) 40%, rgba(251,191,36,0.7) 60%, rgba(52,211,153,0.8) 80%, rgba(96,165,250,0.7) 100%)";
const SPINE_TRACK =
  "linear-gradient(to bottom, rgba(168,85,247,0.16) 0%, rgba(52,211,153,0.12) 80%, rgba(96,165,250,0.1) 100%)";

// ─── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  step,
  active,
  reduce,
  side,
  idPrefix,
}: {
  step: Step;
  active: boolean;
  reduce: boolean;
  side: "left" | "right";
  idPrefix: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Ghost-numeral parallax: slow drift as the card crosses the viewport.
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"],
  });
  const ghostY = useTransform(scrollYProgress, [0, 1], [18, -18]);
  const ghostOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.35, 1, 0.35]);

  const gradId = `hiw-g-${idPrefix}-${step.id}`;
  const lit = reduce || active; // reduced motion = everything fully lit

  return (
    <motion.div
      ref={cardRef}
      className="tss-card relative overflow-hidden rounded-[20px]"
      initial={reduce ? false : { opacity: 0, x: side === "left" ? -24 : 24, y: 12 }}
      whileInView={reduce ? undefined : { opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        ["--card-rgb" as string]: step.rgb,
        border: `1px solid rgba(${step.rgb},${lit ? 0.42 : 0.2})`,
        background: `linear-gradient(140deg, rgba(${step.rgb},0.1) 0%, rgba(8,6,18,0.9) 60%)`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        padding: "20px 22px",
        boxShadow: lit
          ? `0 0 56px rgba(${step.rgb},0.14), 0 18px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`
          : `0 0 48px rgba(${step.rgb},0.06), inset 0 1px 0 rgba(255,255,255,0.04)`,
        transform: lit && !reduce ? "translateY(-3px)" : "translateY(0)",
        transition:
          "border-color 0.35s ease, box-shadow 0.35s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-7 -top-7 h-32 w-32 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(${step.rgb},${lit ? 0.24 : 0.14}) 0%, transparent 70%)`,
          filter: "blur(20px)",
          transition: "background 0.35s ease",
        }}
      />

      {/* Ghost watermark numeral — decorative, slow parallax drift */}
      <motion.div
        aria-hidden
        className="pointer-events-none select-none absolute -bottom-5 -right-3 font-black leading-none"
        style={{
          fontSize: 110,
          letterSpacing: "-0.05em",
          color: `rgba(${step.rgb},0.07)`,
          y: reduce ? 0 : ghostY,
          opacity: reduce ? 1 : ghostOpacity,
        }}
      >
        {step.id}
      </motion.div>

      {/* Icon + meta row + time pill */}
      <div className="relative mb-3 flex items-center gap-2.5">
        <div
          className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px]"
          style={{
            border: `1px solid rgba(${step.rgb},${lit ? 0.5 : 0.32})`,
            background: `radial-gradient(circle at 35% 35%, rgba(${step.rgb},0.22) 0%, rgba(${step.rgb},0.06) 100%)`,
            boxShadow: `0 0 18px rgba(${step.rgb},${lit ? 0.4 : 0.28})`,
            transition: "border-color 0.35s ease, box-shadow 0.35s ease",
          }}
        >
          {/* Pulsing ring — only while this step is active (never in reduced motion) */}
          {active && !reduce && (
            <div
              className="tss-ring absolute inset-0 rounded-[11px]"
              style={{ border: `1px solid rgba(${step.rgb},0.6)` }}
            />
          )}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="17"
            height="17"
            aria-hidden
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={step.hex} />
                <stop offset="100%" stopColor={step.hexTo} />
              </linearGradient>
            </defs>
            {step.paths.map((d, i) => <path key={i} d={d} />)}
          </svg>
        </div>

        <div className="min-w-0">
          <span
            className="block font-bold uppercase tracking-[0.18em]"
            style={{ fontSize: 11, color: step.hex, lineHeight: 1.4 }}
          >
            {step.eyebrow}
          </span>
          <span
            className="font-semibold uppercase tracking-[0.1em]"
            style={{
              fontSize: 10.5,
              color: `rgba(255,255,255,${lit ? 0.7 : 0.55})`,
              transition: "color 0.35s ease",
            }}
          >
            Step {step.id}
          </span>
        </div>

        {/* Time pill — the "how it actually works" data */}
        <span
          className="ml-auto shrink-0 rounded-full px-3 py-1 text-[12.5px] font-semibold uppercase leading-none tracking-[0.08em]"
          style={{
            color: "var(--p400)",
            background: `rgba(168,85,247,${lit ? 0.22 : 0.12})`,
            border: `1px solid rgba(168,85,247,${lit ? 0.4 : 0.24})`,
            transition: "background 0.35s ease, border-color 0.35s ease",
          }}
        >
          {step.time}
        </span>
      </div>

      <h3
        className="relative mb-2 font-bold leading-[1.28] tracking-[-0.018em]"
        style={{
          fontSize: "clamp(16px, 2.2vw, 17.5px)",
          color: `rgba(255,255,255,${lit ? 0.97 : 0.85})`,
          transition: "color 0.35s ease",
        }}
      >
        {step.title}
      </h3>

      <p
        className="relative m-0 leading-[1.68]"
        style={{
          fontSize: 14,
          color: `rgba(255,255,255,${lit ? 0.88 : 0.7})`,
          transition: "color 0.35s ease",
        }}
      >
        {step.body}
      </p>

      {step.chip && (
        <p
          className="relative mt-3 inline-flex rounded-full px-3.5 py-1.5 text-[13px] font-medium leading-snug"
          style={{
            border: "1px solid rgba(168,85,247,0.28)",
            background: "rgba(168,85,247,0.09)",
            color: "rgba(255,255,255,0.78)",
          }}
        >
          {step.chip}
        </p>
      )}
    </motion.div>
  );
}

// ─── Spine dot (desktop center node + connector bridge) ────────────────────────

function SpineDot({
  step,
  active,
  reduce,
  connectorSide,
}: {
  step: Step;
  active: boolean;
  reduce: boolean;
  connectorSide: "left" | "right";
}) {
  const lit = reduce || active;
  return (
    <div className="relative flex w-11 flex-shrink-0 justify-center">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-px -translate-y-1/2"
        style={
          connectorSide === "left"
            ? { right: "50%", width: 34, background: `linear-gradient(to left, rgba(${step.rgb},0.5) 0%, transparent 100%)` }
            : { left: "50%", width: 34, background: `linear-gradient(to right, rgba(${step.rgb},0.5) 0%, transparent 100%)` }
        }
      />
      <div className="relative z-10 flex items-center justify-center">
        <div
          className={active && !reduce ? "tss-pulse" : undefined}
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${step.hex} 0%, ${step.hexTo} 100%)`,
            boxShadow: lit
              ? `0 0 0 5px rgba(${step.rgb},0.18), 0 0 26px rgba(${step.rgb},0.7), 0 0 52px rgba(${step.rgb},0.25)`
              : `0 0 0 4px rgba(${step.rgb},0.1), 0 0 14px rgba(${step.rgb},0.35)`,
            transition: "box-shadow 0.35s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export default function ThyroidStrategySession() {
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Active step = the card crossing the middle band of the viewport. Both the
  // mobile rows and desktop rows carry data-step; whichever layout is visible
  // at the current breakpoint drives the state (hidden ones never intersect).
  useEffect(() => {
    if (reduce || !timelineRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.step ?? 0);
            setActive(idx);
          }
        }
      },
      { rootMargin: "-42% 0px -42% 0px", threshold: 0 },
    );
    timelineRef.current
      .querySelectorAll<HTMLElement>("[data-step]")
      .forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [reduce]);

  // Spine fill + session clock progress.
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 0.72", "end 0.45"],
  });

  return (
    <section
      id="how-it-works"
      className="relative w-full overflow-hidden py-24 scroll-mt-8"
      aria-labelledby="how-it-works-heading"
    >
      {/* Atmospheric background — decorative glows, contained by the section's
          own overflow-hidden (verified: contributes 0px to document overflow) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute left-1/2 -top-24 -translate-x-1/2 rounded-full"
          style={{
            width: "min(720px,100vw)",
            height: "min(520px,80vw)",
            background: "radial-gradient(ellipse, rgba(139,92,246,0.16) 0%, transparent 70%)",
            filter: "blur(55px)",
          }}
        />
        <div
          className="absolute bottom-0 -right-[5%] rounded-full"
          style={{
            width: "min(420px,70vw)",
            height: "min(320px,55vw)",
            background: "radial-gradient(ellipse, rgba(52,211,153,0.09) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute top-[40%] -left-[5%] rounded-full"
          style={{
            width: "min(300px,50vw)",
            height: "min(300px,50vw)",
            background: "radial-gradient(ellipse, rgba(232,121,249,0.06) 0%, transparent 70%)",
            filter: "blur(50px)",
          }}
        />
      </div>

      {/* Session clock — mobile only, pinned to the section top, fills 0→60
          with scroll. Decorative (aria-hidden): the per-card pills carry the
          actual minute data. */}
      {!reduce && (
        <div aria-hidden className="sticky top-0 z-20 md:hidden">
          <div className="h-[3px] w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              className="h-full origin-left"
              style={{
                scaleX: scrollYProgress,
                background: "linear-gradient(to right, #a855f7, #34d399)",
              }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[760px] px-5">

        {/* Header */}
        <motion.div
          className="mb-16 text-center"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-[5px]"
            style={{
              border: "1px solid rgba(139,92,246,0.28)",
              background: "rgba(139,92,246,0.08)",
            }}
          >
            <span className={`block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-500 ${reduce ? "" : "tss-pulse"}`} />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-300">
              Your 60-Minute Session
            </span>
          </div>

          <h2
            id="how-it-works-heading"
            className="mx-auto mb-4 max-w-[540px] font-bold leading-[1.17] tracking-[-0.028em] text-white"
            style={{ fontSize: "clamp(26px, 5vw, 42px)" }}
          >
            Finally, a session that{" "}
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #C084FC 0%, #8B5CF6 45%, #34D399 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              actually understands you.
            </span>
          </h2>

          <p className="mx-auto max-w-[440px] text-[14px] leading-[1.65] text-[var(--t3)]">
            Not a sales call. Not generic advice. Six steps, sixty minutes —
            and you leave knowing the exact reason your weight isn&apos;t
            shifting.
          </p>
        </motion.div>

        {/* ── Timeline ── */}
        <div ref={timelineRef} className="relative">

          {/* Mobile layout */}
          <div className="relative md:hidden">
            {/* Spine track + progressive fill */}
            <div aria-hidden className="absolute bottom-2.5 left-[14px] top-2.5 w-px" style={{ background: SPINE_TRACK }} />
            <motion.div
              aria-hidden
              className="absolute bottom-2.5 left-[14px] top-2.5 w-px origin-top"
              style={{ background: SPINE_GRADIENT, scaleY: reduce ? 1 : scrollYProgress }}
            />
            <div className="flex flex-col gap-4">
              {STEPS.map((step, i) => {
                const lit = reduce || active === i;
                return (
                  <div key={step.id} className="flex items-start gap-4" data-step={i}>
                    <div className="flex w-7 flex-shrink-0 justify-center pt-[22px]">
                      <div
                        className={`relative z-10 ${active === i && !reduce ? "tss-pulse" : ""}`}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: `radial-gradient(circle, ${step.hex} 0%, ${step.hexTo} 100%)`,
                          boxShadow: lit
                            ? `0 0 16px rgba(${step.rgb},0.7), 0 0 0 4px rgba(${step.rgb},0.18)`
                            : `0 0 12px rgba(${step.rgb},0.4), 0 0 0 3px rgba(${step.rgb},0.1)`,
                          transition: "box-shadow 0.35s ease",
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <StepCard step={step} active={active === i} reduce={reduce} side="right" idPrefix="m" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop zig-zag layout */}
          <div className="relative hidden md:block">
            <div aria-hidden className="absolute bottom-3.5 top-3.5 w-px" style={{ left: "50%", transform: "translateX(-50%)", background: SPINE_TRACK }} />
            <motion.div
              aria-hidden
              className="absolute bottom-3.5 top-3.5 w-px origin-top"
              style={{ left: "50%", translateX: "-50%", background: SPINE_GRADIENT, scaleY: reduce ? 1 : scrollYProgress }}
            />

            <div className="flex flex-col" style={{ gap: 18 }}>
              {STEPS.map((step, i) => {
                const isRight = i % 2 !== 0;
                return (
                  <div
                    key={step.id}
                    className="relative flex items-center"
                    style={{ zIndex: 1 }}
                    data-step={i}
                  >
                    <div className="flex flex-1 justify-end pr-7">
                      {!isRight && <StepCard step={step} active={active === i} reduce={reduce} side="left" idPrefix="d" />}
                    </div>
                    <SpineDot step={step} active={active === i} reduce={reduce} connectorSide={isRight ? "right" : "left"} />
                    <div className="flex-1 pl-7">
                      {isRight && <StepCard step={step} active={active === i} reduce={reduce} side="right" idPrefix="d" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Closing callout ── */}
        <motion.div
          className="mx-auto mt-12 max-w-[540px] rounded-[20px] p-5 text-center"
          style={{
            border: "1px solid rgba(168,85,247,0.22)",
            background: "rgba(168,85,247,0.07)",
          }}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="mx-auto max-w-[44ch] text-[15px] font-semibold leading-[1.65] text-[var(--t1)]">
            Reports &ldquo;normal&rdquo; but the weight won&apos;t move?{" "}
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #C084FC 0%, #8B5CF6 45%, #34D399 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              That&apos;s exactly what this session decodes.
            </span>
          </p>
        </motion.div>

        {/* ── CTA — same destination as the hero CTA (goToCta booking flow).
              No sublabel/trust line: this section stays price-neutral. ── */}
        <SectionCta
          variant="primary"
          className="mx-auto max-w-sm"
          buttonClassName="w-full"
          label="Book My Root-Cause Session"
          ariaLabel="Book my root-cause thyroid session"
          location="how_it_works"
        />
      </div>
    </section>
  );
}
