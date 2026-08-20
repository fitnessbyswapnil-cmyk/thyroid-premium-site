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

// PAY-AT-END funnel (owner decision, 20 Aug 2026): every CTA sends her to
// /book-session — the Cal.com embed, where she picks a slot and answers the
// qualification questions FIRST — then /confirm-session asks for the Rs 299
// that confirms the slot.
//
// Why this order: her budget answer (Rs 50k / 30k / 15k) sits two questions
// before the price, so Rs 299 is read against an anchor she set herself, and
// she has already invested several minutes and mentally owns the slot. It also
// keeps the qualification data of everyone who does NOT pay, because the lead
// is written before the charge — pay-first threw that away.
//
// /schedule (pay-first, three fields then checkout) is left intact so the two
// orders can be tested against each other on cost per paid booking.
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
    window.location.href = "/book-session";
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
