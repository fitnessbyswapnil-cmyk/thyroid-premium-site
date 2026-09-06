import type { Metadata } from "next";
import DecodeQuiz from "../DecodeQuiz";

/**
 * /decode/quiz — the quiz on a page of its own.
 *
 * Once she has tapped "get my score" she has decided to start; from that point
 * every other thing on /decode is a distraction, and on a phone it was a
 * distraction she could scroll into mid-quiz. This page has the brand line, the
 * quiz, and — after the score — the checkout. Nothing else. No sticky bar (the
 * only action is already on screen), no proof sections, no footer CTA.
 *
 * Ad traffic goes to /decode; this is only ever reached from a CTA there, so it
 * is noindex like the other funnel steps.
 */
export const metadata: Metadata = {
  title: "Your thyroid score | Swapnil Umbarkar",
  robots: { index: false, follow: false },
};

export default function DecodeQuizPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-page)]">
      <header className="mx-auto flex w-full max-w-[900px] items-center justify-between px-4 pt-5 md:px-6">
        <a href="/decode" className="text-[13px] font-semibold text-[var(--t3)]" aria-label="Back to the page">
          &larr; Back
        </a>
        <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--gold-ink)]">
          Swapnil Umbarkar
        </span>
      </header>
      <DecodeQuiz autostart />
    </main>
  );
}
