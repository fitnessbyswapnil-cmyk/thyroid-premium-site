"use client";

import { useEffect, useState } from "react";

/**
 * The score screen, 28-Nov-2026.
 *
 * The owner's brief: the old card (a number, "3 of 7 markers present", a list
 * of dots) looked plain and asked her to decode it herself. This one reads like
 * a short report made for her: a gauge with a word on it (Low / Moderate /
 * High), one sentence that says what the number means, the signs found in HER
 * answers each with one plain line on why it matters, and an honest footnote
 * that a score from answers is not a diagnosis.
 *
 * Below it, NextSteps shows the three things that happen from here, so the
 * booking form reads as step 2 of a path she can see the end of, not a form
 * that appeared under a score.
 *
 * Nothing here is inferred. Every "found" row is a tap she made; the band is a
 * fixed cut of the same seven-marker count the quiz has always produced.
 */

export type Marker = { label: string; hit: boolean };

/** One plain line per sign, shown only for the signs found in her answers.
 *  Coaching language, no medical claims: nothing here says a marker IS the
 *  cause, only why it is worth looking at. */
const WHY: Record<string, string> = {
  "A thyroid diagnosis": "Your plan has to work with your thyroid, not around it.",
  "Weight stuck even on the tablet": "The tablet treats the report. It does not always move the weight.",
  "Stuck for more than a year": "A long plateau points to the plan, not to your effort.",
  "Eating less did not move it": "Eating even less is not your lever. Something else is.",
  "Already paid for help that did not hold": "Help that was not built around a thyroid tends not to last.",
  "Ten kilos or more to lose": "At this size, a structured plan matters more than willpower.",
  "In the age band where thyroid and hormones shift together": "After 40, thyroid and hormone changes often overlap.",
};

export type Band = { key: "low" | "moderate" | "high"; word: string };

export function bandFor(score100: number): Band {
  if (score100 >= 57) return { key: "high", word: "High" };
  if (score100 >= 40) return { key: "moderate", word: "Moderate" };
  return { key: "low", word: "Low" };
}

const BANDS: Band[] = [
  { key: "low", word: "Low" },
  { key: "moderate", word: "Moderate" },
  { key: "high", word: "High" },
];

