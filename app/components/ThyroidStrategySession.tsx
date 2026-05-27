"use client";

import { useInView } from "@/app/lib/useInView";
import CtaButton from "./CtaButton";

// ─── Data ──────────────────────────────────────────────────────────────────────

interface CP {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  rgb: string;
  hex: string;
  hexTo: string;
  paths: string[];
  tag?: string;
}

const CHECKPOINTS: CP[] = [
  {
    id: "01",
    eyebrow: "Before We Even Speak",
    title: "Your Thyroid Story, Finally Decoded",
    body: "Your full intake is studied before we meet. No repeating yourself. No starting from zero. We already know your pattern.",
    rgb: "168,85,247",
    hex: "#a855f7",
    hexTo: "#7c3aed",
    paths: ["M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"],
  },
  {
    id: "02",
    eyebrow: "Root Cause Analysis",
    title: "Hidden Fat-Loss Blockers Identified",
    body: "The real reason your weight won't budge — even when you eat clean, exercise, and try everything the internet suggests.",
    rgb: "232,121,249",
    hex: "#e879f9",
    hexTo: "#a855f7",
    paths: ["M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"],
    tag: "Most women discover this for the first time here",
  },
  {
    id: "03",
    eyebrow: "Lab Pattern Review",
    title: '"Your Labs Are Normal" — Decoded For Real',
    body: "TSH, T3, T4, and ferritin patterns reviewed against your actual symptoms. Not just ticked against lab reference ranges.",
    rgb: "251,113,133",
    hex: "#fb7185",
    hexTo: "#e11d48",
    paths: [
      "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5",
    ],
    tag: "The question every doctor fails to answer",
  },
  {
    id: "04",
    eyebrow: "Metabolism & Hormones",
    title: "Exactly Where Your Energy Is Leaking",
    body: "Food timing, cortisol spikes, sleep disruptions, and hormone cycles — mapped to your specific fatigue, bloat, and brain fog.",
    rgb: "251,191,36",
    hex: "#fbbf24",
    hexTo: "#d97706",
    paths: ["M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"],
  },
  {
    id: "05",
    eyebrow: "Your Personalized Plan",
    title: "A Thyroid Recovery Blueprint, Built For You",
    body: "A clear, actionable 30-day direction built entirely around your body, your labs, your lifestyle. Not a template. Not generic.",
    rgb: "52,211,153",
    hex: "#34d399",
    hexTo: "#059669",
    paths: ["M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"],
    tag: "The part clients screenshot and save",
  },
  {
    id: "06",
    eyebrow: "Yours Forever",
    title: "Written Clarity — In Your Inbox Within 24 Hours",
    body: "Every insight, every next step — documented and sent to you in writing. So you never have to rely on memory alone.",
    rgb: "96,165,250",
    hex: "#60a5fa",
    hexTo: "#3b82f6",
    paths: ["M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"],
  },
];

const OUTCOMES = [
  { text: "Why your fat loss is blocked",        rgb: "168,85,247" },
  { text: "Your labs decoded in plain language", rgb: "251,113,133" },
  { text: "Thyroid-specific food direction",     rgb: "251,191,36"  },
  { text: "30-day next steps — in writing",      rgb: "52,211,153"  },
];

const TRUST = [
  "Private & confidential",
  "Built for hypothyroid women",
  "No crash diet advice",
  "Personalized to your symptoms",
];

const TESTIMONIALS = [
  {
    quote: "More clarity about my thyroid in 60 minutes than 3 years of trying to figure it out alone. I finally understand why nothing was working.",
    name: "Priya M.",
    city: "Pune",
    condition: "Hashimoto's",
  },
  {
    quote: "He had already studied my intake before we even spoke. Within 10 minutes he pinpointed exactly where my energy was leaking. I left with a real plan.",
    name: "Rekha S.",
    city: "Mumbai",
    condition: "Hypothyroidism",
  },
];

const SPINE_GRADIENT =
  "linear-gradient(to bottom, rgba(168,85,247,0.38) 0%, rgba(232,121,249,0.28) 20%, rgba(251,113,133,0.22) 40%, rgba(251,191,36,0.24) 60%, rgba(52,211,153,0.3) 80%, rgba(96,165,250,0.22) 100%)";

// ─── CheckpointCard ────────────────────────────────────────────────────────────

