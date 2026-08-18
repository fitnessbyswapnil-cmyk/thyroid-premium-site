"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { questions, computeResult, type Answers, type QuizResult } from "./quizData";
import { ScoreGauge } from "./ScoreGauge";
import { QuestionCard } from "./QuestionCard";
import { LeadCaptureCard, type CaptureData } from "./LeadCaptureCard";
import { ResultCard } from "./ResultCard";
import {
  pushDL,
  trackLead,
  generateEventId,
  trackCtaClick,
} from "@/app/lib/analytics";
import {
  getUtmParams,
  getFbclid,
  getVisitorId,
  persistUserData,
} from "@/lib/tracking";
import { CTA_URL } from "@/app/lib/cta";

type Screen = "welcome" | "question" | "capture" | "analyzing" | "result";

const SOURCE_URL = "https://www.swapnilumbarkarfitness.in/quiz";

function readAttribution() {
  if (typeof window === "undefined") return {};
  const utms = getUtmParams();
  const fbclid = getFbclid();
  const visitor_id = getVisitorId();
  return { ...utms, ...(fbclid && { fbclid }), ...(visitor_id && { visitor_id }) };
}

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 44 : -44, opacity: 0 }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.36, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -44 : 44,
    opacity: 0,
    transition: { duration: 0.22, ease: [0.7, 0, 1, 0.6] as const },
  }),
};

