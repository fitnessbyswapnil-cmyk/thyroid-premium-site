"use client";

/**
 * The /decode qualifier. One question per screen, nine taps, no typing.
 *
 * WHY IT EXISTS AT ALL: nobody pays Rs 299 to decode something they do not yet
 * believe is broken. The quiz is what makes the gap specific enough to be worth
 * closing — the result screen names her own pattern back to her, and THAT is
 * what the price attaches to. A quiz in front of a FREE call is pure friction
 * (his "New_Stage1 Quiz Metros" campaign spent Rs 5,909 for zero bookings); in
 * front of a paid one it is the argument.
 *
 * THE REPORT QUESTION IS A ROUTER, NOT A FILTER. A woman with no blood test is
 * not a worse lead — often the opposite, since nothing has been ruled out yet.
 * But this session reads a report, so selling it to her would be selling
 * something that cannot be delivered. So she is handed to the FREE consultation
 * instead, with a reason she can act on. Nobody is turned away, and the free
 * funnel (~Rs 1,000 a booking) keeps the traffic that would otherwise bounce.
 *
 * THE MONEY QUESTION IS DELIBERATELY ABSENT. The old form asked "how much can
 * you invest", and women answered Rs 15,000 against a Rs 25,000 programme —
 * anchoring themselves low before any value existed. On a Rs 299 offer it is
 * also simply incongruous. What replaced it is the decision-maker question,
 * which is the thing that actually killed the last three recorded calls.
 *
 * Answers ride into the Leads sheet through ScheduleClient's existing
 * /api/quiz-lead post, so the dashboard, the cron and the WhatsApp sequences
 * read the same headers they always have.
 */

import { useCallback, useEffect, useState } from "react";
import { pushDL } from "@/app/lib/analytics";
import ScheduleClient from "@/app/schedule/ScheduleClient";

type Q = { id: string; q: string; options: string[] };

const QUESTIONS: Q[] = [
  { id: "age", q: "How old are you?", options: ["Under 30", "30 to 40", "41 to 50", "Over 50"] },
  {
    id: "diagnosis",
    q: "Has a doctor told you that you have a thyroid problem?",
    options: [
      "Yes, and I take medicine every day",
      "Yes, but I do not take medicine",
      "I have not tested, but I think so",
      "No",
    ],
  },
  {
    id: "report",
    q: "Do you have a blood test report?",
    options: ["Yes, from the last 6 months", "Yes, but it is older", "No, I have not done one"],
  },
  {
    id: "goal",
    q: "How much weight do you want to lose?",
    options: ["Under 5 kg", "5 to 10 kg", "10 to 15 kg", "More than 15 kg"],
  },
  {
    id: "stuck",
    q: "How long has your weight been stuck?",
    options: ["Less than 6 months", "6 months to 1 year", "1 to 3 years", "More than 3 years"],
  },
  {
    id: "pattern",
    q: "What happens when you try to lose weight?",
    options: [
      "A little comes off, then it stops",
      "Nothing moves at all",
      "It comes off, then comes back",
      "I lose motivation on my own",
    ],
  },
  {
    id: "tried",
    q: "Have you paid for a diet plan or a coach before?",
    options: ["No, never", "Yes, under ₹10,000", "Yes, ₹10,000 to ₹25,000", "Yes, more than ₹25,000"],
  },
  {
    id: "decision",
    q: "If you decide to start, who decides about the money?",
    options: ["I decide on my own", "My husband and I decide together", "Someone else decides"],
  },
  {
    id: "timing",
    q: "When do you want to start?",
    options: ["Right away", "In a few weeks", "I am just looking for now"],
  },
];

type A = Record<string, string>;

/** Her own answers, said back to her. Only lines that are actually true. */
function readback(a: A): string[] {
  const out: string[] = [];
  if (a.stuck === "More than 3 years" || a.stuck === "1 to 3 years")
    out.push(`Your weight has not moved in ${a.stuck === "More than 3 years" ? "over 3 years" : "1 to 3 years"}.`);
  if (a.diagnosis?.startsWith("Yes, and I take"))
    out.push("You take thyroid medicine every day, and the weight still will not move.");
  else if (a.diagnosis === "Yes, but I do not take medicine")
    out.push("You have a thyroid diagnosis and you are not on medicine for it.");
  else if (a.diagnosis?.startsWith("I have not tested"))
    out.push("You have never been tested, so nothing has been ruled out yet.");
  if (a.pattern === "A little comes off, then it stops")
    out.push("A little comes off, then it stops. That is the pattern in the chart above.");
  if (a.pattern === "Nothing moves at all") out.push("Nothing moves at all, even when you eat less.");
  if (a.pattern === "It comes off, then comes back") out.push("It comes off, then it comes straight back.");
  if (a.tried?.startsWith("Yes")) out.push("You have already paid for help once. So this is not about effort.");
  return out;
}

