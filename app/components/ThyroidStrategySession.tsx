"use client";

import { useEffect, useRef, useState } from "react";
import CtaButton from "./CtaButton";

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

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
  { text: "Why your fat loss is blocked", rgb: "168,85,247" },
  { text: "Your labs decoded in plain language", rgb: "232,121,249" },
  { text: "Thyroid-specific food direction", rgb: "251,113,133" },
  { text: "30-day next steps — in writing", rgb: "52,211,153" },
];

const TRUST = [
  "Private & confidential",
  "Built for hypothyroid women",
  "No crash diet advice",
  "Personalized to your symptoms",
];

const SPINE_GRADIENT =
  "linear-gradient(to bottom, rgba(168,85,247,0.38) 0%, rgba(232,121,249,0.28) 20%, rgba(251,113,133,0.22) 40%, rgba(251,191,36,0.24) 60%, rgba(52,211,153,0.3) 80%, rgba(96,165,250,0.22) 100%)";

// ─── CheckpointCard ────────────────────────────────────────────────────────────

function CheckpointCard({ cp, delay }: { cp: CP; delay: number }) {
  const { ref, visible } = useInView(0.07);
  const gradId = `tss-g-${cp.id}`;

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
        borderRadius: 20,
        border: `1px solid rgba(${cp.rgb},0.2)`,
        background: `linear-gradient(140deg, rgba(${cp.rgb},0.1) 0%, rgba(8,6,18,0.9) 60%)`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        padding: "20px 22px",
        position: "relative" as const,
        overflow: "hidden",
        boxShadow: `0 0 48px rgba(${cp.rgb},0.06), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Ambient glow top-right */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -28,
          right: -28,
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(${cp.rgb},0.18) 0%, transparent 70%)`,
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />

      {/* Icon + meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            border: `1px solid rgba(${cp.rgb},0.32)`,
            background: `radial-gradient(circle at 35% 35%, rgba(${cp.rgb},0.22) 0%, rgba(${cp.rgb},0.06) 100%)`,
            boxShadow: `0 0 18px rgba(${cp.rgb},0.28)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative" as const,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 11,
              border: `1px solid rgba(${cp.rgb},0.55)`,
              animation: "tss-ring 3.2s ease-in-out infinite",
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
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase" as const,
              color: `rgba(${cp.rgb},0.75)`,
              display: "block",
              lineHeight: 1.4,
            }}
          >
            {cp.eyebrow}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.2)",
              textTransform: "uppercase" as const,
            }}
          >
            Step {cp.id}
          </span>
        </div>
      </div>

      <h3
        style={{
          fontSize: "clamp(14.5px, 2.4vw, 16px)",
          fontWeight: 700,
          lineHeight: 1.28,
          letterSpacing: "-0.018em",
          color: "rgba(255,255,255,0.95)",
          margin: "0 0 8px",
        }}
      >
        {cp.title}
      </h3>

      <p style={{ fontSize: 12.5, lineHeight: 1.68, color: "rgba(255,255,255,0.4)", margin: 0 }}>
        {cp.body}
      </p>

      {cp.tag && (
        <div
          style={{
            marginTop: 11,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 9px",
            borderRadius: 99,
            border: `1px solid rgba(${cp.rgb},0.22)`,
            background: `rgba(${cp.rgb},0.07)`,
          }}
        >
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: `rgba(${cp.rgb},0.85)`, flexShrink: 0 }} />
          <span style={{ fontSize: 9.5, fontWeight: 500, color: `rgba(${cp.rgb},0.72)`, letterSpacing: "0.02em" }}>
            {cp.tag}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── SpineDot (desktop center node) ───────────────────────────────────────────

function SpineDot({ cp }: { cp: CP }) {
  const { ref, visible } = useInView(0.07);
  return (
    <div ref={ref} style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${cp.hex} 0%, ${cp.hexTo} 100%)`,
          boxShadow: visible
            ? `0 0 0 5px rgba(${cp.rgb},0.14), 0 0 24px rgba(${cp.rgb},0.6), 0 0 48px rgba(${cp.rgb},0.2)`
            : "none",
          transition: "box-shadow 0.7s ease 200ms",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

// ─── Journey Section ───────────────────────────────────────────────────────────

function JourneySection() {
  return (
    <div style={{ position: "relative" }}>
      {/* ── Mobile layout ───────────────────────────────────── */}
      <div className="md:hidden" style={{ position: "relative" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 14,
            top: 10,
            bottom: 10,
            width: 1,
            background: SPINE_GRADIENT,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {CHECKPOINTS.map((cp, i) => (
            <div key={cp.id} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {/* Spine dot */}
              <div style={{ flexShrink: 0, width: 28, paddingTop: 22, display: "flex", justifyContent: "center" }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${cp.hex} 0%, ${cp.hexTo} 100%)`,
                    boxShadow: `0 0 12px rgba(${cp.rgb},0.55), 0 0 0 3px rgba(${cp.rgb},0.13)`,
                    position: "relative" as const,
                    zIndex: 1,
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <CheckpointCard cp={cp} delay={i * 80} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Desktop zig-zag layout ──────────────────────────── */}
      <div className="hidden md:block" style={{ position: "relative" }}>
        {/* Central spine */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: 14,
            bottom: 14,
            width: 1,
            transform: "translateX(-50%)",
            background: SPINE_GRADIENT,
            zIndex: 0,
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {CHECKPOINTS.map((cp, i) => {
            const isRight = i % 2 !== 0;
            return (
              <div
                key={cp.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  position: "relative" as const,
                  zIndex: 1,
                }}
              >
                {/* Left slot */}
                <div style={{ flex: 1, paddingRight: 28, display: "flex", justifyContent: "flex-end" }}>
                  {!isRight && (
                    <div style={{ width: "100%" }}>
                      <CheckpointCard cp={cp} delay={i * 100} />
                    </div>
                  )}
                </div>

                {/* Center dot */}
                <div style={{ width: 44, flexShrink: 0 }}>
                  <SpineDot cp={cp} />
                </div>

                {/* Right slot */}
                <div style={{ flex: 1, paddingLeft: 28 }}>
                  {isRight && (
                    <div style={{ width: "100%" }}>
                      <CheckpointCard cp={cp} delay={i * 100} />
                    </div>
                  )}
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
      style={{
        marginTop: 44,
        borderRadius: 20,
        border: "1px solid rgba(139,92,246,0.18)",
        background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(8,6,18,0.85) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        padding: "22px 24px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase" as const,
          color: "rgba(255,255,255,0.28)",
          margin: "0 0 16px",
        }}
      >
        You walk away with
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
        {OUTCOMES.map((o) => (
          <div key={o.text} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: `rgba(${o.rgb},0.9)`,
                boxShadow: `0 0 8px rgba(${o.rgb},0.55)`,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.35 }}>
              {o.text}
            </span>
          </div>
        ))}
      </div>
      <p
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.2)",
          margin: "14px 0 0",
          paddingTop: 14,
          borderTop: "1px solid rgba(255,255,255,0.05)",
          lineHeight: 1.55,
        }}
      >
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
      style={{
        marginTop: 48,
        textAlign: "center",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      {/* Testimonial card */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(139,92,246,0.15)",
          background: "rgba(139,92,246,0.05)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "18px 20px",
          marginBottom: 28,
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
          {[0,1,2,3,4].map((i) => (
            <svg key={i} viewBox="0 0 12 12" fill="#a855f7" width="11" height="11" aria-hidden>
              <path d="M6 1l1.27 2.572L10 4.07l-2 1.947.472 2.752L6 7.5 3.528 8.769 4 6.017 2 4.07l2.73-.498z" />
            </svg>
          ))}
        </div>
        <p
          style={{
            fontSize: 13,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.55)",
            margin: "0 0 10px",
            lineHeight: 1.65,
          }}
        >
          &ldquo;More clarity about my thyroid in 60 minutes than 3 years of trying to figure it out alone. I finally understand why nothing was working.&rdquo;
        </p>
        <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(139,92,246,0.75)", letterSpacing: "0.03em" }}>
          — Priya M., Pune&nbsp;&nbsp;·&nbsp;&nbsp;Hashimoto&apos;s
        </span>
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

      <p
        style={{
          marginTop: 14,
          fontSize: 11,
          fontWeight: 500,
          color: "rgba(255,255,255,0.28)",
          lineHeight: 1.5,
        }}
      >
        <span style={{ color: "rgba(52,211,153,0.65)", marginRight: 5 }} aria-hidden>✓</span>
        Full refund if you don&apos;t leave with complete clarity — no questions asked
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "6px 16px",
          marginTop: 14,
        }}
      >
        {TRUST.map((t) => (
          <span key={t} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.24)" }}>
            <svg viewBox="0 0 10 10" fill="none" width="10" height="10" aria-hidden>
              <path d="M2 5l2 2 4-4" stroke="rgba(139,92,246,0.6)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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
    <>
      <style>{`
        @keyframes tss-ring {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 0.75; transform: scale(1.1); }
        }
        @keyframes tss-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.28); }
        }
      `}</style>

      <section
        id="strategy-session"
        className="relative w-full overflow-hidden"
        style={{ paddingTop: 96, paddingBottom: 96 }}
        aria-labelledby="tss-heading"
      >
        {/* Atmospheric background */}
        <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              top: -100,
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(720px,100vw)",
              height: "min(520px,80vw)",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(139,92,246,0.16) 0%, transparent 70%)",
              filter: "blur(55px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: "-5%",
              width: "min(420px,70vw)",
              height: "min(320px,55vw)",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(52,211,153,0.09) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "40%",
              left: "-5%",
              width: "min(300px,50vw)",
              height: "min(300px,50vw)",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(232,121,249,0.06) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
        </div>

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 880,
            marginLeft: "auto",
            marginRight: "auto",
            paddingLeft: 20,
            paddingRight: 20,
          }}
        >
          {/* Header */}
          <div
            ref={headerRef}
            style={{
              textAlign: "center",
              marginBottom: 60,
              opacity: headerVisible ? 1 : 0,
              transform: headerVisible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.65s ease, transform 0.65s ease",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 14px",
                borderRadius: 99,
                border: "1px solid rgba(139,92,246,0.28)",
                background: "rgba(139,92,246,0.08)",
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#a855f7",
                  animation: "tss-pulse 2.2s ease-in-out infinite",
                  display: "block",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase" as const,
                  color: "#c4b5fd",
                }}
              >
                What Happens Inside Your Session
              </span>
            </div>

            <h2
              id="tss-heading"
              style={{
                fontSize: "clamp(26px, 5vw, 42px)",
                fontWeight: 700,
                lineHeight: 1.17,
                letterSpacing: "-0.028em",
                color: "#fff",
                margin: "0 auto 16px",
                maxWidth: 540,
              }}
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

            <p
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.4)",
                margin: "0 auto",
                maxWidth: 400,
                lineHeight: 1.65,
              }}
            >
              Not a sales call. Not generic advice. A structured diagnostic experience — built specifically for women with thyroid struggles.
            </p>
          </div>

          {/* Zig-zag journey */}
          <JourneySection />

          {/* Outcomes strip — narrower container */}
          <div style={{ maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
            <OutcomesStrip />
          </div>

          {/* CTA — narrowest container */}
          <div style={{ maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
            <CTABlock />
          </div>

          {/* Section bridge */}
          <p
            aria-hidden
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "rgba(255,255,255,0.18)",
              letterSpacing: "0.14em",
              textTransform: "uppercase" as const,
              marginTop: 52,
            }}
          >
            ↓&nbsp;&nbsp;See what women say after their session
          </p>
        </div>
      </section>
    </>
  );
}
