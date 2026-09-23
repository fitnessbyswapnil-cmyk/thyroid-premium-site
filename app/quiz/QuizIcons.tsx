/**
 * QuizIcons — small, tasteful line icons used as quiet anchors on each option.
 * Dependency-free (the repo has no icon library), stroke = currentColor so they
 * inherit the gold/ivory tone from their container.
 */
import type { IconKey } from "./quizData";

const COMMON = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PATHS: Record<IconKey, React.ReactNode> = {
  heart: <path d="M19 14c1.5-1.5 3-3.3 3-5.5A4.5 4.5 0 0 0 12 5 4.5 4.5 0 0 0 2 8.5c0 2.2 1.5 4 3 5.5l7 7Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pill: (
    <>
      <path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z" />
      <path d="m7 7 7 7" />
    </>
  ),
  frown: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 15.5c1-1 2.4-1.5 4-1.5s3 .5 4 1.5" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
  utensils: (
    <>
      <path d="M5 3v7a2 2 0 0 0 4 0V3M7 10v11" />
      <path d="M17 3c-1.5 0-3 1.5-3 4.5S15.5 12 17 12v9" />
    </>
  ),
  egg: <path d="M12 21c3.3 0 6-2.5 6-6 0-4-2.7-12-6-12S6 11 6 15c0 3.5 2.7 6 6 6Z" />,
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  dumbbell: (
    <>
      <path d="M6.5 6.5v11M3 9v6M17.5 6.5v11M21 9v6M6.5 12h11" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  brain: (
    <>
      <path d="M9.5 4A2.5 2.5 0 0 0 7 6.5 2.5 2.5 0 0 0 5 11a2.5 2.5 0 0 0 1 4.8A2.5 2.5 0 0 0 9.5 20 2.5 2.5 0 0 0 12 17.5V4.5A.5.5 0 0 0 11.5 4Z" />
      <path d="M14.5 4A2.5 2.5 0 0 1 17 6.5 2.5 2.5 0 0 1 19 11a2.5 2.5 0 0 1-1 4.8A2.5 2.5 0 0 1 14.5 20 2.5 2.5 0 0 1 12 17.5" />
    </>
  ),
  battery: (
    <>
      <rect x="2" y="8" width="16" height="8" rx="2" />
      <path d="M22 11v2" />
      <path d="M6 11v2" />
    </>
  ),
  stomach: <path d="M8 3v4a4 4 0 0 0 4 4h2a4 4 0 0 1 4 4 5 5 0 0 1-10 0c0-2 1-3 1-5" />,
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  rocket: (
    <>
      <path d="M5 13c-1.5 1-2 5-2 5s4-.5 5-2c.5-.8.4-2-.3-2.7-.7-.7-1.9-.8-2.7-.3Z" />
      <path d="M14 7a6 6 0 0 1 6-4c.3 3-1 5-4 6l-5 5-3-3 5-5Z" />
      <path d="M9 12 7.5 10.5M14 7l2.5 2.5" />
    </>
  ),
};

export function QuizIcon({ name, size = 20 }: { name: IconKey; size?: number }) {
  return (
    <svg {...COMMON} width={size} height={size}>
      {PATHS[name]}
    </svg>
  );
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8.5 6.5 12 13 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