function CheckpointCard({
  cp,
  delay,
  side,
}: {
  cp: CP;
  delay: number;
  side: "left" | "right";
}) {
  const { ref, visible } = useInView(0.07);
  const gradId = `tss-g-${cp.id}`;

  const enterX = visible ? 0 : side === "left" ? -24 : 24;
  const enterY = visible ? 0 : 12;

  return (
    <div
      ref={ref}
      className="tss-card relative overflow-hidden rounded-[20px]"
      style={{
        // CSS custom property for hover colour — consumed by .tss-card:hover in globals.css
        ["--card-rgb" as string]: cp.rgb,
        opacity: visible ? 1 : 0,
        transform: `translate(${enterX}px, ${enterY}px)`,
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        border: `1px solid rgba(${cp.rgb},0.2)`,
        background: `linear-gradient(140deg, rgba(${cp.rgb},0.1) 0%, rgba(8,6,18,0.9) 60%)`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        padding: "20px 22px",
        boxShadow: `0 0 48px rgba(${cp.rgb},0.06), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-7 -top-7 h-32 w-32 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(${cp.rgb},0.18) 0%, transparent 70%)`,
          filter: "blur(20px)",
        }}
      />

      {/* Ghost watermark number */}
      <div
        aria-hidden
        className="pointer-events-none select-none absolute -bottom-5 -right-3 font-black leading-none"
        style={{
          fontSize: 110,
          letterSpacing: "-0.05em",
          color: `rgba(${cp.rgb},0.055)`,
        }}
      >
        {cp.id}
      </div>

      {/* Icon + meta row */}
      <div className="relative mb-3 flex items-center gap-2.5">
        <div
          className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px]"
          style={{
            border: `1px solid rgba(${cp.rgb},0.32)`,
            background: `radial-gradient(circle at 35% 35%, rgba(${cp.rgb},0.22) 0%, rgba(${cp.rgb},0.06) 100%)`,
            boxShadow: `0 0 18px rgba(${cp.rgb},0.28)`,
          }}
        >
          {/* Pulsing ring — staggered per checkpoint */}
          <div
            className="absolute inset-0 rounded-[11px] tss-ring"
            style={{
              border: `1px solid rgba(${cp.rgb},0.55)`,
              animationDelay: `${parseInt(cp.id) * 380}ms`,
            }}
          />
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
                <stop offset="0%" stopColor={cp.hex} />
                <stop offset="100%" stopColor={cp.hexTo} />
              </linearGradient>
            </defs>
            {cp.paths.map((d, i) => <path key={i} d={d} />)}
          </svg>
        </div>

        <div>
          <span
            className="block font-bold uppercase tracking-[0.2em]"
            style={{ fontSize: 10.5, color: `rgba(${cp.rgb},0.8)`, lineHeight: 1.4 }}
          >
            {cp.eyebrow}
          </span>
          <span
            className="font-semibold uppercase tracking-[0.1em] text-white/20"
            style={{ fontSize: 10 }}
          >
            Step {cp.id}
          </span>
        </div>
      </div>

      <h3
        className="relative mb-2 font-bold leading-[1.28] tracking-[-0.018em] text-white/95"
        style={{ fontSize: "clamp(16px, 2.2vw, 17.5px)" }}
      >
        {cp.title}
      </h3>

      <p className="relative m-0 leading-[1.68] text-white/52" style={{ fontSize: 13.5 }}>
        {cp.body}
      </p>

      {cp.tag && (
        <div
          className="relative mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{
            border: `1px solid rgba(${cp.rgb},0.22)`,
            background: `rgba(${cp.rgb},0.08)`,
          }}
        >
          <div
            className="h-1 w-1 flex-shrink-0 rounded-full"
            style={{ background: `rgba(${cp.rgb},0.9)` }}
          />
          <span
            className="font-medium tracking-[0.02em]"
            style={{ fontSize: 9.5, color: `rgba(${cp.rgb},0.78)` }}
          >
            {cp.tag}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── SpineDot (desktop center node + connector bridge) ─────────────────────────

function SpineDot({ cp, connectorSide }: { cp: CP; connectorSide: "left" | "right" }) {
  const { ref, visible } = useInView(0.07);

  return (
    <div ref={ref} className="relative flex w-11 flex-shrink-0 justify-center">
      {/* Horizontal connector bridge — fades from dot outward toward card */}
      <div
        aria-hidden
        className="absolute top-1/2 h-px -translate-y-1/2 pointer-events-none"
        style={
          connectorSide === "left"
            ? {
                right: "50%",
                width: 34,
                background: `linear-gradient(to left, rgba(${cp.rgb},0.5) 0%, transparent 100%)`,
              }
            : {
                left: "50%",
                width: 34,
                background: `linear-gradient(to right, rgba(${cp.rgb},0.5) 0%, transparent 100%)`,
              }
        }
      />

      {/* Dot — scales in when visible */}
      <div
        className="relative z-10"
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${cp.hex} 0%, ${cp.hexTo} 100%)`,
          boxShadow: visible
            ? `0 0 0 5px rgba(${cp.rgb},0.14), 0 0 24px rgba(${cp.rgb},0.6), 0 0 48px rgba(${cp.rgb},0.2)`
            : "none",
          transform: visible ? "scale(1)" : "scale(0.2)",
          opacity: visible ? 1 : 0,
          transition:
            "box-shadow 0.7s ease 200ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) 150ms, opacity 0.4s ease 150ms",
        }}
      />
    </div>
  );
}

// ─── JourneySection ────────────────────────────────────────────────────────────

function JourneySection() {
  const { ref: journeyRef, visible: journeyVisible } = useInView(0.04);

  return (
    <div ref={journeyRef} className="relative">

      {/* ── Mobile layout ───────────────────────────────────── */}
      <div className="md:hidden relative">
        {/* Mobile spine — draws downward on scroll */}
        <div
          aria-hidden
          className="absolute left-[14px] top-2.5 bottom-2.5 w-px"
          style={{
            background: SPINE_GRADIENT,
            transformOrigin: "top center",
            transform: journeyVisible ? "scaleY(1)" : "scaleY(0)",
            transition: "transform 2.8s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
        <div className="flex flex-col gap-4">
          {CHECKPOINTS.map((cp, i) => (
            <div key={cp.id} className="flex items-start gap-4">
              {/* Mobile spine dot */}
              <div className="flex w-7 flex-shrink-0 justify-center pt-[22px]">
                <div
                  className="relative z-10"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${cp.hex} 0%, ${cp.hexTo} 100%)`,
                    boxShadow: `0 0 12px rgba(${cp.rgb},0.55), 0 0 0 3px rgba(${cp.rgb},0.13)`,
                  }}
                />
              </div>
              <div className="flex-1">
                <CheckpointCard cp={cp} delay={i * 80} side="right" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Desktop zig-zag layout ──────────────────────────── */}
      <div className="hidden md:block relative">
        {/* Central spine — draws downward on scroll */}
        <div
          aria-hidden
          className="absolute top-3.5 bottom-3.5 w-px"
          style={{
            left: "50%",
            transform: journeyVisible
              ? "translateX(-50%) scaleY(1)"
              : "translateX(-50%) scaleY(0)",
            transformOrigin: "top center",
            background: SPINE_GRADIENT,
            zIndex: 0,
            transition: "transform 2.8s cubic-bezier(0.16,1,0.3,1)",
          }}
        />

        <div className="flex flex-col" style={{ gap: 18 }}>
          {CHECKPOINTS.map((cp, i) => {
            const isRight = i % 2 !== 0;
            return (
              <div key={cp.id} className="relative flex items-center" style={{ zIndex: 1 }}>
                {/* Left slot */}
                <div className="flex flex-1 justify-end pr-7">
                  {!isRight && <CheckpointCard cp={cp} delay={i * 100} side="left" />}
                </div>

                {/* Center dot + connector bridge */}
                <SpineDot cp={cp} connectorSide={isRight ? "right" : "left"} />

                {/* Right slot */}
                <div className="flex-1 pl-7">
                  {isRight && <CheckpointCard cp={cp} delay={i * 100} side="right" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── OutcomesStrip ─────────────────────────────────────────────────────────────

function OutcomesStrip() {
  const { ref, visible } = useInView(0.15);
  return (
    <div
      ref={ref}
      className="mt-11 rounded-[20px] px-6 py-[22px] backdrop-blur-xl"
      style={{
        border: "1px solid rgba(139,92,246,0.18)",
        background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(8,6,18,0.85) 100%)",
        WebkitBackdropFilter: "blur(20px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/28">
        You walk away with
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {OUTCOMES.map((o) => (
          <div key={o.text} className="flex items-center gap-2">
            <div
              className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{
                background: `rgba(${o.rgb},0.9)`,
                boxShadow: `0 0 8px rgba(${o.rgb},0.55)`,
              }}
            />
            <span className="text-[13px] leading-[1.35] text-white/70">{o.text}</span>
          </div>
        ))}
      </div>
      <p className="mt-3.5 border-t border-white/5 pt-3.5 text-[11px] leading-[1.55] text-white/22">
        Regardless of whether you continue to coaching — every insight from this session is yours to keep.
      </p>
    </div>
  );
}

// ─── CTABlock ──────────────────────────────────────────────────────────────────

function CTABlock() {
  const { ref, visible } = useInView(0.15);
  return (
    <div
      ref={ref}
      className="mt-12 text-center"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      {/* Two testimonials — side by side on desktop, stacked on mobile */}
      <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TESTIMONIALS.map((t, i) => (
          <div
            key={i}
            className="rounded-[16px] py-[18px] px-5 text-left backdrop-blur-xl"
            style={{
              border: "1px solid rgba(139,92,246,0.15)",
              background: "rgba(139,92,246,0.05)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div className="mb-2.5 flex gap-1">
              {[0, 1, 2, 3, 4].map((j) => (
                <svg key={j} viewBox="0 0 12 12" fill="#a855f7" width="11" height="11" aria-hidden>
                  <path d="M6 1l1.27 2.572L10 4.07l-2 1.947.472 2.752L6 7.5 3.528 8.769 4 6.017 2 4.07l2.73-.498z" />
                </svg>
              ))}
            </div>
            <p className="mb-2.5 text-[12.5px] italic leading-[1.65] text-white/55">
              &ldquo;{t.quote}&rdquo;
            </p>
            <span className="text-[11px] font-semibold tracking-[0.03em] text-purple-400/75">
              — {t.name}, {t.city}&nbsp;&nbsp;·&nbsp;&nbsp;{t.condition}
            </span>
          </div>
        ))}
      </div>

      <div className="cta-wrap cta-glow-mid">
        <CtaButton
          variant="primary"
          label="Reserve My Private Thyroid Clarity Session"
          sublabel="60 min · 1-on-1 with Swapnil · Written plan included"
          ariaLabel="Reserve your private thyroid clarity session"
          location="strategy_session"
        />
      </div>

      <p className="mt-3.5 text-[11px] font-medium leading-[1.5] text-white/28">
        <span className="mr-1.5 text-emerald-400/65" aria-hidden>✓</span>
        Full refund if you don&apos;t leave with complete clarity — no questions asked
      </p>

      <div className="mt-3.5 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {TRUST.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-[11px] text-white/24">
            <svg viewBox="0 0 10 10" fill="none" width="10" height="10" aria-hidden>
              <path
                d="M2 5l2 2 4-4"
                stroke="rgba(139,92,246,0.6)"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export default function ThyroidStrategySession() {
  const { ref: headerRef, visible: headerVisible } = useInView(0.18);

  return (
    <section
      id="strategy-session"
      className="relative w-full overflow-hidden py-24"
      aria-labelledby="tss-heading"
    >
      {/* Atmospheric background */}
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

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[760px] px-5">

        {/* Header */}
        <div
          ref={headerRef}
          className="mb-16 text-center"
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.65s ease, transform 0.65s ease",
          }}
        >
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-[5px]"
            style={{
              border: "1px solid rgba(139,92,246,0.28)",
              background: "rgba(139,92,246,0.08)",
            }}
          >
            <span className="block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-500 tss-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-300">
              What Happens Inside Your Session
            </span>
          </div>

          <h2
            id="tss-heading"
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

          <p className="mx-auto max-w-[400px] text-[14px] leading-[1.65] text-white/40">
            Not a sales call. Not generic advice. A structured diagnostic experience — built
            specifically for women with thyroid struggles.
          </p>
        </div>

        {/* Zig-zag journey */}
        <JourneySection />

        {/* Outcomes strip — narrower */}
        <div className="mx-auto max-w-[540px]">
          <OutcomesStrip />
        </div>

        {/* CTA */}
        <div className="mx-auto max-w-[480px]">
          <CTABlock />
        </div>

        {/* Section bridge */}
        <p
          aria-hidden
          className="mt-14 text-center text-[11px] uppercase tracking-[0.14em] text-white/18"
        >
          ↓&nbsp;&nbsp;See what women say after their session
        </p>
      </div>
    </section>
  );
}