export default function DecodeQuiz() {
  const [i, setI] = useState(-1); // -1 = intro
  const [a, setA] = useState<A>({});

  const pick = useCallback(
    (q: Q, value: string) => {
      const next = { ...a, [q.id]: value };
      setA(next);
      pushDL({ event: "decode_quiz_answer", quiz_step: String(i + 1), quiz_question: q.id });
      setI((n) => n + 1);
    },
    [a, i],
  );

  const done = i >= QUESTIONS.length;
  useEffect(() => {
    if (done) window.dispatchEvent(new Event("decode-quiz-done"));
  }, [done]);
  const hasReport = a.report?.startsWith("Yes");
  const lines = done ? readback(a) : [];

  // ── intro ────────────────────────────────────────────────────────────────
  if (i === -1) {
    return (
      <Shell>
        <p className="section-label">Start here</p>
        <h2 className="section-title mx-auto text-balance">
          Nine questions. About forty seconds.
        </h2>
        <p className="mx-auto mt-3 max-w-[540px] text-[15.5px] leading-[1.6] text-[var(--t2)]">
          No typing. Just tap. At the end I will tell you what your answers point
          to, and what to do next.
        </p>
        <button
          type="button"
          onClick={() => {
            pushDL({ event: "decode_quiz_start" });
            setI(0);
          }}
          className="cta-button mx-auto mt-7"
          style={{ maxWidth: "24rem" }}
        >
          Start the questions
          <span className="cta-sub">Free. Nothing to fill in.</span>
        </button>
      </Shell>
    );
  }

  // ── result ───────────────────────────────────────────────────────────────
  if (done) {
    return (
      <Shell>
        <p className="section-label">Your answers</p>
        <h2 className="section-title mx-auto text-balance">
          {hasReport ? "This is what you told me" : "First, let’s get your numbers"}
        </h2>

        {lines.length > 0 && (
          <ul className="mx-auto mt-5 flex max-w-[560px] list-none flex-col gap-2.5 p-0 text-left">
            {lines.map((l) => (
              <li
                key={l}
                className="rounded-xl bg-white px-4 py-3 text-[15px] leading-[1.55] text-[var(--t1)]"
                style={{ borderLeft: "4px solid var(--p500)", boxShadow: "var(--shadow-card)" }}
              >
                {l}
              </li>
            ))}
          </ul>
        )}

        {hasReport ? (
          <>
            <p className="mx-auto mt-6 max-w-[580px] text-[16px] leading-[1.62] text-[var(--t2)]">
              You have a blood report. That report can show <strong>which</strong> of
              these already happened to you, and <strong>when</strong>. That is the
              whole job of this session.
            </p>
            <div className="mt-8 text-left">
              <ScheduleClient
                wrapper="div"
                eyebrow="Last step"
                heading="Book your report reading"
                subheading="45 minutes with Swapnil, one to one. Your own blood report, read line by line."
                ctaLabel={"Read my report — ₹299"}
                rationaleTitle="Why ₹299 and not free"
                rationaleBody="So the slot is kept by someone who will come, and so I read your report before the call instead of seeing it for the first time in front of you. If you join the programme later, this ₹299 is taken off the fee."
                extraAnswers={{
                  age: a.age ?? "",
                  diagnosis: a.diagnosis ?? "",
                  struggleDuration: a.stuck ?? "",
                  goal: a.goal ?? "",
                  biggestChallenge: a.pattern ?? "",
                  triedBefore: a.tried ?? "",
                  amountSpent: a.tried?.startsWith("Yes") ? a.tried.replace("Yes, ", "") : "",
                  timing: a.timing ?? "",
                  decisionMaker: a.decision ?? "",
                  symptoms: `Report: ${a.report ?? ""}`,
                }}
              />
            </div>
          </>
        ) : (
          <>
            {/* Honest, and commercially better than taking her money: there is
                nothing to decode, so she goes to the free call instead. */}
            <p className="mx-auto mt-6 max-w-[580px] text-[16px] leading-[1.62] text-[var(--t2)]">
              This session reads your blood report &mdash; and you do not have one
              yet. So paying ₹299 for it would be paying me to read a blank page.
              I am not going to take that.
            </p>
            <p className="mx-auto mt-4 max-w-[580px] text-[16px] leading-[1.62] text-[var(--t2)]">
              Do this instead. Book a <strong>free</strong>{" "}call. I will tell you
              exactly which tests to get and why &mdash; the ones most labs leave
              out. Get them done, and then we read them together.
            </p>
            <a
              href="/book-session"
              className="cta-button mx-auto mt-7"
              style={{ maxWidth: "24rem", textDecoration: "none" }}
              onClick={() => pushDL({ event: "decode_quiz_routed_free" })}
            >
              Book my free call
              <span className="cta-sub">No payment. I tell you what to test.</span>
            </a>
          </>
        )}
      </Shell>
    );
  }

  // ── one question ─────────────────────────────────────────────────────────
  const q = QUESTIONS[i];
  return (
    <Shell>
      <div className="mx-auto mb-6 w-full max-w-[560px]">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--t3)]">
            Question {i + 1} of {QUESTIONS.length}
          </span>
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI((n) => n - 1)}
              className="text-[13px] text-[var(--t3)] underline"
            >
              Back
            </button>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--border-hairline)" }}>
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${((i + 1) / QUESTIONS.length) * 100}%`, background: "var(--p500)" }}
          />
        </div>
      </div>

      <h2 className="section-title mx-auto max-w-[600px] text-balance">{q.q}</h2>

      <div className="mx-auto mt-7 flex w-full max-w-[560px] flex-col gap-3">
        {q.options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => pick(q, o)}
            className="w-full rounded-2xl bg-white px-5 py-4 text-left text-[16px] font-medium leading-[1.4] text-[var(--t1)] transition-colors"
            style={{ border: "1.5px solid var(--border-strong)" }}
          >
            {o}
          </button>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section id="quiz" className="bg-[var(--bg-page)]" style={{ scrollMarginTop: 12 }}>
      <div className="mx-auto w-full max-w-[900px] px-4 py-11 text-center md:px-6 md:py-14">
        {children}
      </div>
    </section>
  );
}
