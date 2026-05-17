"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Step {
  id: number;
  timing: string;
  eyebrow: string;
  headline: string;
  body: string;
  trust: string;
  icon: React.FC<{ className?: string }>;
  accentColor: string;
  glowColor: string;
  emotionalTag: string;
}

// ─── Custom SVG Icons (no external deps) ─────────────────────────────────────

const IconIntake: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" strokeWidth="1.5" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="3" width="18" height="26" rx="2.5" strokeLinejoin="round" />
    <path d="M11 3v3a1 1 0 001 1h8a1 1 0 001-1V3" strokeLinejoin="round" />
    <path d="M11 14h10M11 18h7" strokeLinecap="round" />
    <circle cx="21.5" cy="22.5" r="4.5" fill="currentColor" fillOpacity="0.12" />
    <path d="M19.5 22.5l1.5 1.5 2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconAnalysis: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" strokeWidth="1.5" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14" cy="14" r="9" />
    <path d="M21 21l6 6" strokeLinecap="round" />
    <path d="M10 14h8M14 10v8" strokeLinecap="round" />
    <circle cx="14" cy="14" r="3" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

const IconListen: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" strokeWidth="1.5" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 10c0-3.3 2.7-6 6-6h12c3.3 0 6 2.7 6 6v6c0 3.3-2.7 6-6 6h-3l-5 5v-5H10c-3.3 0-6-2.7-6-6v-6z" strokeLinejoin="round" />
    <path d="M10 14h12M10 10h8" strokeLinecap="round" />
    <circle cx="22" cy="14" r="1.5" fill="currentColor" />
  </svg>
);

const IconBrain: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" strokeWidth="1.5" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 28V16M16 16c0-2-1.5-4-4-4a4 4 0 000 8h4M16 16c0-2 1.5-4 4-4a4 4 0 010 8h-4" strokeLinejoin="round" />
    <path d="M12 12a5 5 0 015-8M20 12a5 5 0 00-5-8" strokeLinejoin="round" />
    <circle cx="12" cy="20" r="1.5" fill="currentColor" fillOpacity="0.5" />
    <circle cx="20" cy="20" r="1.5" fill="currentColor" fillOpacity="0.5" />
    <circle cx="16" cy="16" r="1.5" fill="currentColor" />
  </svg>
);

const IconCompass: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" strokeWidth="1.5" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="12" />
    <path d="M16 4v2M16 26v2M4 16H6M26 16h2" strokeLinecap="round" />
    <path d="M20 12l-3 8-2-4-4 2 3-8 2 4 4-2z" fill="currentColor" fillOpacity="0.2" strokeLinejoin="round" />
    <circle cx="16" cy="16" r="1.5" fill="currentColor" />
  </svg>
);

const IconSummary: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" strokeWidth="1.5" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="6" width="24" height="20" rx="2.5" strokeLinejoin="round" />
    <path d="M4 12h24" />
    <path d="M8 17h6M8 21h10" strokeLinecap="round" />
    <path d="M20 17l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Step Data ────────────────────────────────────────────────────────────────

