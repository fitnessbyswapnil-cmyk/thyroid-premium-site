"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Cal, { getCalApi } from "@calcom/embed-react";
import { pushDL, trackLead, sendLeadToCapi, LEAD_FIRED_SESSION_KEY } from "@/app/lib/analytics";
import { persistUserIdentity } from "@/app/components/tracking/UserIdentityTracker";
import { getUtmParams, getFbclid, getVisitorId } from "@/lib/tracking";

// ── Step model ─────────────────────────────────────────────────────────────────
// One question per screen. `points` maps an option label → score (silent).
// `multiPoints` (for multi-select) maps each option → points, summed and capped.

type StepType =
  | "intro"
  | "text"
  | "single"
  | "multi"
  | "scale"
  | "info"
  | "tel"
  | "email"
  | "finish";

type Option = { label: string; emoji?: string; points?: number };

type Step = {
  id: string;
  type: StepType;
  question?: string;
  sub?: string;
  options?: Option[];
  multiCap?: number;
  placeholder?: string;
  // value-moment body builder (can read prior answers)
  body?: (a: Answers) => string;
};

type Answers = Record<string, string | string[] | number>;

const PERSIST_KEY = "thyroid_qualifying_flow";

// ── Steps (S0–S18) ───────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "intro",
    type: "intro",
    question: "Let's find out why your weight won't move.",
    sub: "12 quick questions. About 2 minutes. Then pick a time that suits you.",
  },
  { id: "name", type: "text", question: "First — what should I call you?", placeholder: "Your first name" },
  {
    id: "goal",
    type: "single",
    question: "What's the one thing you most want to fix, [Name]?",
    options: [
      { label: "Lose the stubborn weight", emoji: "🎯", points: 2 },
      { label: "Get my energy back", emoji: "⚡", points: 2 },
      { label: "Fix the bloating & puffiness", emoji: "🌿", points: 2 },
      { label: "Feel like myself again", emoji: "💆", points: 2 },
      { label: "All of the above", emoji: "✨", points: 2 },
    ],
  },
  {
    id: "challenge",
    type: "single",
    question: "What's been the hardest part?",
    options: [
      { label: "The weight won't move, no matter what I do", points: 8 },
      { label: "I'm exhausted all the time", points: 6 },
      { label: "Bloating and puffiness", points: 4 },
      { label: "Hair thinning / skin issues", points: 4 },
      { label: "Mood swings / brain fog", points: 4 },
    ],
  },
  {
    id: "diagnosis",
    type: "single",
    question: "Have you been diagnosed with a thyroid condition?",
    options: [
      { label: "Yes — hypothyroidism", points: 10 },
      { label: "Yes — Hashimoto's", points: 10 },
      { label: "Yes — not sure which type", points: 8 },
      { label: "I suspect it, but haven't tested", points: 4 },
      { label: "No, not diagnosed", points: 0 },
    ],
  },
  {
    id: "medication",
    type: "single",
    question: "Are you currently on thyroid medication?",
    options: [
      { label: "Yes — and still struggling", points: 6 },
      { label: "Yes — recently started", points: 4 },
      { label: "Not yet", points: 3 },
      { label: "No", points: 1 },
    ],
  },
  {
    id: "duration",
    type: "single",
    question: "How long have you been trying to fix this without results?",
    options: [
      { label: "Over a year", points: 7 },
      { label: "6–12 months", points: 5 },
      { label: "A few months", points: 3 },
      { label: "Just started", points: 1 },
    ],
  },
  {
    id: "valueMoment",
    type: "info",
    question: "Thanks, [Name].",
    body: (a) => {
      const challenge =
        typeof a.challenge === "string" && a.challenge
          ? a.challenge.toLowerCase()
          : "stubborn weight that won't move";
      return `Here's what most women dealing with ${challenge} don't realise: a slower thyroid changes how your body stores fat — so the harder you diet, the more it resists. The fix isn't more effort. It's the right plan for your thyroid. That's exactly what we'll map on your call.`;
    },
  },
  {
    id: "profession",
    type: "single",
    question: "What do you do for work, [Name]?",
    options: [
      { label: "Corporate / IT professional", points: 5 },
      { label: "Business owner / entrepreneur", points: 5 },
      { label: "Doctor / healthcare", points: 5 },
      { label: "Teacher / educator", points: 4 },
      { label: "Homemaker", points: 3 },
      { label: "Something else", points: 3 },
    ],
  },
  {
    id: "tried",
    type: "multi",
    multiCap: 6,
    question: "What have you already tried to fix it?",
    sub: "Select all that apply.",
    options: [
      { label: "Multiple diets / nutritionists", points: 3 },
      { label: "Gym / personal trainer", points: 1 },
      { label: "Medication alone", points: 1 },
      { label: "Online programs / YouTube", points: 1 },
      { label: "Nothing structured yet", points: 0 },
    ],
  },
  {
    id: "spent",
    type: "single",
    question: "Roughly how much have you invested in solving this so far?",
    options: [
      { label: "More than ₹50,000", points: 8 },
      { label: "₹20,000–₹50,000", points: 6 },
      { label: "Under ₹20,000", points: 4 },
      { label: "Nothing yet", points: 2 },
    ],
  },
  {
    id: "commitment",
    type: "scale",
    question: "If I give you the right plan, how committed are you to following it?",
    sub: "1 = Just curious · 10 = Fully committed",
  },
  {
    id: "timing",
    type: "single",
    question: "When do you want to start feeling better?",
    options: [
      { label: "This week", points: 8 },
      { label: "This month", points: 6 },
      { label: "In a month or two", points: 3 },
      { label: "Just exploring for now", points: 1 },
    ],
  },
  {
    id: "investment",
    type: "single",
    question:
      "To get real, lasting results, what are you able to invest in the right solution? (Be honest — it helps me prepare.)",
    options: [
      { label: "I can invest ₹50,000", points: 9 },
      { label: "I can invest ₹30,000", points: 6 },
      { label: "I can invest ₹15,000", points: 3 },
      { label: "I'll decide on the call", points: 4 },
    ],
  },
  {
    id: "decisionMaker",
    type: "single",
    question: "When you decide something important for your health, who makes the final call?",
    options: [
      { label: "I decide for myself", points: 9 },
      { label: "I decide, then tell my family", points: 7 },
      { label: "I discuss with my partner, but it's my choice", points: 5 },
      { label: "My partner / family decides", points: 1 },
    ],
  },
  { id: "whatsapp", type: "tel", question: "Almost done, [Name]. Best WhatsApp number to send your session details?", placeholder: "WhatsApp number" },
  { id: "email", type: "email", question: "And your email, for the confirmation?", placeholder: "you@email.com" },
  { id: "city", type: "text", question: "Last one — which city are you in?", placeholder: "Your city" },
  { id: "finish", type: "finish" },
];

