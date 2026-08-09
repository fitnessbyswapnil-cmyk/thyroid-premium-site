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

// DIRECT-TO-BOOKING funnel (owner instruction): every primary CTA sends the
// visitor straight to the Cashfree-hosted form to book the Rs 299
// consultation call — CTA copy states the price up front so the payment page
// is never a surprise. The free Thyroid Score quiz (/assessment) remains as
// the SECONDARY path (soft "not sure yet?" links) so hesitant visitors are
// still captured as leads instead of bouncing.
//
// The form's own dashboard settings decide the amount charged; CTA copy is
// driven separately by SESSION_PRICE in app/lib/pricing.ts.
//
// OWNER-SIDE: the form's success/return URL points to /session-booked so a
// paying visitor lands on the embedded Cal.com calendar.
export const CONSULTATION_FORM_URL =
  "https://payments.cashfree.com/forms?code=thyroid-session";

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
