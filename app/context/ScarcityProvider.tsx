"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import BookingModal from "../components/BookingModal";

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

// QUIZ-FIRST funnel (owner decision): every CTA sends her into the free
// Thyroid Score assessment (/assessment) FIRST — never straight to payment.
// She sees her score and active blockers, THEN the result screen's own CTA
// opens the Rs 299 embedded Cashfree checkout (QuizFunnel.tsx payNow) —
// fully on-domain, prefilled from the name/phone/email already captured at
// the quiz unlock step, so nothing is asked twice.
//
// CONSULTATION_FORM_URL stays exported as the LAST-RESORT fallback the quiz
// and /book payment flows fall back to if the embedded SDK checkout can't
// start — it is not a primary CTA target anywhere on the site.
export const CONSULTATION_FORM_URL =
  "https://payments.cashfree.com/forms?code=thyroid-session";

export function ScarcityProvider({ children }: { children: ReactNode }) {
  const goToCta = useCallback(() => {
    window.location.href = "/assessment";
  }, []);

  const value: ScarcityContextValue = {
    scarcityLine: SCARCITY_LINE,
    scarcityShort: SCARCITY_SHORT,
    goToCta,
  };

  return (
    <ScarcityContext.Provider value={value}>
      {children}
      <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} location={modalLocation} />
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
