"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trackPurchase, trackSchedule } from "../lib/analytics";
import { persistUserIdentity } from "../components/tracking/UserIdentityTracker";
import { NATIVE_BOOKING_KEY } from "../book/components/BookingFlow";
import type { Step1Data } from "../book/components/BookingFlow";

// ── Config ────────────────────────────────────────────────────────────────────

const CALENDLY_URL = [
  "https://calendly.com/fitnessbyswapnil/60min",
  "?hide_event_type_details=1",
  "&hide_gdpr_banner=1",
  "&hide_landing_page_details=1",
  "&primary_color=3B5A33",
  "&text_color=171310",
  "&background_color=F7F4EF",
].join("");

// ── Types ─────────────────────────────────────────────────────────────────────

type Step2_5Data = {
  weightStruggles: string[];
  biggestFrustration: string;
  energyLevel: string;
  onMedication: string;
  specialistHistory: string;
  energyLow: string;
  triedBefore: string[];
  transformationGoal: string;
  eatingApproach: string;
};

type FlowStage = "intake" | "calendly" | "confirmation";

// ── Progress Stepper ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Your Profile" },
  { id: 2, label: "Secure Slot" },
  { id: 3, label: "Deep Intake" },
  { id: 4, label: "Book Session" },
];

function ProgressStepper({ activeStep }: { activeStep: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {STEPS.map((step, i) => {
        const done = step.id < activeStep;
        const active = step.id === activeStep;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`relative flex h-7 w-7 items-center justify-center rounded-full border text-[0.6rem] font-bold transition-all duration-500 ${
                  done
                    ? "border-purple-400/60 bg-purple-500/20 text-purple-300"
                    : active
                    ? "border-purple-400/80 bg-purple-500/25 text-purple-200 shadow-[0_0_14px_rgba(168,85,247,0.4)]"
                    : "border-white/10 bg-white/[0.03] text-white/20"
                }`}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5 3.5-4" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span>{step.id}</span>
                )}
                {active && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-purple-500/20" />
                )}
              </div>
              <span
                className={`mt-1.5 hidden text-[0.56rem] font-semibold uppercase tracking-[0.12em] sm:block ${
                  done ? "text-purple-400/60" : active ? "text-purple-300/80" : "text-white/15"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 h-px w-8 sm:w-12 transition-all duration-700 ${
                  step.id < activeStep ? "bg-purple-500/40" : "bg-white/8"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Motion variants ───────────────────────────────────────────────────────────

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] as const } },
  exit: (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0, transition: { duration: 0.24, ease: [0.7, 0, 1, 0.6] as const } }),
};

// ── Card Select ───────────────────────────────────────────────────────────────

function SelectCard({
  label,
  emoji,
  selected,
  onToggle,
  multi = false,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  onToggle: () => void;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-full rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
        selected
          ? "border-purple-400/60 bg-purple-500/15 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
          : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
      }`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="flex items-center gap-3">
        {emoji && <span className="text-lg leading-none">{emoji}</span>}
        <span className={`flex-1 text-[0.87rem] font-medium leading-snug ${selected ? "text-white/95" : "text-white/65"}`}>
          {label}
        </span>
        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${selected ? "border-purple-400 bg-purple-500/30" : "border-white/15"}`}>
          {selected && !multi && <div className="h-2 w-2 rounded-full bg-purple-300" />}
          {selected && multi && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2 2 4-4" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}

function PillSelect({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full border px-5 py-2.5 text-[0.83rem] font-semibold transition-all duration-200 active:scale-[0.96] ${
            value === opt
              ? "border-purple-400/60 bg-purple-500/20 text-purple-200 shadow-[0_0_14px_rgba(168,85,247,0.2)]"
              : "border-white/10 bg-white/[0.04] text-white/50 hover:border-white/20"
          }`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Deep Intake Form (Step 2.5) ───────────────────────────────────────────────

const INTAKE_QUESTIONS = [
  {
    id: "weightStruggles" as const,
    label: "Which of these weight struggles feel familiar?",
    hint: "Select all that apply. There are no wrong answers.",
    type: "multi" as const,
    options: [
      { label: "Can't lose weight despite trying hard", emoji: "😔" },
      { label: "Weight comes back as soon as I stop", emoji: "🔄" },
      { label: "Bloated and heavy all the time", emoji: "😮‍💨" },
      { label: "Never had a thyroid-specific plan before", emoji: "📋" },
      { label: "Don't know where to even begin", emoji: "🧩" },
    ],
  },
  {
    id: "biggestFrustration" as const,
    label: "What frustrates you most right now?",
    hint: "Be honest — this helps Swapnil prepare for your session.",
    type: "card" as const,
    options: [
      { label: "Doctors say my reports are normal but I feel terrible", emoji: "💔" },
      { label: "I've tried everything — nothing actually works", emoji: "😤" },
      { label: "Fatigue and weight gain are ruining my confidence", emoji: "😞" },
      { label: "I feel like nobody truly understands what I'm going through", emoji: "🙁" },
    ],
  },
  {
    id: "energyLevel" as const,
    label: "How would you describe your energy levels?",
    type: "card" as const,
    options: [
      { label: "Exhausted from the moment I wake up", emoji: "😴" },
      { label: "Functional but always fighting fatigue", emoji: "😞" },
      { label: "Energy crashes in the afternoon", emoji: "📉" },
      { label: "Some days okay, most days not", emoji: "🌤️" },
    ],
  },
  {
    id: "onMedication" as const,
    label: "Are you currently on thyroid medication?",
    type: "card" as const,
    options: [
      { label: "Yes, regularly as prescribed", emoji: "💊" },
      { label: "Yes, but I often miss doses", emoji: "🔄" },
      { label: "No, not yet", emoji: "❌" },
      { label: "I was on it, but stopped", emoji: "⏸️" },
    ],
  },
  {
    id: "specialistHistory" as const,
    label: "Have you worked with a thyroid nutrition specialist before?",
    type: "card" as const,
    options: [
      { label: "Yes — and I saw results", emoji: "✅" },
      { label: "Yes — but it didn't help much", emoji: "😕" },
      { label: "No — this is my first time", emoji: "🌱" },
      { label: "Only doctors, no nutrition specialist", emoji: "🩺" },
    ],
  },
  {
    id: "energyLow" as const,
    label: "When do you feel your energy is at its absolute lowest?",
    type: "pill" as const,
    options: ["As soon as I wake up", "Mid-morning", "After lunch", "Evening", "All day equally"],
  },
  {
    id: "triedBefore" as const,
    label: "What have you already tried for your thyroid or weight?",
    hint: "Select all that apply.",
    type: "multi" as const,
    options: [
      { label: "Low calorie / crash diets", emoji: "🥗" },
      { label: "Regular gym or cardio", emoji: "🏃" },
      { label: "Thyroid medication only", emoji: "💊" },
      { label: "Yoga or stress management", emoji: "🧘" },
      { label: "Gut health or Ayurveda", emoji: "🌿" },
      { label: "Nothing specific yet", emoji: "🤷" },
    ],
  },
  {
    id: "transformationGoal" as const,
    label: "If your thyroid improved, what would change most in your life?",
    type: "card" as const,
    options: [
      { label: "I'd finally be able to lose the weight", emoji: "✨" },
      { label: "I'd have energy to actually live my life", emoji: "⚡" },
      { label: "I'd stop feeling broken and start feeling like me again", emoji: "🌸" },
      { label: "I'd be the confident woman I know I'm capable of being", emoji: "🦋" },
    ],
  },
  {
    id: "eatingApproach" as const,
    label: "How do you currently approach eating?",
    type: "card" as const,
    options: [
      { label: "I eat fairly healthy but weight won't move", emoji: "🥗" },
      { label: "I restrict eating but still gain weight", emoji: "😰" },
      { label: "I eat normally but feel guilty about certain foods", emoji: "😔" },
      { label: "I've tried so many diets I don't know what's right anymore", emoji: "😤" },
      { label: "I enjoy eating and refuse to starve myself", emoji: "🙌" },
    ],
  },
];

function DeepIntakeForm({ onComplete }: { onComplete: (data: Step2_5Data) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<Step2_5Data>({
    weightStruggles: [],
    biggestFrustration: "",
    energyLevel: "",
    onMedication: "",
    specialistHistory: "",
    energyLow: "",
    triedBefore: [],
    transformationGoal: "",
    eatingApproach: "",
  });

  const q = INTAKE_QUESTIONS[qIndex];
  const progress = ((qIndex + 1) / INTAKE_QUESTIONS.length) * 100;

  const getValue = () => {
    const d = data as Record<string, string | string[]>;
    return d[q.id];
  };

  const isValid = () => {
    const val = getValue();
    if (q.type === "multi") return (val as string[]).length > 0;
    return typeof val === "string" && val.trim().length > 0;
  };

  const update = (field: keyof Step2_5Data, val: string | string[]) => {
    setData((prev) => ({ ...prev, [field]: val }));
  };

  const toggleMulti = (field: "weightStruggles" | "triedBefore", label: string) => {
    const current = data[field];
    update(field, current.includes(label) ? current.filter((v) => v !== label) : [...current, label]);
  };

  const handleNext = () => {
    if (!isValid()) return;
    if (qIndex === INTAKE_QUESTIONS.length - 1) {
      onComplete(data);
      return;
    }
    setDirection(1);
    setQIndex((i) => i + 1);
  };

  const handleBack = () => {
    if (qIndex === 0) return;
    setDirection(-1);
    setQIndex((i) => i - 1);
  };

  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.025] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:p-8">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/15 text-[0.55rem] font-bold text-purple-300">
          3
        </div>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-purple-400/70">
          Thyroid Assessment
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/25">
            Question {qIndex + 1} of {INTAKE_QUESTIONS.length}
          </span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-purple-400/60">
            {Math.round(progress)}% complete
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-600"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="min-h-[280px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div key={qIndex} custom={direction} variants={slide} initial="enter" animate="center" exit="exit">
            <p className="mb-1.5 text-[0.85rem] font-bold tracking-[-0.01em] text-white/90">
              {q.label}
            </p>
            {("hint" in q) && q.hint && (
              <p className="mb-4 text-[0.74rem] leading-relaxed text-white/40">{q.hint}</p>
            )}
            {!("hint" in q) && <div className="mb-4" />}

            {q.type === "pill" && (
              <PillSelect
                options={q.options as string[]}
                value={getValue() as string}
                onChange={(v) => update(q.id, v)}
              />
            )}

            {(q.type === "card" || q.type === "multi") && (
              <div className="space-y-2.5">
                {(q.options as { label: string; emoji: string }[]).map((opt) => (
                  <SelectCard
                    key={opt.label}
                    label={opt.label}
                    emoji={opt.emoji}
                    multi={q.type === "multi"}
                    selected={
                      q.type === "multi"
                        ? (getValue() as string[]).includes(opt.label)
                        : getValue() === opt.label
                    }
                    onToggle={() => {
                      if (q.type === "multi") {
                        toggleMulti(q.id as "weightStruggles" | "triedBefore", opt.label);
                      } else {
                        update(q.id, opt.label);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav */}
      <div className="mt-6 flex items-center gap-3">
        {qIndex > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/40 transition-all duration-200 hover:border-white/20 hover:text-white/70 active:scale-95"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={!isValid()}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-[0.95rem] font-bold tracking-[-0.015em] transition-all duration-300 ${
            isValid()
              ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-[0_8px_32px_rgba(124,58,237,0.35)] hover:scale-[1.01] active:scale-[0.99]"
              : "cursor-not-allowed bg-white/5 text-white/20"
          }`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {qIndex === INTAKE_QUESTIONS.length - 1 ? "Proceed to Booking" : "Continue"}
          {isValid() && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      <p className="mt-4 text-center text-[0.65rem] text-white/18">
        Swapnil reviews these answers before your session
      </p>
    </div>
  );
}

// ── Calendly Step (Step 3) ────────────────────────────────────────────────────

function CalendlyStep({ onBooked }: { onBooked: (date: string, time: string) => void }) {
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    if (document.querySelector('script[src*="calendly"]')) return;
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== "object") return;
      const { event, payload } = e.data;
      if (event === "calendly.event_scheduled") {
        const startTime: string = payload?.event?.start_time || "";
        let dateStr = "";
        let timeStr = "";
        if (startTime) {
          const d = new Date(startTime);
          dateStr = d.toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          timeStr = d.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
        }
        setBooked(true);
        onBooked(dateStr, timeStr);
        trackSchedule({ name: payload?.invitee?.name || "", date: dateStr, time: timeStr });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onBooked]);

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/8 bg-white/[0.025] p-5 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/15 text-[0.55rem] font-bold text-purple-300">
            3
          </div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-purple-400/70">
            Book Your Session
          </p>
        </div>
        <h2 className="mb-2 text-[1.4rem] font-black leading-tight tracking-[-0.035em] text-white">
          {booked ? (
            <>Your session is <span className="bg-gradient-to-r from-emerald-300 to-green-500 bg-clip-text text-transparent">confirmed.</span></>
          ) : (
            <>Almost there. <span className="bg-gradient-to-r from-purple-300 to-violet-500 bg-clip-text text-transparent">Choose your time.</span></>
          )}
        </h2>
        <p className="text-[0.78rem] leading-relaxed text-white/45">
          {booked
            ? "Swapnil will review your full intake before you speak. Check your email for the calendar invite."
            : "Swapnil will personally review your intake before you speak. Pick any available slot below."}
        </p>
      </div>

      <div
        className="overflow-hidden rounded-[20px] border border-white/7"
        style={{ background: "rgba(13,11,26,0.6)" }}
      >
        <div
          className="calendly-inline-widget"
          data-url={CALENDLY_URL}
          style={{ minWidth: "100%", height: "680px" }}
        />
      </div>
    </div>
  );
}

// ── Confirmation (Step 4) ─────────────────────────────────────────────────────

function ConfirmationStep({
  name,
  date,
  time,
}: {
  name: string;
  date: string;
  time: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Confirmed badge */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 shadow-[0_0_24px_rgba(52,211,153,0.12)]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6.5l2.5 2.5 5.5-5.5" stroke="rgba(134,239,172,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
            Session Confirmed
          </span>
        </div>
      </div>

      {/* Headline */}
      <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/[0.06] p-6 text-center">
        <h1 className="mb-3 text-[1.7rem] font-black leading-tight tracking-[-0.04em] text-white">
          You&apos;re all set{name ? `, ${name.split(" ")[0]}` : ""}.{" "}
          <span className="bg-gradient-to-r from-emerald-300 to-green-500 bg-clip-text text-transparent">
            See you soon.
          </span>
        </h1>
        <p className="text-[0.82rem] leading-relaxed text-white/50">
          Swapnil will review everything you shared before you meet. Come with an open mind.
          Leave with a clear direction.
        </p>
      </div>

      {/* Session details */}
      {(date || time) && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/25">
            Your session details
          </p>
          <div className="grid grid-cols-2 gap-3">
            {date && (
              <div className="rounded-xl border border-white/7 bg-white/[0.03] p-3.5">
                <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-emerald-400/65">Date</p>
                <p className="text-[0.82rem] font-semibold leading-snug text-white/88">{date}</p>
              </div>
            )}
            {time && (
              <div className="rounded-xl border border-white/7 bg-white/[0.03] p-3.5">
                <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-emerald-400/65">Time</p>
                <p className="text-[0.82rem] font-semibold text-white/88">{time}</p>
                <p className="mt-0.5 text-[0.65rem] text-white/30">India Standard Time</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp notice */}
      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.07] p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg leading-none">💬</span>
          <div>
            <p className="text-[0.85rem] font-semibold text-white/90">
              Expect a WhatsApp message from Swapnil
            </p>
            <p className="mt-1 text-[0.76rem] leading-relaxed text-white/45">
              You&apos;ll receive your Zoom link and a reminder message before your session.
              Keep an eye on WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* What to prepare */}
      <div className="rounded-2xl border border-white/7 bg-white/[0.025] p-5">
        <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/25">
          Before your session
        </p>
        <div className="space-y-3">
          {[
            { icon: "📄", title: "Bring your thyroid reports", body: "Your most recent TSH/T3/T4 — even a photo on your phone is fine." },
            { icon: "✏️", title: "Pen and paper ready", body: "Swapnil gives specific, actionable insights. You'll want to write them down." },
            { icon: "🔇", title: "A quiet space, zero distractions", body: "These 60 minutes belong entirely to you." },
            { icon: "❓", title: "Know your one key question", body: "The single thing you most want clarity on. Swapnil will open there." },
          ].map((tip) => (
            <div key={tip.title} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-sm">
                {tip.icon}
              </div>
              <div>
                <p className="text-[0.82rem] font-semibold text-white/85">{tip.title}</p>
                <p className="text-[0.72rem] leading-relaxed text-white/40">{tip.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust footer */}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-2">
        {["Private & confidential", "200+ women helped", "ACE & INFS certified", "Full refund guaranteed"].map((item) => (
          <span key={item} className="text-[0.6rem] text-white/18">{item}</span>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SessionBooked() {
  const [show, setShow] = useState(false);
  const [stage, setStage] = useState<FlowStage>("intake");
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [intakeData, setIntakeData] = useState<Step2_5Data | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [isNativeFlow, setIsNativeFlow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  // Entrance animation + detect native flow
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);

    const p = new URLSearchParams(window.location.search);
    const urlLeadId = p.get("leadId") || "";

    // Primary: localStorage has the full step1 payload
    let foundInStorage = false;
    try {
      const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as { step1: Step1Data; startedAt: string };
        if (stored.step1) {
          setStep1Data(stored.step1);
          setIsNativeFlow(true);
          foundInStorage = true;
          persistUserIdentity({ first_name: stored.step1.name, phone: stored.step1.phone });
        }
      }
    } catch { /* non-critical */ }

    // Fallback: localStorage empty but leadId is in URL (different browser/device).
    // Fetch the name/phone from the API so the greeting still works.
    if (!foundInStorage && urlLeadId) {
      setIsNativeFlow(true); // show native UI immediately while we fetch
      fetch(`/api/leads/${encodeURIComponent(urlLeadId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { name?: string; phone?: string } | null) => {
          if (data?.name) {
            setStep1Data({
              name: data.name,
              phone: data.phone ?? "",
              thyroidCondition: "",
              thyroidDuration: "",
              mainGoal: "",
            });
            persistUserIdentity({
              first_name: data.name.split(" ")[0],
              ...(data.phone && { phone: data.phone }),
            });
          }
        })
        .catch(() => { /* non-critical */ });
    }

    // Capture any identity params passed in the URL
    try {
      const email = p.get("email") || p.get("customer_email") || "";
      const phone = p.get("phone") || p.get("customer_phone") || p.get("mobile") || "";
      const first_name = p.get("name") || p.get("customer_name") || p.get("first_name") || "";
      if (email || phone || first_name) persistUserIdentity({ ...(email && { email }), ...(phone && { phone }), ...(first_name && { first_name }) });
    } catch { /* non-critical */ }

    return () => clearTimeout(t);
  }, []);

  const handleIntakeComplete = useCallback((data: Step2_5Data) => {
    setIntakeData(data);
    setStage("calendly");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleBooked = useCallback(async (date: string, time: string) => {
    setBookingDate(date);
    setBookingTime(time);
    setStage("confirmation");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (submittedRef.current) return;
    submittedRef.current = true;

    // Fire Purchase pixel only now — after Calendly slot is confirmed.
    // trackPurchase() returns the event_id it pushed to GTM — reuse it for the
    // CAPI call so Meta can deduplicate browser pixel vs. server event correctly.
    const lead = step1Data;
    const purchaseEventId = trackPurchase(
      lead ? { first_name: lead.name.split(" ")[0], phone: lead.phone } : undefined
    );

    // Server-side CAPI Purchase — runs in parallel, non-blocking
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "Purchase",
        event_id: purchaseEventId,
        source_url: "https://www.swapnilumbarkarfitness.in/session-booked",
        value: 299,
        currency: "INR",
        user_data: {
          ...(lead?.phone && { phone: lead.phone }),
          ...(lead?.name && { first_name: lead.name.split(" ")[0] }),
        },
      }),
    }).catch(() => {});

    // Submit unified payload
    try {
      setSubmitting(true);
      const storedRaw = localStorage.getItem(NATIVE_BOOKING_KEY);
      const stored = storedRaw ? JSON.parse(storedRaw) as {
        step1: Step1Data;
        startedAt?: string;
        leadId?: string;
        attribution?: Record<string, string>;
      } : null;

      await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step1: stored?.step1 || step1Data,
          step2_5: intakeData,
          step3: { bookingDate: date, bookingTime: time, bookingStatus: "booked" },
          leadId: stored?.leadId,
          attribution: stored?.attribution,
          submittedAt: new Date().toISOString(),
        }),
      });

      // Clear localStorage after successful submission
      localStorage.removeItem(NATIVE_BOOKING_KEY);
    } catch {
      // silent — don't interrupt user experience
    } finally {
      setSubmitting(false);
    }
  }, [step1Data, intakeData]);

  const activeStepNum = stage === "intake" ? 3 : stage === "calendly" ? 4 : 4;

  // Fall back to legacy behavior if not native flow (old Tally users)
  if (!isNativeFlow && show) {
    return <LegacySessionBooked />;
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: "#07060f", color: "#fff" }}
    >
      {/* Background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full blur-[100px] transition-all duration-[1500ms]"
          style={{
            background:
              stage === "confirmation"
                ? "radial-gradient(ellipse, rgba(34,197,94,0.09) 0%, transparent 70%)"
                : "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-violet-700/[0.07] blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-fuchsia-700/[0.05] blur-[100px]" />
      </div>

      <div
        className="relative z-10 mx-auto max-w-[560px] px-5 pb-20 pt-12 transition-all duration-700"
        style={{
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(18px)",
        }}
      >
        <ProgressStepper activeStep={activeStepNum} />

        <AnimatePresence mode="wait">
          {stage === "intake" && (
            <motion.div
              key="intake"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Welcome back message */}
              <div className="mb-6 rounded-2xl border border-purple-500/20 bg-purple-500/[0.07] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7l3 3 7-7" stroke="rgba(134,239,172,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[0.84rem] font-semibold text-white/90">
                      Your spot is secured{step1Data?.name ? `, ${step1Data.name.split(" ")[0]}` : ""}. Welcome.
                    </p>
                    <p className="text-[0.72rem] text-white/40">
                      Personalised thyroid assessment · Then pick your time
                    </p>
                  </div>
                </div>
              </div>
              <DeepIntakeForm onComplete={handleIntakeComplete} />
            </motion.div>
          )}

          {stage === "calendly" && (
            <motion.div
              key="calendly"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              <CalendlyStep onBooked={handleBooked} />
            </motion.div>
          )}

          {stage === "confirmation" && (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              <ConfirmationStep
                name={step1Data?.name || ""}
                date={bookingDate}
                time={bookingTime}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {submitting && (
          <p className="mt-4 text-center text-[0.65rem] text-white/20">
            Saving your profile…
          </p>
        )}
      </div>
    </main>
  );
}

