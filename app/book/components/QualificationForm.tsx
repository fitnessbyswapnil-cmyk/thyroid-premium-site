"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Step1Data } from "./BookingFlow";

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionId =
  | "name" | "phone" | "email" | "age" | "thyroidCondition"
  | "weightStruggles" | "energyLevel" | "biggestFrustration" | "mainGoal";

const QUESTION_ORDER: QuestionId[] = [
  "name", "phone", "email", "age", "thyroidCondition",
  "weightStruggles", "energyLevel", "biggestFrustration", "mainGoal",
];

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
      <p className="mb-1.5 text-[0.82rem] font-bold tracking-[-0.01em] text-white/90">
        {label}
      </p>
      {hint && (
        <p className="mb-4 text-[0.74rem] leading-relaxed text-white/40">
          {hint}
        </p>
      )}
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
      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-[0.95rem] text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-purple-500/50 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]"
      style={{ WebkitTapHighlightColor: "transparent" }}
    />
  );
}

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
        <span
          className={`flex-1 text-[0.87rem] font-medium leading-snug ${
            selected ? "text-white/95" : "text-white/65"
          }`}
        >
          {label}
        </span>
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
            selected
              ? "border-purple-400 bg-purple-500/30"
              : "border-white/15"
          }`}
        >
          {selected && !multi && (
            <div className="h-2 w-2 rounded-full bg-purple-300" />
          )}
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
      hint="Swapnil will send your confirmation here."
    >
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[0.95rem] text-white/35 select-none">
          +91
        </span>
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="98765 43210"
          autoComplete="tel"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-4 pl-14 pr-5 text-[0.95rem] text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-purple-500/50 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]"
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
      label="Your email address"
      hint="We'll send your session confirmation and Zoom link here."
    >
      <TextInput
        value={value}
        onChange={onChange}
        placeholder="you@example.com"
        type="email"
        autoComplete="email"
      />
    </QuestionShell>
  );
}

function AgeQuestion({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ranges = [
    { label: "Under 25", val: "<25" },
    { label: "25–34", val: "25-34" },
    { label: "35–44", val: "35-44" },
    { label: "45–54", val: "45-54" },
    { label: "55+", val: "55+" },
  ];
  return (
    <QuestionShell label="How old are you?" hint="Thyroid needs change at different life stages.">
      <div className="flex flex-wrap gap-2.5">
        {ranges.map((r) => (
          <button
            key={r.val}
            type="button"
            onClick={() => onChange(r.val)}
            className={`rounded-full border px-5 py-2.5 text-[0.85rem] font-semibold transition-all duration-200 active:scale-[0.96] ${
              value === r.val
                ? "border-purple-400/60 bg-purple-500/20 text-purple-200 shadow-[0_0_14px_rgba(168,85,247,0.2)]"
                : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20"
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

function WeightStrugglesQuestion({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const options = [
    { label: "Can't lose weight despite trying hard", emoji: "😔" },
    { label: "Weight comes back as soon as I stop", emoji: "🔄" },
    { label: "Bloated and heavy all the time", emoji: "😮‍💨" },
    { label: "Never had a thyroid-specific plan before", emoji: "📋" },
    { label: "Don't know where to even begin", emoji: "🧩" },
  ];
  const toggle = (label: string) => {
    onChange(
      value.includes(label) ? value.filter((v) => v !== label) : [...value, label]
    );
  };
  return (
    <QuestionShell
      label="Which of these feel like you?"
      hint="Select all that apply. There are no wrong answers."
    >
      <div className="space-y-2.5">
        {options.map((o) => (
          <SelectCard
            key={o.label}
            label={o.label}
            emoji={o.emoji}
            selected={value.includes(o.label)}
            onToggle={() => toggle(o.label)}
            multi
          />
        ))}
      </div>
    </QuestionShell>
  );
}

function EnergyLevelQuestion({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [
    { label: "Exhausted from the moment I wake up", emoji: "😴" },
    { label: "Functional but always fighting fatigue", emoji: "😞" },
    { label: "Energy crashes in the afternoon", emoji: "📉" },
    { label: "Some days okay, most days not", emoji: "🌤️" },
  ];
  return (
    <QuestionShell label="How would you describe your energy levels?">
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

function FrustrationQuestion({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [
    { label: "Doctors say my reports are normal but I feel terrible", emoji: "💔" },
    { label: "I've tried everything — nothing actually works", emoji: "😤" },
    { label: "Fatigue and weight gain are ruining my confidence", emoji: "😞" },
    { label: "I feel like nobody truly understands what I'm going through", emoji: "🙁" },
  ];
  return (
    <QuestionShell label="What frustrates you most right now?" hint="Be honest — this helps Swapnil prepare for your session.">
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
    age: "",
    thyroidCondition: "",
    weightStruggles: [],
    energyLevel: "",
    biggestFrustration: "",
    mainGoal: "",
  });

  const currentQuestion = QUESTION_ORDER[qIndex];
  const progress = ((qIndex + 1) / QUESTION_ORDER.length) * 100;

  const getCurrentValue = () => {
    const d = data as Record<string, string | string[]>;
    return d[currentQuestion];
  };

  const isCurrentValid = useCallback((): boolean => {
    const val = getCurrentValue();
    if (currentQuestion === "weightStruggles") return (val as string[]).length > 0;
    if (currentQuestion === "email") {
      const v = (val as string).trim();
      return v.includes("@") && v.includes(".");
    }
    return typeof val === "string" && val.trim().length > 0;
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

  const update = (field: QuestionId, val: string | string[]) => {
    setData((prev) => ({ ...prev, [field]: val }));
  };

  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.025] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:p-8">
      {/* Question counter + progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/25">
            Question {qIndex + 1} of {QUESTION_ORDER.length}
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

      {/* Question content */}
      <div className="min-h-[280px]" ref={(el) => { inputRef.current = el?.querySelector("input") ?? null; }}>
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
            {currentQuestion === "age" && (
              <AgeQuestion value={data.age} onChange={(v) => update("age", v)} />
            )}
            {currentQuestion === "thyroidCondition" && (
              <ThyroidConditionQuestion
                value={data.thyroidCondition}
                onChange={(v) => update("thyroidCondition", v)}
              />
            )}
            {currentQuestion === "weightStruggles" && (
              <WeightStrugglesQuestion
                value={data.weightStruggles}
                onChange={(v) => update("weightStruggles", v)}
              />
            )}
            {currentQuestion === "energyLevel" && (
              <EnergyLevelQuestion
                value={data.energyLevel}
                onChange={(v) => update("energyLevel", v)}
              />
            )}
            {currentQuestion === "biggestFrustration" && (
              <FrustrationQuestion
                value={data.biggestFrustration}
                onChange={(v) => update("biggestFrustration", v)}
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

      {/* Navigation */}
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
          disabled={!isCurrentValid()}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-[0.95rem] font-bold tracking-[-0.015em] transition-all duration-300 ${
            isCurrentValid()
              ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-[0_8px_32px_rgba(124,58,237,0.35)] hover:scale-[1.01] active:scale-[0.99]"
              : "cursor-not-allowed bg-white/5 text-white/20"
          }`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {qIndex === QUESTION_ORDER.length - 1 ? "See My Results" : "Continue"}
          {isCurrentValid() && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      <p className="mt-4 text-center text-[0.65rem] text-white/18">
        Private & confidential · Never shared
      </p>
    </div>
  );
}
