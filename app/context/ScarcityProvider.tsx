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
  goToCta: () => void;
};

const ScarcityContext = createContext<ScarcityContextValue | null>(null);

// Honest, static scarcity — no timer / scroll-based decrementing counter.
// Reflects a genuinely limited weekly intake without faking a live count.
const SCARCITY_LINE = "Only a few sessions open this week";
const SCARCITY_SHORT = "Limited weekly intake";

// Every CTA on the site routes here. Consultation calls are booked through
// the Cashfree-hosted form: complete it → slot reserved → call scheduled.
// (Owner-side: the form's success/return URL should point back to
// https://www.swapnilumbarkarfitness.in/book so paid clients flow straight
// into the qualifying questions + Cal.com calendar.)
export const CONSULTATION_FORM_URL = "https://payments.cashfree.com/forms/thyroid-session";

export function ScarcityProvider({ children }: { children: ReactNode }) {
  const goToCta = useCallback(() => {
    window.location.href = CONSULTATION_FORM_URL;
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
