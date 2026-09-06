"use client";

/**
 * The /decode qualifier — the owner's eleven Cal.com booking questions, asked
 * one per screen with a tap for every answer, plus the blood-report question
 * that ROUTES rather than filters. Twelve taps, no typing.
 *
 * Two scores come out of the same answers and go to different people:
 *
 *  - The PATTERN score is hers. "6 of 7 markers of a stalled metabolism" is
 *    true from what she just tapped, is defensible from a coach (it is not a
 *    diagnosis and does not sound like one), and is what the Rs 299 attaches
 *    to: the session reads her report to find which markers already happened.
 *  - The LEAD score is his. lib/lead-scoring's scoreLead() has fed the CRM for
 *    months and expects its own option labels, so the answers are mapped into
 *    those labels before scoring and the result rides to the sheet as
 *    leadScore / leadTier through the existing /api/quiz-lead post.
 *
 * Free-text Cal questions ("in your own words", city, profession) are tap
 * lists here on purpose — typing on a phone at question nine is where quizzes
 * die. The four "what happens" options are the four patterns that appear in
 * the recorded calls, and the first is a booking-form answer verbatim.
 *
 * Pay-then-book, not book-then-pay: ScheduleClient captures the lead, takes the
 * Rs 299, and only then opens the calendar. A free slot that is paid for later
 * fires Schedule before any money moves, fills the calendar with people who
 * never pay, and defeats the only reason the fee exists.
 */

import { useCallback, useEffect, useState } from "react";
import { pushDL } from "@/app/lib/analytics";
import { scoreLead } from "@/lib/lead-scoring";
import ScheduleClient from "@/app/schedule/ScheduleClient";

type Q = { id: string; q: string; options: string[] };

const QUESTIONS: Q[] = [
  { id: "age", q: "What is your age?", options: ["Under 30", "30 to 35", "36 to 40", "41 to 50", "Over 50"] },
  {
    id: "diagnosis",
    q: "Has a doctor told you that you have a thyroid problem?",
    options: [
      "Yes, hypothyroid and on medication",
      "Yes, hypothyroid but not on medication",
      "Not tested, but I think so",
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
    options: ["Under 5 kg", "5 to 10 kg", "10 to 15 kg", "15 to 20 kg", "More than 20 kg"],
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
      "I eat less, and the weight still goes up",
      "A little comes off, then it stops",
      "It comes off, then comes straight back",
      "I lose motivation on my own",
    ],
  },
  {
    id: "tried",
    q: "Have you ever paid a coach, dietitian or programme for this?",
    options: ["No, never", "Yes, under ₹10,000", "Yes, ₹10,000 to ₹25,000", "Yes, more than ₹25,000"],
  },
  {
    id: "budget",
    q: "This is a paid programme. How much can you invest to fix this properly?",
    options: ["I can invest ₹50,000", "I can invest ₹30,000", "I can invest ₹15,000", "I'll decide on the call"],
  },
  {
    id: "decision",
    q: "If you decide to go ahead, are you the one who decides about the money?",
    options: ["Yes, I decide on my own", "No, I need to discuss it with my spouse or family"],
  },
  {
    id: "timing",
    q: "If we find your blocker, when would you want to start?",
    options: ["This week", "This month", "In a month or two", "Just exploring for now"],
  },
  {
    id: "city",
    q: "Which city do you live in?",
    options: ["Delhi NCR", "Mumbai", "Bengaluru", "Hyderabad", "Pune", "Chennai", "Kerala", "Somewhere else"],
  },
  {
    id: "profession",
    q: "What do you do?",
    options: [
      "Homemaker",
      "Corporate / IT professional",
      "Business owner / entrepreneur",
      "Doctor / healthcare",
      "Teacher / educator",
      "Something else",
    ],
  },
];

type A = Record<string, string>;

/** Her seven markers. Each is TRUE from a tap she made — nothing inferred. */
function markers(a: A): { label: string; hit: boolean }[] {
  const diagnosed = a.diagnosis?.startsWith("Yes");
  const onMeds = a.diagnosis === "Yes, hypothyroid and on medication";
  const stuckLong = a.stuck === "1 to 3 years" || a.stuck === "More than 3 years";
  const eatLess = a.pattern === "I eat less, and the weight still goes up" || a.pattern === "A little comes off, then it stops";
  const paid = !!a.tried && a.tried !== "No, never";
  const big = a.goal === "10 to 15 kg" || a.goal === "15 to 20 kg" || a.goal === "More than 20 kg";
  const forty = a.age === "41 to 50" || a.age === "Over 50";
  return [
    { label: "A thyroid diagnosis", hit: !!diagnosed },
    { label: "Weight stuck even on the tablet", hit: onMeds },
    { label: "Stuck for more than a year", hit: stuckLong },
    { label: "Eating less did not move it", hit: eatLess },
    { label: "Already paid for help that did not hold", hit: paid },
    { label: "Ten kilos or more to lose", hit: big },
    { label: "In the age band where thyroid and hormones shift together", hit: forty },
  ];
}