const steps: Step[] = [
  {
    id: 1,
    timing: "Immediately after booking",
    eyebrow: "Step 01 · Before We Meet",
    headline: "Your Personalized Thyroid Intake",
    body: "Within minutes of booking, you'll receive a private intake form built specifically for thyroid concerns. Your history, labs, past diets, energy patterns, and frustrations — reviewed by Swapnil personally before your call. You will never need to repeat your story.",
    trust: "Completely private. Reviewed by Swapnil before your session.",
    icon: IconIntake,
    accentColor: "from-violet-400 to-purple-500",
    glowColor: "rgba(139, 92, 246, 0.25)",
    emotionalTag: "You're already being seen.",
  },
  {
    id: 2,
    timing: "24 hours before your call",
    eyebrow: "Step 02 · Your History Studied",
    headline: "Patterns Identified. No Catch-Up Time.",
    body: "Swapnil studies your intake before you arrive. He identifies your most likely hormonal blockers, maps your thyroid history, and comes prepared. You don't spend 20 minutes explaining yourself. You spend 60 minutes getting answers.",
    trust: "This preparation is what makes 60 minutes feel like a turning point.",
    icon: IconAnalysis,
    accentColor: "from-purple-400 to-fuchsia-500",
    glowColor: "rgba(168, 85, 247, 0.25)",
    emotionalTag: "He's already thinking about you.",
  },
  {
    id: 3,
    timing: "Minutes 0–15",
    eyebrow: "Step 03 · Deep Listening",
    headline: "Finally — Someone Who Listens First.",
    body: "The session opens with the one thing most doctors skip: truly listening. Your energy. Your relationship with food. Your sleep, your stress, your cycle. No script. No timer pressure. Just a specialist who has heard your exact story — and knows what it means.",
    trust: "Most clients say they felt heard within the first five minutes.",
    icon: IconListen,
    accentColor: "from-fuchsia-400 to-pink-500",
    glowColor: "rgba(217, 70, 239, 0.2)",
    emotionalTag: "Not rushed. Not dismissed.",
  },
  {
    id: 4,
    timing: "Minutes 15–45",
    eyebrow: "Step 04 · Thyroid Blocker Analysis",
    headline: "The Exact Reason Fat Isn't Moving.",
    body: "This is the moment most clients describe as transformative. Swapnil names your specific blockers — whether it's cortisol, nutrient depletion, medication timing, or your current eating pattern — and explains in clear language how your thyroid is connected to the weight that hasn't moved despite everything.",
    trust: "Named, explained, and specific to you. Not a generic checklist.",
    icon: IconBrain,
    accentColor: "from-rose-400 to-pink-500",
    glowColor: "rgba(251, 113, 133, 0.2)",
    emotionalTag: "Finally, an explanation that makes sense.",
  },
  {
    id: 5,
    timing: "Minutes 45–55",
    eyebrow: "Step 05 · Your Action Roadmap",
    headline: "Three Steps. Written Down. Yours to Keep.",
    body: "You leave with three specific, personalized actions you can take immediately — regardless of whether you continue to coaching. This is not a teaser. Not a cliffhanger. This is a real strategy built from your intake, your blockers, and your life.",
    trust: "This alone is worth more than ₹299. Most clients say it.",
    icon: IconCompass,
    accentColor: "from-amber-400 to-orange-400",
    glowColor: "rgba(251, 191, 36, 0.2)",
    emotionalTag: "Clarity. For the first time.",
  },
  {
    id: 6,
    timing: "Within 24 hours after the call",
    eyebrow: "Step 06 · Written Clarity Summary",
    headline: "Everything We Discussed. In Writing.",
    body: "Within 24 hours, you receive a written summary — your key thyroid blockers, your personalized action steps, and any resources Swapnil recommended. It's yours permanently. Because real support doesn't end when the call does.",
    trust: "No upsell attached. No conditions. Just your clarity, documented.",
    icon: IconSummary,
    accentColor: "from-teal-400 to-emerald-400",
    glowColor: "rgba(52, 211, 153, 0.2)",
    emotionalTag: "Something tangible. Something lasting.",
  },
];

// ─── useInView hook ──────────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

// ─── StepCard ────────────────────────────────────────────────────────────────

function StepCard({ step, index }: { step: Step; index: number }) {
  const { ref, inView } = useInView(0.1);
  const Icon = step.icon;
  const isEven = index % 2 === 0;

  return (
    <div
      ref={ref}
      className="relative flex flex-col sm:flex-row items-start gap-0"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.65s ease ${index * 120}ms, transform 0.65s ease ${index * 120}ms`,
      }}
    >
      {/* ── Timeline node + connector line ─────────────────────── */}
      <div className="relative flex flex-col items-center flex-shrink-0 mr-5 sm:mr-8">
        {/* Glow node */}
        <div
          className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full border border-white/20"
          style={{
            background: `radial-gradient(circle at center, ${step.glowColor}, rgba(255,255,255,0.04))`,
            boxShadow: `0 0 24px ${step.glowColor}, 0 0 0 1px rgba(255,255,255,0.08)`,
          }}
        >
          <Icon className={`w-5 h-5 bg-gradient-to-br ${step.accentColor} [background-clip:text] [-webkit-background-clip:text] text-transparent`} />
        </div>
        {/* Connector line — hidden after last item */}
        {index < steps.length - 1 && (
          <div
            className="w-px mt-1 flex-1 min-h-[64px]"
            style={{
              background: inView
                ? `linear-gradient(to bottom, ${step.glowColor}, rgba(255,255,255,0.03))`
                : "rgba(255,255,255,0.04)",
              transition: `background 0.8s ease ${index * 120 + 400}ms`,
            }}
          />
        )}
      </div>

      {/* ── Card ──────────────────────────────────────────────── */}
      <div
        className="group relative flex-1 mb-10 sm:mb-14 rounded-2xl border border-white/[0.07] overflow-hidden cursor-default"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          transition: "box-shadow 0.3s ease, border-color 0.3s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 48px ${step.glowColor}, 0 0 0 1px rgba(255,255,255,0.12)`;
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
        }}
      >
        {/* Subtle gradient top edge accent */}
        <div
          className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r ${step.accentColor} opacity-40`}
        />

        <div className="p-6 sm:p-8">
          {/* Top row: timing + emotional tag */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border border-white/10"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {step.timing}
            </span>
            <span
              className={`text-[10px] font-medium italic bg-gradient-to-r ${step.accentColor} [background-clip:text] [-webkit-background-clip:text] text-transparent`}
            >
              {step.emotionalTag}
            </span>
          </div>

          {/* Eyebrow */}
          <p
            className={`text-[11px] font-bold uppercase tracking-[0.2em] mb-2 bg-gradient-to-r ${step.accentColor} [background-clip:text] [-webkit-background-clip:text] text-transparent`}
          >
            {step.eyebrow}
          </p>

          {/* Headline */}
          <h3 className="text-lg sm:text-xl font-semibold text-white leading-snug mb-3 tracking-tight">
            {step.headline}
          </h3>

          {/* Body */}
          <p className="text-sm sm:text-[15px] leading-relaxed text-white/60 mb-5">
            {step.body}
          </p>

          {/* Trust microcopy */}
          <div className="flex items-start gap-2.5 pt-4 border-t border-white/[0.06]">
            <div
              className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-gradient-to-br ${step.accentColor} flex items-center justify-center`}
              style={{ minWidth: 16 }}
            >
              <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5">
                <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-xs text-white/40 leading-relaxed">{step.trust}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader() {
  const { ref, inView } = useInView(0.2);
  return (
    <div
      ref={ref}
      className="text-center mb-16 sm:mb-20"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
      }}
    >
      {/* Eyebrow pill */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/[0.08] mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-300">
          Your Strategy Session
        </span>
      </div>

      {/* Headline */}
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white leading-tight tracking-tight mb-4 max-w-2xl mx-auto">
        Your 60-Minute{" "}
        <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 [background-clip:text] [-webkit-background-clip:text] text-transparent">
          Thyroid Strategy Session
        </span>
      </h2>

      {/* Subheadline */}
      <p className="text-base sm:text-lg text-white/55 max-w-xl mx-auto leading-relaxed">
        This is not a sales call. This is a personalized diagnostic experience —
        designed to give you clarity your body has been waiting for.
      </p>

      {/* Divider accent */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <div className="h-px w-12 bg-gradient-to-r from-transparent to-purple-500/50" />
        <div className="w-1.5 h-1.5 rounded-full bg-purple-400/60" />
        <div className="h-px w-12 bg-gradient-to-l from-transparent to-purple-500/50" />
      </div>
    </div>
  );
}

