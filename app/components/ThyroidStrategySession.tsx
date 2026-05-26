"use client";

import { useEffect, useRef, useState } from "react";
import CtaButton from "./CTAButton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlowStep {
  num: string;
  label: string;
  micro: string;
  rgb: string;       // "R,G,B" for rgba()
  hex: string;       // start color for icon gradient
  hexTo: string;     // end color for icon gradient
  svgPaths: string[];
}

// ─── Step data — ultra-concise, no paragraphs ─────────────────────────────────

const STEPS: FlowStep[] = [
  {
    num: "01",
    label: "Your Private Intake",
    micro: "Reviewed personally — before we speak.",
    rgb: "139,92,246",
    hex: "#8B5CF6",
    hexTo: "#6D28D9",
    svgPaths: [
      "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2",
      "M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
      "M9 12l2 2 4-4",
    ],
  },
  {
    num: "02",
    label: "Case Prepared",
    micro: "Your history studied before we meet.",
    rgb: "167,139,250",
    hex: "#A78BFA",
    hexTo: "#7C3AED",
    svgPaths: [
      "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
    ],
  },
  {
    num: "03",
    label: "Deep Listening",
    micro: "No scripts. No clock watching.",
    rgb: "232,121,249",
    hex: "#E879F9",
    hexTo: "#A855F7",
    svgPaths: [
      "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155",
    ],
  },
  {
    num: "04",
    label: "Thyroid Blockers Named",
    micro: "The real reason fat isn't moving.",
    rgb: "251,113,133",
    hex: "#FB7185",
    hexTo: "#E11D48",
    svgPaths: [
      "M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18",
    ],
  },
  {
    num: "05",
    label: "Your Action Strategy",
    micro: "Three steps. Specific to you. Yours now.",
    rgb: "251,191,36",
    hex: "#FBBF24",
    hexTo: "#D97706",
    svgPaths: [
      "M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z",
    ],
  },
  {
    num: "06",
    label: "Written Summary Sent",
    micro: "In your inbox within 24 hours.",
    rgb: "52,211,153",
    hex: "#34D399",
    hexTo: "#059669",
    svgPaths: [
      "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
    ],
  },
];

const OUTCOMES = [
  { text: "Thyroid clarity", rgb: "139,92,246" },
  { text: "Personalized actions", rgb: "232,121,249" },
  { text: "Written strategy", rgb: "52,211,153" },
  { text: "Real understanding", rgb: "251,191,36" },
];

const TRUST_SIGNALS = [
  "Private & confidential",
  "No sales pressure",
  "Written plan included",
] as const;

// ─── useInView ────────────────────────────────────────────────────────────────

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// ─── StepIcon — SVG with per-step linear gradient ────────────────────────────

