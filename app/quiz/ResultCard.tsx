"use client";

import type { QuizResult } from "./quizData";
import { ScoreGauge } from "./ScoreGauge";
import { QuizIcon } from "./QuizIcons";

/**
 * Result screen: gold gauge animates to her Blocker Score, band name in
 * Playfair, a personalised paragraph (frustration + top blockers), and the
 * single CTA into the existing ₹299 booking flow.
 */
export function ResultCard({
  result,
  firstName,
  onCta,
  ctaUrl,
}: {
  result: QuizResult;
  firstName: string;
  onCta: () => void;
  ctaUrl: string;
}) {
  return (
    <div className="text-center">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--gold)]/75">
        {firstName ? `${firstName}, here's your result` : "Your result"}
      </p>

      <div className="mt-5 flex justify-center">
        <ScoreGauge value={result.percent} variant="result" size={220} />
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--gold)]/40 text-[var(--gold-soft)]">
          <QuizIcon name={result.band.icon} size={15} />
        </span>
        <h1 className="quiz-display text-[1.7rem] leading-tight text-[var(--ivory)] sm:text-[2rem]">
          {result.band.name}
        </h1>
      </div>

      <p className="mx-auto mt-4 max-w-[44ch] text-[0.92rem] leading-relaxed text-white/65">
        {result.paragraph}
      </p>

      {/* Report confirmation */}
      <div className="mx-auto mt-6 max-w-[34ch] rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3">
        <p className="text-[0.78rem] leading-relaxed text-white/45">
          Your full report is on its way to your{" "}
          <span className="text-white/70">email &amp; WhatsApp.</span>
        </p>
      </div>

      {/* CTA into the existing ₹299 strategy-call flow */}
      <a
        href={ctaUrl}
        onClick={onCta}
        className="quiz-cta mt-6 flex w-full items-center justify-center gap-2 rounded-full py-[1.15rem] text-[1rem] font-bold tracking-[-0.01em] active:scale-[0.99]"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        Book Your ₹299 Thyroid Strategy Call
      </a>
      <p className="mt-3 text-[0.7rem] text-white/35">
        60-minute private session · Full refund guarantee
      </p>
    </div>
  );
}
