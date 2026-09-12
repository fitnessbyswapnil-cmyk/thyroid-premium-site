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
  title: "Book your consultation · Step 1 of 2 | Swapnil Umbarkar",
  robots: { index: false, follow: false },
};

export default function DecodeQuizPage() {
  return (
    // Same palette as the page she came from. Without theme-decode the brand
    // line, the progress bar and every selected-answer border rendered in the
    // free funnel's electric green, one tap after a red CTA — which is the
    // ad-to-page break the palette exists to close, reopened at the step where
    // she is actually deciding.
    <main className="theme-decode min-h-screen bg-[var(--bg-page)]">
      <header className="mx-auto flex w-full max-w-[900px] items-center justify-between px-4 pt-5 md:px-6">
        <a href="/decode" className="text-[13px] font-semibold text-[var(--t3)]" aria-label="Back to the page">
          &larr; Back
        </a>
        <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--gold-ink)]">
          Swapnil Umbarkar
        </span>
      </header>
      {/* This used to end "— step 1 of 2". The quiz's own progress row now
          says exactly that, one line below, so the page was telling her twice
          in two different type sizes. */}
      <p className="mx-auto mt-6 max-w-[900px] px-4 text-center text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--t3)] md:px-6">
        Scheduling your 1-1 Thyroid Consultation
      </p>
      <DecodeQuiz autostart />
    </main>
  );
}
