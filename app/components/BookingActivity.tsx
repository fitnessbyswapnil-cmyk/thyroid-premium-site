"use client";

import { useEffect, useState } from "react";

/**
 * Real booking activity, or nothing at all.
 *
 * This is the honest replacement for a rotating "Pooja from Ludhiana just
 * booked" ticker. It shows a true count of consultations booked in the last
 * seven days, and it renders NOTHING until that count is high enough to
 * actually help — so a quiet week is silent rather than embarrassing.
 *
 * No names, no cities, no individual is identified. "Booked a thyroid fat loss
 * call" attached to a named woman is a disclosure about her health, and that is
 * not ours to publish however real it is.
 */
const THRESHOLD = 3;

export default function BookingActivity({ className = "" }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/booking-activity")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d: { count?: number }) => {
        if (!cancelled && typeof d?.count === "number") setCount(d.count);
      })
      .catch(() => { /* silent — the component simply stays hidden */ });
    return () => { cancelled = true; };
  }, []);

  if (count < THRESHOLD) return null;

  return (
    <p
      className={`text-center text-[length:var(--text-2xs)] font-medium leading-[1.5] text-[var(--t4)] ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="mr-1.5 inline-block h-[6px] w-[6px] rounded-full align-middle"
        style={{ background: "var(--good, #1d6f42)" }}
      />
      {count} women booked this call in the last 7 days
    </p>
  );
}
