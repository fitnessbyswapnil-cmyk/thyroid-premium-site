"use client";

import { useCallback, useEffect, useState } from "react";
import SectionCta from "./SectionCta";
import { pushDL } from "@/app/lib/analytics";

// Symptom recognition, built to the supplied design.
//
// Every line names a moment she has lived rather than a symptom she has to
// categorise. "Constant fatigue" is a category she has to judge herself
// against, and half the time she talks herself out of it. "By 4pm you are
// finished" is a memory: she either recognises the afternoon or she does not,
// and there is nothing to argue with. Recognition is the only thing this
// section exists to produce, and it is the rung the rest of the page rests on.
//
// Descriptive only. Symptoms are named, never "treated" or "cured", and
// nothing here asserts the reader has a condition — that keeps the section
// clean for ASCI and for Meta's Personal Attributes policy.
//
// The tally is written to sessionStorage so the booking step can open holding
// her own answers instead of asking her to repeat them.
const SYMPTOMS = [
  "By 4pm you are finished. You just want to sit down.",
  "You wake up and your stomach is already bloated.",
  "Too much hair in the comb, every single morning.",
  "You forget what you were saying, mid-sentence, in a meeting.",
  "Your feet stay cold in bed, even in summer.",
  "You need chai just to get through the afternoon.",
  "Dinner is done and you still want something sweet.",
  "The weighing scale has shown the same number for months.",
  "You sleep a full night and wake up tired anyway.",
  "You avoid the front camera first thing in the morning.",
] as const;

export const SYMPTOM_TALLY_KEY = "thyroid_symptom_tally";

// Shown at thresholds rather than on every tick: an encouragement that fires
// on tick one is noise, one that fires at three is a verdict.
const ENCOURAGE: Record<number, string> = {
  3: "That's already more than most.",
  6: "Sound like a lot? You're not imagining it.",
  9: "Every single one — this call is exactly for you.",
};

function encouragementFor(n: number): string {
  let out = "";
  for (const t of Object.keys(ENCOURAGE).map(Number).sort((a, b) => a - b)) {
    if (n >= t) out = ENCOURAGE[t];
  }
  return out;
}