function StepIcon({
  paths,
  hex,
  hexTo,
  gradId,
}: {
  paths: string[];
  hex: string;
  hexTo: string;
  gradId: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={`url(#${gradId})`}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={hex} />
          <stop offset="100%" stopColor={hexTo} />
        </linearGradient>
      </defs>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

// ─── FlowNode — single step in the vertical timeline ─────────────────────────

function FlowNode({ step, index }: { step: FlowStep; index: number }) {
  const { ref, visible } = useInView(0.08);
  const isLast = index === STEPS.length - 1;
  const delay = index * 90;
  const gradId = `tss-g-${step.num}`;

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        alignItems: "flex-start",
        position: "relative",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      {/* ── Left: spine column ─────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexShrink: 0,
          width: 44,
          marginRight: 18,
        }}
      >
        {/* Step number */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: `rgba(${step.rgb},0.7)`,
            marginBottom: 4,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {step.num}
        </span>

        {/* Icon node */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: `1px solid rgba(${step.rgb},${visible ? 0.35 : 0.1})`,
            background: `radial-gradient(circle at 40% 40%, rgba(${step.rgb},0.14), rgba(${step.rgb},0.04))`,
            boxShadow: visible
              ? `0 0 18px rgba(${step.rgb},0.22), 0 0 0 5px rgba(${step.rgb},0.05)`
              : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
            transition: `border-color 0.6s ease ${delay + 150}ms, box-shadow 0.6s ease ${delay + 150}ms`,
          }}
        >
          <StepIcon
            paths={step.svgPaths}
            hex={step.hex}
            hexTo={step.hexTo}
            gradId={gradId}
          />
        </div>

        {/* Connector — fades in after the node */}
        {!isLast && (
          <div
            style={{
              width: 1,
              flex: 1,
              minHeight: 48,
              marginTop: 4,
              background: `linear-gradient(to bottom, rgba(${step.rgb},0.35), rgba(${STEPS[index + 1].rgb},0.15))`,
              opacity: visible ? 1 : 0,
              transition: `opacity 0.7s ease ${delay + 350}ms`,
            }}
          />
        )}
      </div>

      {/* ── Right: concise text ────────────────────── */}
      <div
        style={{
          flex: 1,
          paddingTop: 14,
          paddingBottom: isLast ? 0 : 44,
        }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "rgba(255,255,255,0.90)",
            margin: "0 0 5px",
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}
        >
          {step.label}
        </h3>
        <p
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.38)",
            margin: 0,
            lineHeight: 1.55,
            letterSpacing: "0.005em",
          }}
        >
          {step.micro}
        </p>
      </div>
    </div>
  );
}

// ─── OutcomeCard ──────────────────────────────────────────────────────────────

function OutcomeCard() {
  const { ref, visible } = useInView(0.15);

  return (
    <div
      ref={ref}
      style={{
        marginTop: 48,
        borderRadius: 20,
        border: "1px solid rgba(139,92,246,0.2)",
        background:
          "linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(109,40,217,0.04) 50%, rgba(52,211,153,0.05) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        padding: "24px 24px 20px",
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translateY(0) scale(1)"
          : "translateY(12px) scale(0.99)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.3)",
          margin: "0 0 14px",
        }}
      >
        You leave with
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 12px",
        }}
      >
        {OUTCOMES.map((o) => (
          <div
            key={o.text}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: `rgba(${o.rgb},0.9)`,
                boxShadow: `0 0 8px rgba(${o.rgb},0.5)`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: "rgba(255,255,255,0.72)",
                lineHeight: 1.3,
              }}
            >
              {o.text}
            </span>
          </div>
        ))}
      </div>

      {/* Guarantee — the most conversion-relevant sentence on the page */}
      <p
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.22)",
          margin: "16px 0 0",
          paddingTop: 14,
          borderTop: "1px solid rgba(255,255,255,0.05)",
          lineHeight: 1.5,
        }}
      >
        Regardless of whether you continue to coaching — this is yours.
      </p>
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader() {
  const { ref, visible } = useInView(0.2);

  return (
    <div
      ref={ref}
      style={{
        textAlign: "center",
        marginBottom: 56,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.65s ease, transform 0.65s ease",
      }}
    >
      {/* Eyebrow pill — "When" invites cold traffic in vs "After" which presupposes booking */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 14px",
          borderRadius: 99,
          border: "1px solid rgba(139,92,246,0.28)",
          background: "rgba(139,92,246,0.08)",
          marginBottom: 18,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#A78BFA",
            animation: "tss-pulse 2s ease-in-out infinite",
            display: "block",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#C4B5FD",
          }}
        >
          What Happens When You Book
        </span>
      </div>

      {/* Headline */}
      <h2
        id="strategy-session-heading"
        style={{
          fontSize: "clamp(26px, 5vw, 40px)",
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: "-0.025em",
          color: "#fff",
          margin: "0 0 12px",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        Your 60-Minute{" "}
        <span
          style={{
            backgroundImage:
              "linear-gradient(135deg, #C084FC 0%, #8B5CF6 50%, #34D399 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Thyroid Strategy Session
        </span>
      </h2>

      {/* One line — maximum clarity */}
      <p
        style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.42)",
          margin: 0,
          letterSpacing: "0.005em",
        }}
      >
        Not a sales call. A structured diagnostic experience.
      </p>
    </div>
  );
}

