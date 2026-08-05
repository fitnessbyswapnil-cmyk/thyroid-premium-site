"use client";

/**
 * /admin — private lead dashboard (passcode-gated, read-only on the funnel).
 *
 * Design (per dataviz method): dark surface matching the site; brand purple
 * for single-series marks; a 3-slot validated categorical set for sources
 * (fixed per ENTITY: Facebook=blue, Instagram=orange, Other=aqua); status
 * colors (good/warning/critical) reserved for risk & outcome states, always
 * paired with a label — never color alone. Charts are hand-rolled SVG:
 * thin marks, 2px gaps, direct labels where they earn it, hover tooltips.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Lead = {
  row: number;
  ts: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  adId: string;
  booked: boolean;
  sessionDate: string;
  tier: string;
  city: string;
  commitment: number | null;
  amountSpent: string;
  triedBefore: string;
  challenge: string;
  score: number | null;
  showed: string;
  closedAmt: number | null;
};

// ── palette (validated: 3-slot categorical + purple ordinal, dark surface) ──
const INK1 = "#f4f2f7";
const INK2 = "#b9b3c4";
const MUTED = "#8a8494";
const GRID = "#26242c";
const CARD = "#17181c";
const PURPLE = "#c793ff";
const SRC_COLORS: Record<string, string> = { fb: "#3987e5", ig: "#d95926", other: "#199e70" };
const SRC_LABELS: Record<string, string> = { fb: "Facebook", ig: "Instagram", other: "Other" };
const FUNNEL_RAMP = ["#e0c6ff", "#c793ff", "#a855f7", "#7e22ce"];
const GOOD = "#0ca30c";
const WARN = "#fab219";
const CRIT = "#d03b3b";

const KEY_STORE = "admin_dash_key";
const dayMs = 86400000;

// ── personalized WhatsApp message builder ───────────────────────────────────
// Deterministic templates in Swapnil's voice, personalized from form answers.
// The right template is picked from the lead's STATE; the pain line from
// their "Biggest Challenge" answer. Sent via wa.me ?text= prefill — the
// owner always reviews in WhatsApp before hitting send.

// NOTE: no emoji in message text — WhatsApp Web's compose box has shown
// mojibake ("�") for emoji delivered via the wa.me ?text= prefill. Emoji stay
// in the dashboard UI (which renders fine) but never in outbound message text.
const SIGN = "\n\n— Swapnil Umbarkar\nACE & INFS Certified Thyroid Fat-Loss Coach";
const MANUAL_OFFER =
  "If it's easier, just reply with a day and time that works for you — I'll schedule it myself from my end.";

function painLine(l: Lead): string {
  const c = l.challenge.toLowerCase();
  const tried = l.triedBefore.toLowerCase();
  const effort =
    tried && !tried.includes("nothing")
      ? " What you tried before wasn't wrong effort — those plans were built for a body without hypothyroidism."
      : "";
  if (c.includes("won't move") || c.includes("weight"))
    return `You mentioned the weight won't move no matter what — that's exactly what we'll decode on the call. It's not a willpower problem.${effort}`;
  if (c.includes("hair") || c.includes("skin"))
    return `You mentioned hair thinning and skin issues along with the weight — a classic sign the thyroid side was never properly addressed. We'll cover both.${effort}`;
  if (c.includes("bloat") || c.includes("puffi"))
    return `You mentioned the bloating and puffiness — that's usually the first thing we can calm down. We'll map it on the call.${effort}`;
  if (c.includes("energy") || c.includes("tired") || c.includes("exhaust"))
    return `You mentioned the exhaustion — that's your thyroid talking, not laziness. We'll find what it actually needs.${effort}`;
  return `I've read your form carefully — on the call we'll get to the root of what's been holding your progress back.${effort}`;
}

const REPORTS =
  "If you have recent reports (TSH, T3, T4 + iron/vit D), share them here — I review them personally before the call. No reports? Come anyway.";

function buildMessage(l: Lead): { kind: string; text: string } | null {
  const first = (l.name.trim().split(/\s+/)[0] || "there").replace(/^./, (c) => c.toUpperCase());
  const time = l.sessionDate.match(/\d{1,2}:\d{2} [AP]M/)?.[0] ?? "";
  const dateNice = l.sessionDate.replace(/ \d{4}/, "");

  if ((l.closedAmt ?? 0) > 0) return null; // already a client
  if (l.showed === "Y")
    return {
      kind: "Follow-up",
      text: `Hi ${first}! Great speaking with you today. As promised, your session summary and next steps are on the way. Any question at all — message me right here.${SIGN}`,
    };
  if (l.showed === "N")
    return {
      kind: "Rebook",
      text: `Hi ${first}, missed you at our session — no worries at all, life happens.\n\nYour free thyroid strategy session is still yours. Rebook in one tap: swapnilumbarkarfitness.in/book\n\n${MANUAL_OFFER}${SIGN}`,
    };
  if (l.booked && isToday(l.sessionDate))
    return {
      kind: "Remind",
      text: `Hi ${first}! Reminder — your free thyroid session is TODAY at ${time || dateNice}. Your slot is reserved.\n\nJoin link is in your email. If you have your thyroid reports, send them here before we start. See you soon!${SIGN}`,
    };
  if (l.booked)
    return {
      kind: "Confirm",
      text: `Hi ${first}! Confirming your free thyroid strategy session — ${dateNice}.\n\nPlease reply YES to lock your slot.\n\n${painLine(l)}\n\n${REPORTS}${SIGN}`,
    };
  return {
    kind: "Nudge",
    text: `Hi ${first}! This is Swapnil — I received your thyroid form and read your answers personally.\n\n${painLine(l)}\n\nThe next step is your free 60-min strategy session — pick your time here: swapnilumbarkarfitness.in/book\n\n${MANUAL_OFFER}\n\nI take only a few sessions a week, so grab a slot while there's space.${SIGN}`,
  };
}

function waHref(phone: string, text?: string): string {
  const p = phone.length === 10 ? "91" + phone : phone;
  return `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function riskOf(l: Lead): "high" | "med" | "low" {
  if (!l.phone || (l.commitment !== null && l.commitment <= 3)) return "high";
  if (l.commitment !== null && l.commitment <= 6) return "med";
  return "low";
}

function isToday(sessionDate: string): boolean {
  // "05 Aug 2026 3:00 PM"
  const m = sessionDate.match(/^(\d{1,2}) (\w{3}) (\d{4})/);
  if (!m) return false;
  const d = new Date(`${m[2]} ${m[1]}, ${m[3]}`);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

// ── tiny chart primitives ────────────────────────────────────────────────────

function useTooltip() {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const show = (e: React.MouseEvent, text: string) => {
    const host = (e.currentTarget as SVGElement).closest(".chart-card") as HTMLElement | null;
    const r = host?.getBoundingClientRect();
    if (!r) return;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div
      style={{
        position: "absolute",
        left: Math.min(tip.x + 10, 240),
        top: tip.y - 34,
        background: "#0b0b0e",
        border: `1px solid ${GRID}`,
        color: INK1,
        fontSize: 11.5,
        padding: "4px 8px",
        borderRadius: 6,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: 5,
      }}
    >
      {tip.text}
    </div>
  ) : null;
  return { show, hide, node };
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const { show, hide, node } = useTooltip();
  const W = 320, H = 120, PAD = 4;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (W - PAD * 2) / data.length;
  return (
    <div style={{ position: "relative" }}>
      {node}
      <svg viewBox={`0 0 ${W} ${H + 16}`} style={{ width: "100%", display: "block" }}>
        <line x1={PAD} x2={W - PAD} y1={H} y2={H} stroke={GRID} strokeWidth="1" />
        {data.map((d, i) => {
          const h = d.value === 0 ? 0 : Math.max(3, (d.value / max) * (H - 14));
          const x = PAD + i * bw;
          return (
            <g key={d.label}>
              <rect
                x={x + 1} y={H - h} width={Math.max(2, bw - 2)} height={h}
                rx={2} fill={PURPLE}
                onMouseEnter={(e) => show(e, `${d.label}: ${d.value}`)}
                onMouseLeave={hide}
              />
              {d.value > 0 && d.value === max && (
                <text x={x + bw / 2} y={H - h - 4} textAnchor="middle" fontSize="10" fill={INK2}>
                  {d.value}
                </text>
              )}
              {(i === 0 || i === data.length - 1) && (
                <text x={x + bw / 2} y={H + 12} textAnchor="middle" fontSize="9" fill={MUTED}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Funnel({ stages }: { stages: { label: string; value: number }[] }) {
  const { show, hide, node } = useTooltip();
  const max = Math.max(1, stages[0]?.value ?? 1);
  return (
    <div style={{ position: "relative", display: "grid", gap: 6 }}>
      {node}
      {stages.map((s, i) => {
        const pct = max ? Math.round((s.value / max) * 100) : 0;
        return (
          <div key={s.label} style={{ display: "grid", gridTemplateColumns: "64px 1fr 44px", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: INK2 }}>{s.label}</span>
            <svg viewBox="0 0 100 14" preserveAspectRatio="none" style={{ width: "100%", height: 16, display: "block" }}>
              <rect x="0" y="2" width="100" height="10" rx="3" fill={GRID} />
              <rect
                x="0" y="2" width={Math.max(s.value > 0 ? 3 : 0, pct)} height="10" rx="3"
                fill={FUNNEL_RAMP[Math.min(i, FUNNEL_RAMP.length - 1)]}
                onMouseEnter={(e) => show(e, `${s.label}: ${s.value} (${pct}%)`)}
                onMouseLeave={hide}
              />
            </svg>
            <span style={{ fontSize: 12, color: INK1, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
              {s.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Donut({ parts }: { parts: { key: string; label: string; value: number; color: string }[] }) {
  const { show, hide, node } = useTooltip();
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const R = 40, CX = 50, CY = 50, SW = 16;
  let acc = 0;
  const circ = 2 * Math.PI * R;
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
      {node}
      <svg viewBox="0 0 100 100" style={{ width: 110, flexShrink: 0 }}>
        {parts.map((p) => {
          const frac = p.value / total;
          const dash = Math.max(0, frac * circ - 2); // 2px surface gap
          const el = (
            <circle
              key={p.key}
              cx={CX} cy={CY} r={R} fill="none"
              stroke={p.color} strokeWidth={SW}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-acc * circ + circ / 4}
              onMouseEnter={(e) => show(e, `${p.label}: ${p.value} (${Math.round(frac * 100)}%)`)}
              onMouseLeave={hide}
            />
          );
          acc += frac;
          return el;
        })}
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="16" fontWeight="700" fill={INK1}>
          {total}
        </text>
      </svg>
      <div style={{ display: "grid", gap: 6 }}>
        {parts.map((p) => (
          <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: INK2 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color, flexShrink: 0 }} />
            {p.label}
            <span style={{ color: INK1, fontVariantNumeric: "tabular-nums" }}>{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HBars({ data, color, suffix }: { data: { label: string; value: number; note?: string }[]; color: string; suffix?: string }) {
  const { show, hide, node } = useTooltip();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ position: "relative", display: "grid", gap: 7 }}>
      {node}
      {data.map((d) => (
        <div key={d.label} style={{ display: "grid", gridTemplateColumns: "minmax(70px,110px) 1fr auto", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: INK2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
          <svg viewBox="0 0 100 12" preserveAspectRatio="none" style={{ width: "100%", height: 14, display: "block" }}>
            <rect
              x="0" y="2" width={Math.max(3, (d.value / max) * 100)} height="8" rx="3" fill={color}
              onMouseEnter={(e) => show(e, `${d.label}: ${d.value}${suffix ?? ""}${d.note ? ` · ${d.note}` : ""}`)}
              onMouseLeave={hide}
            />
          </svg>
          <span style={{ fontSize: 11.5, color: INK1, fontVariantNumeric: "tabular-nums" }}>
            {d.value}{suffix ?? ""}{d.note ? <span style={{ color: MUTED }}> · {d.note}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } catch { /* clipboard unavailable */ }
      }}
      title="Copy message"
      style={{ background: "transparent", border: `1px solid ${GRID}`, color: done ? GOOD : INK2, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}
    >
      {done ? "✓ Copied" : "⧉ Copy"}
    </button>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

const RANGES = [
  { key: "7", label: "7D", days: 7 },
  { key: "14", label: "14D", days: 14 },
  { key: "30", label: "30D", days: 30 },
  { key: "all", label: "All", days: 100000 },
];

export default function AdminDashboard() {
  const [key, setKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [range, setRange] = useState("14");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    try { setKey(sessionStorage.getItem(KEY_STORE)); } catch { setKey(null); }
  }, []);

  const load = useCallback(async (k: string) => {
    try {
      const res = await fetch("/api/admin/dashboard", { headers: { "x-admin-key": k } });
      if (res.status === 401) {
        try { sessionStorage.removeItem(KEY_STORE); } catch { /* ignore */ }
        setKey(null);
        setAuthError("Wrong passcode");
        return;
      }
      if (!res.ok) { setLoadError("Could not load data — retrying in 60s"); return; }
      const json = await res.json();
      setLeads(json.leads ?? []);
      setLoadError("");
      setUpdatedAt(new Date());
    } catch {
      setLoadError("Network error — retrying in 60s");
    }
  }, []);

  useEffect(() => {
    if (!key) return;
    load(key);
    timer.current = window.setInterval(() => load(key), 60000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [key, load]);

  const submitKey = (e: React.FormEvent) => {
    e.preventDefault();
    const k = input.trim();
    if (!k) return;
    try { sessionStorage.setItem(KEY_STORE, k); } catch { /* ignore */ }
    setAuthError("");
    setLeads(null);
    setKey(k);
  };

  const mark = async (row: number, field: "showed" | "closed", value: string) => {
    if (!key) return;
    // Optimistic update
    setLeads((prev) =>
      prev
        ? prev.map((l) =>
            l.row === row
              ? field === "showed"
                ? { ...l, showed: value }
                : { ...l, closedAmt: parseFloat(value) || 0 }
              : l,
          )
        : prev,
    );
    await fetch("/api/admin/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ row, field, value }),
    }).catch(() => {});
  };

  const days = RANGES.find((r) => r.key === range)?.days ?? 14;
  const inRange = useMemo(() => {
    if (!leads) return [];
    const cutoff = Date.now() - days * dayMs;
    return leads.filter((l) => new Date(l.ts).getTime() >= cutoff);
  }, [leads, days]);

  const agg = useMemo(() => {
    const total = inRange.length;
    const booked = inRange.filter((l) => l.booked).length;
    const showed = inRange.filter((l) => l.showed === "Y").length;
    const noshow = inRange.filter((l) => l.showed === "N").length;
    const closed = inRange.filter((l) => (l.closedAmt ?? 0) > 0);
    const revenue = closed.reduce((s, l) => s + (l.closedAmt ?? 0), 0);
    const scores = inRange.map((l) => l.score).filter((s): s is number => s !== null);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    // per-day bars
    const shown = Math.min(days, 30);
    const perDay: { label: string; value: number }[] = [];
    for (let i = shown - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * dayMs);
      const dayStr = d.toISOString().slice(0, 10);
      perDay.push({ label: fmtDay(d), value: inRange.filter((l) => l.ts.slice(0, 10) === dayStr).length });
    }

    // sources (fixed entity → color)
    const srcCount: Record<string, number> = { fb: 0, ig: 0, other: 0 };
    inRange.forEach((l) => {
      const k = l.source === "fb" || l.source === "ig" ? l.source : "other";
      srcCount[k]++;
    });

    // score buckets
    const buckets = [
      { label: "<50", value: scores.filter((s) => s < 50).length },
      { label: "50–64", value: scores.filter((s) => s >= 50 && s < 65).length },
      { label: "65–79", value: scores.filter((s) => s >= 65 && s < 80).length },
      { label: "80+", value: scores.filter((s) => s >= 80).length },
    ];

    // per-ad quality (the targeting lever)
    const byAd = new Map<string, { leads: number; scoreSum: number; scoreN: number; booked: number; showed: number }>();
    inRange.forEach((l) => {
      const id = l.adId || "unknown";
      const e = byAd.get(id) ?? { leads: 0, scoreSum: 0, scoreN: 0, booked: 0, showed: 0 };
      e.leads++;
      if (l.score !== null) { e.scoreSum += l.score; e.scoreN++; }
      if (l.booked) e.booked++;
      if (l.showed === "Y") e.showed++;
      byAd.set(id, e);
    });
    const ads = [...byAd.entries()]
      .map(([id, e]) => ({
        label: `…${id.slice(-5)}`,
        value: e.leads,
        note: `score ${e.scoreN ? Math.round(e.scoreSum / e.scoreN) : "–"} · ${e.booked} bkd`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // cities
    const cityMap = new Map<string, number>();
    inRange.forEach((l) => {
      const c = l.city.trim().toLowerCase();
      if (!c) return;
      const nice = c.split(/\s+/)[0].replace(/^./, (ch) => ch.toUpperCase());
      cityMap.set(nice, (cityMap.get(nice) ?? 0) + 1);
    });
    const cities = [...cityMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const todaySessions = (leads ?? [])
      .filter((l) => l.booked && l.sessionDate && isToday(l.sessionDate))
      .sort((a, b) => (a.sessionDate < b.sessionDate ? -1 : 1));

    return { total, booked, showed, noshow, closedN: closed.length, revenue, avgScore, perDay, srcCount, buckets, ads, cities, todaySessions };
  }, [inRange, leads, days]);

  // ── auth gate ──
  if (!key) {
    return (
      <main style={{ minHeight: "100vh", background: "#0f1012", display: "grid", placeItems: "center", padding: 20 }}>
        <form onSubmit={submitKey} style={{ width: "min(92vw, 340px)", background: CARD, border: `1px solid ${GRID}`, borderRadius: 16, padding: 28, textAlign: "center" }}>
          <p style={{ fontSize: 13, letterSpacing: "0.18em", color: MUTED, textTransform: "uppercase", marginBottom: 14 }}>Private Dashboard</p>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Passcode"
            autoFocus
            style={{ width: "100%", background: "#0f1012", border: `1px solid ${GRID}`, borderRadius: 10, padding: "12px 14px", color: INK1, fontSize: 15, textAlign: "center", outline: "none" }}
          />
          {authError && <p style={{ color: CRIT, fontSize: 12, marginTop: 10 }}>✕ {authError}</p>}
          <button type="submit" style={{ marginTop: 14, width: "100%", background: "#a855f7", border: "none", borderRadius: 10, padding: "12px 0", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Open
          </button>
        </form>
      </main>
    );
  }

  const card: React.CSSProperties = { background: CARD, border: `1px solid ${GRID}`, borderRadius: 14, padding: "14px 16px", position: "relative" };
  const cardTitle: React.CSSProperties = { fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, marginBottom: 10 };

  return (
    <main style={{ minHeight: "100vh", background: "#0f1012", color: INK1, fontFamily: "var(--font-body), Inter, system-ui, sans-serif", padding: "16px 14px 60px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800 }}>Lead Dashboard</h1>
            <p style={{ fontSize: 11, color: MUTED }}>
              {updatedAt ? `Live · updated ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Loading…"}
              {loadError && <span style={{ color: WARN }}> · ⚠ {loadError}</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                style={{
                  padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: range === r.key ? "#a855f7" : "transparent",
                  color: range === r.key ? "#fff" : INK2,
                  border: `1px solid ${range === r.key ? "#a855f7" : GRID}`,
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </header>

        {leads === null ? (
          <p style={{ color: MUTED, padding: 40, textAlign: "center" }}>Loading your leads…</p>
        ) : (
          <>
            {/* stat tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 12 }}>
              {[
                { label: "Leads", v: String(agg.total), sub: `last ${range === "all" ? "all time" : range + " days"}` },
                { label: "Booked", v: agg.total ? `${Math.round((agg.booked / agg.total) * 100)}%` : "–", sub: `${agg.booked} of ${agg.total}` },
                { label: "Showed", v: agg.showed + agg.noshow > 0 ? `${Math.round((agg.showed / (agg.showed + agg.noshow)) * 100)}%` : "–", sub: agg.showed + agg.noshow > 0 ? `${agg.showed} showed · ${agg.noshow} no-show` : "mark calls below" },
                { label: "Closed", v: String(agg.closedN), sub: agg.revenue > 0 ? `₹${agg.revenue.toLocaleString("en-IN")}` : "mark wins below" },
                { label: "Avg Score", v: agg.avgScore ? String(agg.avgScore) : "–", sub: "lead quality /100" },
              ].map((t) => (
                <div key={t.label} style={card}>
                  <p style={cardTitle}>{t.label}</p>
                  <p style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{t.v}</p>
                  <p style={{ fontSize: 10.5, color: MUTED, marginTop: 6 }}>{t.sub}</p>
                </div>
              ))}
            </div>

            {/* today's sessions */}
            {agg.todaySessions.length > 0 && (
              <div style={{ ...card, marginBottom: 12 }}>
                <p style={cardTitle}>Today&apos;s Sessions</p>
                <div style={{ display: "grid", gap: 8 }}>
                  {agg.todaySessions.map((l) => {
                    const risk = riskOf(l);
                    const rc = risk === "high" ? CRIT : risk === "med" ? WARN : GOOD;
                    const rl = risk === "high" ? "✕ high no-show risk" : risk === "med" ? "△ medium risk" : "✓ likely to show";
                    const time = l.sessionDate.match(/\d{1,2}:\d{2} [AP]M/)?.[0] ?? l.sessionDate;
                    return (
                      <div key={l.row} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 10px", background: "#0f1012", borderRadius: 10, border: `1px solid ${GRID}` }}>
                        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 13, minWidth: 64 }}>{time}</span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{l.name || "—"}</span>
                        <span style={{ fontSize: 11, color: MUTED }}>score {l.score ?? "–"}</span>
                        <span style={{ fontSize: 11, color: rc, marginLeft: "auto" }}>{rl}</span>
                        {l.phone && (() => {
                          const msg = buildMessage(l);
                          return (
                            <a href={waHref(l.phone, msg?.text)} target="_blank" rel="noreferrer"
                              title={msg ? `Opens WhatsApp with the ${msg.kind} message pre-typed` : undefined}
                              style={{ fontSize: 11.5, fontWeight: 700, color: "#0f1012", background: GOOD, borderRadius: 999, padding: "4px 10px", textDecoration: "none" }}>
                              WA · {msg?.kind ?? "Chat"}
                            </a>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* charts grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10, marginBottom: 12 }}>
              <div className="chart-card" style={card}>
                <p style={cardTitle}>Leads per day</p>
                <BarChart data={agg.perDay} />
              </div>
              <div className="chart-card" style={card}>
                <p style={cardTitle}>Funnel</p>
                <Funnel stages={[
                  { label: "Leads", value: agg.total },
                  { label: "Booked", value: agg.booked },
                  { label: "Showed", value: agg.showed },
                  { label: "Closed", value: agg.closedN },
                ]} />
                <p style={{ fontSize: 10, color: MUTED, marginTop: 8 }}>Showed/Closed fill as you mark calls below</p>
              </div>
              <div className="chart-card" style={card}>
                <p style={cardTitle}>Lead source</p>
                <Donut parts={(["ig", "fb", "other"] as const).map((k) => ({
                  key: k, label: SRC_LABELS[k], value: agg.srcCount[k], color: SRC_COLORS[k],
                }))} />
              </div>
              <div className="chart-card" style={card}>
                <p style={cardTitle}>Lead quality (score)</p>
                <HBars data={agg.buckets} color={PURPLE} />
              </div>
              <div className="chart-card" style={card}>
                <p style={cardTitle}>Top ads · leads + avg quality</p>
                {agg.ads.length ? <HBars data={agg.ads} color={PURPLE} /> : <p style={{ fontSize: 12, color: MUTED }}>No ad-tagged leads in range</p>}
              </div>
              <div className="chart-card" style={card}>
                <p style={cardTitle}>Top cities</p>
                {agg.cities.length ? <HBars data={agg.cities} color={PURPLE} /> : <p style={{ fontSize: 12, color: MUTED }}>No city data in range</p>}
              </div>
            </div>

            {/* lead table */}
            <div style={{ ...card, overflowX: "auto" }}>
              <p style={cardTitle}>Latest leads — tap to act</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
                <thead>
                  <tr style={{ color: MUTED, textAlign: "left" }}>
                    {["When", "Name", "Score", "Src", "Session", "Contact", "Outcome"].map((h) => (
                      <th key={h} style={{ padding: "6px 8px", fontWeight: 600, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: `1px solid ${GRID}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inRange.slice(0, 25).map((l) => {
                    const d = new Date(l.ts);
                    const sc = l.score ?? 0;
                    const scColor = sc >= 75 ? GOOD : sc >= 60 ? WARN : MUTED;
                    return (
                      <tr key={l.row} style={{ borderBottom: `1px solid ${GRID}` }}>
                        <td style={{ padding: "8px", color: MUTED, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                          {fmtDay(d)} {d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td style={{ padding: "8px", fontWeight: 600 }}>{l.name || "—"}<br />
                          <span style={{ fontWeight: 400, fontSize: 10.5, color: MUTED }}>{l.city}</span>
                        </td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ color: scColor, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{l.score ?? "–"}</span>
                          <span style={{ fontSize: 10, color: MUTED }}> {l.tier}</span>
                        </td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, display: "inline-block", background: SRC_COLORS[l.source === "fb" || l.source === "ig" ? l.source : "other"], marginRight: 5 }} />
                          {l.source || "—"}
                        </td>
                        <td style={{ padding: "8px", whiteSpace: "nowrap", color: l.booked ? INK1 : MUTED }}>
                          {l.booked ? l.sessionDate.replace(/ \d{4}/, "") : "not booked"}
                        </td>
                        <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                          {(() => {
                            const msg = buildMessage(l);
                            if (!l.phone)
                              return msg ? (
                                <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                                  <span style={{ color: CRIT, fontSize: 11 }}>✕ no phone</span>
                                  <CopyBtn text={msg.text} />
                                </span>
                              ) : (
                                <span style={{ color: CRIT, fontSize: 11 }}>✕ no phone</span>
                              );
                            return (
                              <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                                <a href={waHref(l.phone, msg?.text)} target="_blank" rel="noreferrer"
                                  title={msg ? `Opens WhatsApp with the ${msg.kind} message pre-typed — review, then send` : "Open chat"}
                                  style={{ color: GOOD, fontWeight: 700, textDecoration: "none" }}>
                                  WA · {msg?.kind ?? "Chat"} ↗
                                </a>
                                {msg && <CopyBtn text={msg.text} />}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                          {(l.closedAmt ?? 0) > 0 ? (
                            <span style={{ color: GOOD, fontWeight: 700 }}>✓ ₹{(l.closedAmt ?? 0).toLocaleString("en-IN")}</span>
                          ) : l.showed === "Y" ? (
                            <>
                              <span style={{ color: GOOD, marginRight: 6 }}>✓ showed</span>
                              <button onClick={() => { const a = window.prompt("Closed amount (₹)?"); if (a && /^\d+$/.test(a.trim())) mark(l.row, "closed", a.trim()); }}
                                style={{ background: "transparent", border: `1px solid ${GRID}`, color: INK2, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>
                                + Closed ₹
                              </button>
                            </>
                          ) : l.showed === "N" ? (
                            <span style={{ color: CRIT }}>✕ no-show</span>
                          ) : l.booked ? (
                            <>
                              <button onClick={() => mark(l.row, "showed", "Y")}
                                style={{ background: "transparent", border: `1px solid ${GOOD}`, color: GOOD, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", marginRight: 5 }}>
                                Showed
                              </button>
                              <button onClick={() => mark(l.row, "showed", "N")}
                                style={{ background: "transparent", border: `1px solid ${GRID}`, color: MUTED, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>
                                No-show
                              </button>
                            </>
                          ) : (
                            <span style={{ color: MUTED, fontSize: 11 }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
