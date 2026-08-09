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

// EMBEDDED-ON-DOMAIN funnel (owner instruction): every primary CTA opens the
// in-page BookingModal — name + WhatsApp, then the Cashfree JS SDK checkout
// as an in-page modal. The visitor never leaves swapnilumbarkarfitness.in,
// and the post-payment redirect is triggered by OUR code (window.location.href
// in BookingModal), not a Cashfree dashboard setting — that setting proved
// unreliable across multiple attempts to configure it correctly.
//
// CONSULTATION_FORM_URL is kept as the FALLBACK ONLY: if the embedded
// checkout can't start (order API/SDK failure), BookingModal sends her here
// instead of leaving a dead button. It is no longer a primary CTA target.
export const CONSULTATION_FORM_URL =
  "https://payments.cashfree.com/forms?code=thyroid-session";

export function ScarcityProvider({ children }: { children: ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLocation, setModalLocation] = useState("unknown");

  const goToCta = useCallback((location?: string) => {
    setModalLocation(location ?? "unknown");
    setModalOpen(true);
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
