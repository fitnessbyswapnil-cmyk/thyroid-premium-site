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
 * PRICING: the paid gate is LIVE. The score-unlock form (this screen) captures
 * the lead FIRST — so she is in the sheet, the dashboard and the email
 * sequence whether or not she pays — then the result screen's CTA sends her
 * to the Cashfree-hosted payment form (CONSULTATION_FORM_URL). Cashfree
 * returns her to /payment-success, which resolves to /session-booked and
 * embeds the Cal.com calendar inline. CTA copy shows SESSION_PRICE; the
 * amount actually charged is whatever the Cashfree form is configured for.
 * No "free / no card" claims anywhere.
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
import { getUtmParams, getFbclid, getVisitorId } from "@/lib/tracking";
import { NATIVE_BOOKING_KEY } from "@/app/book/components/BookingFlow";
import { SESSION_PRICE } from "@/app/lib/pricing";

// ── palette (matches the site + admin dashboard system) ─────────────────────
const BG = "#0f1012";
const CARD = "#17181c";
const CARD2 = "#1c1d22";
const GRID = "#26242c";
const INK1 = "#f4f2f7";
const INK2 = "#b9b3c4";
const MUTED = "#8a8494";
const PURPLE = "#a855f7";
const PURPLE_L = "#c793ff";
const GOOD = "#0ca30c";

const SCARCITY_LINE = "Only a few sessions open this week";

// ── question bank (verbatim from the approved prototype) ────────────────────
type Q = { id: string; t: string; opts?: string[]; multi?: boolean; scale?: boolean };
const QS: Q[] = [
  { id: "q1", t: "Your age?", opts: ["25–32", "33–40", "41–48", "49+"] },
  { id: "q2", t: "Have you been diagnosed with a thyroid condition?", opts: ["Yes, hypothyroidism", "Yes, Hashimoto's", "I suspect it, not diagnosed yet", "No"] },
  { id: "q3", t: "Are you on thyroid medication?", opts: ["Yes — and still struggling with weight", "Yes — and it's under control", "Not yet"] },
  { id: "q4", t: "How long have you been fighting this weight?", opts: ["Under 6 months", "6–12 months", "1–3 years", "More than 3 years"] },
  { id: "q5", t: "Beyond the scale, what else is bothering you?", multi: true, opts: ["Exhausted by afternoon", "Hair fall", "Bloating / puffiness", "Brain fog", "Mood swings", "Feeling cold all the time", "Clothes not fitting"] },
  { id: "q6", t: "What's the SINGLE biggest frustration?", opts: ["The weight won't move, no matter what I do", "No energy for anything", "Hair thinning / skin issues", "The bloating and puffiness"] },
  { id: "q7", t: "What have you already tried?", multi: true, opts: ["Dieting / calorie cutting", "Gym / personal trainer", "Nutritionists / diet plans", "Only medication", "YouTube / free plans", "Nothing structured yet"] },
  { id: "q8", t: "How much have you spent on solutions so far?", opts: ["Nothing yet", "Under ₹10,000", "₹10,000–₹50,000", "More than ₹50,000"] },
  { id: "q9", t: "If your thyroid finally cooperated, what changes first?", opts: ["Lose the stubborn weight", "Get my energy back", "Feel like myself again", "All of the above"] },
  { id: "q10", t: "How ready are you to fix this — honestly?", scale: true },
  { id: "q11", t: "When do you want to start?", opts: ["This week", "This month", "In a month or two", "Just exploring"] },
];
const SECTIONS: [number, number, string][] = [[0, 3, "ABOUT YOU"], [4, 7, "YOUR HISTORY"], [8, 10, "YOUR READINESS"]];
const REACT: Record<string, string[]> = {
  q1: ["Prime years — metabolism is very trainable", "Peak years — this pattern responds well", "This band responds fast to thyroid-first plans", "Slower, but absolutely movable"],
  q2: ["Diagnosed — we know what we're working with", "Hashimoto's — autoimmune needs its own plan", "Suspected — step one is the right panel", "Good — we'll rule it in or out properly"],
  q3: ["Medicated and stuck — the classic gap", "Controlled — now we build on it", "Not yet — plenty of room to move"],
  q4: ["Early — the best time to fix it", "Under a year — very recoverable", "3 years of fighting — that ends here", "Long fight. It was the method, not you"],
  q6: ["The scale is the loudest signal — noted", "Energy first. That's fixable", "Hair and skin — thyroid signature", "Bloating — inflammation is in play"],
  q8: ["Clean slate — no wasted spend", "Spent a little — never the money", "₹10k+ spent — it was the map, not the money", "₹50k+ — you needed a plan, not more spend"],
  q9: ["Weight first — clear target", "Energy first — that comes early", "Feeling like yourself — the real goal", "All of it. That's the full protocol"],
  q11: ["This week — best possible timing", "This month — strong start", "A month or two — we'll plan it", "Exploring — the score still helps"],
};

