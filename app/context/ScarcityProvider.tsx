"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type SpotsCount = 7 | 5 | 3;

type ScarcityContextValue = {
  spots: SpotsCount;
  scarcityLine: string;
  scarcityShort: string;
  goToCta: () => void;
};

const ScarcityContext = createContext<ScarcityContextValue | null>(null);

const SCARCITY_LINES: Record<SpotsCount, string> = {
  7: "Only 7 Private Consultations Left",
  5: "Limited Weekly Consultation Slots · 5 Remaining",
  3: "Only 3 Strategy Sessions Remaining",
};

export function ScarcityProvider({ children }: { children: ReactNode }) {
  const [spots, setSpots] = useState<SpotsCount>(7);

  const dropTo = useCallback((next: SpotsCount) => {
    setSpots((prev) => (next < prev ? next : prev));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => dropTo(5), 38000);
    return () => window.clearTimeout(timer);
  }, [dropTo]);

  useEffect(() => {
    const onScroll = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      if (window.scrollY / max >= 0.5) dropTo(3);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [dropTo]);

  const goToCta = useCallback(() => {
    dropTo(3);
    window.location.href = "/book";
  }, [dropTo]);

  const value: ScarcityContextValue = {
    spots,
    scarcityLine: SCARCITY_LINES[spots],
    scarcityShort: `Only ${spots} sessions left`,
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
