"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Step1Data } from "./BookingFlow";

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionId = "name" | "phone" | "email" | "thyroidCondition" | "thyroidDuration" | "mainGoal";

const QUESTION_ORDER: QuestionId[] = [
  "name", "phone", "email", "thyroidCondition", "thyroidDuration", "mainGoal",
];

// Basic email shape check — email is the strongest Meta match key, so we require
// a plausible address before advancing rather than passing junk to CAPI.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Motion variants ───────────────────────────────────────────────────────────

const slide = {
  enter: (dir: number) => ({
    x: dir > 0 ? 48 : -48,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -48 : 48,
    opacity: 0,
    transition: { duration: 0.24, ease: [0.7, 0, 1, 0.6] as const },
  }),
};

// ── Sub-components ────────────────────────────────────────────────────────────

function QuestionShell({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[0.82rem] font-bold tracking-[-0.01em] text-[#241f1a]">
        {label}
      </p>
      {hint && (
        <p className="mb-4 text-[0.74rem] leading-relaxed text-[#857c6d]">
          {hint}
        </p>
      )}
      {!hint && <div className="mb-4" />}
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full rounded-2xl border border-[#ddd4c6] bg-white px-5 py-4 text-[0.95rem] text-white placeholder-[#9c9384] outline-none transition-all duration-200 focus:border-[#a37220] focus:bg-white focus:shadow-[0_0_0_3px_rgba(163, 114, 32,0.15)]"
      style={{ WebkitTapHighlightColor: "transparent" }}
    />
  );
}

function SelectCard({
  label,
  emoji,
  selected,
  onToggle,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-full rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
        selected
          ? "border-[#a37220] bg-[#a37220]/12 shadow-[0_0_20px_rgba(163, 114, 32,0.15)]"
          : "border-[#ddd4c6] bg-white hover:border-[#c9c0af] hover:bg-[#ffffff]"
      }`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="flex items-center gap-3">
        {emoji && <span className="text-lg leading-none">{emoji}</span>}
        <span
          className={`flex-1 text-[0.87rem] font-medium leading-snug ${
            selected ? "text-[#241f1a]" : "text-[#423b33]"
          }`}
        >
          {label}
        </span>
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
            selected
              ? "border-[#a37220] bg-[#a37220]"
              : "border-[#ddd4c6]"
          }`}
        >
          {selected && (
            <div className="h-2 w-2 rounded-full bg-[#96661a]" />
          )}
        </div>
      </div>
    </button>
  );
}

// ── Questions ─────────────────────────────────────────────────────────────────

function NameQuestion({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <QuestionShell label="What is your name?" hint="We'll use this to personalise your session.">
      <TextInput
        value={value}
        onChange={onChange}
        placeholder="Your full name"
        autoComplete="name"
      />
    </QuestionShell>
  );
}

