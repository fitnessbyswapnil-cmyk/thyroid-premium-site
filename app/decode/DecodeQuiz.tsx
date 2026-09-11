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
import { pushDL, trackLead } from "@/app/lib/analytics";
import { persistUserIdentity } from "@/app/components/tracking/UserIdentityTracker";
import { getUtmParams, getFbclid, getVisitorId, getFbc, getFbp } from "@/lib/tracking";
import InAppBrowserNotice from "@/app/components/InAppBrowserNotice";
import { useTurnstile, TurnstileBox, postWithBotCheck, leadCounted, loadTurnstile } from "@/app/components/TurnstileWidget";
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

/** `autostart`: begin at question 1. Used by /decode/quiz, where the CTA she
 *  just tapped WAS the intro — a second "start" screen would be a second ask. */
export default function DecodeQuiz({ autostart = false }: { autostart?: boolean } = {}) {
  const [i, setI] = useState(autostart ? 0 : -1);
  // The gate: name + WhatsApp number after the last question and BEFORE the
  // score. Every completer becomes a lead the WhatsApp sequence can reach and a
  // Lead event Meta can learn from; before this, a woman who saw her score and
  // left was invisible.
  const [gate, setGate] = useState<{ name: string; phone: string }>({ name: "", phone: "" });
  const [gateErr, setGateErr] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [resumeScore, setResumeScore] = useState<number | null>(null);
  const [resumeInit, setResumeInit] = useState<{ name?: string; phone?: string; email?: string } | undefined>(undefined);
  // What the resume link needs to know before it offers to sell her anything
  // again: she may have already paid, and may already hold a slot.
  const [already, setAlready] = useState<{ paid: boolean; booked: boolean; sessionDate: string } | null>(null);

  // Resume link from WhatsApp: /decode/quiz?leadId=<id>&s=<score> reopens the
  // checkout prefilled with the score shown — nothing asked twice.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const id = q.get("leadId") || q.get("lead") || "";
      if (!id) return;
      const sc = Number(q.get("s"));
      setLeadId(id);
      if (Number.isFinite(sc) && sc >= 0 && sc <= 100) setResumeScore(sc);
      fetch(`/api/leads/${encodeURIComponent(id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { name?: string; phone?: string; email?: string } | null) => { if (d) setResumeInit({ name: d.name, phone: d.phone, email: d.email }); })
        .catch(() => {});
      // Paid and booked already? Then the checkout must not be shown again.
      // Failure is silent on purpose: an unknown state falls through to the
      // normal checkout rather than telling her something wrong.
      fetch(`/api/lead-status?leadId=${encodeURIComponent(id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { paid?: boolean; booked?: boolean; sessionDate?: string } | null) => {
          if (d && (d.paid || d.booked)) {
            setAlready({ paid: !!d.paid, booked: !!d.booked, sessionDate: d.sessionDate ?? "" });
          }
        })
        .catch(() => {});
      setA((prev) => ({ ...prev, report: "Yes, from the last 6 months" }));
      setI(QUESTIONS.length + 1);
    } catch { /* no window */ }
  }, []);
  useEffect(() => {
    if (autostart) pushDL({ event: "decode_quiz_start" });
  }, [autostart]);
  // Bot check on the gate. Inert unless NEXT_PUBLIC_TURNSTILE_SITE_KEY was set
  // at build time. The script starts loading with the quiz so the invisible
  // check has finished long before she reaches the gate; the widget itself
  // mounts only on the gate screen.
  const bot = useTurnstile("decode_gate");
  useEffect(() => { void loadTurnstile(); }, []);
  const [a, setA] = useState<A>({});

  const pick = useCallback(
    (q: Q, value: string) => {
      setA((prev) => ({ ...prev, [q.id]: value }));
      pushDL({ event: "decode_quiz_answer", quiz_step: String(i + 1), quiz_question: q.id });
      setI((n) => n + 1);
    },
    [i],
  );

  const atGate = i === QUESTIONS.length; // answered everything, number not yet given
  const done = i > QUESTIONS.length;      // gate passed, or resumed
  useEffect(() => {
    if (done) window.dispatchEvent(new Event("decode-quiz-done"));
  }, [done]);

  const hasReport = a.report?.startsWith("Yes");
  const ms = done ? markers(a) : [];
  const hits = ms.filter((m) => m.hit).length;
  // Out of 100, as asked. Seven equally-weighted markers; the list under the
  // number shows exactly which taps produced it, so it never reads as a
  // black box.
  const score100 = resumeScore ?? Math.round((hits / 7) * 100);
  const lead = done ? scoreLead(toLeadAnswers(a)) : null;

  const submitGate = useCallback(async () => {
    if (gateBusy) return;
    const digits = gate.phone.replace(/\D/g, "");
    const phone10 = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
    if (!gate.name.trim()) { setGateErr("Please enter your name"); return; }
    if (phone10.length !== 10) { setGateErr("Enter a 10-digit WhatsApp number"); return; }
    setGateErr(""); setGateBusy(true);
    const id = `dq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const firstName = gate.name.trim().split(/\s+/)[0] || "";
    const msNow = markers(a); const hitsNow = msNow.filter((m) => m.hit).length;
    const scoreNow = Math.round((hitsNow / 7) * 100);
    const leadNow = scoreLead(toLeadAnswers(a));
    persistUserIdentity({ first_name: firstName, phone: phone10 });
    // Bot check off: Lead fires here, exactly as it always has. Bot check on:
    // Lead waits for the server's verdict below, because a submission the
    // server could not verify must not reach Meta as a Lead.
    const leadUser = { first_name: firstName, phone: phone10, email: "" };
    if (!bot.enabled) trackLead(leadUser);
    pushDL({ event: "decode_gate_submitted" });
    // The real _fbc / _fbp cookies, not just fbclid. QuizComplete scored 4.8
    // on Event Match Quality against Lead's 9.3 because it was reaching Meta
    // with four keys instead of nine — no click id, no browser id, no IP, no
    // user agent. Those last two the server adds; these two only exist here.
    const utms = getUtmParams(); const fbclid = getFbclid(); const visitorId = getVisitorId();
    const fbcCookie = getFbc(); const fbpCookie = getFbp();
    let counted = true;
    try {
      // With the bot check off this is the same single fetch, byte for byte.
      const res = await postWithBotCheck(bot, "/api/quiz-lead", {
        leadId: id, name: gate.name.trim(), phone: phone10, email: "",
        city: a.city ?? "", age: a.age ?? "", diagnosis: a.diagnosis ?? "", onMedication: a.diagnosis ?? "",
        struggleDuration: a.stuck ?? "", biggestChallenge: a.pattern ?? "", triedBefore: a.tried ?? "",
        amountSpent: a.tried && a.tried !== "No, never" ? a.tried.replace("Yes, ", "") : "",
        goal: a.goal ?? "", budget: a.budget ?? "", timing: a.timing ?? "", decisionMaker: a.decision ?? "",
        symptoms: `Report: ${a.report ?? "—"} | Work: ${a.profession ?? "—"} | Pattern score: ${scoreNow}/100 (${hitsNow}/7)`,
        leadScore: leadNow.score, leadTier: leadNow.tier,
        patternScore: scoreNow, markersHit: hitsNow, decidesAlone: a.decision === "Yes, I decide on my own",
        source: "decode_quiz",
        attribution: { ...utms, ...(fbclid && { fbclid }), ...(visitorId && { visitor_id: visitorId }), ...(fbcCookie && { fbc: fbcCookie }), ...(fbpCookie && { fbp: fbpCookie }) },
      });
      if (bot.enabled) counted = await leadCounted(res);
    } catch { /* score is shown regardless; the row write is best-effort */ }
    if (bot.enabled && counted) trackLead(leadUser);
    setLeadId(id); setGateBusy(false); setI((n) => n + 1);
  }, [a, gate, gateBusy, bot]);

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

  if (atGate) {
    return (
      <Shell>
        <p className="section-label">Last step before your score</p>
        <h2 className="section-title mx-auto text-balance">Where should I send it?</h2>
        <p className="mx-auto mt-3 max-w-[520px] text-[15.5px] leading-[1.6] text-[var(--t2)]">
          Your score shows here now, and I WhatsApp it to you so you keep it &mdash; with the one thing to do next.
        </p>
        <div className="mx-auto mt-6 w-full max-w-[420px] text-left">
          <label className="block text-[13px] font-semibold text-[var(--t1)]" htmlFor="gate-name">Your name</label>
          <input id="gate-name" value={gate.name} onChange={(e) => setGate((g) => ({ ...g, name: e.target.value }))} placeholder="First name" autoComplete="given-name"
            className="mt-1 w-full rounded-lg bg-white px-4 py-3 text-[16px] text-[var(--t1)]" style={{ border: "1.5px solid var(--border-strong)" }} />
          <label className="mt-4 block text-[13px] font-semibold text-[var(--t1)]" htmlFor="gate-phone">WhatsApp number</label>
          <div className="mt-1 flex">
            <span aria-hidden="true" className="flex items-center rounded-l-lg bg-white px-3 text-[15px] text-[var(--t2)]" style={{ border: "1.5px solid var(--border-strong)", borderRight: 0 }}>+91</span>
            <input id="gate-phone" value={gate.phone} onChange={(e) => setGate((g) => ({ ...g, phone: e.target.value }))} placeholder="10-digit mobile" inputMode="numeric" autoComplete="tel"
              className="w-full rounded-r-lg bg-white px-4 py-3 text-[16px] text-[var(--t1)]" style={{ border: "1.5px solid var(--border-strong)" }} />
          </div>
          {gateErr && <p className="mt-2 text-[13px]" style={{ color: "var(--red-cta)" }}>{gateErr}</p>}
          <TurnstileBox bot={bot} hint="One quick check. Tap the box to see your score." hintColor="var(--t2)" />
          <button type="button" onClick={submitGate} disabled={gateBusy} className="cta-button mt-5 w-full" style={{ opacity: gateBusy ? 0.7 : 1 }}>
            {gateBusy ? "One moment…" : "Show my score"}
            <span className="cta-sub">I&rsquo;ll WhatsApp your score. No spam &mdash; reply stop any time.</span>
          </button>
        </div>
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
          {resumeScore == null && (<ul className="mt-5 flex list-none flex-col gap-2 p-0 text-left">
            {ms.map((m) => (
              <li key={m.label} className="flex items-start gap-3 text-[15px] leading-[1.45]" style={{ color: m.hit ? "#fff" : "#6b7280" }}>
                <span aria-hidden="true" className="mt-[3px] inline-block h-4 w-4 flex-none rounded-full" style={{ background: m.hit ? "#00ff66" : "transparent", border: m.hit ? "0" : "1.5px solid #4b5563" }} />
                {m.label}
              </li>
            ))}
          </ul>)}
        </div>

        {already ? (
          <div className="mx-auto mt-8 max-w-[560px] rounded-2xl p-6 text-left"
               style={{ background: "var(--p-subtle)", border: "1.5px solid var(--p-border)" }}>
            <p className="text-[19px] font-bold text-[var(--t1)]">
              {already.booked
                ? "You are already booked."
                : "Your payment is already received."}
            </p>
            {already.booked ? (
              <>
                <p className="mt-2 text-[15px] leading-[1.6] text-[var(--t2)]">
                  Your 1-1 Thyroid Consultation is confirmed &mdash; 60 minutes, one to one with Swapnil.
                  {already.sessionDate ? <> Your slot: <strong>{already.sessionDate}</strong>.</> : null}
                </p>
                <p className="mt-3 text-[15px] leading-[1.6] text-[var(--t2)]">
                  Nothing more to pay and nothing more to book. Before we speak, send your latest
                  thyroid report (TSH, T3, T4) on WhatsApp &mdash; I read every report before the call.
                </p>
                <a href="https://cal.com/swapnilumbarkarfitness/60min"
                   className="mt-5 inline-block text-[14px] font-bold underline"
                   style={{ color: "var(--p500)" }}>
                  Change or cancel your slot
                </a>
              </>
            ) : (
              <>
                <p className="mt-2 text-[15px] leading-[1.6] text-[var(--t2)]">
                  We have your ₹299. The only step left is choosing your time &mdash; do not pay again.
                </p>
                <a href="https://cal.com/swapnilumbarkarfitness/60min"
                   className="cta-button mt-5"
                   style={{ maxWidth: "22rem", textDecoration: "none" }}>
                  Pick my call time
                </a>
              </>
            )}
          </div>
        ) : hasReport ? (
          <>
            <p className="mx-auto mt-6 max-w-[580px] text-[16px] leading-[1.62] text-[var(--t2)]">
              {score100 >= 57
                ? <>Most women who score this high have the answer sitting in a report that was read as &ldquo;normal&rdquo;. In 60 minutes I read yours line by line and tell you <strong>which</strong> of these markers already happened, and <strong>when</strong>.</>
                : <>Your report will show which of these are real and which are not. That is the whole job of the session &mdash; and if the answer is that you do not need me, you will hear that too.</>}
            </p>
            <div className="mt-8 text-left">
              <InAppBrowserNotice />
              <ScheduleClient
                wrapper="div"
                eyebrow={`Your score: ${score100} / 100`}
                heading="Schedule your 1-1 Thyroid Consultation"
                subheading="The Premium Thyroid Fat Loss Session — 60 minutes, one to one with Swapnil. Your own blood report read line by line, and the exact reason your weight is not moving. Pay, then pick your slot."
                ctaLabel={"Pay ₹299 & pick my slot"}
                rationaleTitle="Why ₹299 and not free"
                rationaleBody="So the slot is kept by someone who will come, and so I read your report before the call instead of seeing it for the first time in front of you. If you join the programme later, this ₹299 is taken off the fee."
                presetThyroid={a.diagnosis || "Yes, hypothyroid and on medication"}
                existingLeadId={leadId || undefined}
                initial={resumeInit ?? { name: gate.name, phone: gate.phone }}
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
              You do not have a blood report yet &mdash; that is fine. In the session I tell you <strong>exactly which tests to get</strong> and why (the ones most labs leave out), and we work from your answers above until the results are in.
            </p>
            <div className="mt-8 text-left">
              <ScheduleClient
                wrapper="div"
                eyebrow={`Your score: ${score100} / 100`}
                heading="Schedule your 1-1 Thyroid Consultation"
                subheading="The Premium Thyroid Fat Loss Session — 60 minutes, one to one with Swapnil. Which tests to get, what your answers already point to, and the plan to start on. Pay, then pick your slot."
                ctaLabel={"Pay ₹299 & pick my slot"}
                rationaleTitle="Why ₹299 and not free"
                rationaleBody="So the slot is kept by someone who will come, and so I prepare from your answers before the call. If you join the programme later, this ₹299 is taken off the fee."
                presetThyroid={a.diagnosis || "Yes, hypothyroid and on medication"}
                existingLeadId={leadId || undefined}
                initial={resumeInit ?? { name: gate.name, phone: gate.phone }}
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