// ── Scoring (silent) ─────────────────────────────────────────────────────────

function pointsFor(step: Step, value: string | string[] | number | undefined): number {
  if (value == null) return 0;
  if (step.type === "scale") {
    const n = typeof value === "number" ? value : Number(value) || 0;
    return Math.round((n / 10) * 7);
  }
  if (step.type === "multi" && Array.isArray(value)) {
    const sum = value.reduce((acc, label) => {
      const opt = step.options?.find((o) => o.label === label);
      return acc + (opt?.points ?? 0);
    }, 0);
    return Math.min(sum, step.multiCap ?? sum);
  }
  if (typeof value === "string") {
    const opt = step.options?.find((o) => o.label === value);
    return opt?.points ?? 0;
  }
  return 0;
}

function computeScore(answers: Answers): { score: number; band: "Hot" | "Warm" | "Cold" } {
  let score = 0;
  for (const step of STEPS) {
    if (!step.options && step.type !== "scale") continue;
    score += pointsFor(step, answers[step.id]);
  }
  const band = score >= 65 ? "Hot" : score >= 45 ? "Warm" : "Cold";
  return { score, band };
}

// ── Small UI pieces ─────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const label = pct < 50 ? `${pct}% complete` : pct < 100 ? `Almost there · ${pct}%` : "Done";
  return (
    <div className="mb-8 w-full">
      <div className="mb-2 flex justify-between text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white/30">
        <span>{label}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #a855f7, #c5a24d)" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

function OptionCard({
  option,
  index,
  selected,
  onClick,
}: {
  option: Option;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-[18px] border px-5 text-left transition-all duration-200"
      style={{
        minHeight: 76,
        borderColor: selected ? "rgba(168,85,247,0.7)" : "rgba(255,255,255,0.10)",
        background: selected ? "rgba(168,85,247,0.14)" : "rgba(255,255,255,0.035)",
        boxShadow: selected ? "0 0 24px rgba(168,85,247,0.22)" : "none",
      }}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[0.7rem] font-bold transition-colors"
        style={{
          background: selected ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.06)",
          color: selected ? "#e9d5ff" : "rgba(255,255,255,0.4)",
        }}
        aria-hidden
      >
        {option.emoji ?? index + 1}
      </span>
      <span className="text-[0.98rem] font-semibold leading-snug text-white/90">{option.label}</span>
      {selected && (
        <svg className="ml-auto shrink-0" width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M2 7l3 3 7-7" stroke="#c5a24d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function TextField({
  value,
  onChange,
  onEnter,
  type = "text",
  placeholder,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  type?: string;
  placeholder?: string;
  error?: string;
}) {
  const inputMode = type === "tel" ? "tel" : type === "email" ? "email" : "text";
  return (
    <div className="w-full">
      <input
        autoFocus
        type={type}
        inputMode={inputMode as "tel" | "email" | "text"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter();
        }}
        className="w-full rounded-2xl border bg-white/[0.04] px-5 py-4 text-[1.05rem] text-white outline-none transition-colors placeholder:text-white/25"
        style={{ borderColor: error ? "rgba(248,113,113,0.6)" : "rgba(168,85,247,0.35)" }}
      />
      <div className="mt-2 min-h-[1.1rem] text-[0.78rem] text-rose-300/80">{error || ""}</div>
    </div>
  );
}

// ── Validation ─────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function phoneDigits(v: string) {
  return v.replace(/\D/g, "");
}