type Answers = Record<string, number | number[] | null>;
const emptyAnswers = (): Answers => ({ q1: null, q2: null, q3: null, q4: null, q5: [], q6: null, q7: [], q8: null, q9: null, q10: null, q11: null });

// ── scoring — ported verbatim from the approved prototype ───────────────────
function computeParts(a: Answers) {
  const n = (x: number | null | undefined) => (x == null ? 0 : x);
  const sym = ((a.q5 as number[]) || []).length;
  const tried = ((a.q7 as number[]) || []).filter((i) => i !== 5).length;
  const spend = n(a.q8 as number);
  const S = Math.min(100, Math.round(sym * 12 + n(a.q4 as number) * 9 + (a.q6 != null ? 10 : 0) + (a.q2 === 0 || a.q2 === 1 ? 12 : 0)));
  const G = Math.min(100, Math.round(tried * 15 + spend * 11 + (a.q3 === 0 ? 16 : 0)));
  const R = Math.min(100, Math.round((a.q10 == null ? 0 : (a.q10 as number) * 6.4) + (a.q11 == null ? 0 : [26, 18, 9, 2][a.q11 as number] || 2) + (a.q9 === 3 ? 8 : 0)));
  return { S, G, R, sym, tried, spend };
}
function answeredCount(a: Answers): number {
  return QS.reduce((c, q) => {
    const v = a[q.id];
    return c + ((q.multi ? ((v as number[]) || []).length > 0 : v != null) ? 1 : 0);
  }, 0);
}
function liveTotalOf(a: Answers, ins: number): number {
  const p = computeParts(a);
  return Math.min(96, 2.5 * answeredCount(a) + 2 * ins + 0.17 * p.S + 0.21 * p.G + 0.27 * p.R);
}
function computeFrom(a: Answers) {
  const p = computeParts(a);
  const total = Math.max(35, Math.min(96, Math.round(27.5 + 6 + 0.17 * p.S + 0.21 * p.G + 0.27 * p.R)));
  let tierLabel: string, tierLine: string;
  if (total >= 75) { tierLabel = "HIGH POTENTIAL"; tierLine = "Your weight is very likely recoverable — this pattern responds fast once the plan is built thyroid-first."; }
  else if (total >= 58) { tierLabel = "STRONG POTENTIAL"; tierLine = "Clearly recoverable — your answers show specific, fixable blockers rather than a stuck metabolism."; }
  else { tierLabel = "EMERGING POTENTIAL"; tierLine = "There's real room to move — we'd start gentler, but the blockers in your pattern are fixable."; }
  const Q5 = QS[4].opts!, symArr = (a.q5 as number[]) || [];
  const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const ready10 = a.q10 == null ? 0 : (a.q10 as number);
  const rules: [boolean, string][] = [
    [((a.q7 as number[]) || []).includes(2) && ((a.q7 as number[]) || []).includes(1), "You've tried nutritionists AND a gym — the effort was never the problem. Those plans weren't built for a hypothyroid metabolism."],
    [p.tried >= 3, `You've tried ${p.tried} different approaches. That's not failure — it's proof you needed a thyroid-first plan all along.`],
    [p.sym >= 4, `${p.sym} symptoms beyond the scale — including ${lc(Q5[symArr[0]] || "")} and ${lc(Q5[symArr[1]] || "")} — point to an under-supported thyroid, not a willpower problem.`],
    [a.q4 === 3, "More than 3 years of fighting the same weight almost always means the method was wrong — not your body."],
    [a.q3 === 0, "You're on medication and still struggling — the dose treats your lab report, not your metabolism. That gap is exactly what your call covers."],
    [p.spend >= 2, "You've already invested ₹10,000+ in solutions. The missing piece was never more money — it's a plan built for your thyroid."],
    [ready10 >= 8 && (a.q11 === 0 || a.q11 === 1), `You rated yourself ${ready10}/10 ready and want to start ${a.q11 === 0 ? "this week" : "this month"} — that combination is when results come fastest.`],
    [a.q2 === 2, "You suspect a thyroid issue but aren't diagnosed yet — confirming the right panel is step one, and your call covers exactly which tests."],
    [true, "Your answer pattern closely matches the women who respond fastest once the plan finally fits the thyroid."],
  ];
  const insights = rules.filter((r) => r[0]).map((r) => r[1]).slice(0, 3);
  return { total, symptomLoad: p.S, approachGap: p.G, readiness: p.R, tierLabel, tierLine, insights };
}
function reactionFor(qi: number, ans: Answers): string {
  const id = QS[qi].id;
  if (id === "q5") { const n = ((ans.q5 as number[]) || []).length; return n ? `${n} symptom${n > 1 ? "s" : ""} — a pattern, not willpower` : ""; }
  if (id === "q7") { const n = ((ans.q7 as number[]) || []).filter((i) => i !== 5).length; return n ? `${n} approach${n > 1 ? "es" : ""} tried — none built for a thyroid` : "Clean slate — we start it right"; }
  if (id === "q10") { const v = (ans.q10 as number) || 0; return v >= 8 ? "Ready. That's when results come fastest" : v >= 5 ? "Honest answer — we work with that" : "Low readiness — we'd start gentle"; }
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
            stroke={on ? `url(#${cx})` : "#232428"}
            strokeWidth={size === "sm" ? 4 : 8}
            strokeDasharray={`${dash.toFixed(2)} ${(C - dash).toFixed(2)}`}
            strokeLinecap="round"
            transform={`rotate(${rot} ${center} ${center})`}
            style={{ filter: on ? "drop-shadow(0 0 5px rgba(168,85,247,0.45))" : "none", transition: "stroke 300ms ease" }}
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
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(15,16,18,0.92)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${GRID}`, padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div ref={ringBoxRef} style={{ position: "relative", flexShrink: 0 }}>
            <SegmentedRing size="sm" val={ringVal} answered={answered} />
            {sweepOn && <div style={{ position: "absolute", inset: -4, borderRadius: "50%", boxShadow: `0 0 24px 6px rgba(168,85,247,0.5)`, animation: "engineBloom 900ms ease-out" }} />}
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
          {sweepOn && <div style={{ position: "absolute", inset: -8, borderRadius: "50%", boxShadow: `0 0 40px 10px rgba(168,85,247,0.5)`, animation: "engineBloom 900ms ease-out" }} />}
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
      const fig = insightFig(ans.q8 as number | null);
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
    if (qi === 3) { celebrate("ABOUT YOU DECODED ✓"); showInsight(0); goTo(4); return; }
    if (qi === 6) { showInsight(1); goTo(7); return; }
    if (qi === 7) { celebrate("HISTORY DECODED ✓"); showInsight(2); goTo(8); return; }
    if (qi === 10) { celebrate("READINESS DECODED ✓"); timers.current.toProc = setTimeout(() => startProcessing(), 700); return; }
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
  const selectScale = (v: number) => {
    if (advancing) return;
    const a = { ...ans, q10: v };
    setAns(a); setAdvancing(true);
    updateScore(a, insightCount, 9);
    clearT("adv");
    timers.current.adv = setTimeout(() => advanceFrom(9), 500);
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
    if (f.city.trim().length < 2) e.city = true;
    if (Object.keys(e).length) { setErrs(e); setFormErr("Please check the highlighted fields — we need them to reveal your score."); return; }
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
        source_url: "https://www.swapnilumbarkarfitness.in/assessment",
        user_data: {
          first_name: firstName, ...(lastName && { last_name: lastName }),
          phone: phoneDigits, email: f.email.trim(),
          ...(visitorId && { external_id: visitorId }),
        },
      }),
    }).catch(() => {});

    const sc = computeFrom(ans);
    const leadId = `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const opt = (qid: string, i: number | null) => (i == null ? "" : QS.find((x) => x.id === qid)!.opts![i]);
    const optsJoin = (qid: string, idxs: number[]) => idxs.map((i) => QS.find((x) => x.id === qid)!.opts![i]).join(", ");

    fetch("/api/quiz-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        name: f.name.trim(), phone: phoneDigits, email: f.email.trim(), city: f.city.trim(),
        age: opt("q1", ans.q1 as number | null),
        diagnosis: opt("q2", ans.q2 as number | null),
        onMedication: opt("q3", ans.q3 as number | null),
        struggleDuration: opt("q4", ans.q4 as number | null),
        symptoms: optsJoin("q5", (ans.q5 as number[]) || []),
        biggestChallenge: opt("q6", ans.q6 as number | null), // matches dashboard painLine()/PROOF_MAP keywords verbatim
        triedBefore: optsJoin("q7", (ans.q7 as number[]) || []) || "Nothing structured yet",
        amountSpent: opt("q8", ans.q8 as number | null),
        goal: opt("q9", ans.q9 as number | null),
        commitment: ans.q10 != null ? String(ans.q10) : "",
        timing: opt("q11", ans.q11 as number | null),
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
            thyroidCondition: opt("q2", ans.q2 as number | null),
            thyroidDuration: opt("q4", ans.q4 as number | null),
            mainGoal: opt("q9", ans.q9 as number | null),
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

  // Sends her to the Cashfree-hosted payment form. Her lead row and the
  // NATIVE_BOOKING_KEY bridge payload are already written at submit() time, and
  // localStorage survives the round trip — so when Cashfree returns her to
  // /payment-success she still resolves to /session-booked with her details
  // intact for the embedded Cal.com calendar.
  const payNow = useCallback(() => {
    setPayLoading(true);
    pushDL({ event: "cta_click", location: "assessment_result", button_label: "Pay & Decode My Score" });
    trackInitiateCheckout();
    pushDL({ event: "quiz_payment_initiated" });
    window.location.href = CONSULTATION_FORM_URL;
  }, []);

  // ── derived values for render ──
  const parts = computeParts(ans);
  const micro = [{ label: "Symptom Load", v: parts.S }, { label: "Approach Gap", v: parts.G }, { label: "Readiness", v: parts.R }];
  const si = SECTIONS.findIndex(([a, b]) => q >= a && q <= b);
  const sec = SECTIONS[si < 0 ? 0 : si];
  const Q = QS[q];
  const isMulti = !!Q.multi, isScale = !!Q.scale;
  const sel = (i: number) => (Q.multi ? ((ans[Q.id] as number[]) || []).includes(i) : ans[Q.id] === i);
  const mCount = isMulti ? ((ans[Q.id] as number[]) || []).length : 0;
  const bandTexts = ["under 6 months", "6–12 months", "1–3 years", "3+ years"], bandPcts = [18, 34, 61, 78];
  const herBand = ans.q4 == null ? 2 : (ans.q4 as number);
  let insightTitle = "", insightCaption = "";
  if (insight === 0) { insightTitle = "How long women like you fought it"; insightCaption = `${bandPcts[herBand]}% of women fighting it ${bandTexts[herBand]} were on generic plans — built for normal thyroids.`; }
  if (insight === 1) { insightTitle = "The Approach Gap"; insightCaption = parts.tried >= 2 ? `Women who tried ${parts.tried}+ methods and failed shared the same gap — the effort was never the problem.` : "The effort was never the problem — the plan was built for the wrong metabolism."; }
  if (insight === 2) { const fig = insightFig(ans.q8 as number | null).toLocaleString("en-IN"); insightTitle = "It was never the money"; insightCaption = ((ans.q8 as number) || 0) >= 2 ? `Your spend bracket averaged ₹${fig} before a thyroid-first plan — it wasn't the money, it was the map.` : `Women like you spent ₹${fig} on average before the right map. Spending more was never the answer.`; }

  const sc = scores || { total: 0, symptomLoad: 0, approachGap: 0, readiness: 0, tierLabel: "", tierLine: "", insights: [] as string[] };
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
            11 questions · 90 seconds · watch your Thyroid Score build as you answer
          </p>
          <p style={{ fontSize: 12.5, color: MUTED, marginBottom: 30 }}>
            Free to take · Decode it live on a ₹{SESSION_PRICE} private 1-on-1 Thyroid Consultation Call
          </p>
          <button
            onClick={() => { ringTargetRef.current = 0; setScreen("quiz"); setQ(0); window.scrollTo(0, 0); }}
            style={{ width: "100%", padding: "18px 0", borderRadius: 16, background: `linear-gradient(135deg, ${PURPLE}, #7e22ce)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 14px 40px rgba(168,85,247,0.35)" }}
          >
            Start My Assessment
          </button>
          <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ display: "flex" }}>
              {["AV", "PR", "SK"].map((ini, i) => (
                <div key={ini} style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg, ${PURPLE_L}, ${PURPLE})`, border: `2px solid ${BG}`, marginLeft: i ? -8 : 0, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: "#1a0f24" }}>{ini}</div>
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
          <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="90" cy="90" r="74" fill="none" stroke={GRID} strokeWidth="10" />
            <circle cx="90" cy="90" r="74" fill="none" stroke={PURPLE} strokeWidth="10" strokeLinecap="round" strokeDasharray="465" strokeDashoffset={dash} style={{ transition: "stroke-dashoffset 80ms linear" }} />
          </svg>
          <p style={{ marginTop: -110, fontSize: 40, fontWeight: 800 }}>{Math.round(proc)}<span style={{ fontSize: 18, color: MUTED }}>%</span></p>
          <div style={{ marginTop: 100, display: "grid", gap: 10, textAlign: "left" }}>
            {stagesDef.map(([a, b, text], i) => {
              const done = proc >= b, active = proc >= a && proc < b;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: done || active ? 1 : 0.4 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${done || active ? PURPLE : "#33343b"}`, background: done ? PURPLE : "transparent", flexShrink: 0, display: "grid", placeItems: "center" }}>
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
              Enter your details to reveal your score — then schedule your private 1-on-1 Thyroid Consultation Call to have it fully decoded.
            </p>
          </div>
          <div style={{ ...card, padding: 22, display: "grid", gap: 12 }}>
            {([
              ["name", "First name", "text"], ["phone", "WhatsApp number", "tel"], ["email", "Email", "email"], ["city", "City", "text"],
            ] as const).map(([k, ph, type]) => (
              <input
                key={k} type={type} placeholder={ph} value={form[k]}
                onChange={(ev) => setForm((f) => ({ ...f, [k]: ev.target.value }))}
                style={{ width: "100%", padding: "13px 14px", borderRadius: 12, background: "#0f1012", border: `1px solid ${errs[k] ? "#f87171" : "#2a2b31"}`, color: INK1, fontSize: 14, outline: "none" }}
              />
            ))}
            {formErr && <p style={{ fontSize: 12, color: "#f87171" }}>{formErr}</p>}
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
    const bars = [["Symptom Load", sc.symptomLoad], ["Approach Gap", sc.approachGap], ["Readiness", sc.readiness]] as [string, number][];
    const stack = [
      "Your Thyroid Score decoded live — the exact blocker explained",
      "60-min private 1-on-1 with a thyroid-first coach",
      "Your first 30 days mapped, step by step",
      `Only ₹${SESSION_PRICE} to reserve your slot — fully adjusted against your plan`,
    ];
    return (
      <main style={{ ...shell, padding: "24px 20px 100px" }}>
        <style>{KEYFRAMES}</style>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.14em", color: PURPLE_L, textTransform: "uppercase", fontWeight: 700, marginBottom: 18 }}>
            {firstName ? `${firstName.toUpperCase()} — YOUR THYROID SCORE` : "YOUR THYROID SCORE"}
          </p>
          <div style={{ textAlign: "center" }}>
            <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="110" cy="110" r="90" fill="none" stroke={GRID} strokeWidth="14" />
              <circle cx="110" cy="110" r="90" fill="none" stroke={PURPLE} strokeWidth="14" strokeLinecap="round" strokeDasharray="565.5" strokeDashoffset={dialDash} />
            </svg>
            <p style={{ marginTop: -140, fontSize: 56, fontWeight: 800 }}>{Math.round(dial)}</p>
            <p style={{ fontSize: 12, color: MUTED, marginBottom: 130 }}>out of 100</p>
          </div>
          <div style={{ textAlign: "center", marginTop: -8 }}>
            <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", color: PURPLE_L }}>{sc.tierLabel}</p>
            <p style={{ fontSize: 13.5, color: INK2, lineHeight: 1.6, marginTop: 6, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>{sc.tierLine}</p>
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: MUTED, marginTop: 14, maxWidth: 360, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            This is your starting score. The full decode — exactly what&apos;s blocking YOU — happens on your Thyroid Consultation Call.
          </p>

          <div style={{ ...card, marginTop: 22, padding: 20, opacity: barsOn ? 1 : 0, transition: "opacity 500ms ease" }}>
            {bars.map(([label, v]) => <MicroBar key={label} label={label} val={v} />)}
          </div>

          {sc.insights.length > 0 && (
            <div style={{ ...card, marginTop: 14, padding: 20 }}>
              <p style={{ fontSize: 11, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase", marginBottom: 12 }}>What Your Answers Reveal</p>
              <div style={{ display: "grid", gap: 12 }}>
                {sc.insights.map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: PURPLE_L, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                    <p style={{ fontSize: 13, color: INK2, lineHeight: 1.55 }}>{t}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 22, borderRadius: 22, border: `1px solid ${GRID}`, background: `linear-gradient(160deg, rgba(168,85,247,0.10), ${CARD2})`, padding: 24 }}>
            <p style={{ fontSize: 10.5, letterSpacing: "0.14em", color: PURPLE_L, textTransform: "uppercase", fontWeight: 800, marginBottom: 6 }}>Private 1-on-1 Thyroid Consultation Call</p>
            <h3 style={{ fontSize: 19, fontWeight: 800, fontFamily: "var(--font-display), Georgia, serif", marginBottom: 14 }}>Decode your score on a private call &mdash; ₹{SESSION_PRICE}</h3>
            <div style={{ display: "grid", gap: 9, marginBottom: 16 }}>
              {stack.map((t) => (
                <div key={t} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ color: GOOD, fontSize: 13, marginTop: 1 }}>✓</span>
                  <p style={{ fontSize: 13, color: INK2, lineHeight: 1.5 }}>{t}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: MUTED, marginBottom: 14 }}>{SCARCITY_LINE}</p>
            <button
              onClick={payNow}
              disabled={payLoading}
              style={{ width: "100%", padding: "17px 0", borderRadius: 14, background: `linear-gradient(135deg, ${PURPLE}, #7e22ce)`, border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: payLoading ? "default" : "pointer", boxShadow: "0 14px 36px rgba(168,85,247,0.32)", opacity: payLoading ? 0.75 : 1 }}
            >
              {payLoading ? "Opening secure checkout…" : `Pay ₹${SESSION_PRICE} & Decode My Score`}
            </button>
            <p style={{ fontSize: 11, color: MUTED, textAlign: "center", marginTop: 10 }}>Secure checkout, right here. Then pick your call time.</p>
          </div>

          <button onClick={() => { Object.keys(timers.current).forEach(clearT); ringTargetRef.current = 0; setScreen("intro"); setQ(0); setAns(emptyAnswers()); setRingVal(0); setForm({ name: "", phone: "", email: "", city: "" }); window.scrollTo(0, 0); }}
            style={{ display: "block", margin: "20px auto 0", background: "transparent", border: "none", color: MUTED, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
            Retake the assessment
          </button>
        </div>

        {/* sticky mobile CTA */}
        {!desktop && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(15,16,18,0.96)", backdropFilter: "blur(10px)", borderTop: `1px solid ${GRID}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, zIndex: 30 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700 }}>Thyroid Consultation Call</p>
              <p style={{ fontSize: 10.5, color: MUTED }}>60 min · Private 1-on-1 · ₹{SESSION_PRICE}</p>
            </div>
            <button onClick={payNow} disabled={payLoading} style={{ padding: "11px 18px", borderRadius: 999, background: PURPLE, border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: payLoading ? "default" : "pointer", whiteSpace: "nowrap", opacity: payLoading ? 0.75 : 1 }}>
              {payLoading ? "Opening…" : "Pay & Decode"}
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
      <p style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Q{q + 1} · {11 - q - 1} to go</p>
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
                    <div style={{ height: "100%", width: `${bandPcts[i]}%`, background: i === herBand ? `linear-gradient(90deg, ${PURPLE_L}, ${PURPLE})` : "#33343b", transition: `width 620ms cubic-bezier(.22,.61,.36,1) ${i * 80}ms` }} />
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
          <p style={{ fontSize: 12, color: PURPLE_L, marginTop: 14, fontWeight: 600 }}>Your Thyroid Consultation Call decodes exactly this — ₹{SESSION_PRICE}, booked in one quick step.</p>
        </div>
      ) : isScale ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => {
            const s = ans.q10 === v;
            return (
              <button key={v} onClick={() => selectScale(v)} style={{ padding: "16px 0", borderRadius: 12, background: s ? "rgba(168,85,247,0.14)" : CARD, border: `1px solid ${s ? PURPLE : GRID}`, color: s ? "#e9d5ff" : INK2, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>{v}</button>
            );
          })}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", fontSize: 10.5, color: MUTED, marginTop: 2 }}>
            <span>Not ready yet</span><span>Completely ready</span>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {(Q.opts || []).map((label, i) => {
            const s = sel(i);
            return (
              <button
                key={label}
                onClick={(e) => { if (isMulti) toggleMulti(q, i); else selectSingle(q, i); }}
                style={{ textAlign: "left", padding: "16px 18px", borderRadius: 14, background: s ? "rgba(168,85,247,0.10)" : CARD, border: `1px solid ${s ? PURPLE : GRID}`, color: s ? "#f5edff" : INK2, fontSize: 14.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: s ? "0 0 0 3px rgba(168,85,247,0.15)" : "none", transition: "all 150ms ease" }}
              >
                {label}
                {isMulti && <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${s ? PURPLE : "#3a3b44"}`, background: s ? PURPLE : "transparent", flexShrink: 0, display: "grid", placeItems: "center", fontSize: 11, color: "#fff" }}>{s ? "✓" : ""}</span>}
              </button>
            );
          })}
          {isMulti && (
            <button onClick={continueMulti} disabled={mCount === 0} style={{ marginTop: 6, padding: "15px 0", borderRadius: 14, background: mCount ? PURPLE : "#232428", border: "none", color: mCount ? "#fff" : "#6a6b73", fontSize: 14.5, fontWeight: 700, cursor: mCount ? "pointer" : "default" }}>
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