/** Map the tap labels onto the labels lib/lead-scoring has always expected. */
function toLeadAnswers(a: A) {
  const diagnosis =
    a.diagnosis?.startsWith("Yes") ? "Yes — hypothyroidism"
    : a.diagnosis === "Not tested, but I think so" ? "Yes — not sure which type" : "No";
  const duration =
    a.stuck === "1 to 3 years" || a.stuck === "More than 3 years" ? "Over a year"
    : a.stuck === "6 months to 1 year" ? "6–12 months" : "Under 6 months";
  const challenge =
    a.pattern === "I eat less, and the weight still goes up" || a.pattern === "A little comes off, then it stops"
      ? "The weight won't move, no matter what I do" : a.pattern ?? "";
  return {
    investment: a.budget ?? "",
    timing: a.timing ?? "",
    diagnosis,
    duration,
    goal: "Lose the stubborn weight",
    challenge,
    tried: a.tried && a.tried !== "No, never" ? ["Paid coach or programme"] : [],
    profession: a.profession ?? "",
  };
}

export default function DecodeQuiz() {
  const [i, setI] = useState(-1);
  const [a, setA] = useState<A>({});

  const pick = useCallback(
    (q: Q, value: string) => {
      setA((prev) => ({ ...prev, [q.id]: value }));
      pushDL({ event: "decode_quiz_answer", quiz_step: String(i + 1), quiz_question: q.id });
      setI((n) => n + 1);
    },
    [i],
  );

  const done = i >= QUESTIONS.length;
  useEffect(() => {
    if (done) window.dispatchEvent(new Event("decode-quiz-done"));
  }, [done]);

  const hasReport = a.report?.startsWith("Yes");
  const ms = done ? markers(a) : [];
  const hits = ms.filter((m) => m.hit).length;
  // Out of 100, as asked. Seven equally-weighted markers; the list under the
  // number shows exactly which taps produced it, so it never reads as a
  // black box.
  const score100 = Math.round((hits / 7) * 100);
  const lead = done ? scoreLead(toLeadAnswers(a)) : null;

  if (i === -1) {
    return (
      <Shell>
        <p className="section-label">Start here</p>
        <h2 className="section-title mx-auto text-balance">Twelve questions. About forty seconds.</h2>
        <p className="mx-auto mt-3 max-w-[540px] text-[15.5px] leading-[1.6] text-[var(--t2)]">
          No typing. Just tap. At the end you get your score, and I tell you what to do next.
        </p>
        <button
          type="button"
          onClick={() => { pushDL({ event: "decode_quiz_start" }); setI(0); }}
          className="cta-button mx-auto mt-7"
          style={{ maxWidth: "24rem" }}
        >
          Get my score
          <span className="cta-sub">Free. Nothing to fill in.</span>
        </button>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <p className="section-label">Your score</p>
        <div
          className="mx-auto mt-2 max-w-[560px] rounded-2xl px-6 py-7"
          style={{ background: "#0b1120", color: "#fff" }}
        >
          <div className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: "#00ff66" }}>
            Markers of a stalled thyroid metabolism
          </div>
          <div className="mt-2 font-bold leading-none" style={{ fontSize: 60 }}>
            {score100}<span className="text-[26px] font-semibold" style={{ color: "#9a9890" }}> / 100</span>
          </div>
          <div className="mt-2 text-[13px]" style={{ color: "#9a9890" }}>
            {hits} of 7 markers present
          </div>
          <ul className="mt-5 flex list-none flex-col gap-2 p-0 text-left">
            {ms.map((m) => (
              <li key={m.label} className="flex items-start gap-3 text-[15px] leading-[1.45]" style={{ color: m.hit ? "#fff" : "#6b7280" }}>
                <span aria-hidden="true" className="mt-[3px] inline-block h-4 w-4 flex-none rounded-full" style={{ background: m.hit ? "#00ff66" : "transparent", border: m.hit ? "0" : "1.5px solid #4b5563" }} />
                {m.label}
              </li>
            ))}
          </ul>
        </div>

        {hasReport ? (
          <>
            <p className="mx-auto mt-6 max-w-[580px] text-[16px] leading-[1.62] text-[var(--t2)]">
              {score100 >= 57
                ? <>Most women who score this high have the answer sitting in a report that was read as &ldquo;normal&rdquo;. In 45 minutes I read yours line by line and tell you <strong>which</strong> of these markers already happened, and <strong>when</strong>.</>
                : <>Your report will show which of these are real and which are not. That is the whole job of the session &mdash; and if the answer is that you do not need me, you will hear that too.</>}
            </p>
            <div className="mt-8 text-left">
              <ScheduleClient
                wrapper="div"
                eyebrow={`Your score: ${score100} / 100`}
                heading="Premium Thyroid Fat Loss Session"
                subheading="45 minutes, one to one with Swapnil. Your own blood report read line by line, and the exact reason your weight is not moving."
                ctaLabel={"Book my Premium Session — ₹299"}
                rationaleTitle="Why ₹299 and not free"
                rationaleBody="So the slot is kept by someone who will come, and so I read your report before the call instead of seeing it for the first time in front of you. If you join the programme later, this ₹299 is taken off the fee."
                presetThyroid={a.diagnosis}
                extraAnswers={{
                  age: a.age ?? "",
                  diagnosis: a.diagnosis ?? "",
                  onMedication: a.diagnosis ?? "",
                  struggleDuration: a.stuck ?? "",
                  goal: a.goal ?? "",
                  biggestChallenge: a.pattern ?? "",
                  triedBefore: a.tried ?? "",
                  amountSpent: a.tried && a.tried !== "No, never" ? a.tried.replace("Yes, ", "") : "",
                  budget: a.budget ?? "",
                  timing: a.timing ?? "",
                  decisionMaker: a.decision ?? "",
                  city: a.city ?? "",
                  // No Profession column in the sheet; it rides with the report answer.
                  symptoms: `Report: ${a.report ?? "—"} | Work: ${a.profession ?? "—"} | Pattern score: ${score100}/100 (${hits}/7)`,
                  leadScore: lead?.score,
                  leadTier: lead?.tier,
                }}
              />
            </div>
          </>
        ) : (
          <>
            <p className="mx-auto mt-6 max-w-[580px] text-[16px] leading-[1.62] text-[var(--t2)]">
              You do not have a blood report yet &mdash; that is fine. In the Premium Session I tell you <strong>exactly which tests to get</strong> and why (the ones most labs leave out), and we work from your answers above until the report is in. Book it below, or take the free call first if you would rather.
            </p>
            <div className="mt-8 text-left">
              <ScheduleClient
                wrapper="div"
                eyebrow={`Your score: ${score100} / 100`}
                heading="Premium Thyroid Fat Loss Session"
                subheading="45 minutes, one to one with Swapnil. Which tests to get, what your answers already point to, and the exact plan to start on."
                ctaLabel={"Book my Premium Session — ₹299"}
                rationaleTitle="Why ₹299 and not free"
                rationaleBody="So the slot is kept by someone who will come, and so I prepare from your answers before the call. If you join the programme later, this ₹299 is taken off the fee."
                presetThyroid={a.diagnosis}
                extraAnswers={{
                  age: a.age ?? "",
                  diagnosis: a.diagnosis ?? "",
                  onMedication: a.diagnosis ?? "",
                  struggleDuration: a.stuck ?? "",
                  goal: a.goal ?? "",
                  biggestChallenge: a.pattern ?? "",
                  triedBefore: a.tried ?? "",
                  amountSpent: a.tried && a.tried !== "No, never" ? a.tried.replace("Yes, ", "") : "",
                  budget: a.budget ?? "",
                  timing: a.timing ?? "",
                  decisionMaker: a.decision ?? "",
                  city: a.city ?? "",
                  symptoms: `Report: ${a.report ?? "—"} | Work: ${a.profession ?? "—"} | Pattern score: ${score100}/100 (${hits}/7)`,
                  leadScore: lead?.score,
                  leadTier: lead?.tier,
                }}
              />
            </div>
            <p className="mx-auto mt-6 max-w-[580px] text-[14.5px] leading-[1.6] text-[var(--t3)]">
              Prefer to get tested first?{" "}
              <a href="/book-session" className="underline text-[var(--t1)]" onClick={() => pushDL({ event: "decode_quiz_routed_free" })}>
                Book a free call
              </a>{" "}
              and I will tell you what to test.
            </p>
          </>
        )}
      </Shell>
    );
  }

  const q = QUESTIONS[i];
  return (
    <Shell>
      <div className="mx-auto mb-6 w-full max-w-[560px]">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--t3)]">
            Question {i + 1} of {QUESTIONS.length}
          </span>
          {i > 0 && (
            <button type="button" onClick={() => setI((n) => n - 1)} className="text-[13px] text-[var(--t3)] underline">
              Back
            </button>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--border-hairline)" }}>
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${((i + 1) / QUESTIONS.length) * 100}%`, background: "var(--p500)" }} />
        </div>
      </div>
      <h2 className="section-title mx-auto max-w-[600px] text-balance">{q.q}</h2>
      <div className="mx-auto mt-7 flex w-full max-w-[560px] flex-col gap-3">
        {q.options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => pick(q, o)}
            className="w-full rounded-lg bg-white px-5 py-4 text-left text-[16px] font-medium leading-[1.4] text-[var(--t1)] transition-colors"
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
      <div className="mx-auto w-full max-w-[900px] px-4 py-11 text-center md:px-6 md:py-14">{children}</div>
    </section>
  );
}