// ── Cal.com booking step ─────────────────────────────────────────────────────
// Mirrors /session-booked: dark month_view, prefilled, leadId metadata. On a
// confirmed booking it redirects to /booking-confirmed, where the (untouched)
// Schedule event fires on load keyed schedule_<uid>. Schedule is NOT fired here.

function CalendarStep({
  name,
  email,
  phone,
  leadId,
}: {
  name: string;
  email: string;
  phone: string;
  leadId: string;
}) {
  const bookedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cal = await getCalApi({ namespace: "60min" });
      if (cancelled) return;
      cal("ui", {
        theme: "dark",
        layout: "month_view",
        hideEventTypeDetails: false,
        cssVarsPerTheme: { light: { "cal-brand": "#a855f7" }, dark: { "cal-brand": "#a855f7" } },
      });
      cal("on", {
        action: "bookingSuccessful",
        callback: (e: unknown) => {
          if (bookedRef.current) return;
          bookedRef.current = true;
          const data = ((e as { detail?: { data?: Record<string, any> } })?.detail?.data) || {};
          const startTime: string =
            data?.booking?.startTime || data?.startTime || data?.date || data?.booking?.start || "";
          const uid: string = data?.uid || data?.booking?.uid || data?.confirmedEvent?.uid || "";
          let dateStr = "";
          let timeStr = "";
          if (startTime) {
            const dt = new Date(startTime);
            if (!isNaN(dt.getTime())) {
              dateStr = dt.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
              timeStr = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
            }
          }
          const params = new URLSearchParams();
          if (uid) params.set("uid", uid);
          if (dateStr) params.set("date", dateStr);
          if (timeStr) params.set("time", timeStr);
          if (name) params.set("name", name);
          window.location.href = `/booking-confirmed?${params.toString()}`;
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [name]);

  return (
    <div className="mx-auto w-full">
      <div
        className="overflow-hidden rounded-[24px] p-2 sm:p-3"
        style={{ background: "var(--bg-elevated)", boxShadow: "0 24px 70px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(168,85,247,0.22)" }}
      >
        <Cal
          namespace="60min"
          calLink="swapnilumbarkarfitness/60min"
          style={{ width: "100%", height: "100%", minHeight: "640px", overflow: "scroll" }}
          config={{
            layout: "month_view",
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
            ...(phone ? { attendeePhoneNumber: phone, smsReminderNumber: phone } : {}),
            ...(leadId ? { metadata: { leadId } } : {}),
          }}
        />
      </div>
    </div>
  );
}

// ── Main flow ─────────────────────────────────────────────────────────────────

export default function QualifyingFlow() {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [draft, setDraft] = useState(""); // current text/tel/email/scale input
  const [error, setError] = useState("");
  const leadFiredRef = useRef(false);
  const leadIdRef = useRef("");

  // Restore from sessionStorage (survive accidental refresh)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PERSIST_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { idx: number; answers: Answers };
        if (saved.answers) setAnswers(saved.answers);
        if (typeof saved.idx === "number") setIdx(Math.min(saved.idx, STEPS.length - 1));
      }
    } catch { /* non-critical */ }
  }, []);

  // Persist on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(PERSIST_KEY, JSON.stringify({ idx, answers }));
    } catch { /* non-critical */ }
  }, [idx, answers]);

  const step = STEPS[idx];
  const name = typeof answers.name === "string" ? answers.name : "";

  const pct = useMemo(() => {
    // Progress across the question steps (exclude intro & finish from the count).
    const total = STEPS.length - 2;
    const done = Math.max(0, Math.min(idx - 1, total));
    return Math.round((done / total) * 100);
  }, [idx]);

  const personalize = useCallback(
    (s?: string) => (s ? s.replace(/\[Name\]/g, name || "there") : ""),
    [name],
  );

  const goNext = useCallback(() => {
    setError("");
    setDraft("");
    setIdx((i) => Math.min(i + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setError("");
    setDraft("");
    setIdx((i) => Math.max(i - 1, 0));
  }, []);

  // Sync draft when arriving on a text-like step (so back/forward keeps values)
  useEffect(() => {
    if (["text", "tel", "email"].includes(step.type)) {
      setDraft(typeof answers[step.id] === "string" ? (answers[step.id] as string) : "");
    }
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectSingle = useCallback(
    (label: string) => {
      setAnswers((a) => ({ ...a, [step.id]: label }));
      // brief auto-advance (~200ms) so the selection is felt
      setTimeout(() => goNext(), 200);
    },
    [step, goNext],
  );

  const toggleMulti = useCallback(
    (label: string) => {
      setAnswers((a) => {
        const cur = Array.isArray(a[step.id]) ? (a[step.id] as string[]) : [];
        return { ...a, [step.id]: cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label] };
      });
    },
    [step],
  );

  const submitText = useCallback(() => {
    const v = draft.trim();
    if (step.type === "text") {
      if (!v) { setError("Please enter a response to continue."); return; }
    }
    if (step.type === "tel") {
      if (phoneDigits(v).length < 10) { setError("Please enter a valid WhatsApp number."); return; }
    }
    if (step.type === "email") {
      if (!EMAIL_RE.test(v)) { setError("Please enter a valid email address."); return; }
    }
    setAnswers((a) => ({ ...a, [step.id]: v }));
    goNext();
  }, [draft, step, goNext]);

  // ── Fire Lead once, when the contact info is complete (entering finish) ──────
  useEffect(() => {
    if (step.type !== "finish" || leadFiredRef.current) return;
    leadFiredRef.current = true;
    // Record the session-wide guard so /booking-confirmed won't double-fire Lead.
    try { sessionStorage.setItem(LEAD_FIRED_SESSION_KEY, "1"); } catch { /* non-critical */ }

    const nm = typeof answers.name === "string" ? answers.name : "";
    const phone = typeof answers.whatsapp === "string" ? answers.whatsapp : "";
    const email = typeof answers.email === "string" ? answers.email : "";
    const firstName = nm.split(" ")[0] || "";
    const lastName = nm.split(" ").slice(1).join(" ");

    persistUserIdentity({ ...(firstName && { first_name: firstName }), ...(phone && { phone }), ...(email && { email }) });

    const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    leadIdRef.current = leadId;

    // Browser Pixel Lead — capture event_id for server dedup
    const leadEventId = trackLead({
      ...(firstName && { first_name: firstName }),
      ...(lastName && { last_name: lastName }),
      ...(phone && { phone }),
      ...(email && { email }),
    });
    pushDL({ event: "qualifying_flow_completed" });

    // UTM / source attribution
    const utms = getUtmParams();
    const fbclid = getFbclid();
    const visitorId = getVisitorId();
    const attribution = { ...utms, ...(fbclid && { fbclid }), ...(visitorId && { visitor_id: visitorId }) };

    // Server CAPI Lead — same event_id → Meta dedup. Logged (no longer silent).
    sendLeadToCapi(
      leadEventId,
      {
        ...(firstName && { first_name: firstName }),
        ...(lastName && { last_name: lastName }),
        ...(phone && { phone }),
        ...(email && { email }),
        ...(visitorId && { external_id: visitorId }),
      },
      "https://www.swapnilumbarkarfitness.in/book",
    );

    // Full lead payload → Make webhook (silent score/band for manual review only)
    const { score, band } = computeScore(answers);
    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        name: nm,
        phone,
        email,
        city: typeof answers.city === "string" ? answers.city : "",
        profession: typeof answers.profession === "string" ? answers.profession : "",
        answers,
        leadScore: score,
        band,
        ...attribution,
      }),
    }).catch(() => {});
  }, [step.type, answers]);

  // ── Keyboard control ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || (e.key === "ArrowLeft" && step.type !== "text" && step.type !== "tel" && step.type !== "email")) {
        goBack();
        return;
      }
      if (step.type === "single" && /^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        const opt = step.options?.[i];
        if (opt) selectSingle(opt.label);
      }
      if ((step.type === "intro" || step.type === "info") && e.key === "Enter") goNext();
      if (step.type === "multi" && e.key === "Enter") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, selectSingle, goNext, goBack]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[720px] px-5">
      {step.type !== "intro" && step.type !== "finish" && <ProgressBar pct={pct} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* INTRO */}
          {step.type === "intro" && (
            <div className="py-10 text-center">
              <h1
                className="mx-auto max-w-[16ch] text-[length:clamp(2rem,1.4rem+3vw,3.25rem)] font-black leading-[1.05] tracking-[-0.03em] text-white"
                style={{ fontFamily: "var(--font-display), Georgia, serif" }}
              >
                {step.question}
              </h1>
              <p className="mx-auto mt-5 max-w-[42ch] text-[1rem] leading-relaxed text-white/55">{step.sub}</p>
              <button
                type="button"
                onClick={goNext}
                className="mt-9 inline-flex items-center gap-2 rounded-full px-8 py-4 text-[1rem] font-bold text-white transition-transform hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)", boxShadow: "0 12px 36px rgba(168,85,247,0.35)" }}
              >
                Start →
              </button>
              <p className="mt-4 text-[0.72rem] text-white/25">Free session · No payment required</p>
            </div>
          )}

          {/* QUESTION HEADER (shared) */}
          {step.type !== "intro" && step.type !== "finish" && (
            <h2
              className="text-[length:clamp(1.6rem,1.2rem+1.8vw,2.4rem)] font-bold leading-[1.12] tracking-[-0.02em] text-white"
              style={{ fontFamily: "var(--font-display), Georgia, serif" }}
            >
              {personalize(step.question)}
            </h2>
          )}
          {step.sub && step.type !== "intro" && step.type !== "finish" && (
            <p className="mt-2.5 text-[0.92rem] text-white/45">{step.sub}</p>
          )}

          {/* SINGLE */}
          {step.type === "single" && (
            <div className="mt-7 flex flex-col gap-3">
              {step.options!.map((opt, i) => (
                <OptionCard
                  key={opt.label}
                  option={opt}
                  index={i}
                  selected={answers[step.id] === opt.label}
                  onClick={() => selectSingle(opt.label)}
                />
              ))}
            </div>
          )}

          {/* MULTI */}
          {step.type === "multi" && (
            <>
              <div className="mt-7 flex flex-col gap-3">
                {step.options!.map((opt, i) => {
                  const cur = Array.isArray(answers[step.id]) ? (answers[step.id] as string[]) : [];
                  return (
                    <OptionCard
                      key={opt.label}
                      option={opt}
                      index={i}
                      selected={cur.includes(opt.label)}
                      onClick={() => toggleMulti(opt.label)}
                    />
                  );
                })}
              </div>
              <ContinueButton onClick={goNext} />
            </>
          )}

          {/* SCALE */}
          {step.type === "scale" && (
            <>
              <div className="mt-7 grid grid-cols-5 gap-2.5 sm:grid-cols-10">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                  const sel = answers[step.id] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [step.id]: n }))}
                      className="flex h-14 items-center justify-center rounded-xl border text-[1rem] font-bold transition-all duration-150"
                      style={{
                        borderColor: sel ? "rgba(168,85,247,0.7)" : "rgba(255,255,255,0.1)",
                        background: sel ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.035)",
                        color: sel ? "#e9d5ff" : "rgba(255,255,255,0.7)",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[0.72rem] text-white/30">
                <span>Just curious</span>
                <span>Fully committed</span>
              </div>
              {answers[step.id] != null && <ContinueButton onClick={goNext} />}
            </>
          )}

          {/* INFO / VALUE MOMENT */}
          {step.type === "info" && (
            <div className="mt-4">
              <p className="text-[1.05rem] leading-[1.7] text-white/75">{personalize(step.body?.(answers))}</p>
              <ContinueButton onClick={goNext} label="Continue →" />
            </div>
          )}

          {/* TEXT / TEL / EMAIL */}
          {(step.type === "text" || step.type === "tel" || step.type === "email") && (
            <div className="mt-7">
              <TextField
                value={draft}
                onChange={(v) => { setDraft(v); if (error) setError(""); }}
                onEnter={submitText}
                type={step.type === "text" ? "text" : step.type}
                placeholder={step.placeholder}
                error={error}
              />
              <ContinueButton onClick={submitText} />
            </div>
          )}

          {/* FINISH — animated reward → calendar */}
          {step.type === "finish" && (
            <FinishStep
              name={name}
              email={typeof answers.email === "string" ? answers.email : ""}
              phone={typeof answers.whatsapp === "string" ? answers.whatsapp : ""}
              leadId={leadIdRef.current}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Back control */}
      {step.type !== "intro" && step.type !== "finish" && idx > 0 && (
        <button
          type="button"
          onClick={goBack}
          className="mt-6 text-[0.78rem] font-medium text-white/30 transition-colors hover:text-white/60"
        >
          ← Back
        </button>
      )}
    </div>
  );
}