export default function SymptomChips() {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const count = picked.size;
  const total = SYMPTOMS.length;
  const pct = Math.round((count / total) * 100);
  const encourage = encouragementFor(count);

  const toggle = useCallback((s: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      if (count === 0) sessionStorage.removeItem(SYMPTOM_TALLY_KEY);
      else sessionStorage.setItem(SYMPTOM_TALLY_KEY, JSON.stringify({ count, symptoms: [...picked] }));
    } catch {
      /* storage unavailable — the section still works, it just does not carry forward */
    }
  }, [count, picked]);

  // One dataLayer event where the pattern becomes meaningful, not per tap.
  useEffect(() => {
    if (count === 3) pushDL({ event: "symptom_pattern_reached", symptom_count: 3 });
  }, [count]);

  return (
    <section className="relative bg-[var(--bg-page)] px-4 pb-10 pt-5 md:px-6 md:pb-14 md:pt-7" aria-labelledby="symptoms-heading">
      <div className="container-narrow relative z-10 flex flex-col items-center">
        <header className="section-header">
          <p className="section-label">Sound familiar?</p>
          <h2 id="symptoms-heading" className="section-title mx-auto text-balance" style={{ maxWidth: "22ch" }}>
            Still ticking these boxes, even on your tablet?
          </h2>
        </header>

        {/* Progress bar, sticky so the count stays visible while she works down
            the list. It is the section's feedback loop: without it, ticking is
            data entry; with it, she is watching a number about herself climb. */}
        <div className="sticky top-3 z-[5] mb-5 w-full max-w-[640px]">
          <div className="flex items-center gap-[14px] rounded-[14px] bg-white px-[18px] py-[14px] shadow-[0_2px_12px_rgba(36,31,26,0.08)]">
            <div
              className="h-[10px] flex-1 overflow-hidden rounded-lg bg-[var(--yellow-soft)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]"
              role="progressbar"
              aria-valuenow={count}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label="Symptoms ticked"
            >
              <div
                className="h-full rounded-lg"
                style={{
                  width: `${pct}%`,
                  transition: "width 400ms ease-out",
                  background: "linear-gradient(90deg, var(--red-cta), #e8622a)",
                  boxShadow: count ? "0 0 8px rgba(230,0,0,0.4)" : "none",
                }}
              />
            </div>
            <div className="whitespace-nowrap text-[length:var(--text-xs)] font-semibold text-[var(--t1)]">
              {count} of {total} ticked
            </div>
          </div>
        </div>

        <ul className="mb-10 w-full max-w-[640px] overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(36,31,26,0.06)]" role="list">
          {SYMPTOMS.map((s, i) => {
            const on = picked.has(s);
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s)}
                  className={[
                    "flex w-full cursor-pointer items-start gap-[14px] px-4 py-[14px] text-left transition-colors duration-150 md:px-[22px] md:py-4",
                    i < SYMPTOMS.length - 1 ? "border-b border-[var(--border-hairline)]" : "",
                  ].join(" ")}
                  style={{ background: on ? "var(--p-tint)" : "#fff" }}
                >
                  {/* Selected state is inline, not Tailwind. The arbitrary
                      utilities for it rendered into the DOM but produced no
                      computed style on the deployed build: the box stayed white
                      with the unchecked border while aria-pressed was true.
                      Other arbitrary values in this codebase, including
                      bg-[var(--token)] and comma-bearing shadows, do generate
                      correctly, so the cause was specific to these classes and
                      was never pinned down. Inline styles cannot be dropped by
                      the scanner, so the state is expressed that way. */}
                  <span
                    aria-hidden="true"
                    className="mt-[1px] flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-2 transition-all duration-200"
                    style={
                      on
                        ? {
                            borderColor: "var(--red-cta)",
                            background: "var(--red-cta)",
                            boxShadow: "0 2px 6px rgba(230,0,0,0.35)",
                          }
                        : {
                            borderColor: "var(--border-strong)",
                            background: "#fff",
                            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
                          }
                    }
                  >
                    {on && (
                      <svg width="13" height="10" viewBox="0 0 15 12" fill="none" className="tick-pop">
                        <path d="M1.5 6L5.5 10L13.5 1.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={[
                      "text-[14.5px] leading-[1.4] transition-colors duration-200 md:text-[15.5px]",
                      on ? "text-[var(--t1)]" : "text-[#4a4436]",
                    ].join(" ")}
                  >
                    {s}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mb-9 max-w-[600px] text-center">
          <p className="mb-2.5 text-[19px] leading-[1.5] text-[var(--t1)]">
            <strong className="font-semibold">Tap the ones that are true for you.</strong>{" "}
            Most women on thyroid medicine tick more than they expect to.
          </p>
          <p className="text-[length:var(--text-sm)] leading-[1.5] text-[var(--t4)]">
            No tablet, and your report says &ldquo;normal&rdquo; but your body disagrees? This still applies.
          </p>
        </div>

        {encourage && (
          <div
            aria-live="polite"
            className="tick-pop -mt-4 mb-7 max-w-[600px] text-center text-[length:var(--text-sm)] font-semibold text-[var(--gold-ink)]"
          >
            {encourage}
          </div>
        )}

        <SectionCta
          variant="primary"
          className="mx-auto max-w-sm"
          buttonClassName={count >= 5 ? "cta-pulse" : ""}
          label="Schedule My 1-1 Thyroid Fat Loss Call"
          sublabel="Free · 60 minutes · one to one"
          ariaLabel="Schedule my 1-1 thyroid fat loss session"
          location="symptoms"
        />
      </div>
    </section>
  );
}