function PhoneQuestion({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <QuestionShell
      label="Your WhatsApp number"
      hint="I&apos;ll send your session confirmation here."
    >
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[0.95rem] text-[#857c6d] select-none">
          +91
        </span>
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="98765 43210"
          autoComplete="tel"
          className="w-full rounded-2xl border border-[#ddd4c6] bg-white py-4 pl-14 pr-5 text-[0.95rem] text-white placeholder-[#9c9384] outline-none transition-all duration-200 focus:border-[#a37220] focus:bg-white focus:shadow-[0_0_0_3px_rgba(163, 114, 32,0.15)]"
          style={{ WebkitTapHighlightColor: "transparent" }}
        />
      </div>
    </QuestionShell>
  );
}

function EmailQuestion({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <QuestionShell
      label="Your best email"
      hint="Your session details & call link are sent here."
    >
      <TextInput
        value={value}
        onChange={onChange}
        placeholder="you@email.com"
        type="email"
        autoComplete="email"
      />
    </QuestionShell>
  );
}

function ThyroidConditionQuestion({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [
    { label: "Hypothyroidism", emoji: "🌡️" },
    { label: "Hashimoto's Thyroiditis", emoji: "🔬" },
    { label: "Hyperthyroidism", emoji: "⚡" },
    { label: "Not diagnosed yet", emoji: "🤔" },
    { label: "Something else / Not sure", emoji: "💭" },
  ];
  return (
    <QuestionShell label="What is your thyroid condition?" hint="Choose the one that best describes your situation.">
      <div className="space-y-2.5">
        {options.map((o) => (
          <SelectCard
            key={o.label}
            label={o.label}
            emoji={o.emoji}
            selected={value === o.label}
            onToggle={() => onChange(o.label)}
          />
        ))}
      </div>
    </QuestionShell>
  );
}

function ThyroidDurationQuestion({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [
    { label: "Less than 1 year", val: "Less than 1 year" },
    { label: "1–3 years", val: "1–3 years" },
    { label: "3–5 years", val: "3–5 years" },
    { label: "More than 5 years", val: "More than 5 years" },
  ];
  return (
    <QuestionShell
      label="How long have you been dealing with this?"
      hint="Thyroid issues affect your body differently over time."
    >
      <div className="flex flex-wrap gap-2.5">
        {options.map((r) => (
          <button
            key={r.val}
            type="button"
            onClick={() => onChange(r.val)}
            className={`rounded-full border px-5 py-2.5 text-[0.85rem] font-semibold transition-all duration-200 active:scale-[0.96] ${
              value === r.val
                ? "border-[#a37220] bg-[#a37220]/15 text-[#8a5d12] shadow-[0_0_14px_rgba(163, 114, 32,0.2)]"
                : "border-[#ddd4c6] bg-white text-[#6b6157] hover:border-[#c9c0af]"
            }`}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {r.label}
          </button>
        ))}
      </div>
    </QuestionShell>
  );
}

function GoalQuestion({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [
    { label: "Finally lose the weight that won't budge", emoji: "✨" },
    { label: "Get my energy back — properly", emoji: "⚡" },
    { label: "Understand what's really happening in my body", emoji: "🧠" },
    { label: "Feel like myself again", emoji: "🌸" },
  ];
  return (
    <QuestionShell label="What is your #1 goal from this session?">
      <div className="space-y-2.5">
        {options.map((o) => (
          <SelectCard
            key={o.label}
            label={o.label}
            emoji={o.emoji}
            selected={value === o.label}
            onToggle={() => onChange(o.label)}
          />
        ))}
      </div>
    </QuestionShell>
  );
}

// ── Main QualificationForm ────────────────────────────────────────────────────

export function QualificationForm({
  onComplete,
}: {
  onComplete: (data: Step1Data) => void;
}) {
  const [qIndex, setQIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<Step1Data>({
    name: "",
    phone: "",
    email: "",
    thyroidCondition: "",
    thyroidDuration: "",
    mainGoal: "",
  });

  const currentQuestion = QUESTION_ORDER[qIndex];
  const progress = ((qIndex + 1) / QUESTION_ORDER.length) * 100;

  const getCurrentValue = () => {
    const d = data as Record<string, string>;
    return d[currentQuestion];
  };

  const isCurrentValid = useCallback((): boolean => {
    const val = getCurrentValue();
    if (typeof val !== "string" || val.trim().length === 0) return false;
    if (currentQuestion === "email") return EMAIL_RE.test(val.trim());
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currentQuestion]);

  const handleNext = () => {
    if (!isCurrentValid()) return;
    if (qIndex === QUESTION_ORDER.length - 1) {
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

  const update = (field: QuestionId, val: string) => {
    setData((prev) => ({ ...prev, [field]: val }));
  };

  const isLast = qIndex === QUESTION_ORDER.length - 1;

  return (
    <div className="rounded-[28px] border border-[#ddd4c6] bg-white p-6 shadow-[0_24px_80px_rgba(36, 31, 26,0.14)] backdrop-blur-2xl sm:p-8">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#857c6d]">
            Question {qIndex + 1} of {QUESTION_ORDER.length}
          </span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#96661a]">
            {Math.round(progress)}% complete
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[#ede7dd]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#96661a] to-[#8a5d12]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Question content */}
      <div className="min-h-[260px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentQuestion}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {currentQuestion === "name" && (
              <NameQuestion value={data.name} onChange={(v) => update("name", v)} />
            )}
            {currentQuestion === "phone" && (
              <PhoneQuestion value={data.phone} onChange={(v) => update("phone", v)} />
            )}
            {currentQuestion === "email" && (
              <EmailQuestion value={data.email} onChange={(v) => update("email", v)} />
            )}
            {currentQuestion === "thyroidCondition" && (
              <ThyroidConditionQuestion
                value={data.thyroidCondition}
                onChange={(v) => update("thyroidCondition", v)}
              />
            )}
            {currentQuestion === "thyroidDuration" && (
              <ThyroidDurationQuestion
                value={data.thyroidDuration}
                onChange={(v) => update("thyroidDuration", v)}
              />
            )}
            {currentQuestion === "mainGoal" && (
              <GoalQuestion
                value={data.mainGoal}
                onChange={(v) => update("mainGoal", v)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Auto-advance hint for card questions */}
      {(currentQuestion === "thyroidCondition" || currentQuestion === "mainGoal") && isCurrentValid() && (
        <p className="mb-3 text-center text-[0.65rem] text-[#96661a]/50">
          Tap Continue to proceed
        </p>
      )}

      {/* Navigation */}
      <div className="mt-4 flex items-center gap-3">
        {qIndex > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#ddd4c6] bg-white text-[#857c6d] transition-all duration-200 hover:border-[#c9c0af] hover:text-[#423b33] active:scale-95"
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
          disabled={!isCurrentValid()}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-[0.95rem] font-bold tracking-[-0.015em] transition-all duration-300 ${
            isCurrentValid()
              ? "bg-gradient-to-r from-[#96661a] to-[#8a5d12] text-white shadow-[0_8px_32px_rgba(150, 102, 26,0.35)] hover:scale-[1.01] active:scale-[0.99]"
              : "cursor-not-allowed bg-[#ede7dd] text-[#9c9384]"
          }`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {isLast ? "Reserve My Spot →" : "Continue"}
          {isCurrentValid() && !isLast && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      <p className="mt-4 text-center text-[0.65rem] text-[#9c9384]">
        Private & confidential · Never shared
      </p>
    </div>
  );
}