function Gauge({ score }: { score: number }) {
  // Starts empty and fills once mounted. Reduced motion: globals.css drops
  // the transition, so it simply renders full.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);
  return (
    <svg viewBox="0 0 240 132" className="score-gauge" aria-hidden="true">
      <defs>
        <linearGradient id="score-arc-fill" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#f3cf8c" />
          <stop offset="1" stopColor="#e0a042" />
        </linearGradient>
      </defs>
      <path d="M20 120 A100 100 0 0 1 220 120" pathLength={100} fill="none"
        stroke="rgba(255,255,255,0.12)" strokeWidth="14" strokeLinecap="round" />
      <path d="M20 120 A100 100 0 0 1 220 120" pathLength={100} fill="none"
        stroke="url(#score-arc-fill)" strokeWidth="14" strokeLinecap="round"
        strokeDasharray="100" strokeDashoffset={100 - Math.max(shown, 1)} className="score-arc" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className="flex-none">
      <circle cx="10" cy="10" r="10" fill="var(--clinic-amber)" />
      <path d="M5.6 10.4l2.9 2.8 5.9-6.2" fill="none" stroke="var(--clinic-ink)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ScoreReport({
  name,
  score100,
  hits,
  markers,
  meaning,
  next,
}: {
  name: string;
  score100: number;
  hits: number;
  /** null when she came back from the WhatsApp link: the score survives, her taps do not. */
  markers: Marker[] | null;
  /** The one line under the signs that says what this means for her. */
  meaning?: React.ReactNode;
  /** Shown under the card when the next step is booking. */
  next?: { href: string; label: string; sub: string };
}) {
  const band = bandFor(score100);
  const found = markers?.filter((m) => m.hit) ?? [];
  const absent = markers?.filter((m) => !m.hit) ?? [];
  const first = name.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto mt-2 w-full max-w-[560px] text-left">
      <div className="score-report">
        {/* The dark head: the number and what it means, at a glance. */}
        <div className="score-report__head">
          <p className="text-[length:var(--fs-3xs)] font-semibold uppercase tracking-[var(--ls-caps)]" style={{ color: "var(--clinic-amber)" }}>
            Your thyroid metabolism score
          </p>
          {first && (
            <p className="mt-1 text-[length:var(--fs-3xs)]" style={{ color: "rgba(250,247,242,0.72)" }}>
              Prepared for {first}
            </p>
          )}

          <div className="relative mx-auto mt-5 w-full max-w-[280px]">
            <Gauge score={score100} />
            <div className="absolute inset-x-0 bottom-0 text-center">
              <span className="text-[length:var(--fs-3xl)] font-medium leading-[var(--lh-display)] tracking-[var(--ls-display)]" style={{ fontFamily: "var(--font-display), Georgia, serif" }} data-tabular>
                {score100}
              </span>
              <span className="text-[length:var(--fs-sm)]" style={{ color: "rgba(250,247,242,0.6)" }}> / 100</span>
            </div>
          </div>

          {/* The scale, so the number never has to be interpreted alone. */}
          <div className="score-bands mx-auto mt-4 max-w-[320px]" role="img" aria-label={`Score band: ${band.word}`}>
            {BANDS.map((b) => {
              const on = b.key === band.key;
              return (
                <div key={b.key} className="text-center">
                  <div className="h-1.5 rounded-full" style={{ background: on ? "var(--clinic-amber)" : "rgba(255,255,255,0.14)" }} />
                  <div className={`mt-1.5 text-[length:var(--fs-3xs)] ${on ? "font-semibold" : "font-normal"}`} style={{ color: on ? "#faf7f2" : "rgba(250,247,242,0.5)" }}>
                    {b.word}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mx-auto mt-5 max-w-[420px] text-center text-[length:var(--fs-sm)] leading-[var(--lh-body)]" style={{ color: "#faf7f2" }}>
            Your answers show <strong className="font-semibold" style={{ color: "var(--clinic-amber)" }}>{hits} of the 7 signs</strong> that keep thyroid weight stuck.
          </p>
        </div>

        {/* The light body: which signs, and why each one matters. */}
        <div className="score-report__body">
          {markers && (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[length:var(--fs-3xs)] font-semibold uppercase tracking-[var(--ls-caps)] text-[var(--clinic-amber-ink)]">
                  Found in your answers
                </p>
                <span className="text-[length:var(--fs-3xs)] text-[var(--t2)]" data-tabular>{found.length} of 7</span>
              </div>
              {found.length > 0 ? (
                <ul className="mt-3 flex list-none flex-col gap-3 p-0">
                  {found.map((m) => (
                    <li key={m.label} className="score-report__row">
                      <Check />
                      <div>
                        <p className="text-[length:var(--fs-xs)] font-medium leading-[var(--lh-tight)] text-[var(--t1)]">{m.label}</p>
                        {WHY[m.label] && (
                          <p className="mt-0.5 text-[length:var(--fs-3xs)] leading-[var(--lh-tight)] text-[var(--t2)]">{WHY[m.label]}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[length:var(--fs-xs)] leading-[var(--lh-body)] text-[var(--t2)]">
                  None of the seven signs showed up in your answers.
                </p>
              )}

              {absent.length > 0 && (
                <>
                  <p className="mt-6 text-[length:var(--fs-3xs)] font-semibold uppercase tracking-[var(--ls-caps)] text-[var(--t2)]">
                    Not in your answers
                  </p>
                  <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
                    {absent.map((m) => (
                      <li key={m.label} className="score-report__chip text-[length:var(--fs-3xs)] leading-[var(--lh-tight)]">{m.label}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {meaning && (
            <p className={`${markers ? "mt-6 border-t pt-5" : ""} text-[length:var(--fs-xs)] leading-[var(--lh-body)] text-[var(--t1)]`} style={{ borderColor: "var(--clinic-line)" }}>
              {meaning}
            </p>
          )}
          <p className="mt-3 text-[length:var(--fs-3xs)] leading-[var(--lh-tight)] text-[var(--t2)]">
            This score comes from your answers. It is not a diagnosis.
          </p>
        </div>
      </div>

      {next && (
        <a
          href={next.href}
          onClick={(e) => {
            const el = document.getElementById(next.href.replace("#", ""));
            if (!el) return;
            e.preventDefault();
            el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
          }}
          className="cta-button mx-auto mt-6"
          style={{ maxWidth: "24rem", textDecoration: "none" }}
        >
          {next.label}
          <span className="cta-sub">{next.sub}</span>
        </a>
      )}
    </div>
  );
}

/**
 * What happens after the score, as three steps she can see the end of. Step 1
 * is the form directly below; the other two are what that booking buys her.
 */
export function NextSteps({ hasReport }: { hasReport: boolean }) {
  const steps = [
    { title: "Pick your time", body: "Right below. It takes about a minute.", now: true },
    hasReport
      ? { title: "Send your report", body: "On WhatsApp, before the call. TSH, T3 and T4 are enough.", now: false }
      : { title: "Get the right tests", body: "I tell you which tests to get, and why most labs leave some out.", now: false },
    hasReport
      ? { title: "Get your answer", body: "60 minutes, one to one. I read your report line by line and show you your blocker.", now: false }
      : { title: "Get your answer", body: "60 minutes, one to one. We work from your answers, and you leave with a plan to start.", now: false },
  ];
  return (
    <div id="next-step" className="mx-auto mt-12 w-full max-w-[560px] text-left" style={{ scrollMarginTop: 16 }}>
      <p className="text-center text-[length:var(--fs-3xs)] font-semibold uppercase tracking-[var(--ls-caps)] text-[var(--clinic-amber-ink)]">
        Your next step
      </p>
      <h2 className="section-title mx-auto mt-2 text-balance text-center">Book your free Thyroid Root Cause Session</h2>
      <ol className="next-steps mt-7 list-none p-0">
        {steps.map((s, n) => (
          <li key={s.title} className={`next-steps__item${s.now ? " is-now" : ""}`}>
            <span className="next-steps__num" aria-hidden="true">{n + 1}</span>
            <div>
              <p className="text-[length:var(--fs-xs)] font-semibold leading-[var(--lh-tight)] text-[var(--t1)]">
                {s.title}
                {s.now && <span className="next-steps__now">You are here</span>}
              </p>
              <p className="mt-1 text-[length:var(--fs-3xs)] leading-[var(--lh-tight)] text-[var(--t2)]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
