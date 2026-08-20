"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";

type ScarcityContextValue = {
  scarcityLine: string;
  scarcityShort: string;
  goToCta: (location?: string) => void;
};

const ScarcityContext = createContext<ScarcityContextValue | null>(null);

// Honest, static scarcity — no timer / scroll-based decrementing counter.
// Reflects a genuinely limited weekly intake without faking a live count.
const SCARCITY_LINE = "Only a few sessions open this week";
const SCARCITY_SHORT = "Limited weekly intake";

// SCHEDULE-FIRST funnel (owner decision, 20 Aug 2026): every CTA sends her to
// /schedule — three fields, then the same Rs 299 embedded Cashfree checkout,
// then Cal.com for the slot and the qualifying questions.
//
// This replaces the quiz-first order. The quiz asked 7 questions at the point
// of LOWEST commitment and produced 0 payments on Rs 5,637 of spend; the
// qualifying questions now sit on the Cal.com form AFTER payment, where she is
// already invested. /assessment still works and is untouched, so the old flow
// stays available for a side-by-side test.
//
// CONSULTATION_FORM_URL stays exported as the LAST-RESORT fallback the quiz
// and /book payment flows fall back to if the embedded SDK checkout can't
// start — it is not a primary CTA target anywhere on the site.
export const CONSULTATION_FORM_URL =
  "https://payments.cashfree.com/forms?code=thyroid-session";

export function ScarcityProvider({ children }: { children: ReactNode }) {
  const goToCta = useCallback(() => {
    window.location.href = "/schedule";
  }, []);

  const value: ScarcityContextValue = {
    scarcityLine: SCARCITY_LINE,
    scarcityShort: SCARCITY_SHORT,
    goToCta,
  };

  return (
    <ScarcityContext.Provider value={value}>
      {children}
    </ScarcityContext.Provider>
  );
}

export function useScarcity() {
  const ctx = useContext(ScarcityContext);
  if (!ctx) {
    throw new Error("useScarcity must be used within ScarcityProvider");
  }
  return ctx;
}