// ── Legacy fallback (old Tally → Cashfree → session-booked flow) ──────────────

function LegacySessionBooked() {
  const [booked, setBooked] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<{ name?: string; date?: string; time?: string }>({});
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document.querySelector('script[src*="calendly"]')) return;
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== "object") return;
      const { event, payload } = e.data;
      if (event === "calendly.event_scheduled") {
        const name = payload?.invitee?.name || "";
        const startTime: string = payload?.event?.start_time || "";
        let dateStr = "", timeStr = "";
        if (startTime) {
          const d = new Date(startTime);
          dateStr = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        }
        setBookingDetails({ name, date: dateStr, time: timeStr });
        setBooked(true);
        trackSchedule({ name, date: dateStr, time: timeStr });
        setTimeout(() => confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <main style={{ background: "#07060f", minHeight: "100vh", color: "#fff", position: "relative" }}>
      <div style={{ maxWidth: "660px", margin: "0 auto", padding: "48px 20px 80px", position: "relative", zIndex: 10 }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: "999px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", marginBottom: "14px" }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.16em", color: "rgba(134,239,172,0.85)" }}>Payment Confirmed</span>
          </div>
          <h1 style={{ fontSize: "clamp(1.55rem, 4vw, 1.9rem)", fontWeight: 900, lineHeight: 1.12, letterSpacing: "-0.035em", marginBottom: "12px" }}>
            {booked ? "Your Session Is Confirmed." : "One Step Left. Choose Your Session Time."}
          </h1>
          <p style={{ fontSize: "0.88rem", lineHeight: 1.65, color: "rgba(255,255,255,0.5)", maxWidth: "38ch", margin: "0 auto" }}>
            {booked ? "Swapnil will review your intake before you speak. Check your email for the calendar invite." : "Pick any available time below."}
          </p>
        </div>

        <div style={{ borderRadius: "20px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", marginBottom: "32px", minHeight: "700px", background: "rgba(13,11,26,0.6)" }}>
          <div className="calendly-inline-widget" data-url={CALENDLY_URL} style={{ minWidth: "100%", height: "700px" }} />
        </div>

        {booked && (
          <div ref={confirmRef}>
            <ConfirmationStep name={bookingDetails.name || ""} date={bookingDetails.date || ""} time={bookingDetails.time || ""} />
          </div>
        )}
      </div>
    </main>
  );
}