export default function QuizClient() {
  const reduce = useReducedMotion();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [qIndex, setQIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [firstName, setFirstName] = useState("");

  const leadIdRef = useRef<string>("");
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = questions.length;
  const current = questions[qIndex];

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length,
    [answers],
  );
  // Header gauge fills with progress through the quiz (anticipation device).
  const gaugeValue = (answeredCount / total) * 100;

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (qIndex < total - 1) {
      setDirection(1);
      setQIndex((i) => i + 1);
    } else {
      setDirection(1);
      setScreen("capture");
    }
  }, [qIndex, total]);

  const goBack = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (screen === "capture") {
      setDirection(-1);
      setScreen("question");
      return;
    }
    if (qIndex === 0) {
      setDirection(-1);
      setScreen("welcome");
      return;
    }
    setDirection(-1);
    setQIndex((i) => i - 1);
  }, [qIndex, screen]);

  const handlePick = useCallback(
    (label: string) => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      if (current.type === "multi") {
        setAnswers((prev) => {
          const existing = prev[current.id] ?? [];
          const next = existing.includes(label)
            ? existing.filter((l) => l !== label)
            : [...existing, label];
          return { ...prev, [current.id]: next };
        });
        return;
      }
      // single → record + auto-advance
      setAnswers((prev) => ({ ...prev, [current.id]: [label] }));
      advanceTimer.current = setTimeout(() => goNext(), reduce ? 60 : 320);
    },
    [current, goNext, reduce],
  );

  // ── Start ─────────────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    pushDL({ event: "quiz_start", event_id: generateEventId("quiz_start") });
    setDirection(1);
    setQIndex(0);
    setScreen("question");
  }, []);

  // ── Submit (lead capture) ───────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (data: CaptureData) => {
      setSubmitting(true);
      setServerError(undefined);

      const r = computeResult(answers);
      setResult(r);

      const first = data.name.split(" ")[0];
      setFirstName(first);
      const leadId = `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      leadIdRef.current = leadId;
      const attribution = readAttribution();

      // Persist identity so the /book page + later events carry strong match keys.
      persistUserData({
        email: data.email,
        phone: data.whatsapp,
        name: data.name,
        externalId: getVisitorId(),
      });
      try {
        localStorage.setItem(
          "meta_user_identity",
          JSON.stringify({ email: data.email, phone: data.whatsapp, first_name: first }),
        );
      } catch {
        /* non-critical */
      }

      // Browser Pixel Lead — returns the dedup event_id reused by CAPI + DL event.
      const leadEventId = trackLead({
        first_name: first,
        phone: data.whatsapp,
        email: data.email,
      });

      // Quiz-funnel analytics event (GA4) — shares the Lead's event_id.
      pushDL({
        event: "quiz_lead_submit",
        event_id: leadEventId,
        band: r.band.id,
        band_name: r.band.name,
        percent: r.percent,
        score: r.totalScore,
        frustration: r.frustrationTag,
      });

      // Server CAPI Lead (dedupes with the browser Pixel via the same event_id).
      const capi = fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "Lead",
          event_id: leadEventId,
          source_url: SOURCE_URL,
          user_data: {
            first_name: first,
            phone: data.whatsapp,
            email: data.email,
            ...(attribution.visitor_id && { external_id: attribution.visitor_id }),
          },
          custom_data: { band: r.band.id, percent: r.percent, content_name: "thyroid_blocker_quiz" },
        }),
      }).catch(() => {});

      // Persist the lead to the existing pipeline (Sheets + Make) via /api/quiz.
      const save = fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          name: data.name,
          email: data.email,
          whatsapp: data.whatsapp,
          totalScore: r.totalScore,
          maxScore: r.maxScore,
          percent: r.percent,
          band: r.band.id,
          bandName: r.band.name,
          frustration: r.frustrationTag,
          tags: r.tags,
          answers,
          attribution,
          eventId: leadEventId,
        }),
      }).catch(() => {});

      // Premium "analysing" beat — minimum dwell so it never feels skipped.
      setScreen("analyzing");
      const dwell = new Promise((res) => setTimeout(res, reduce ? 400 : 2500));
      await Promise.allSettled([capi, save, dwell]);

      setSubmitting(false);
      setScreen("result");
    },
    [answers, reduce],
  );

  const handleResultCta = useCallback(() => {
    trackCtaClick("quiz_result", "Book Your ₹299 Thyroid Strategy Call");
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="quiz-root relative mx-auto flex min-h-[100svh] w-full max-w-[560px] flex-col px-5 pb-12 pt-6 sm:pt-10">
      {/* Header (question screens only) */}
      {screen === "question" && (
        <div className="mb-7">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/45 transition-colors hover:border-white/25 hover:text-white/80"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="flex-1">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/30">
                  Question {qIndex + 1} of {total}
                </span>
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/70">
                  Building your score
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg,#C9A24B,#E4C97B)" }}
                  animate={{ width: `${((qIndex + 1) / total) * 100}%` }}
                  transition={{ duration: reduce ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>

            <ScoreGauge value={gaugeValue} variant="ring" size={52} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          {screen === "welcome" && (
            <motion.div
              key="welcome"
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              className="text-center"
            >
              <div className="mb-8 flex justify-center">
                <ScoreGauge value={0} variant="result" size={170} caption="Your score" />
              </div>
              <h1 className="quiz-display mx-auto max-w-[15ch] text-balance text-[2.1rem] leading-[1.08] text-[var(--ivory)] sm:text-[2.6rem]">
                What's really blocking your thyroid fat loss?
              </h1>
              <p className="mx-auto mt-4 max-w-[40ch] text-[0.95rem] leading-relaxed text-white/55">
                Answer 14 quick questions to reveal your personal Blocker Score,
                and the exact areas quietly stalling your results.
              </p>
              <button
                type="button"
                onClick={handleStart}
                className="quiz-cta mx-auto mt-8 flex w-full max-w-[22rem] items-center justify-center gap-2 rounded-full py-[1.15rem] text-[1rem] font-bold tracking-[-0.01em] active:scale-[0.99]"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Start the Quiz →
              </button>
              <p className="mt-4 text-[0.72rem] text-white/35">
                Takes 90 seconds · 100% free
              </p>
            </motion.div>
          )}

          {screen === "question" && (
            <motion.div
              key={current.id}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <QuestionCard
                question={current}
                selected={answers[current.id] ?? []}
                onPick={handlePick}
                onContinue={goNext}
              />
            </motion.div>
          )}

          {screen === "capture" && (
            <motion.div
              key="capture"
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <button
                type="button"
                onClick={goBack}
                className="mb-5 inline-flex items-center gap-1.5 text-[0.74rem] font-medium text-white/40 transition-colors hover:text-white/70"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M10 4 6 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>
              <LeadCaptureCard
                onSubmit={handleSubmit}
                submitting={submitting}
                serverError={serverError}
              />
            </motion.div>
          )}

          {screen === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center text-center"
            >
              <div className="quiz-analyzing-ring" aria-hidden="true" />
              <p
                className="quiz-display mt-8 text-[1.3rem] text-[var(--ivory)]"
                role="status"
                aria-live="polite"
              >
                Analysing your answers…
              </p>
              <p className="mt-2 text-[0.82rem] text-white/45">
                Building your personalised Blocker Score
              </p>
            </motion.div>
          )}

          {screen === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: reduce ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <ResultCard
                result={result}
                firstName={firstName}
                onCta={handleResultCta}
                ctaUrl={CTA_URL}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
