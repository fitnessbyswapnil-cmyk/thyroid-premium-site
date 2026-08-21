"use client";

import { useCallback, useEffect, useState } from "react";
import SectionCta from "./SectionCta";
import { pushDL } from "@/app/lib/analytics";

// Symptom recognition — framed for the MEDICATED woman ("still ticking these
// even on the tablet?"), which keeps the hyperniche sharp while letting the
// undiagnosed reader self-include. Descriptive only: symptoms are named, never
// "treated" or "cured", which keeps the section clean for ASCI and for Meta's
// health policy. Nothing here asserts that the reader has a condition.
//
// WHY THESE ARE SENTENCES AND NOT LABELS:
// "Constant fatigue" is a category. She has to decide whether her tiredness
// counts as "constant", and half the time she talks herself out of it.
// "By 4pm you are finished" is a memory — she either recognises the afternoon
// or she doesn't, and there is nothing to argue with. Recognition is what this
// whole section exists to produce, so every line names a moment she has
// actually lived rather than a symptom she has to categorise.
//
// WHY IT IS INTERACTIVE, AND WHY IT SITS SECOND ON THE PAGE:
// this is the only point before the CTA where she describes herself rather
// than being described. Ticking is a small self-identifying act, which makes
// the larger consistent act — booking — materially more likely. The running
// count also leaves the list visibly unfinished, which pulls at attention in a
// way a static grid does not.
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

/** The result line is the CTA's argument, so it has to move with the count. */
function verdict(n: number): { head: string; body: string } {
  if (n === 0) {
    return {
      head: "Tap the ones that are true for you.",
      body: "Most women on thyroid medicine tick more than they expect to.",
    };
  }
  if (n <= 2) {
    return {
      head: `${n} ticked.`,
      body: "Even one or two can be your thyroid talking — especially if your report came back normal.",
    };
  }
  return {
    head: `${n} out of 10.`,
    body: "Three or more is a pattern, not bad luck. On the call I read your reports against it and tell you which of the three blockers is yours.",
  };
}

export default function SymptomChips() {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const count = picked.size;
  const { head, body } = verdict(count);

  const toggle = useCallback((s: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  // Persist for the booking step.
  useEffect(() => {
    try {
      if (count === 0) sessionStorage.removeItem(SYMPTOM_TALLY_KEY);
      else {
        sessionStorage.setItem(
          SYMPTOM_TALLY_KEY,
          JSON.stringify({ count, symptoms: [...picked] }),
        );
      }
    } catch {
      /* storage unavailable — the section still works, it just does not carry forward */
    }
  }, [count, picked]);

  // One dataLayer event at the point the pattern becomes meaningful, not on
  // every tap — three ticks is where she has effectively self-qualified.
  useEffect(() => {
    if (count === 3) pushDL({ event: "symptom_pattern_reached", symptom_count: 3 });
  }, [count]);

  return (
    <section
      className="section-pad relative bg-[var(--bg-section)]"
      aria-labelledby="symptoms-heading"
    >
      <div className="container-narrow relative z-10">
        <header className="section-header">
          <p className="section-label">Sound familiar?</p>
          <h2
            id="symptoms-heading"
            className="section-title mx-auto text-balance"
            style={{ maxWidth: "22ch" }}
          >
            Still ticking these boxes, even on your tablet?
          </h2>
        </header>

        {/* Rows, not pills. These are sentences now, and a sentence in a pill
            either wraps badly or gets truncated. A full-width row also gives a
            far bigger tap target on the phone, which is where nearly all of
            this traffic reads it. */}
        <ul
          className="mx-auto max-w-[46ch] overflow-hidden rounded-[14px] border border-[var(--border-hairline)] bg-white"
          role="list"
        >
          {SYMPTOMS.map((s, i) => {
            const on = picked.has(s);
            return (
              <li
                key={s}
                className={i > 0 ? "border-t border-[var(--border-hairline)]" : ""}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s)}
                  className={[
                    "flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left",
                    "transition-colors duration-150",
                    on ? "bg-[var(--yellow-soft)]" : "bg-white hover:bg-[var(--surface-wash)]",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "mt-[2px] flex h-[19px] w-[19px] flex-none items-center justify-center rounded-[5px]",
                      "text-[11px] font-bold transition-colors duration-150",
                      on
                        ? "bg-[var(--yellow-mark)] text-[var(--ink-on-yellow)]"
                        : "border border-[var(--border-strong)] bg-white text-transparent",
                    ].join(" ")}
                  >
                    ✓
                  </span>
                  <span
                    className={[
                      "text-[15px] leading-[1.5] transition-colors duration-150",
                      on ? "font-medium text-[var(--t1)]" : "text-[var(--t2)]",
                    ].join(" ")}
                  >
                    {s}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div aria-live="polite" className="mx-auto mt-7 max-w-[42ch] text-center">
          <p className="text-pretty text-[length:var(--text-sm)] leading-[1.7] text-[var(--t2)]">
            <strong className="font-semibold text-[var(--t1)]">{head}</strong> {body}
          </p>
        </div>

        <p className="mx-auto mt-2 max-w-[40ch] text-center text-[12.5px] leading-[1.55] text-[var(--t4)]">
          No tablet, and your report says &ldquo;normal&rdquo; but your body disagrees? This still applies.
        </p>

        <SectionCta
          variant="primary"
          className="mx-auto mt-8 max-w-sm"
          buttonClassName="w-full"
          label={count >= 3 ? "Find Out Which Blocker Is Mine" : "Schedule My 1-1 Thyroid Call"}
          sublabel="Find what is blocking your thyroid fat loss · free"
          trust="Leave the call knowing your exact blocker. No charge, no obligation."
          ariaLabel="Schedule my 1-1 thyroid fat loss session"
          location="symptoms"
        />
      </div>
    </section>
  );
}
