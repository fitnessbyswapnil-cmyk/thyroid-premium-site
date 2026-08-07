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
// — the qualifying step before the paid 1-on-1 call. The assessment itself
// generates the visitor's score, then its result screen opens an EMBEDDED
// Cashfree checkout (in-page modal, no navigation to cashfree.com) and, on
// success, hands off to /session-booked, which embeds the Cal.com calendar
// inline. The whole funnel stays on swapnilumbarkarfitness.in end to end.
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
