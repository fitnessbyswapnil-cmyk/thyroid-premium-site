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

// Every CTA on the site routes into the Thyroid Score assessment (/assessment)
// — the qualifying step before the paid 1-on-1 call. The assessment generates
// the visitor's score, and its result screen sends her to the Cashfree-hosted
// payment form below.
//
// PAYMENT STEP — Cashfree-hosted form (owner's choice; it needs no API keys).
// The form's own settings decide the amount charged; CTA copy is driven
// separately by SESSION_PRICE in app/lib/pricing.ts.
//
// OWNER-SIDE REQUIREMENT: the form's success/return URL must be set to
//   https://www.swapnilumbarkarfitness.in/payment-success?order_id={order_id}
// Without it, a paying visitor is left on Cashfree and never reaches the
// Cal.com calendar — no booking, and no Meta Purchase/Schedule events.
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
