"use client";

import { useScarcity } from "../context/ScarcityProvider";

type ScarcityBadgeProps = {
  className?: string;
};

export default function ScarcityBadge({ className = "" }: ScarcityBadgeProps) {
  const { scarcityLine } = useScarcity();

  return (
    <div
      className={`badge-pill ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="badge-dot shrink-0" aria-hidden="true" />
      <span className="leading-snug">{scarcityLine}</span>
    </div>
  );
}