// ─── MicroCTA ─────────────────────────────────────────────────────────────────

function MicroCTA() {
  const { ref, inView } = useInView(0.2);
  return (
    <div
      ref={ref}
      className="text-center mt-12 sm:mt-16"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
      }}
    >
      {/* Reassurance quote */}
      <p className="text-sm text-white/40 italic max-w-lg mx-auto mb-8 leading-relaxed">
        &ldquo;Most women tell me the session alone gave them more clarity than 3 years of trying everything else.&rdquo;
      </p>
      <p className="text-xs text-white/30 mb-6 tracking-wide">— Swapnil Umbarkar, Thyroid Fat-Loss Specialist</p>

      {/* CTA Button */}
      <div className="flex flex-col items-center gap-3">
        <a
          href="#book"
          className="group relative inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-semibold text-white overflow-hidden transition-all duration-300"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.9) 0%, rgba(168,85,247,0.9) 50%, rgba(217,70,239,0.85) 100%)",
            boxShadow: "0 0 32px rgba(139,92,246,0.35), 0 1px 0 rgba(255,255,255,0.12) inset",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 48px rgba(139,92,246,0.55), 0 1px 0 rgba(255,255,255,0.15) inset";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 32px rgba(139,92,246,0.35), 0 1px 0 rgba(255,255,255,0.12) inset";
            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          }}
        >
          <span>Reserve My ₹299 Strategy Session</span>
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        {/* Micro trust signals */}
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5 mt-2">
          {["Full refund guarantee", "Private & confidential", "No sales pressure"].map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-[11px] text-white/35">
              <svg viewBox="0 0 10 10" fill="none" className="w-3 h-3">
                <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ThyroidStrategySession() {
  return (
    <>
      {/* Scoped keyframe styles */}
      <style>{`
        @keyframes tss-pulse-glow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      <section
        id="strategy-session"
        className="relative w-full overflow-hidden py-24 sm:py-32"
        aria-labelledby="strategy-session-heading"
      >
        {/* ── Background atmosphere ─────────────────────────────── */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        >
          {/* Deep radial glow — top center */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-25"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(139,92,246,0.4) 0%, rgba(109,40,217,0.15) 40%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          {/* Bottom soft glow */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-15"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(217,70,239,0.3) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
          {/* Subtle grid texture */}
          <div
            className="absolute inset-0 opacity-[0.018]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        {/* ── Content container ─────────────────────────────────── */}
        <div className="relative mx-auto max-w-3xl px-5 sm:px-8">
          {/* Section header */}
          <SectionHeader />

          {/* Timeline */}
          <div className="relative">
            {steps.map((step, index) => (
              <StepCard key={step.id} step={step} index={index} />
            ))}
          </div>

          {/* Micro CTA */}
          <MicroCTA />

          {/* Transition bridge to next section */}
          <div className="mt-16 sm:mt-20 text-center">
            <p className="text-xs text-white/25 tracking-widest uppercase">
              ↓ &nbsp; See what women are saying after their session
            </p>
          </div>
        </div>
      </section>
    </>
  );
}