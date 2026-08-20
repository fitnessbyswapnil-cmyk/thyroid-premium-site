"use client";

/**
 * /assessment — interactive "Thyroid Score" quiz funnel.
 *
 * Ported from the approved Claude Design v4 prototype: 11 questions with a
 * live score-building engine (segmented ring + 3 sub-bars), section
 * celebrations, comparison interstitials, a processing screen, an unlock
 * (contact-capture) form, and a personalised result screen. Scoring math is
 * ported verbatim from the prototype so the numbers are real, not decorative.
 *
 * MESSAGING CONTRACT (per owner instruction): the score is a teaser, never
 * the end product. Every screen points at ONE outcome — booking the private
 * 1-on-1 Thyroid Consultation Call, where the score gets fully decoded.
 * "Report"/"generate a report" language is deliberately avoided throughout.
 *
 * PRICING: the paid gate is LIVE and EMBEDDED. The score-unlock form (this
 * screen) captures the lead FIRST — sheet, dashboard, email sequence — then
 * the result CTA opens the Cashfree JS SDK checkout as an in-page modal
 * (order created server-side with her quiz details + visitor_id/fbc/fbp as
 * order_tags for Meta attribution). Success → /session-booked (embedded
 * Cal.com). If the order API/SDK can't start, payNow falls back to the
 * hosted form (CONSULTATION_FORM_URL) so the pay button never dies. CTA
 * copy shows SESSION_PRICE; the ACTUAL charge is IS_TEST_MODE-controlled in
 * app/api/create-cashfree-order. No "free / no card" claims anywhere.
 *
 * Lead capture: POSTs to /api/quiz-lead (writes the full answer set to the
 * same Leads sheet the dashboard/WhatsApp sequences read) and mirrors the
 * same browser+server Lead tracking calls QualifyingFlow.tsx uses, so EMQ
 * and dedup behave identically to the rest of the funnel.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONSULTATION_FORM_URL } from "@/app/context/ScarcityProvider";
import { pushDL, trackLead, trackInitiateCheckout } from "@/app/lib/analytics";
import { persistUserIdentity } from "@/app/components/tracking/UserIdentityTracker";
import { getUtmParams, getFbclid, getVisitorId, getFbc, getFbp } from "@/lib/tracking";
import { NATIVE_BOOKING_KEY } from "@/app/book/components/BookingFlow";
import { SESSION_PRICE } from "@/app/lib/pricing";
import { checkoutRedirectTarget } from "@/lib/checkout-target";

// ── palette (matches the site + admin dashboard system) ─────────────────────
const BG = "#ffffff";
const CARD = "#ffffff";
const CARD2 = "#fdf6e4";
const GRID = "#ede7dd";
const INK1 = "#241f1a";
const INK2 = "#423b33";
const MUTED = "#857c6d";
const PURPLE = "#96661a";
const PURPLE_L = "#a37220";
const GOOD = "#047857";
const WARN = "#b45309";

const SCARCITY_LINE = "Only a few sessions open this week";

// ── question bank (verbatim from the approved prototype) ────────────────────
type Q = { id: string; t: string; opts?: string[]; multi?: boolean; scale?: boolean };
const QS: Q[] = [
  { id: "diagnosis",  t: "Have you been diagnosed with a thyroid condition?", opts: ["Yes, hypothyroidism", "Yes, Hashimoto's", "I suspect it, not diagnosed yet", "No"] },
  { id: "medication", t: "Are you on thyroid medication?", opts: ["Yes, and still struggling with weight", "Yes, and it's under control", "Not yet"] },
  { id: "duration",   t: "How long have you been fighting this weight?", opts: ["Under 6 months", "6–12 months", "1–3 years", "More than 3 years"] },
  { id: "symptoms",   t: "Beyond the scale, what else is bothering you?", multi: true, opts: ["Exhausted by afternoon", "Hair fall", "Bloating / puffiness", "Brain fog", "Mood swings", "Feeling cold all the time", "Clothes not fitting"] },
  { id: "tried",      t: "What have you already tried?", multi: true, opts: ["Dieting / calorie cutting", "Gym / personal trainer", "Nutritionists / diet plans", "Only medication", "YouTube / free plans", "Nothing structured yet"] },
  // Budget and decision-maker are deliberately LAST — maximum sunk cost,
  // minimum drop-off. The sub-copy frames budget as preparation ("so I can
  // prepare the right plan"), not screening; "can you afford this" is what
  // gets abandoned.
  //
  // These option labels are NOT free text: they must match SCORING.investment
  // in lib/lead-scoring.ts character for character, because that map is keyed
  // on the label itself. The previous quiz labels ("₹10,000 – ₹20,000" etc.)
  // matched nothing there, so every quiz lead silently scored 0 on the single
  // strongest buying signal in the model.
  { id: "budget",     t: "This is a paid programme. To fix this properly with a plan built for your thyroid, how much can you invest to reach a permanent result?", opts: ["I can invest ₹50,000", "I can invest ₹30,000", "I can invest ₹15,000"] },
  { id: "decisionMaker", t: "If you decide to move forward with our solution, are you the sole financial decision-maker?", opts: ["Yes, I am the sole financial decision-maker", "No, I need to discuss it with my spouse/family"] },
];
const SECTIONS: [number, number, string][] = [[0, 2, "YOUR THYROID"], [3, 6, "YOUR HISTORY"]];
const REACT: Record<string, string[]> = {
  diagnosis: ["Diagnosed. We know what we're working with", "Hashimoto's. Autoimmune needs its own plan", "Suspected. Step one is the right panel", "Good. We'll rule it in or out properly"],
  medication: ["Medicated and stuck. The classic gap", "Controlled. Now we build on it", "Not yet. Plenty of room to move"],
  duration: ["Early. The best time to fix it", "Under a year. Very recoverable", "1–3 years of fighting. That ends here", "Long fight. It was the method, not you"],
  // Budget and decision-maker must never be scored, but she still deserves a
  // human response rather than silence on the two most uncomfortable questions.
  budget: ["Noted. I'll prepare the full plan", "Noted. We'll map what fits", "Noted. We'll start where you are"],
  decisionMaker: ["Good. That keeps this simple", "Understood. I'll give you everything you need to show them"],
};

type Answers = Record<string, number | number[] | null>;
const emptyAnswers = (): Answers => ({ diagnosis: null, medication: null, duration: null, symptoms: [], tried: [], budget: null, decisionMaker: null });

// ── scoring — ported verbatim from the approved prototype ───────────────────
function computeParts(a: Answers) {
  const sym = ((a.symptoms as number[]) || []).length;                    // 0–7
  const tried = ((a.tried as number[]) || []).filter((i) => i !== 5).length; // 0–5, excl. "Nothing structured yet"
  const dur = (a.duration as number) ?? 0;                                // 0–3
  const diagnosed = a.diagnosis === 0 || a.diagnosis === 1;
  const suspected = a.diagnosis === 2;
  const stuck = a.medication === 0;                                       // medicated and still struggling

  // Symptom Load — how much her body is signalling.
  const S = Math.min(100, Math.round(sym * 14 + (diagnosed ? 20 : suspected ? 10 : 0)));
  // Approach Gap — how thoroughly the conventional route has failed her.
  const G = Math.min(100, Math.round(tried * 18 + (stuck ? 35 : 0)));
  // Time Entrenched — how established the pattern is.
  const E = Math.min(100, Math.round(dur * 28 + (dur >= 2 ? 12 : 0)));

  // NOTE: budget and decisionMaker are deliberately absent. Two women with
  // identical symptoms must see identical Thyroid Scores regardless of what
  // they can pay or who signs off on it — anything else is misleading, and
  // indefensible the moment two friends compare results. Both are private
  // sales fields, surfaced only on the dashboard.
  return { S, G, E, sym, tried, dur, diagnosed, stuck };
}
function answeredCount(a: Answers): number {
  return QS.reduce((c, q) => {
    const v = a[q.id];
    return c + ((q.multi ? ((v as number[]) || []).length > 0 : v != null) ? 1 : 0);
  }, 0);
}
function liveTotalOf(a: Answers, ins: number): number {
  const p = computeParts(a);
  return Math.min(96, 4.5 * answeredCount(a) + 2 * ins + 0.17 * p.S + 0.21 * p.G + 0.27 * p.E);
}

// Returns the blockers that are ACTUALLY true in her answers, as full sentences.
// The result screen leads with these and the WhatsApp follow-up reuses the same
// strings, so they must read as prose, never as a count. Never fabricate one.
function blockerLines(a: Answers): string[] {
  const out: string[] = [];
  const sym = ((a.symptoms as number[]) || []).length;
  const tried = ((a.tried as number[]) || []).filter((i) => i !== 5).length;
  const symLabels = ((a.symptoms as number[]) || []).slice(0, 3).map((i) => (QS[3].opts![i] || "").toLowerCase());

  if (a.medication === 0)
    out.push("You're on medication and still stuck. The dose treats your lab report, not your metabolism.");
  if (sym >= 3)
    out.push(`${sym} symptoms beyond the scale point to an under-supported thyroid. You flagged ${symLabels.join(", ")}.`);
  if (tried >= 2)
    out.push(`${tried} approaches already tried. None of them were built for a hypothyroid metabolism.`);
  if (((a.duration as number) ?? 0) >= 2)
    out.push("More than a year of fighting the same weight almost always means the method was wrong, not your body.");
  return out;
}

function computeFrom(a: Answers) {
  const p = computeParts(a);
  const total = Math.max(35, Math.min(96, Math.round(33.5 + 0.17 * p.S + 0.21 * p.G + 0.27 * p.E)));
  let tierLabel: string, tierLine: string;
  if (total >= 75) { tierLabel = "HIGH POTENTIAL"; tierLine = "Recoverable, but not on its own."; }
  else if (total >= 58) { tierLabel = "STRONG POTENTIAL"; tierLine = "Recoverable, but not on its own."; }
  else { tierLabel = "EMERGING POTENTIAL"; tierLine = "Recoverable, but not on its own."; }
  const SYMS = QS[3].opts!, symArr = (a.symptoms as number[]) || [];
  const lc = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
  const rules: [boolean, string][] = [
    [((a.tried as number[]) || []).includes(2) && ((a.tried as number[]) || []).includes(1), "You've tried nutritionists AND a gym. The effort was never the problem. Those plans weren't built for a hypothyroid metabolism."],
    [p.tried >= 3, `You've tried ${p.tried} different approaches. Not one of them was built for a hypothyroid metabolism, which is why the effort never showed up on the scale.`],
    [p.sym >= 4, `${p.sym} symptoms beyond the scale, including ${lc(SYMS[symArr[0]] || "")} and ${lc(SYMS[symArr[1]] || "")}, point to an under-supported thyroid rather than a willpower problem.`],
    [a.duration === 3, "More than 3 years of fighting the same weight almost always means the method was wrong, not your body."],
    [a.medication === 0, "You're on medication and still struggling. The dose treats your lab report, not your metabolism. That gap is exactly what your call covers."],
    [a.diagnosis === 2, "You suspect a thyroid issue but aren't diagnosed yet. Confirming the right panel is step one, and your call covers exactly which tests."],
    [true, "Your answer pattern closely matches the women who respond fastest once the plan finally fits the thyroid."],
  ];
  const insights = rules.filter((r) => r[0]).map((r) => r[1]).slice(0, 3);
  const lines = blockerLines(a);
  return { total, symptomLoad: p.S, approachGap: p.G, entrenched: p.E, tierLabel, tierLine, insights, blockerLines: lines, blockers: lines.length };
}
function reactionFor(qi: number, ans: Answers): string {
  const id = QS[qi].id;
  if (id === "symptoms") { const n = ((ans.symptoms as number[]) || []).length; return n ? `${n} symptom${n > 1 ? "s" : ""}. A pattern, not willpower` : ""; }
  if (id === "tried") { const n = ((ans.tried as number[]) || []).filter((i) => i !== 5).length; return n ? `${n} approach${n > 1 ? "es" : ""} tried. None built for a thyroid` : "Clean slate. We start it right"; }
  const arr = REACT[id]; const v = ans[id] as number;
  return arr && v != null ? arr[v] || "" : "";
}
function insightFig(spendIdx: number | null): number {
  return [27400, 27400, 41200, 74500][spendIdx ?? 0];
}
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

// ── small presentational helpers ─────────────────────────────────────────────

function SegmentedRing({ size, val, answered }: { size: "sm" | "lg"; val: number; answered: boolean[] }) {
  const r = size === "sm" ? 24 : 92;
  const cx = size === "sm" ? "mg1" : "dg1";
  const C = 2 * Math.PI * r;
  const step = C / 11;
  const gapDeg = size === "sm" ? 9 : 7;
  const gap = C * (gapDeg / 360);
  const dash = step - gap;
  const box = r * 2 + 20;
  const center = box / 2;
  return (
    <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} style={{ transform: "rotate(0deg)" }}>
      <defs>
        <linearGradient id={cx} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={PURPLE_L} />
          <stop offset="100%" stopColor={PURPLE} />
        </linearGradient>
      </defs>
      <circle cx={center} cy={center} r={r} fill="none" stroke={GRID} strokeWidth={size === "sm" ? 4 : 8} />
      {Array.from({ length: 11 }, (_, i) => {
        const rot = -90 + i * (360 / 11);
        const on = answered[i];
        return (
          <circle
            key={i}
            cx={center} cy={center} r={r} fill="none"
            stroke={on ? `url(#${cx})` : "#ddd4c6"}
            strokeWidth={size === "sm" ? 4 : 8}
            strokeDasharray={`${dash.toFixed(2)} ${(C - dash).toFixed(2)}`}
            strokeLinecap="round"
            transform={`rotate(${rot} ${center} ${center})`}
            style={{ filter: on ? "drop-shadow(0 0 5px rgba(163, 114, 32,0.45))" : "none", transition: "stroke 300ms ease" }}
          />
        );
      })}
      <text x={center} y={center + (size === "sm" ? 4 : 8)} textAnchor="middle" fontSize={size === "sm" ? 15 : 40} fontWeight={800} fill={INK1}>
        {Math.round(val)}
      </text>
    </svg>
  );
}

function MicroBar({ label, val }: { label: string; val: number }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: MUTED, marginBottom: 3 }}>
        <span>{label}</span><span style={{ color: INK2, fontWeight: 700 }}>{val}</span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: GRID, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, val)}%`, background: `linear-gradient(90deg, ${PURPLE_L}, ${PURPLE})`, transition: "width 700ms cubic-bezier(.22,.61,.36,1)" }} />
      </div>
    </div>
  );
}

// ── the score engine panel — permanent, never unmounts (fixes the "flashing
// interrupt" problem from earlier design rounds) ─────────────────────────────
function ScoreEnginePanel({
  ringVal, micro, reactOn, reactDelta, reactText, stampOn, stampText, sweepOn, answered, compact, ringBoxRef,
}: {
  ringVal: number; micro: { label: string; v: number }[];
  reactOn: boolean; reactDelta: string; reactText: string;
  stampOn: boolean; stampText: string; sweepOn: boolean;
  answered: boolean[]; compact: boolean;
  ringBoxRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (compact) {
    return (
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${GRID}`, padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div ref={ringBoxRef} style={{ position: "relative", flexShrink: 0 }}>
            <SegmentedRing size="sm" val={ringVal} answered={answered} />
            {sweepOn && <div style={{ position: "absolute", inset: -4, borderRadius: "50%", boxShadow: `0 0 24px 6px rgba(163, 114, 32,0.5)`, animation: "engineBloom 900ms ease-out" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, letterSpacing: "0.12em", color: MUTED, textTransform: "uppercase" }}>Thyroid Score · Live</p>
            <div style={{ display: "flex", gap: 10 }}>
              {micro.map((m) => (
                <div key={m.label} style={{ flex: 1, height: 3, borderRadius: 999, background: GRID, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, m.v)}%`, background: PURPLE, transition: "width 700ms ease" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
        {(reactOn || stampOn) && (
          <p style={{ marginTop: 6, fontSize: 11, color: stampOn ? PURPLE_L : INK2, fontWeight: stampOn ? 700 : 500, animation: "engineFade 300ms ease" }}>
            {stampOn ? stampText : `${reactDelta ? reactDelta + " · " : ""}${reactText}`}
          </p>
        )}
      </div>
    );
  }
  return (
    <div style={{ position: "sticky", top: 24, alignSelf: "start" }}>
      <div style={{ background: CARD, border: `1px solid ${GRID}`, borderRadius: 20, padding: "28px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 10.5, letterSpacing: "0.16em", color: MUTED, textTransform: "uppercase", marginBottom: 18 }}>Your Thyroid Score · Live</p>
        <div ref={ringBoxRef} style={{ position: "relative", display: "inline-block" }}>
          <SegmentedRing size="lg" val={ringVal} answered={answered} />
          {sweepOn && <div style={{ position: "absolute", inset: -8, borderRadius: "50%", boxShadow: `0 0 40px 10px rgba(163, 114, 32,0.5)`, animation: "engineBloom 900ms ease-out" }} />}
        </div>
        <p style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>out of 100</p>
        <div style={{ minHeight: 44, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {(reactOn || stampOn) && (
            <p style={{ fontSize: 12.5, color: stampOn ? PURPLE_L : INK2, fontWeight: stampOn ? 800 : 600, animation: "engineFade 340ms ease", lineHeight: 1.4 }}>
              {stampOn ? stampText : (<>{reactDelta && <span style={{ color: GOOD, marginRight: 5 }}>{reactDelta}</span>}{reactText}</>)}
            </p>
          )}
        </div>
        <div style={{ marginTop: 8, textAlign: "left" }}>
          {micro.map((m) => <MicroBar key={m.label} label={m.label} val={Math.round(m.v)} />)}
        </div>
      </div>
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────

type Screen = "intro" | "quiz" | "processing" | "unlock" | "result";

export default function QuizFunnel() {
  const [vw, setVw] = useState(1200);
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    onR();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const desktop = vw >= 900;
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    try { setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { /* ignore */ }
  }, []);

  const [screen, setScreen] = useState<Screen>("intro");
  const [q, setQ] = useState(0);
  const [ans, setAns] = useState<Answers>(emptyAnswers());
  const [advancing, setAdvancing] = useState(false);
  const [ringVal, setRingVal] = useState(0);
  const ringTargetRef = useRef(0);
  const [reactOn, setReactOn] = useState(false);
  const [reactDelta, setReactDelta] = useState("");
  const [reactText, setReactText] = useState("");
  const [stampOn, setStampOn] = useState(false);
  const [stampText, setStampText] = useState("");
  const [sweepOn, setSweepOn] = useState(false);
  const [insight, setInsight] = useState<number | null>(null);
  const [insightCount, setInsightCount] = useState(0);
  const [insightStat, setInsightStat] = useState(0);
  const [proc, setProc] = useState(0);
  const [scores, setScores] = useState<ReturnType<typeof computeFrom> | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "" });
  const [errs, setErrs] = useState<Record<string, boolean>>({});
  const [formErr, setFormErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dial, setDial] = useState(0);
  const [barsOn, setBarsOn] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);

  // Pre-warm the Cashfree SDK the moment the unlock form appears — browser QA
  // measured 12-15s of blank modal when the script had to load at click time.
  // Warming here means the SDK is cached before she ever taps Pay.
  const cashfreeRef = useRef<Awaited<ReturnType<typeof import("@cashfreepayments/cashfree-js").load>> | null>(null);
  useEffect(() => {
    if (screen !== "unlock" && screen !== "result") return;
    if (cashfreeRef.current) return;
    import("@cashfreepayments/cashfree-js")
      .then((m) => m.load({ mode: process.env.NODE_ENV === "production" ? "production" : "sandbox" }))
      .then((cf) => { cashfreeRef.current = cf; })
      .catch(() => { /* payNow retries the load itself; fallback covers total failure */ });
  }, [screen]);

  // Mobile pays via full-page redirect ("_self") — if she cancels on the
  // Cashfree page and comes back, bfcache restores this page with the CTA
  // stuck on "Redirecting…". Re-arm it so she can retry.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setPayLoading(false);
        setPayError("");
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  const ringBoxRef = useRef<HTMLDivElement>(null);

  const timers = useRef<{ [k: string]: ReturnType<typeof setTimeout> | number }>({});
  const clearT = (k: string) => { const t = timers.current[k]; if (t) { clearTimeout(t as number); cancelAnimationFrame(t as number); } };
  useEffect(() => () => { Object.keys(timers.current).forEach(clearT); }, []);

  const answered = useMemo(() => QS.map((qq) => (qq.multi ? ((ans[qq.id] as number[]) || []).length > 0 : ans[qq.id] != null)), [ans]);

  const animRing = useCallback((target: number) => {
    clearT("ring");
    if (reducedMotion) { setRingVal(target); return; }
    const from = ringVal, t0 = performance.now(), D = 620;
    const step = (now: number) => {
      const pr = Math.min(1, (now - t0) / D), e = easeOutCubic(pr);
      setRingVal(from + (target - from) * e);
      if (pr < 1) timers.current.ring = requestAnimationFrame(step);
    };
    timers.current.ring = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const showReaction = (d: number, text: string) => {
    if (!text && d === 0) return;
    setReactDelta(d > 0 ? `+${d}` : d < 0 ? String(d) : "");
    setReactText(text);
    setReactOn(true);
    clearT("react");
    timers.current.react = setTimeout(() => setReactOn(false), 3200);
  };

  const updateScore = useCallback((a: Answers, ins: number, qi: number | null) => {
    const target = liveTotalOf(a, ins);
    const old = ringTargetRef.current;
    const d = Math.round(target) - Math.round(old);
    ringTargetRef.current = target;
    const text = qi == null ? "" : reactionFor(qi, a);
    showReaction(d, text);
    animRing(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animRing]);

  const celebrate = (text: string) => {
    setStampText(text); setStampOn(true); setSweepOn(!reducedMotion);
    clearT("sweep"); clearT("stamp");
    timers.current.sweep = setTimeout(() => setSweepOn(false), 950);
    timers.current.stamp = setTimeout(() => setStampOn(false), 2600);
  };

  const showInsight = (k: number) => {
    const ic = insightCount + 1;
    setInsight(k); setInsightCount(ic);
    updateScore(ans, ic, null);
    if (k === 2) {
      const fig = insightFig(null);
      clearT("stat");
      if (reducedMotion) setInsightStat(fig);
      else {
        setInsightStat(0);
        const t0 = performance.now(), D = 900;
        const step = (now: number) => {
          const pr = Math.min(1, (now - t0) / D), e = easeOutCubic(pr);
          setInsightStat(fig * e);
          if (pr < 1) timers.current.stat = requestAnimationFrame(step);
        };
        timers.current.stat = requestAnimationFrame(step);
      }
    }
    clearT("insight");
    timers.current.insight = setTimeout(() => { setInsightOnOff(); }, 2500);
  };
  const setInsightOnOff = () => setInsight(null);

  const startProcessing = useCallback(() => {
    clearT("adv");
    setScreen("processing"); setProc(0); setAdvancing(false);
    setScores(computeFrom(ans));
    window.scrollTo(0, 0);
    const dur = 4000, t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setProc(p * 100);
      if (p < 1) timers.current.proc = requestAnimationFrame(step);
      else timers.current.proc2 = setTimeout(() => { setScreen("unlock"); window.scrollTo(0, 0); }, 500);
    };
    timers.current.proc = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ans]);

  const goTo = (n: number) => { setQ(n); setAdvancing(false); };
  const advanceFrom = (qi: number) => {
    // One interstitial only, after "what have you already tried" — the Approach
    // Gap does the most persuasive work of the three and the other two were
    // pure drop-off.
    if (qi === 2) { celebrate("YOUR THYROID DECODED ✓"); goTo(3); return; }
    if (qi === 4) { showInsight(1); goTo(5); return; }
    // Derived from QS, never hardcoded: this was `qi === 5` when the quiz had
    // six questions, so adding a seventh silently skipped it — the last
    // question rendered, and answering it jumped straight to the result with
    // that answer discarded.
    if (qi === QS.length - 1) { celebrate("ASSESSMENT COMPLETE ✓"); timers.current.toProc = setTimeout(() => startProcessing(), 700); return; }
    goTo(qi + 1);
  };

  const selectSingle = (qi: number, oi: number) => {
    if (advancing) return;
    const qid = QS[qi].id;
    const a = { ...ans, [qid]: oi };
    setAns(a); setAdvancing(true);
    updateScore(a, insightCount, qi);
    clearT("adv");
    timers.current.adv = setTimeout(() => advanceFrom(qi), 500);
  };
  const toggleMulti = (qi: number, oi: number) => {
    const qid = QS[qi].id;
    const cur = (ans[qid] as number[]) || [];
    const next = cur.includes(oi) ? cur.filter((x) => x !== oi) : [...cur, oi];
    const a = { ...ans, [qid]: next };
    setAns(a);
    updateScore(a, insightCount, qi);
  };
  const continueMulti = () => {
    const qid = QS[q].id;
    if (((ans[qid] as number[]) || []).length === 0) return;
    advanceFrom(q);
  };
  const back = () => { if (q === 0) { setScreen("intro"); window.scrollTo(0, 0); } else goTo(q - 1); };

  // ── result reveal ──
  const showResult = useCallback((ansOverride?: Answers) => {
    Object.keys(timers.current).forEach(clearT);
    const a = ansOverride || ans;
    const sc = computeFrom(a);
    setScores(sc); setScreen("result"); setDial(0); setBarsOn(false);
    window.scrollTo(0, 0);
    const D = 1400, target = sc.total;
    if (reducedMotion) { setDial(target); setBarsOn(true); return; }
    timers.current.dialDelay = setTimeout(() => {
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / D), e = easeOutCubic(p);
        setDial(target * e);
        if (p < 1) timers.current.dial = requestAnimationFrame(step);
      };
      timers.current.dial = requestAnimationFrame(step);
    }, 280);
    timers.current.bars = setTimeout(() => setBarsOn(true), 1780);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ans, reducedMotion]);

  // ── unlock form submit: capture the real lead ──
  const submit = async () => {
    const f = form, e: Record<string, boolean> = {};
    if (f.name.trim().length < 2) e.name = true;
    const d = f.phone.replace(/\D/g, "");
    if (!(d.length === 10 || (d.length === 12 && d.indexOf("91") === 0))) e.phone = true;
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = true;
    // City is no longer collected at the unlock gate (friction cut: 4 fields
    // -> 3 at the highest-drop-off moment; IP-based ct matching covers Meta,
    // and the WhatsApp playbook never used city). The form key stays so the
    // /api/quiz-lead payload shape is unchanged - it just sends "".
    if (Object.keys(e).length) { setErrs(e); setFormErr("Please check the highlighted fields. We need them to reveal your score."); return; }
    setErrs({}); setFormErr(""); setSubmitting(true);

    const firstName = f.name.trim().split(/\s+/)[0] || "";
    const lastName = f.name.trim().split(/\s+/).slice(1).join(" ");
    const phoneDigits = d.length === 12 ? d.slice(2) : d;

    persistUserIdentity({
      ...(firstName && { first_name: firstName }),
      ...(phoneDigits && { phone: phoneDigits }),
      ...(f.email && { email: f.email.trim() }),
    });

    const leadEventId = trackLead({
      ...(firstName && { first_name: firstName }),
      ...(lastName && { last_name: lastName }),
      phone: phoneDigits,
      email: f.email.trim(),
    });
    pushDL({ event: "quiz_completed" });

    const utms = getUtmParams();
    const fbclid = getFbclid();
    const visitorId = getVisitorId();
    const attribution = {
      utm_source: utms.utm_source, utm_medium: utms.utm_medium, utm_campaign: utms.utm_campaign,
      utm_content: utms.utm_content, utm_term: utms.utm_term,
      ...(fbclid && { fbclid }), ...(visitorId && { visitor_id: visitorId }),
    };

    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "Lead", event_id: leadEventId,
        source_url: window.location.href,
        user_data: {
          first_name: firstName, ...(lastName && { last_name: lastName }),
          phone: phoneDigits, email: f.email.trim(),
          ...(visitorId && { external_id: visitorId }),
        },
      }),
    }).catch(() => {});

    const sc = computeFrom(ans);
    const leadId = `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setLeadId(leadId); // payNow (embedded checkout) needs it after this closure ends
    const opt = (qid: string, i: number | null) => (i == null ? "" : QS.find((x) => x.id === qid)!.opts![i]);
    const optsJoin = (qid: string, idxs: number[]) => idxs.map((i) => QS.find((x) => x.id === qid)!.opts![i]).join(", ");

    fetch("/api/quiz-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        name: f.name.trim(), phone: phoneDigits, email: f.email.trim(), city: f.city.trim(),
        // Retired questions still post as "" so the sheet's column mapping
        // never shifts and the dashboard keeps reading the same headers.
        age: "",
        diagnosis: opt("diagnosis", ans.diagnosis as number | null),
        onMedication: opt("medication", ans.medication as number | null),
        struggleDuration: opt("duration", ans.duration as number | null),
        symptoms: optsJoin("symptoms", (ans.symptoms as number[]) || []),
        // Dashboard painLine()/PROOF_MAP match on this text; her symptoms are
        // now the closest true signal since the single-frustration question is gone.
        biggestChallenge: optsJoin("symptoms", (ans.symptoms as number[]) || []),
        triedBefore: optsJoin("tried", (ans.tried as number[]) || []) || "Nothing structured yet",
        amountSpent: "",
        goal: "",
        commitment: "",
        timing: "",
        budget: opt("budget", ans.budget as number | null),
        decisionMaker: opt("decisionMaker", ans.decisionMaker as number | null),
        leadScore: sc.total,
        leadTier: sc.tierLabel,
        attribution,
      }),
    }).catch(() => {});

    // Bridge payload for /session-booked (embedded Cal.com step after payment) —
    // same localStorage key + shape BookingFlow.tsx uses, so that page's
    // hydration/Purchase-firing logic works unchanged for quiz leads too.
    try {
      localStorage.setItem(
        NATIVE_BOOKING_KEY,
        JSON.stringify({
          step1: {
            name: f.name.trim(), phone: phoneDigits, email: f.email.trim(),
            thyroidCondition: opt("diagnosis", ans.diagnosis as number | null),
            thyroidDuration: opt("duration", ans.duration as number | null),
            mainGoal: "",
          },
          startedAt: new Date().toISOString(),
          leadId,
          attribution,
        }),
      );
    } catch { /* non-critical */ }

    setSubmitting(false);
    showResult();
  };

  // EMBEDDED checkout (owner requirement): the Cashfree JS SDK opens as a
  // modal ON this page — no navigation to cashfree.com. The order is created
  // server-side with her quiz details prefilled (no Cashfree form fields to
  // retype) and carries visitor_id/fbc/fbp as order_tags, so the webhook's
  // Purchase CAPI attributes the sale back to the exact Meta ad click.
  // On success → /session-booked (embedded Cal.com) with orderId + leadId.
  //
  // FALLBACK: if the order API or SDK cannot start (missing keys, network),
  // she is sent to the hosted form instead — a paying customer must never
  // meet a dead button. localStorage bridge survives that round trip too.
  const payNow = useCallback(async () => {
    if (payLoading) return;
    setPayLoading(true);
    setPayError("");
    pushDL({ event: "cta_click", location: "assessment_result", button_label: "Pay & Decode My Score" });
    trackInitiateCheckout();
    pushDL({ event: "quiz_payment_initiated" });

    try {
      const orderRes = await fetch("/api/create-cashfree-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          customerPhone: form.phone,
          customerName: form.name,
          customerEmail: form.email,
          visitorId: getVisitorId(),
          fbc: getFbc(),
          fbp: getFbp(),
        }),
      });
      if (!orderRes.ok) throw new Error("order_failed");

      const { paymentSessionId, orderId, amount } = (await orderRes.json()) as {
        paymentSessionId: string;
        orderId: string;
        amount?: number;
      };

      // orderId + real charged amount → /session-booked fires Purchase with
      // event_id Purchase_<orderId>, deduped with the webhook CAPI leg.
      try {
        const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        localStorage.setItem(NATIVE_BOOKING_KEY, JSON.stringify({ ...obj, orderId, amount }));
      } catch { /* non-critical */ }

      // Usually already warmed by the unlock/result-screen pre-load effect.
      let cashfree = cashfreeRef.current;
      if (!cashfree) {
        const { load } = await import("@cashfreepayments/cashfree-js");
        cashfree = await load({
          mode: process.env.NODE_ENV === "production" ? "production" : "sandbox",
        });
      }
      if (!cashfree) throw new Error("sdk_unavailable");

      // Mobile → "_self": full-page Cashfree checkout with native GPay/
      // PhonePe/Paytm app-launch buttons (UPI intent doesn't fire from the
      // iframe modal). Desktop → "_modal" with QR. On "_self" the browser
      // leaves this page; Cashfree returns her to /payment-success.
      const result = await cashfree.checkout({ paymentSessionId, redirectTarget: checkoutRedirectTarget() });

      if (result.error) {
        setPayError("Payment was not completed. Please try again or use UPI.");
        setPayLoading(false);
      } else if (result.paymentDetails) {
        window.location.href = `/session-booked?orderId=${orderId}&leadId=${leadId}`;
        // loading stays true — navigating away
      } else {
        setPayError("Payment not completed. Tap the button to try again.");
        setPayLoading(false);
      }
    } catch (err) {
      console.error("[quiz-payment] embedded checkout unavailable, falling back to hosted form:", err instanceof Error ? err.message : String(err));
      window.location.href = CONSULTATION_FORM_URL;
    }
  }, [leadId, form, payLoading]);

  // ── derived values for render ──
  const parts = computeParts(ans);
  const micro = [{ label: "Symptom Load", v: parts.S }, { label: "Approach Gap", v: parts.G }, { label: "Time Entrenched", v: parts.E }];
  const si = SECTIONS.findIndex(([a, b]) => q >= a && q <= b);
  const sec = SECTIONS[si < 0 ? 0 : si];
  const Q = QS[q];
  const isMulti = !!Q.multi, isScale = !!Q.scale;
  const sel = (i: number) => (Q.multi ? ((ans[Q.id] as number[]) || []).includes(i) : ans[Q.id] === i);
  const mCount = isMulti ? ((ans[Q.id] as number[]) || []).length : 0;
  const bandTexts = ["under 6 months", "6–12 months", "1–3 years", "3+ years"], bandPcts = [18, 34, 61, 78];
  const herBand = ans.duration == null ? 2 : (ans.duration as number);
  let insightTitle = "", insightCaption = "";
  if (insight === 0) { insightTitle = "How long women like you fought it"; insightCaption = `${bandPcts[herBand]}% of women fighting it ${bandTexts[herBand]} were on generic plans, built for normal thyroids.`; }
  if (insight === 1) { insightTitle = "The Approach Gap"; insightCaption = parts.tried >= 2 ? `Women who tried ${parts.tried}+ methods and failed shared the same gap. The effort was never the problem.` : "The effort was never the problem. The plan was built for the wrong metabolism."; }
  if (insight === 2) { const fig = insightFig(null).toLocaleString("en-IN"); insightTitle = "It was never the money"; insightCaption = `Women like you spent ₹${fig} on average before the right map. Spending more was never the answer.`; }

  const sc = scores || { total: 0, symptomLoad: 0, approachGap: 0, entrenched: 0, tierLabel: "", tierLine: "", insights: [] as string[], blockerLines: [] as string[], blockers: 0 };
  const firstName = form.name.trim().split(/\s+/)[0] || "";
  const stagesDef: [number, number, string][] = [[2, 38, "Analysing your symptom pattern…"], [38, 74, "Comparing with 200+ hypothyroid client profiles…"], [74, 100, "Calculating your Thyroid Score…"]];

  const card: React.CSSProperties = { background: CARD, border: `1px solid ${GRID}`, borderRadius: 20 };
  const shell: React.CSSProperties = { minHeight: "100vh", background: BG, color: INK1, fontFamily: "var(--font-body), Inter, system-ui, sans-serif" };

  // ── INTRO ──
  if (screen === "intro") {
    return (
      <main style={{ ...shell, display: "grid", placeItems: "center", padding: "24px 20px" }}>
        <style>{KEYFRAMES}</style>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: 11, letterSpacing: "0.18em", color: PURPLE_L, textTransform: "uppercase", fontWeight: 700, marginBottom: 14 }}>Thyroid Fat-Loss Assessment</p>
          <h1 style={{ fontSize: "clamp(1.7rem,5vw,2.3rem)", fontFamily: "var(--font-display), Georgia, serif", fontWeight: 800, lineHeight: 1.15, marginBottom: 14 }}>
            Find out what&apos;s really blocking your thyroid weight loss
          </h1>
          <p style={{ fontSize: 14.5, color: INK2, lineHeight: 1.6, marginBottom: 8 }}>
            7 questions · 60 seconds · watch your Thyroid Score build as you answer
          </p>
          {/* The price used to sit here in muted grey as a footnote. It now
              matches the time cost in size and colour: every woman who leaves at
              this screen over ₹299 is a woman who would otherwise have cost a
              full lead fee and never paid. Filtering here is cheaper than
              filtering after the click. */}
          <p style={{ fontSize: 14.5, color: INK2, lineHeight: 1.6, marginBottom: 30 }}>
            <strong style={{ fontWeight: 700 }}>Free to take.</strong> Decode it live on a ₹{SESSION_PRICE} private 1-on-1 Thyroid Consultation Call.
          </p>
          <button
            onClick={() => { ringTargetRef.current = 0; setScreen("quiz"); setQ(0); window.scrollTo(0, 0); }}
            style={{ width: "100%", padding: "18px 0", borderRadius: 16, background: `linear-gradient(135deg, ${PURPLE}, #8a5d12)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 14px 40px rgba(163, 114, 32,0.35)" }}
          >
            Start My Assessment
          </button>
          <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ display: "flex" }}>
              {["AV", "PR", "SK"].map((ini, i) => (
                <div key={ini} style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg, ${PURPLE_L}, ${PURPLE})`, border: `2px solid ${BG}`, marginLeft: i ? -8 : 0, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: "#ffffff" }}>{ini}</div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: MUTED }}>Taken by 200+ Indian women with hypothyroidism</p>
          </div>
        </div>
      </main>
    );
  }

  // ── PROCESSING ──
  if (screen === "processing") {
    const dash = 465 * (1 - proc / 100);
    return (
      <main style={{ ...shell, display: "grid", placeItems: "center", padding: "24px 20px" }}>
        <style>{KEYFRAMES}</style>
        <div style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
          {/* Number is absolutely centred INSIDE the ring — the old negative-
              margin hack let it drift outside the circle at some viewport/font
              scales (caught in browser QA). */}
          <div style={{ position: "relative", width: 180, height: 180, margin: "0 auto" }}>
            <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: "rotate(-90deg)", display: "block" }}>
              <circle cx="90" cy="90" r="74" fill="none" stroke={GRID} strokeWidth="10" />
              <circle cx="90" cy="90" r="74" fill="none" stroke={PURPLE} strokeWidth="10" strokeLinecap="round" strokeDasharray="465" strokeDashoffset={dash} style={{ transition: "stroke-dashoffset 80ms linear" }} />
            </svg>
            <p style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 40, fontWeight: 800, margin: 0 }}>
              {Math.round(proc)}<span style={{ fontSize: 18, color: MUTED }}>%</span>
            </p>
          </div>
          <div style={{ marginTop: 26, display: "grid", gap: 10, textAlign: "left" }}>
            {stagesDef.map(([a, b, text], i) => {
              const done = proc >= b, active = proc >= a && proc < b;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: done || active ? 1 : 0.4 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${done || active ? PURPLE : "#ddd4c6"}`, background: done ? PURPLE : "transparent", flexShrink: 0, display: "grid", placeItems: "center" }}>
                    {done && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                  </div>
                  <p style={{ fontSize: 13, color: active ? INK1 : done ? INK2 : MUTED }}>{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // ── UNLOCK ──
  if (screen === "unlock") {
    return (
      <main style={{ ...shell, display: "grid", placeItems: "center", padding: "24px 20px" }}>
        <style>{KEYFRAMES}</style>
        <div style={{ maxWidth: 420, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <p style={{ fontSize: 34, marginBottom: 6 }}>✓</p>
            <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display), Georgia, serif" }}>Your Thyroid Score is ready</h2>
            <p style={{ fontSize: 13.5, color: INK2, marginTop: 8, lineHeight: 1.6 }}>
              Enter your details to reveal your score, then schedule your private 1-on-1 Thyroid Consultation Call to have it fully decoded.
            </p>
          </div>
          <div style={{ ...card, padding: 22, display: "grid", gap: 12 }}>
            {([
              ["name", "First name", "text"], ["phone", "WhatsApp number", "tel"], ["email", "Email", "email"],
            ] as const).map(([k, ph, type]) => (
              <input
                key={k} type={type} placeholder={ph} value={form[k]}
                onChange={(ev) => setForm((f) => ({ ...f, [k]: ev.target.value }))}
                style={{ width: "100%", padding: "13px 14px", borderRadius: 12, background: "#ffffff", border: `1px solid ${errs[k] ? "#b8322b" : "#d9d0bf"}`, color: INK1, fontSize: 14, outline: "none" }}
              />
            ))}
            {formErr && <p style={{ fontSize: 12, color: "#b8322b" }}>{formErr}</p>}
            <button
              onClick={submit} disabled={submitting}
              style={{ marginTop: 4, padding: "16px 0", borderRadius: 14, background: PURPLE, border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? "Revealing…" : "Show My Score"}
            </button>
          </div>
          <p style={{ marginTop: 14, fontSize: 11.5, color: MUTED, textAlign: "center" }}>Score sent to your WhatsApp. Full decode happens live on your call.</p>
        </div>
      </main>
    );
  }

  // ── RESULT ──
  if (screen === "result") {
    const dialDash = 565.5 * (1 - dial / 100);
    const bars = [["Symptom Load", sc.symptomLoad], ["Approach Gap", sc.approachGap], ["Time Entrenched", sc.entrenched]] as [string, number][];
    const lines = sc.blockerLines ?? [];
    const COUNT_WORD = ["No", "One", "Two", "Three", "Four", "Five"];
    const headline =
      lines.length === 0
        ? "Your answers point to a thyroid that is under-supported, not a body that won't respond."
        : `${COUNT_WORD[lines.length] ?? lines.length} thing${lines.length > 1 ? "s are" : " is"} actively working against your thyroid right now.`;

    // The call DIAGNOSES; the 12-week programme TREATS. Nothing here may promise
    // a plan she could self-implement — macros, meal structures, supplement
    // timing and weekly adjustments are the Rs20,000. Give the sequence away
    // and there is nothing left to sell on the call.
    const stack = [
      `Your ${lines.length > 0 ? `${lines.length} blocker${lines.length > 1 ? "s" : ""}` : "results"} decoded live, in the order they need fixing`,
      "Your thyroid reports read before we speak, not during",
      "A written summary sent to your WhatsApp afterwards, yours to keep",
      `₹${SESSION_PRICE}, credited in full against your plan if you go ahead`,
    ];

    const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
    const waHref = waNumber
      ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Send me my ${lines.length || 3} blockers`)}`
      : "";

    return (
      <main style={{ ...shell, padding: "24px 20px 100px" }}>
        <style>{KEYFRAMES}</style>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.14em", color: PURPLE_L, textTransform: "uppercase", fontWeight: 700, marginBottom: 18 }}>
            {firstName ? `${firstName.toUpperCase()}, YOUR THYROID ASSESSMENT` : "YOUR THYROID ASSESSMENT"}
          </p>

          {/* THE BLOCKERS LEAD. The score used to sit here, and a reassuring
              tier line under it read as "I'm fine" — 69% of leads never tapped
              pay. What creates urgency is her own answers reflected back as
              specific, named problems. */}
          <h1 style={{ fontSize: "clamp(1.45rem,4.6vw,1.85rem)", fontFamily: "var(--font-display), Georgia, serif", fontWeight: 800, lineHeight: 1.25, textAlign: "center", marginBottom: lines.length ? 20 : 10 }}>
            {headline}
          </h1>

          {lines.length > 0 && (
            <div style={{ display: "grid", gap: 14, marginBottom: 24 }}>
              {lines.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: PURPLE_L, flexShrink: 0, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p style={{ fontSize: 14, color: INK1, lineHeight: 1.55 }}>{t}</p>
                </div>
              ))}
            </div>
          )}

          {/* Score demoted to a subtitle — smaller dial, below the problem. */}
          <div style={{ position: "relative", width: 132, height: 132, margin: "0 auto" }}>
            <svg width="132" height="132" viewBox="0 0 220 220" style={{ transform: "rotate(-90deg)", display: "block", width: "132px", height: "132px" }}>
              <circle cx="110" cy="110" r="90" fill="none" stroke={GRID} strokeWidth="14" />
              <circle cx="110" cy="110" r="90" fill="none" stroke={PURPLE} strokeWidth="14" strokeLinecap="round" strokeDasharray="565.5" strokeDashoffset={dialDash} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, margin: 0 }}>{Math.round(dial)}</p>
                <p style={{ fontSize: 10, color: MUTED, margin: "2px 0 0" }}>out of 100</p>
              </div>
            </div>
          </div>
          {/* The ONLY permitted framing. "Responds fast" / "clearly recoverable"
              as standalone reassurance is what made her leave. Hope and
              dependency have to arrive in the same sentence. */}
          <p style={{ textAlign: "center", fontSize: 13.5, color: INK2, marginTop: 8 }}>
            Thyroid Score {sc.total} / 100. <span style={{ color: INK1, fontWeight: 600 }}>Recoverable, but not on its own.</span>
          </p>

          <div style={{ height: 1, background: GRID, margin: "22px 0" }} />

          <p style={{ fontSize: 14, color: INK1, lineHeight: 1.6, textAlign: "center" }}>
            Each one is fixable. Together they compound, and the order you fix them in decides whether it works.{" "}
            <span style={{ color: PURPLE_L, fontWeight: 600 }}>That sequence is what we map on your call.</span>
          </p>

          <div style={{ height: 1, background: GRID, margin: "22px 0" }} />

          <div style={{ ...card, padding: 20, opacity: barsOn ? 1 : 0, transition: "opacity 500ms ease" }}>
            {bars.map(([label, v]) => <MicroBar key={label} label={label} val={v} />)}
          </div>

          <div style={{ marginTop: 22, borderRadius: 22, border: `1px solid ${GRID}`, background: `linear-gradient(160deg, rgba(163, 114, 32,0.10), ${CARD2})`, padding: 24 }}>
            <p style={{ fontSize: 10.5, letterSpacing: "0.14em", color: PURPLE_L, textTransform: "uppercase", fontWeight: 800, marginBottom: 6 }}>The 60-minute thyroid blocker call</p>
            <h3 style={{ fontSize: 19, fontWeight: 800, fontFamily: "var(--font-display), Georgia, serif", marginBottom: 14 }}>₹{SESSION_PRICE}, credited against your plan</h3>
            <div style={{ display: "grid", gap: 9, marginBottom: 16 }}>
              {stack.map((t) => (
                <div key={t} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ color: GOOD, fontSize: 13, marginTop: 1 }}>✓</span>
                  <p style={{ fontSize: 13, color: INK2, lineHeight: 1.5 }}>{t}</p>
                </div>
              ))}
            </div>

            {/* Risk reversal sits immediately above the button, where the
                hesitation actually happens. */}
            <p style={{ fontSize: 12.5, color: INK2, lineHeight: 1.55, fontStyle: "italic", borderLeft: `2px solid ${PURPLE}`, paddingLeft: 12, marginBottom: 16 }}>
              &ldquo;If you finish the call and still don&apos;t know what&apos;s blocking you, tell me and I&apos;ll refund the ₹{SESSION_PRICE}, and you keep the written summary.&rdquo;
            </p>

            <p style={{ fontSize: 11.5, color: MUTED, marginBottom: 14 }}>{SCARCITY_LINE}</p>
            <button
              onClick={payNow}
              disabled={payLoading}
              style={{ width: "100%", padding: "17px 0", borderRadius: 14, background: `linear-gradient(135deg, ${PURPLE}, #8a5d12)`, border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: payLoading ? "default" : "pointer", boxShadow: "0 14px 36px rgba(163, 114, 32,0.32)", opacity: payLoading ? 0.75 : 1 }}
            >
              {payLoading ? "Opening secure checkout…" : `Book My Call · ₹${SESSION_PRICE}`}
            </button>
            {payError && (
              <p style={{ fontSize: 12, color: "#b8322b", textAlign: "center", marginTop: 10 }}>{payError}</p>
            )}
            <p style={{ fontSize: 11, color: MUTED, textAlign: "center", marginTop: 10 }}>Pay directly with GPay, PhonePe, Paytm or card. Secure Cashfree checkout, then pick your call time.</p>

            {/* Quieter escape hatch. Safe to offer now that replies land in the
                /admin inbox — before that, a tap here went nowhere. */}
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                onClick={() => pushDL({ event: "wa_link_tapped", location: "result_secondary" })}
                style={{ display: "block", textAlign: "center", marginTop: 14, fontSize: 12.5, color: MUTED, textDecoration: "none" }}
              >
                Not ready? Get my {lines.length || 3} blockers on WhatsApp →
              </a>
            )}
          </div>

          <button onClick={() => { Object.keys(timers.current).forEach(clearT); ringTargetRef.current = 0; setScreen("intro"); setQ(0); setAns(emptyAnswers()); setRingVal(0); setForm({ name: "", phone: "", email: "", city: "" }); window.scrollTo(0, 0); }}
            style={{ display: "block", margin: "20px auto 0", background: "transparent", border: "none", color: MUTED, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
            Retake the assessment
          </button>
        </div>

        {/* sticky mobile CTA */}
        {!desktop && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(10px)", borderTop: `1px solid ${GRID}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, zIndex: 30 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700 }}>Thyroid Consultation Call</p>
              <p style={{ fontSize: 10.5, color: MUTED }}>60 min · Private 1-on-1 · ₹{SESSION_PRICE}</p>
            </div>
            <button onClick={payNow} disabled={payLoading} style={{ padding: "11px 18px", borderRadius: 999, background: PURPLE, border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: payLoading ? "default" : "pointer", whiteSpace: "nowrap", opacity: payLoading ? 0.75 : 1 }}>
              {payLoading ? "Opening…" : `Book · ₹${SESSION_PRICE}`}
            </button>
          </div>
        )}
      </main>
    );
  }

  // ── QUIZ (+ interstitials) ──
  const engine = (
    <ScoreEnginePanel
      ringVal={ringVal} micro={micro} reactOn={reactOn} reactDelta={reactDelta} reactText={reactText}
      stampOn={stampOn} stampText={stampText} sweepOn={sweepOn} answered={answered} compact={!desktop} ringBoxRef={ringBoxRef}
    />
  );

  const questionBlock = (
    <div style={{ maxWidth: desktop ? 520 : 480, width: "100%" }}>
      <button onClick={back} style={{ background: "none", border: "none", color: MUTED, fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>← Back</button>
      <p style={{ fontSize: 10.5, letterSpacing: "0.12em", color: PURPLE_L, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>SECTION {(si < 0 ? 0 : si) + 1} · {sec[2]}</p>
      <p style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Q{q + 1} · {QS.length - q - 1} to go</p>
      <h2 key={q} style={{ fontSize: desktop ? 28 : 23, fontWeight: 800, fontFamily: "var(--font-display), Georgia, serif", lineHeight: 1.25, marginBottom: 22, animation: "quizSlide 250ms cubic-bezier(.22,.61,.36,1) both" }}>
        {Q.t}
      </h2>

      {insight != null ? (
        <div style={{ ...card, padding: 22, animation: "engineFade 300ms ease" }}>
          <p style={{ fontSize: 10, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Pattern Check {insight + 1} of 3</p>
          <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{insightTitle}</h3>
          {insight === 0 && (
            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              {bandTexts.map((label, i) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "90px 1fr 36px", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: i === herBand ? PURPLE_L : MUTED }}>{label}</span>
                  <div style={{ height: 8, borderRadius: 999, background: GRID, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${bandPcts[i]}%`, background: i === herBand ? `linear-gradient(90deg, ${PURPLE_L}, ${PURPLE})` : "#ddd4c6", transition: `width 620ms cubic-bezier(.22,.61,.36,1) ${i * 80}ms` }} />
                  </div>
                  <span style={{ fontSize: 11, color: i === herBand ? PURPLE_L : MUTED, textAlign: "right" }}>{bandPcts[i]}%</span>
                </div>
              ))}
            </div>
          )}
          {insight === 2 && (
            <p style={{ fontSize: 30, fontWeight: 800, color: PURPLE_L, marginBottom: 10 }}>₹{Math.round(insightStat).toLocaleString("en-IN")}</p>
          )}
          <p style={{ fontSize: 13, color: INK2, lineHeight: 1.6 }}>{insightCaption}</p>
          <p style={{ fontSize: 12, color: PURPLE_L, marginTop: 14, fontWeight: 600 }}>Your Thyroid Consultation Call decodes exactly this. ₹{SESSION_PRICE}, booked in one quick step.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {(Q.opts || []).map((label, i) => {
            const s = sel(i);
            return (
              <button
                key={label}
                onClick={(e) => { if (isMulti) toggleMulti(q, i); else selectSingle(q, i); }}
                style={{ textAlign: "left", padding: "16px 18px", borderRadius: 14, background: s ? "rgba(163, 114, 32,0.10)" : CARD, border: `1px solid ${s ? PURPLE : GRID}`, color: s ? "#8a5d12" : INK2, fontSize: 14.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: s ? "0 0 0 3px rgba(163, 114, 32,0.15)" : "none", transition: "all 150ms ease" }}
              >
                {label}
                {isMulti && <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${s ? PURPLE : "#d9d0bf"}`, background: s ? PURPLE : "transparent", flexShrink: 0, display: "grid", placeItems: "center", fontSize: 11, color: "#fff" }}>{s ? "✓" : ""}</span>}
              </button>
            );
          })}
          {isMulti && (
            <button onClick={continueMulti} disabled={mCount === 0} style={{ marginTop: 6, padding: "15px 0", borderRadius: 14, background: mCount ? PURPLE : "#ddd4c6", border: "none", color: mCount ? "#fff" : "#9c9384", fontSize: 14.5, fontWeight: 700, cursor: mCount ? "pointer" : "default" }}>
              {mCount ? `Continue · ${mCount} selected` : "Continue"}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <main style={shell}>
      <style>{KEYFRAMES}</style>
      {!desktop && engine}
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: desktop ? "40px 24px 60px" : "20px 20px 40px", display: desktop ? "grid" : "block", gridTemplateColumns: desktop ? "1fr 340px" : undefined, gap: desktop ? 40 : 0, alignItems: "start" }}>
        {questionBlock}
        {desktop && engine}
      </div>
    </main>
  );
}

const KEYFRAMES = `
@keyframes engineFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes engineBloom { 0% { opacity: 0.9; transform: scale(0.9); } 60% { opacity: 0.5; } 100% { opacity: 0; transform: scale(1.25); } }
@keyframes quizSlide { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
`;