function ContinueButton({ onClick, label = "Continue →" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[0.95rem] font-bold text-white transition-transform hover:scale-[1.02]"
      style={{ background: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)", boxShadow: "0 10px 30px rgba(168,85,247,0.3)" }}
    >
      {label}
    </button>
  );
}

function FinishStep({ name, email, phone, leadId }: { name: string; email: string; phone: string; leadId: string }) {
  const [revealCalendar, setRevealCalendar] = useState(false);
  const checks = ["Profile complete", "Goals identified", "Matching you to the right session…"];
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const timers = checks.map((_, i) => setTimeout(() => setShown((s) => Math.max(s, i + 1)), 250 * (i + 1)));
    const cal = setTimeout(() => setRevealCalendar(true), 250 * checks.length + 500);
    return () => { timers.forEach(clearTimeout); clearTimeout(cal); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="py-4">
      {!revealCalendar ? (
        <div className="py-10 text-center">
          <div className="mx-auto flex max-w-[22rem] flex-col gap-3">
            {checks.map((c, i) => (
              <motion.div
                key={c}
                initial={{ opacity: 0, x: -10 }}
                animate={i < shown ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "rgba(168,85,247,0.2)" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6.5l2.5 2.5 5.5-5.5" stroke="#c5a24d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <span className="text-[0.9rem] font-semibold text-white/85">{c}</span>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-5 text-center">
            <h2 className="text-[length:clamp(1.5rem,1.2rem+1.4vw,2rem)] font-bold leading-tight tracking-[-0.02em] text-white" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
              Pick a time that works for you{name ? `, ${name.split(" ")[0]}` : ""} 👇
            </h2>
            <p className="mx-auto mt-2.5 max-w-[40ch] text-[0.88rem] text-white/50">Your free 60-minute thyroid strategy session. Swapnil reviews your answers before you meet.</p>
          </div>
          <CalendarStep name={name} email={email} phone={phone} leadId={leadId} />
        </motion.div>
      )}
    </div>
  );
}