// ─── CTABlock ─────────────────────────────────────────────────────────────────

function CTABlock() {
  const { ref, visible } = useInView(0.15);

  return (
    <div
      ref={ref}
      style={{
        marginTop: 48,
        textAlign: "center",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      {/* Attributed testimonial card — name + city + condition = evidence not decoration */}
      <div
        style={{
          borderRadius: 14,
          border: "1px solid rgba(139,92,246,0.15)",
          background: "rgba(139,92,246,0.05)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "16px 18px",
          marginBottom: 24,
          textAlign: "left",
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.52)",
            margin: "0 0 10px",
            lineHeight: 1.65,
          }}
        >
          &ldquo;More clarity in 60 minutes than 3 years of trying alone.&rdquo;
        </p>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(139,92,246,0.75)",
            letterSpacing: "0.03em",
          }}
        >
          — Priya M., Pune&nbsp;&nbsp;·&nbsp;&nbsp;Hashimoto&apos;s
        </span>
      </div>

      {/* Medium-intensity glow wrapper — psychological escalation */}
      <div className="cta-wrap cta-glow-mid" style={{ marginBottom: 0 }}>
        <CtaButton
          variant="primary"
          label="Reserve My Private Thyroid Session"
          sublabel="60 min · 1-on-1 · Written action plan included"
          ariaLabel="Reserve your private thyroid strategy session"
          location="strategy_session"
        />
      </div>

      {/* Refund guarantee — single high-trust line */}
      <p
        style={{
          marginTop: 12,
          textAlign: "center",
          fontSize: 11,
          fontWeight: 500,
          color: "rgba(255,255,255,0.28)",
          lineHeight: 1.5,
        }}
      >
        <span
          style={{ color: "rgba(52,211,153,0.65)", marginRight: 5 }}
          aria-hidden="true"
        >
          ✓
        </span>
        Full refund if you don&apos;t leave with complete clarity
      </p>

      {/* Trust trio */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "6px 18px",
          marginTop: 12,
        }}
      >
        {TRUST_SIGNALS.map((t) => (
          <span
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "rgba(255,255,255,0.24)",
            }}
          >
            <svg
              viewBox="0 0 10 10"
              fill="none"
              width="10"
              height="10"
              aria-hidden="true"
            >
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

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function ThyroidStrategySession() {
  return (
    <>
      <style>{`
        @keyframes tss-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>

      <section
        id="strategy-session"
        className="relative w-full overflow-hidden"
        style={{ paddingTop: 96, paddingBottom: 96 }}
        aria-labelledby="strategy-session-heading"
      >
        {/* Atmospheric background — fluid min() widths prevent overflow on 390px Android */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -80,
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(600px, 100vw)",
              height: "min(500px, 80vw)",
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse, rgba(139,92,246,0.18) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(400px, 90vw)",
              height: "min(300px, 60vw)",
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse, rgba(52,211,153,0.1) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
        </div>

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 480,
            marginLeft: "auto",
            marginRight: "auto",
            paddingLeft: 20,
            paddingRight: 20,
          }}
        >
          <SectionHeader />

          <div style={{ position: "relative" }}>
            {STEPS.map((step, i) => (
              <FlowNode key={step.num} step={step} index={i} />
            ))}
          </div>

          <OutcomeCard />
          <CTABlock />

          {/* Section bridge — aria-hidden: ↓ is decorative, not content */}
          <p
            aria-hidden="true"
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "rgba(255,255,255,0.18)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginTop: 48,
            }}
          >
            ↓&nbsp;&nbsp;See what women say after their session
          </p>
        </div>
      </section>
    </>
  );
}