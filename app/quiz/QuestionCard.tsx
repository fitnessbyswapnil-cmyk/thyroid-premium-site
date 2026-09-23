"use client";

import type { Question } from "./quizData";
import { QuizIcon, CheckIcon } from "./QuizIcons";

/**
 * One question screen. Single-select calls onPick (parent auto-advances ~300ms
 * later). Multi-select toggles and shows a Continue button.
 */
export function QuestionCard({
  question,
  selected,
  onPick,
  onContinue,
}: {
  question: Question;
  selected: string[];
  onPick: (label: string) => void;
  onContinue: () => void;
}) {
  const isMulti = question.type === "multi";
  const canContinue = selected.length > 0;

  return (
    <div>
      <h2 className="quiz-display text-balance text-[1.55rem] leading-[1.15] text-[var(--ivory)] sm:text-[1.85rem]">
        {question.question}
      </h2>
      {question.sub && (
        <p className="mt-2 text-[0.82rem] leading-relaxed text-white/45">
          {question.sub}
        </p>
      )}

      <div
        role={isMulti ? "group" : "radiogroup"}
        aria-label={question.question}
        className="mt-6 space-y-2.5"
      >
        {question.options.map((opt) => {
          const isSel = selected.includes(opt.label);
          return (
            <button
              key={opt.label}
              type="button"
              role={isMulti ? "checkbox" : "radio"}
              aria-checked={isSel}
              onClick={() => onPick(opt.label)}
              className={`group flex min-h-[56px] w-full items-center gap-3.5 rounded-2xl border px-4 py-3 text-left transition-all duration-200 active:scale-[0.985] ${
                isSel
                  ? "quiz-option-selected"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                  isSel
                    ? "border-[var(--gold)]/60 text-[var(--gold-soft)]"
                    : "border-white/10 text-white/40"
                }`}
                style={isSel ? { background: "rgba(201,162,75,0.12)" } : undefined}
              >
                <QuizIcon name={opt.icon} size={18} />
              </span>

              <span
                className={`flex-1 text-[0.92rem] font-medium leading-snug ${
                  isSel ? "text-white" : "text-white/70"
                }`}
              >
                {opt.label}
              </span>

              {/* selection indicator */}
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center transition-all duration-200 ${
                  isMulti ? "rounded-md" : "rounded-full"
                } border ${
                  isSel
                    ? "border-[var(--gold)] text-[var(--onyx)]"
                    : "border-white/20"
                }`}
                style={isSel ? { background: "var(--gold)" } : undefined}
              >
                {isSel && <CheckIcon size={12} />}
              </span>
            </button>
          );
        })}
      </div>

      {isMulti && (
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full py-4 text-[0.95rem] font-bold tracking-[-0.01em] transition-all duration-300 ${
            canContinue
              ? "quiz-cta active:scale-[0.99]"
              : "cursor-not-allowed bg-white/5 text-white/25"
          }`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          Continue
        </button>
      )}
    </div>
  );
}
