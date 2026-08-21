"use client";

import { useCallback, useEffect, useState } from "react";
import SectionCta from "./SectionCta";
import { pushDL } from "@/app/lib/analytics";

// Symptom recognition grid — framed for the MEDICATED woman ("still ticking
// these even on the tablet?"), which keeps the hyperniche sharp while letting
// the undiagnosed reader self-include (she ticks the same boxes). Descriptive
// only: symptoms are named, never "treated" or "cured" — that line keeps the
// section clean for ASCI and Meta health policy.
//
// WHY THIS IS INTERACTIVE, AND WHY IT SITS SECOND ON THE PAGE:
// this is the only moment before the CTA where she describes herself rather
// than being described. Ticking boxes is a small self-identifying act, which
// makes the larger consistent act — booking — materially more likely. The
// running count also leaves the list visibly unfinished, and a partially
// complete set pulls at attention in a way a static grid does not.
//
// The tally is written to sessionStorage so the booking step can open holding
// her own answers instead of asking her to repeat them.
const SYMPTOMS = [
  "Constant fatigue",
  "Morning bloating",
  "Hair fall",
  "Brain fog in meetings",
  "Cold hands & feet",
  "Afternoon energy crash",
  "Cravings after dinner",
  "Weight that won't move",
  "Disturbed sleep",
  "Puffy face",
] as const;

export const SYMPTOM_TALLY_KEY = "thyroid_symptom_tally";

/** The result line is the CTA's argument, so it has to change with the count. */
function verdict(n: number): { head: string; body: string } {
  if (n === 0) {
    return {
      head: "Tap the ones that are true for you this week.",
      body: "Most women on thyroid medication tick more than they expect to.",
    };
  }
  if (n <= 2) {
    return {
      head: `${n} ticked.`,
      body: "Even one or two of these can be a thyroid signal worth reading properly, especially alongside a report that says 'normal'.",
    };
  }
  return {
    head: `${n} of 10 ticked.`,
    body: "Three or more is a pattern, not a coincidence. On the call I read your reports against it and tell you which of the three blockers is yours.",
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

  // Persist for the booking step. Debounced via effect so rapid taps write once
  // per settled state rather than on every toggle.
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

        <ul
          className="mx-auto flex max-w-[560px] flex-wrap items-center justify-center gap-2.5"
          role="list"
        >
          {SYMPTOMS.map((s) => {
            const on = picked.has(s);
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s)}
                  className={[
                    "inline-flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2",
                    "text-[13.5px] font-medium transition-colors duration-150",
                    on
                      ? "border border-[var(--t1)] bg-[var(--yellow-soft)] text-[var(--t1)]"
                      : "border border-[var(--border-strong)] bg-white text-[var(--t2)] hover:border-[var(--t4)]",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-[15px] w-[15px] items-center justify-center rounded-[4px] text-[10px] font-bold transition-colors duration-150",
                      on
                        ? "bg-[var(--yellow-mark)] text-[var(--ink-on-yellow)]"
                        : "border border-[var(--border-strong)] bg-white text-transparent",
                    ].join(" ")}
                  >
                    ✓
                  </span>
                  {s}
                </button>
              </li>
            );
          })}
        </ul>

        <div
          aria-live="polite"
          className="mx-auto mt-7 max-w-[40ch] text-center"
        >
          <p className="text-pretty text-[length:var(--text-sm)] leading-[1.7] text-[var(--t2)]">
            <strong className="font-semibold text-[var(--t1)]">{head}</strong>{" "}
            {body}
          </p>
        </div>

        <p className="mx-auto mt-2 max-w-[40ch] text-center text-[12.5px] leading-[1.55] text-[var(--t4)]">
          No tablet, and reports say &ldquo;normal&rdquo; but your body disagrees? This still applies.
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
