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

type WaMsg = { ts: string; phone: string; direction: "in" | "out"; text: string; name: string; read: boolean };
type Thread = { phone: string; name: string; messages: WaMsg[]; lastTs: string; unread: number; windowMinutesLeft: number };

type Lead = {
  row: number;
  ts: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  adId: string;
  // booked = a call that is still going to happen. cancelled = Cal.com says the
  // booking was called off and she has not rebooked, so she is a paid lead with
  // no call on the calendar — the most urgent state in the whole dashboard.
  booked: boolean;
  cancelled: boolean;
  sessionDate: string;
  tier: string;
  city: string;
  commitment: number | null;
  amountSpent: string;
  triedBefore: string;
  challenge: string;
  budget: string;
  paid: boolean;
  paidAmount: number | null;
  score: number | null;
  showed: string;
  closedAmt: number | null;
  meetLink: string;
  msg1: string;
  msg2: string;
  msg3: string;
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
// Sent via wa.me ?text= prefill — the owner always reviews in WhatsApp before
// hitting send.
//
// SYMBOL SAFETY: two rounds tested on real sends both broke — first
// pictographic emoji (😊 💛), then a plain BMP symbol (☺) — while the
// em-dash "—" rendered fine both times. There is no reliable "safe" symbol
// class in this pipeline, so message TEXT is now plain ASCII + the em-dash
// only. Symbols/emoji are fine in the dashboard's own UI (buttons, badges)
// — they just never go into a wa.me-prefilled message again.
const SITE = "https://www.swapnilumbarkarfitness.in";
// Where an unpaid lead goes to book: the consultation is paid now, so a nudge
// must send her to the payment form, not the old free booking page.
const PAY_URL = "https://payments.cashfree.com/forms?code=thyroid-session";
// Where a lead who has ALREADY PAID goes to (re)pick a slot — she must never be
// asked to pay twice.
const REBOOK_URL = `${SITE}/session-booked`;
const SIGN = "\n\n— Swapnil Umbarkar\nACE & INFS Certified Thyroid Fat-Loss Coach";
const MANUAL_OFFER =
  "If it's easier, just reply with a day and time that works for you — I'll schedule it myself from my end.";
const REPORTS =
  "If you have recent reports (TSH, T3, T4 + iron/vit D), share them here — I review them personally before the call. No reports? Come anyway.";

function firstName(l: Lead): string {
  return (l.name.trim().split(/\s+/)[0] || "there").replace(/^./, (c) => c.toUpperCase());
}

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

// Session Date arrives from Make as "09 Aug 2026 4:00 PM" — parse it into a
// real Date so we can print "Sunday, 9 Aug at 4:00 PM" instead of the raw
// string, and so isToday()/reminders stay in sync with one parser.
function parseSessionDate(sessionDate: string): Date | null {
  const m = sessionDate.match(/^(\d{1,2}) (\w{3}) (\d{4}) (\d{1,2}):(\d{2}) ([AP]M)/);
  if (!m) return null;
  const [, d, mon, y, h, min, ap] = m;
  let hour = parseInt(h, 10) % 12;
  if (ap === "PM") hour += 12;
  const dt = new Date(`${mon} ${d}, ${y} ${String(hour).padStart(2, "0")}:${min}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function fmtFull(sessionDate: string): string {
  const d = parseSessionDate(sessionDate);
  if (!d) return sessionDate;
  const day = d.toLocaleDateString("en-IN", { weekday: "long" });
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  // en-IN's am/pm comes back lowercase in some locales — force uppercase to
  // match the raw "3:00 PM" style already used elsewhere in these messages.
  const time = d
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/am|pm/i, (m) => m.toUpperCase());
  return `${day}, ${date} at ${time}`;
}

function meetLine(l: Lead): string {
  // meetLink is auto-fetched from Cal.com's API by the dashboard route when
  // CAL_API_KEY is configured (falls back to a manually pasted sheet value,
  // then to this generic line if neither is available).
  return l.meetLink
    ? `\n\nJoin link: ${l.meetLink}`
    : "\n\nJoin link will be in your confirmation email — reply here if you don't see it.";
}

// ── proof matcher — Step 3 sends a REAL client photo picked to match this
// lead's own "Biggest Challenge" answer, so the belief built is specific to
// her, not generic. Filenames verified against /public. WhatsApp auto-
// previews a direct image URL as a thumbnail — no manual attaching needed.
const PROOF_MAP: { test: (c: string) => boolean; url: string; line: string }[] = [
  {
    test: (c) => c.includes("hair") || c.includes("skin"),
    url: `${SITE}/whatsapp-proof/Pooja-Sharma.jpeg`,
    line: "Pooja had the same hair-fall worry — her message a few weeks in:",
  },
  {
    test: (c) => c.includes("bloat") || c.includes("puffi"),
    url: `${SITE}/whatsapp-proof/Sruthi-Reddy.jpeg`,
    line: "Sruthi had the same bloating — here's what changed for her:",
  },
  {
    test: (c) => c.includes("energy") || c.includes("tired") || c.includes("exhaust"),
    url: `${SITE}/whatsapp-proof/Ritika-Deshmukh.jpeg`,
    line: "Ritika had the same exhaustion — her update:",
  },
  {
    test: (c) => c.includes("won't move") || c.includes("weight"),
    url: `${SITE}/${encodeURI("transformations/Namrata 5.png")}`,
    line: "Namrata was stuck exactly like this — 16 kg down in 90 days:",
  },
];
const DEFAULT_PROOF = {
  url: `${SITE}/#transformations-heading`,
  line: "A few real client transformations — this is what's possible:",
};

// She picks a bracket, not a number, so rank by intent: 3 = can fund the
// Rs20,000 outright. Lead score measures symptom severity — this is the column
// follow-up should actually be worked in order of.
function budgetRank(b: string): number {
  const t = (b || "").toLowerCase();
  if (t.includes("20,000 or more") || t.includes("20000 or more")) return 3;
  if (t.includes("10,000") && t.includes("20,000")) return 2;
  if (t.includes("under")) return 1;
  return 0; // "I'd want to see the plan first" — undecided, not unable
}
function budgetShort(b: string): string {
  const r = budgetRank(b);
  return r === 3 ? "₹20k+" : r === 2 ? "₹10–20k" : r === 1 ? "<₹10k" : "Plan first";
}

function pickProof(l: Lead) {
  const c = l.challenge.toLowerCase();
  return PROOF_MAP.find((p) => p.test(c)) ?? DEFAULT_PROOF;
}

// ── single-message states (not booked / showed / no-show / already a client) ──
function buildMessage(l: Lead): { kind: string; text: string } | null {
  const first = firstName(l);
  if ((l.closedAmt ?? 0) > 0) return null; // already a client — no automated message
  if (l.showed === "Y")
    return {
      kind: "Follow-up",
      text: `Hi ${first}! Great speaking with you today. As promised, your session summary and next steps are on the way. Any question at all — message me right here.${SIGN}`,
    };
  if (l.showed === "N")
    return {
      kind: "Rebook",
      text: `Hi ${first}, missed you at our call — no worries at all, life happens.\n\nYour slot is already paid for and still yours. Pick a new time in one tap: ${REBOOK_URL}\n\n${MANUAL_OFFER}${SIGN}`,
    };
  // Cancelled ≠ no-show: she actively called it off, so the message has to
  // remove any sense that she has lost the money or the slot.
  if (l.cancelled)
    return {
      kind: "Rebook",
      text: `Hi ${first}, I see your consultation call got cancelled — completely fine, things come up.\n\nYour Rs 299 slot is still paid and still reserved for you, nothing is lost. Just pick whichever new time suits you: ${REBOOK_URL}\n\n${MANUAL_OFFER}${SIGN}`,
    };
  if (l.booked) return null; // handled by the 3-step sequence below instead
  return {
    kind: "Nudge",
    text: `Hi ${first}! This is Swapnil — I received your thyroid form and read your answers personally.\n\n${painLine(l)}\n\nThe next step is your private 60-min consultation call, where I decode exactly what's blocking you. It's Rs 299 to reserve the slot, and that's adjusted against your plan if you go ahead: ${PAY_URL}\n\n${MANUAL_OFFER}\n\nI take only a few calls a week, so grab a slot while there's space.${SIGN}`,
  };
}

// Used only on the "Today's Sessions" strip — a short, urgent, same-day nudge.
function buildTodayReminder(l: Lead): string {
  const first = firstName(l);
  const time = l.sessionDate.match(/\d{1,2}:\d{2} [AP]M/)?.[0] ?? fmtFull(l.sessionDate);
  return `Hi ${first}! Reminder — your thyroid consultation call is TODAY at ${time}. Your slot is reserved.${meetLine(l)}\n\nIf you have your thyroid reports, send them here before we start. See you soon!${SIGN}`;
}

// ── the 3-step warm-up sequence — shown for BOOKED leads whose call hasn't
// happened yet (not showed/no-show/closed). Each step is a separate WhatsApp
// send with its own job: secure the slot → get her invested → install belief.
type SeqStep = { key: "msg1" | "msg2" | "msg3"; label: string; text: string; sent: boolean };

function buildSequence(l: Lead): SeqStep[] {
  const first = firstName(l);
  const full = fmtFull(l.sessionDate);
  const dayOnly = full.split(" at ")[0];
  const proof = pickProof(l);

  return [
    {
      key: "msg1",
      label: "① Confirm",
      sent: l.msg1 !== "",
      text: `Hi ${first}! Confirming your private 1-on-1 thyroid consultation — ${full}.${meetLine(l)}\n\nPlease reply YES to lock your slot.\n\n${painLine(l)}${SIGN}`,
    },
    {
      key: "msg2",
      label: "② Reports",
      sent: l.msg2 !== "",
      text: `Hi ${first}! Looking forward to our session — ${full}.\n\n${REPORTS}\n\nEven a quick photo of your last report helps me prepare properly for you.${SIGN}`,
    },
    {
      key: "msg3",
      label: "③ Proof",
      sent: l.msg3 !== "",
      text: `Hi ${first}! One more thing before we speak:\n\n${proof.line}\n${proof.url}\n\nHer starting point looked a lot like yours. See you ${dayOnly}!${SIGN}`,
    },
  ];
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

// Daily series (thin, muted) + 7-day moving average (bold purple) on ONE
// axis — same unit, so no dual-axis sin. Direct label on the latest average.
function TrendChart({ data, unit }: { data: { label: string; value: number | null }[]; unit: string }) {
  const { show, hide, node } = useTooltip();
  const W = 320, H = 110, PADX = 6, PADY = 10;
  const vals = data.map((d) => d.value).filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length < 2) return <p style={{ fontSize: 12, color: MUTED }}>Not enough days with data yet</p>;
  const max = Math.max(...vals) * 1.1 || 1;
  const x = (i: number) => PADX + (i / Math.max(1, data.length - 1)) * (W - PADX * 2);
  const y = (v: number) => H - PADY - (v / max) * (H - PADY * 2);

  // 7-day trailing average over non-null values
  const avg: (number | null)[] = data.map((_, i) => {
    const win = data.slice(Math.max(0, i - 6), i + 1).map((d) => d.value).filter((v): v is number => v !== null);
    return win.length ? win.reduce((a, b) => a + b, 0) / win.length : null;
  });
  const path = (series: (number | null)[]) => {
    let d = "", pen = false;
    series.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const lastAvgIdx = avg.map((v, i) => (v !== null ? i : -1)).filter((i) => i >= 0).pop() ?? -1;

  return (
    <div style={{ position: "relative" }}>
      {node}
      <svg viewBox={`0 0 ${W} ${H + 14}`} style={{ width: "100%", display: "block" }}>
        <line x1={PADX} x2={W - PADX} y1={H - PADY} y2={H - PADY} stroke={GRID} strokeWidth="1" />
        <path d={path(data.map((d) => d.value))} fill="none" stroke={MUTED} strokeWidth="1" opacity="0.55" />
        <path d={path(avg)} fill="none" stroke={PURPLE} strokeWidth="2" strokeLinecap="round" />
        {lastAvgIdx >= 0 && avg[lastAvgIdx] !== null && (
          <>
            <circle cx={x(lastAvgIdx)} cy={y(avg[lastAvgIdx] as number)} r="3" fill={PURPLE} />
            <text
              x={Math.min(x(lastAvgIdx), W - 4)} y={Math.max(10, y(avg[lastAvgIdx] as number) - 7)}
              textAnchor="end" fontSize="10.5" fontWeight="700" fill={INK1}
            >
              {unit}{Math.round(avg[lastAvgIdx] as number).toLocaleString("en-IN")}
            </text>
          </>
        )}
        {data.map((d, i) => (
          <rect
            key={d.label + i} x={x(i) - 4} y={0} width={8} height={H} fill="transparent"
            onMouseEnter={(e) =>
              show(e, `${d.label}: ${d.value === null ? "no spend" : unit + Math.round(d.value).toLocaleString("en-IN")}${avg[i] !== null ? ` (7d avg ${unit}${Math.round(avg[i] as number).toLocaleString("en-IN")})` : ""}`)
            }
            onMouseLeave={hide}
          />
        ))}
        <text x={PADX} y={H + 11} fontSize="9" fill={MUTED}>{data[0]?.label}</text>
        <text x={W - PADX} y={H + 11} textAnchor="end" fontSize="9" fill={MUTED}>{data[data.length - 1]?.label}</text>
      </svg>
      <p style={{ fontSize: 9.5, color: MUTED, marginTop: 2 }}>
        thin line = daily (noisy at low volume) · <span style={{ color: PURPLE, fontWeight: 700 }}>bold = 7-day average, judge this one</span>
      </p>
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

function MeetLinkEditor({
  lead,
  onSave,
}: {
  lead: Lead;
  onSave: (row: number, url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(lead.meetLink);
  if (!editing) {
    return (
      <button
        onClick={() => { setVal(lead.meetLink); setEditing(true); }}
        title={lead.meetLink ? "Edit meet link" : "Paste the Google Meet / Zoom link from Cal.com"}
        style={{ background: "transparent", border: `1px dashed ${lead.meetLink ? GRID : WARN}`, color: lead.meetLink ? MUTED : WARN, borderRadius: 6, padding: "3px 8px", fontSize: 10.5, cursor: "pointer" }}
      >
        {lead.meetLink ? "🔗 link set" : "+ meet link"}
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="meet.google.com/xxx-xxxx-xxx"
        autoFocus
        style={{ width: 150, fontSize: 10.5, background: "#0f1012", border: `1px solid ${GRID}`, borderRadius: 6, padding: "3px 6px", color: INK1 }}
      />
      <button
        onClick={() => {
          const clean = val.trim();
          const withScheme = clean && !/^https?:\/\//.test(clean) ? `https://${clean}` : clean;
          onSave(lead.row, withScheme);
          setEditing(false);
        }}
        style={{ background: PURPLE, border: "none", color: "#1a0f24", borderRadius: 6, padding: "3px 8px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
      >
        Save
      </button>
    </span>
  );
}

function SequenceButtons({
  lead,
  onSend,
}: {
  lead: Lead;
  onSend: (row: number, step: "msg1" | "msg2" | "msg3") => void;
}) {
  if (!lead.phone) return <span style={{ color: CRIT, fontSize: 11 }}>✕ no phone</span>;
  const steps = buildSequence(lead);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {steps.map((s) => (
        <a
          key={s.key}
          href={waHref(lead.phone, s.text)}
          target="_blank"
          rel="noreferrer"
          onClick={() => { if (!s.sent) onSend(lead.row, s.key); }}
          title={`Opens WhatsApp with the ${s.label} message pre-typed — review, then send`}
          style={{
            fontSize: 10.5, fontWeight: 700, textDecoration: "none", borderRadius: 999, padding: "3px 8px",
            color: s.sent ? GOOD : "#0f1012",
            background: s.sent ? "transparent" : GOOD,
            border: `1px solid ${GOOD}`,
          }}
        >
          {s.sent ? `✓ ${s.label}` : s.label}
        </a>
      ))}
    </div>
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
  const [calStatus, setCalStatus] = useState<{
    keySet: boolean; source: string; fetched: number; matched: number; cancelled: number; error: string; sample: string[];
  } | null>(null);
  const [adsData, setAdsData] = useState<{
    daily: { date: string; spend: number; impressions: number; linkClicks: number; cpm: number; frequency: number }[];
    ads: { adId: string; adName: string; spend: number; impressions: number; linkClicks: number; cpm: number; frequency: number }[];
    status: { tokenSet: boolean; tokenSource: string; ok: boolean; error: string };
  } | null>(null);
  const timer = useRef<number | null>(null);
  const adsTimer = useRef<number | null>(null);
  const [leadFilter, setLeadFilter] = useState("All");
  // WhatsApp inbox. Cloud API delivers replies to a webhook and nowhere else,
  // so without this every answer to our own messages is lost.
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const msgTimer = useRef<number | null>(null);
  // Queue items dismissed via "Done" — per day, survives refresh within the session
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("q_dismissed");
      if (raw) setDismissed(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore */ }
  }, []);
  const dismissQueueItem = (k: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(k);
      try { sessionStorage.setItem("q_dismissed", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

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
      setCalStatus(json.calStatus ?? null);
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

  // Ads data refreshes every 5 min (Meta insights lag hours anyway — no
  // point hammering the Marketing API every 60s like the sheet).
  const loadAds = useCallback(async (k: string) => {
    try {
      const res = await fetch("/api/admin/ads", { headers: { "x-admin-key": k } });
      if (res.ok) setAdsData(await res.json());
    } catch { /* header line just stays absent */ }
  }, []);
  useEffect(() => {
    if (!key) return;
    loadAds(key);
    adsTimer.current = window.setInterval(() => loadAds(key), 300000);
    return () => { if (adsTimer.current) window.clearInterval(adsTimer.current); };
  }, [key, loadAds]);

  // Polled rather than pushed: a 20s cycle is well inside the 24-hour reply
  // window and avoids standing up a socket for a handful of conversations.
  const loadMessages = useCallback(async (k: string) => {
    try {
      const res = await fetch("/api/admin/messages", { headers: { "x-admin-key": k } });
      if (res.ok) { const j = await res.json(); setThreads(j.threads ?? []); }
    } catch { /* inbox just stays as-is until the next poll */ }
  }, []);
  useEffect(() => {
    if (!key) return;
    loadMessages(key);
    msgTimer.current = window.setInterval(() => loadMessages(key), 20000);
    return () => { if (msgTimer.current) window.clearInterval(msgTimer.current); };
  }, [key, loadMessages]);

  const openConversation = useCallback(async (phone: string) => {
    setOpenThread(phone); setDraft(""); setSendError("");
    if (!key) return;
    // Optimistic: clear the badge immediately, let the server catch up.
    setThreads((prev) => prev?.map((t) => (t.phone === phone ? { ...t, unread: 0 } : t)) ?? prev);
    try {
      await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({ phone, markRead: true }),
      });
    } catch { /* badge will correct itself on the next poll */ }
  }, [key]);

  const sendReply = useCallback(async () => {
    if (!key || !openThread || !draft.trim() || sending) return;
    setSending(true); setSendError("");
    const text = draft.trim();
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({ phone: openThread, text }),
      });
      const j = await res.json();
      if (!res.ok) { setSendError(j.error || "Could not send"); }
      else { setDraft(""); await loadMessages(key); }
    } catch {
      setSendError("Network error — not sent");
    } finally {
      setSending(false);
    }
  }, [key, openThread, draft, sending, loadMessages]);

  const submitKey = (e: React.FormEvent) => {
    e.preventDefault();
    const k = input.trim();
    if (!k) return;
    try { sessionStorage.setItem(KEY_STORE, k); } catch { /* ignore */ }
    setAuthError("");
    setLeads(null);
    setKey(k);
  };

  type MarkField = "showed" | "closed" | "meetlink" | "msg1" | "msg2" | "msg3";

  // Last programme-conversion result, shown as an inline note under the table.
  const [metaSend, setMetaSend] = useState<{ row: number; status: string; keys: number } | null>(null);

  const mark = async (row: number, field: MarkField, value: string) => {
    if (!key) return;
    // Optimistic update
    setLeads((prev) =>
      prev
        ? prev.map((l) => {
            if (l.row !== row) return l;
            if (field === "showed") return { ...l, showed: value };
            if (field === "closed") return { ...l, closedAmt: parseFloat(value) || 0 };
            if (field === "meetlink") return { ...l, meetLink: value };
            return { ...l, [field]: value }; // msg1 / msg2 / msg3
          })
        : prev,
    );
    const res = await fetch("/api/admin/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ row, field, value }),
    }).catch(() => null);

    // Marking a win also reports the sale to Meta. Surface the outcome — a
    // silently failed conversion is the difference between the ad account
    // learning who becomes a client and never knowing.
    if (field === "closed" && res) {
      const json = (await res.json().catch(() => null)) as
        | { meta?: { status?: string; detail?: { matchKeys?: string[]; timestampAdjusted?: boolean } } }
        | null;
      const m = json?.meta;
      if (m) setMetaSend({ row, status: m.status ?? "error", keys: m.detail?.matchKeys?.length ?? 0 });
    }
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
    const cancelled = inRange.filter((l) => l.cancelled).length;
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

    return { total, booked, cancelled, showed, noshow, closedN: closed.length, revenue, avgScore, perDay, srcCount, buckets, ads, cities, todaySessions };
  }, [inRange, leads, days]);

  // ── Ad Performance: Meta spend joined with the sheet's lead quality ──
  const adPerf = useMemo(() => {
    if (!adsData || !adsData.status.ok || !leads) return null;
    const daily = adsData.daily;
    const leadsByDate = new Map<string, number>();
    const bookedByDate = new Map<string, number>();
    leads.forEach((l) => {
      const d = l.ts.slice(0, 10);
      leadsByDate.set(d, (leadsByDate.get(d) ?? 0) + 1);
      if (l.booked) bookedByDate.set(d, (bookedByDate.get(d) ?? 0) + 1);
    });

    // CPL per day: spend ÷ leads from OUR sheet (first-party truth, not
    // Meta's attributed count). null when no spend that day.
    const cplSeries = daily.map((d) => {
      const n = leadsByDate.get(d.date) ?? 0;
      return {
        label: new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        value: d.spend > 0 ? (n > 0 ? d.spend / n : d.spend) : null, // spend with 0 leads = CPL is "all of it"
      };
    });

    const sum = (rows: typeof daily, f: (r: (typeof daily)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
    const last7 = daily.slice(-7);
    const prev7 = daily.slice(-14, -7);
    const window7 = (rows: typeof daily) => {
      const spend = sum(rows, (r) => r.spend);
      const imps = sum(rows, (r) => r.impressions);
      const clicks = sum(rows, (r) => r.linkClicks);
      const dates = new Set(rows.map((r) => r.date));
      let nLeads = 0, nBooked = 0;
      dates.forEach((dt) => { nLeads += leadsByDate.get(dt) ?? 0; nBooked += bookedByDate.get(dt) ?? 0; });
      return {
        spend,
        cpl: nLeads > 0 ? spend / nLeads : null,
        cpb: nBooked > 0 ? spend / nBooked : null,
        ctr: imps > 0 ? (clicks / imps) * 100 : null,
        cpm: imps > 0 ? (spend / imps) * 1000 : null,
      };
    };
    const cur = window7(last7);
    const prev = window7(prev7);

    // Per-ad decision table: Meta delivery × sheet lead quality by ad id.
    const leadsByAd = new Map<string, { n: number; scoreSum: number; scoreN: number; booked: number }>();
    leads.forEach((l) => {
      if (!l.adId) return;
      const e = leadsByAd.get(l.adId) ?? { n: 0, scoreSum: 0, scoreN: 0, booked: 0 };
      e.n++;
      if (l.score !== null) { e.scoreSum += l.score; e.scoreN++; }
      if (l.booked) e.booked++;
      leadsByAd.set(l.adId, e);
    });
    const adRows = adsData.ads.map((a) => {
      const j = leadsByAd.get(a.adId) ?? { n: 0, scoreSum: 0, scoreN: 0, booked: 0 };
      const ctr = a.impressions > 0 ? (a.linkClicks / a.impressions) * 100 : 0;
      const cpl = j.n > 0 ? a.spend / j.n : null;
      const cpb = j.booked > 0 ? a.spend / j.booked : null;
      let verdict: { label: string; color: string; why: string };
      if (a.spend < 500) verdict = { label: "LEARNING", color: MUTED, why: "under Rs500 spent - too early to judge" };
      else if (j.booked > 0 && cpb !== null && cpb <= 1200) verdict = { label: "SCALE", color: GOOD, why: `booking calls at Rs${Math.round(cpb)} - raise budget 20-30%` };
      else if (j.booked === 0 && a.spend > 1500) verdict = { label: "KILL", color: CRIT, why: `Rs${Math.round(a.spend)} spent, zero bookings` };
      else if (ctr < 0.8) verdict = { label: "WATCH", color: WARN, why: `weak CTR ${ctr.toFixed(2)}% - creative not hooking` };
      else if (a.frequency > 3) verdict = { label: "WATCH", color: WARN, why: `frequency ${a.frequency.toFixed(1)} - fatigue, rotate creative` };
      else verdict = { label: "WATCH", color: WARN, why: "delivering - needs bookings to earn SCALE" };
      return {
        ...a, ctr, cpl, cpb,
        leads: j.n,
        avgScore: j.scoreN ? Math.round(j.scoreSum / j.scoreN) : null,
        booked: j.booked,
        verdict,
      };
    });

    return { cplSeries, cur, prev, adRows };
  }, [adsData, leads]);

  // ── Operator layer: action queue, speed-to-touch, money, insights ──
  const ops = useMemo(() => {
    if (!leads) return null;
    const now = Date.now();

    type QItem = { lead: Lead; label: string; kind: "Confirm" | "Nudge" | "Reports" | "Proof" | "Rebook" | "Follow-up"; urgent: boolean; due?: string };
    const queue: QItem[] = [];
    const DUE: Record<QItem["kind"], string> = {
      Confirm: "today", Nudge: "today", Reports: "before the session", Proof: "before the session", Rebook: "today", "Follow-up": "by evening",
    };
    for (const l of leads) {
      if ((l.closedAmt ?? 0) > 0) continue;
      const ageMin = (now - new Date(l.ts).getTime()) / 60000;
      const sess = parseSessionDate(l.sessionDate);
      const hrsToSession = sess ? (sess.getTime() - now) / 3600000 : null;

      // Cancellation outranks every other state: she paid, then took the call
      // off the calendar. Left alone that is a refund request or a silent
      // write-off, so it jumps the queue ahead of ordinary new-lead nudges.
      if (l.cancelled && l.showed === "") {
        queue.push({ lead: l, label: "Cancelled her call — win the slot back", kind: "Rebook", urgent: true });
        continue;
      }
      if (l.showed === "N") {
        if (ageMin < 14 * 1440) queue.push({ lead: l, label: "No-show — invite to rebook", kind: "Rebook", urgent: false });
        continue;
      }
      if (l.showed === "Y") {
        if (sess && now - sess.getTime() > 2 * 86400000 && now - sess.getTime() < 14 * 86400000)
          queue.push({ lead: l, label: "Showed but not closed — follow up", kind: "Follow-up", urgent: false });
        continue;
      }
      if (!l.msg1 && ageMin < 3 * 1440) {
        queue.push({
          lead: l,
          label: ageMin > 30 ? `Waiting ${ageMin > 120 ? Math.round(ageMin / 60) + " hr" : Math.round(ageMin) + " min"} for first message` : "New lead — send first message",
          kind: l.booked ? "Confirm" : "Nudge",
          urgent: ageMin > 30,
        });
        continue;
      }
      if (l.booked && hrsToSession !== null && hrsToSession > 0 && hrsToSession <= 24) {
        if (!l.msg2) queue.push({ lead: l, label: "Session in <24h — ask for reports", kind: "Reports", urgent: true });
        else if (!l.msg3) queue.push({ lead: l, label: "Session in <24h — send proof story", kind: "Proof", urgent: false });
      }
    }
    queue.forEach((q) => { q.due = q.urgent ? "asap" : DUE[q.kind]; });
    queue.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));

    // Speed to first touch — only leads whose msg1 stored a real timestamp
    const touches = leads
      .map((l) => {
        if (!l.msg1 || l.msg1 === "Y") return null;
        const mins = (new Date(l.msg1).getTime() - new Date(l.ts).getTime()) / 60000;
        return Number.isFinite(mins) && mins >= 0 && mins < 7 * 1440 ? mins : null;
      })
      .filter((v): v is number => v !== null);
    const avgTouchMin = touches.length ? Math.round(touches.reduce((a, b) => a + b, 0) / touches.length) : null;

    // Money — revenue over the selected range; spend matched to the same days
    const cutoff = now - days * dayMs;
    const revenue = inRange.reduce((s, l) => s + (l.closedAmt ?? 0), 0);
    const spendInRange = (adsData?.daily ?? [])
      .filter((d) => new Date(d.date + "T00:00:00").getTime() >= cutoff)
      .reduce((s, d) => s + d.spend, 0);
    const roas = revenue > 0 && spendInRange > 0 ? revenue / spendInRange : null;

    // Pipeline forecast: upcoming booked calls × close rate × avg ticket
    const upcoming = leads.filter((l) => {
      const sess = parseSessionDate(l.sessionDate);
      return l.booked && l.showed === "" && (l.closedAmt ?? 0) <= 0 && sess !== null && sess.getTime() > now;
    }).length;
    const showedAll = leads.filter((l) => l.showed === "Y").length;
    const closedAll = leads.filter((l) => (l.closedAmt ?? 0) > 0);
    const closeRate = showedAll >= 3 ? closedAll.length / showedAll : null;
    const avgTicket = closedAll.length >= 1 ? closedAll.reduce((s, l) => s + (l.closedAmt ?? 0), 0) / closedAll.length : null;
    const pipeline = closeRate !== null && avgTicket !== null ? Math.round(upcoming * closeRate * avgTicket) : null;

    // Arrivals by weekday (IST) — works from day one
    const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dowCounts = new Array(7).fill(0);
    inRange.forEach((l) => {
      const ist = new Date(new Date(l.ts).getTime() + 5.5 * 3600000);
      dowCounts[ist.getUTCDay()]++;
    });
    const arrivals = DOW.map((label, i) => ({ label, value: dowCounts[i] }));

    // Insights (gated until enough marked outcomes exist to be honest)
    const outcomes = leads.filter((l) => l.showed === "Y" || l.showed === "N").length;
    const INSIGHT_MIN = 10;
    let insights: { label: string; value: number; note?: string }[] | null = null;
    if (outcomes >= INSIGHT_MIN) {
      const bands: [string, (s: number) => boolean][] = [
        ["80+", (s) => s >= 80],
        ["65-79", (s) => s >= 65 && s < 80],
        ["50-64", (s) => s >= 50 && s < 65],
        ["<50", (s) => s < 50],
      ];
      insights = bands.map(([label, test]) => {
        const band = leads.filter((l) => l.score !== null && test(l.score) && (l.showed === "Y" || l.showed === "N"));
        const showedN = band.filter((l) => l.showed === "Y").length;
        const closedN = band.filter((l) => (l.closedAmt ?? 0) > 0).length;
        return {
          label,
          value: band.length ? Math.round((showedN / band.length) * 100) : 0,
          note: `${showedN}/${band.length} showed · ${closedN} closed`,
        };
      });
    }

    // Month-to-date revenue + linear on-pace projection (design port)
    const istNowD = new Date(now + 5.5 * 3600000);
    const monthStartIso = `${istNowD.getUTCFullYear()}-${String(istNowD.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthRevenue = leads
      .filter((l) => l.ts.startsWith(monthStartIso))
      .reduce((s, l) => s + (l.closedAmt ?? 0), 0);
    const daysInMonth = new Date(istNowD.getUTCFullYear(), istNowD.getUTCMonth() + 1, 0).getDate();
    const onPace = istNowD.getUTCDate() >= 3 && monthRevenue > 0
      ? Math.round((monthRevenue / istNowD.getUTCDate()) * daysInMonth)
      : null;

    // Funnel stage-conversion caption (design port)
    const totalR = inRange.length;
    const bookedR = inRange.filter((l) => l.booked).length;
    const showedR = inRange.filter((l) => l.showed === "Y").length;
    const closedR = inRange.filter((l) => (l.closedAmt ?? 0) > 0).length;
    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
    const stageRates = {
      lb: pct(bookedR, totalR),
      bs: pct(showedR, bookedR),
      sc: pct(closedR, showedR),
    };

    // Arrivals auto-insight: top-2 weekdays' share (design port)
    const totalArrivals = arrivals.reduce((s, a) => s + a.value, 0);
    const top2 = [...arrivals].sort((a, b) => b.value - a.value).slice(0, 2).filter((a) => a.value > 0);
    const arrivalsInsight =
      totalArrivals >= 10 && top2.length === 2
        ? `${top2[0].label} + ${top2[1].label} bring ${Math.round(((top2[0].value + top2[1].value) / totalArrivals) * 100)}% of leads — weight budget toward them`
        : null;

    return { queue: queue.slice(0, 8), avgTouchMin, revenue, spendInRange, roas, upcoming, pipeline, closeRate, avgTicket, arrivals, arrivalsInsight, outcomes, INSIGHT_MIN, insights, monthRevenue, onPace, stageRates };
  }, [leads, inRange, days, adsData]);

  const queueMessage = (item: { lead: Lead; kind: string }): { text: string; step: "msg1" | "msg2" | "msg3" | null } => {
    const seq = buildSequence(item.lead);
    if (item.kind === "Confirm") return { text: seq[0].text, step: "msg1" };
    if (item.kind === "Reports") return { text: seq[1].text, step: "msg2" };
    if (item.kind === "Proof") return { text: seq[2].text, step: "msg3" };
    const msg = buildMessage(item.lead);
    // Nudge for a not-booked lead is their first touch — record it on msg1.
    return { text: msg?.text ?? "", step: item.kind === "Nudge" ? "msg1" : null };
  };

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
            <p style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display), Georgia, serif" }}>
              {(() => { const h = new Date().getHours(); return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening"; })()}, Swapnil
              {ops && ops.monthRevenue > 0 && (
                <span style={{ marginLeft: 12, verticalAlign: "middle", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-body), Inter, sans-serif", color: PURPLE, border: `1px solid ${GRID}`, background: CARD, borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap" }}>
                  ● ₹{ops.monthRevenue.toLocaleString("en-IN")} collected this month
                </span>
              )}
            </h1>
            <p style={{ fontSize: 11, color: MUTED }}>
              {updatedAt ? `Live · updated ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Loading…"}
              {loadError && <span style={{ color: WARN }}> · ⚠ {loadError}</span>}
            </p>
            {calStatus && (
              <p style={{ fontSize: 10.5, color: calStatus.error ? WARN : calStatus.matched > 0 ? GOOD : MUTED }}>
                Cal sync:{" "}
                {calStatus.error
                  ? `⚠ ${calStatus.error}`
                  : calStatus.matched > 0 || calStatus.cancelled > 0
                  ? `✓ ${calStatus.matched} matched · ${calStatus.cancelled} cancelled (${calStatus.source}, ${calStatus.fetched} bookings)`
                  : `no upcoming bookings found (${calStatus.source})`}
                {calStatus.error && calStatus.sample.length > 0 && (
                  <span style={{ color: MUTED }}> · fields: {calStatus.sample.join(", ")}</span>
                )}
              </p>
            )}
            {adsData && (
              <p style={{ fontSize: 10.5, color: adsData.status.ok ? (adsData.status.error ? WARN : GOOD) : WARN }}>
                Ads data:{" "}
                {adsData.status.ok
                  ? adsData.status.error
                    ? `⚠ partial — ${adsData.status.error}`
                    : `✓ live from Meta (${adsData.status.tokenSource})`
                  : `⚠ ${adsData.status.error}`}
              </p>
            )}
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
            {/* ── ACTION QUEUE: what needs your hands right now ── */}
            {ops && ops.queue.filter((q) => !dismissed.has(`${q.lead.row}-${q.kind}`)).length > 0 && (
              <div style={{ ...card, marginBottom: 12, borderColor: ops.queue.some((q) => q.urgent && !dismissed.has(`${q.lead.row}-${q.kind}`)) ? WARN : GRID }}>
                <p style={cardTitle}>
                  Needs Action Now · {ops.queue.filter((q) => !dismissed.has(`${q.lead.row}-${q.kind}`)).length}
                  {ops.avgTouchMin !== null && (
                    <span style={{ float: "right", textTransform: "none", letterSpacing: 0, color: ops.avgTouchMin <= 15 ? GOOD : ops.avgTouchMin <= 60 ? WARN : CRIT }}>
                      avg first touch: {ops.avgTouchMin < 60 ? `${ops.avgTouchMin} min` : `${(ops.avgTouchMin / 60).toFixed(1)} hr`}
                    </span>
                  )}
                </p>
                <div style={{ display: "grid", gap: 6 }}>
                  {ops.queue.filter((q) => !dismissed.has(`${q.lead.row}-${q.kind}`)).map((q) => {
                    const m = queueMessage(q);
                    const dKey = `${q.lead.row}-${q.kind}`;
                    return (
                      <div key={dKey} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "7px 10px", background: "#0f1012", borderRadius: 10, borderLeft: `3px solid ${q.urgent ? CRIT : q.kind === "Follow-up" || q.kind === "Rebook" ? PURPLE : WARN}`, border: `1px solid ${q.urgent ? WARN : GRID}` }}>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: q.urgent ? CRIT : MUTED, border: `1px solid ${q.urgent ? CRIT : GRID}`, borderRadius: 5, padding: "2px 6px" }}>
                          {q.urgent ? "URGENT" : q.kind === "Follow-up" ? "CLOSE IT" : "TO DO"}
                        </span>
                        <span style={{ fontSize: 10, color: MUTED }}>{q.due}</span>
                        <span style={{ fontWeight: 700, fontSize: 12.5 }}>{q.lead.name || "(no name)"}</span>
                        <span style={{ fontSize: 11.5, color: q.urgent ? WARN : INK2 }}>{q.label}</span>
                        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 5 }}>
                          {q.lead.phone && m.text ? (
                            <a
                              href={waHref(q.lead.phone, m.text)}
                              target="_blank" rel="noreferrer"
                              onClick={() => { if (m.step) mark(q.lead.row, m.step, new Date().toISOString()); }}
                              style={{ fontSize: 11, fontWeight: 700, color: "#0f1012", background: GOOD, borderRadius: 999, padding: "4px 10px", textDecoration: "none" }}
                            >
                              WA · {q.kind}
                            </a>
                          ) : m.text ? (
                            <CopyBtn text={m.text} />
                          ) : null}
                          <button
                            onClick={() => dismissQueueItem(dKey)}
                            title="Handled outside WhatsApp — clear from queue"
                            style={{ fontSize: 11, fontWeight: 600, color: MUTED, background: "transparent", border: `1px solid ${GRID}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}
                          >
                            Done
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* stat tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 12 }}>
              {[
                { label: "Leads", v: String(agg.total), sub: `last ${range === "all" ? "all time" : range + " days"}` },
                // Cancellations are called out here rather than silently removed:
                // "6 of 43" hides the fact that 2 of them walked away.
                { label: "Booked", v: agg.total ? `${Math.round((agg.booked / agg.total) * 100)}%` : "–", sub: agg.cancelled > 0 ? `${agg.booked} live · ${agg.cancelled} cancelled` : `${agg.booked} of ${agg.total}` },
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

            {/* ── money row: revenue, ROAS, pipeline ── */}
            {ops && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
                <div style={card}>
                  <p style={cardTitle}>Revenue</p>
                  <p style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: ops.revenue > 0 ? GOOD : INK1 }}>
                    {ops.revenue > 0 ? `₹${ops.revenue.toLocaleString("en-IN")}` : "₹0"}
                  </p>
                  <p style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>
                    {ops.onPace !== null ? `on pace for ₹${ops.onPace.toLocaleString("en-IN")} this month` : "closed wins in range"}
                  </p>
                </div>
                <div style={card}>
                  <p style={cardTitle}>ROAS</p>
                  <p style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                    {ops.roas !== null ? `${ops.roas.toFixed(1)}×` : "–"}
                  </p>
                  <p style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>
                    {ops.roas !== null
                      ? `₹${Math.round(ops.spendInRange).toLocaleString("en-IN")} spend → ₹${ops.revenue.toLocaleString("en-IN")}`
                      : "unlocks with first closed win + ads data"}
                  </p>
                </div>
                <div style={card}>
                  <p style={cardTitle}>Pipeline</p>
                  <p style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                    {ops.pipeline !== null ? `₹${ops.pipeline.toLocaleString("en-IN")}` : `${ops.upcoming} calls`}
                  </p>
                  <p style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>
                    {ops.pipeline !== null
                      ? `${ops.upcoming} upcoming × ${Math.round((ops.closeRate ?? 0) * 100)}% close × avg ₹${Math.round(ops.avgTicket ?? 0).toLocaleString("en-IN")}`
                      : "expected value unlocks after 3+ marked calls"}
                  </p>
                </div>
              </div>
            )}

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
                        {l.phone && (
                          <a href={waHref(l.phone, buildTodayReminder(l))} target="_blank" rel="noreferrer"
                            title="Opens WhatsApp with today's reminder pre-typed"
                            style={{ fontSize: 11.5, fontWeight: 700, color: "#0f1012", background: GOOD, borderRadius: 999, padding: "4px 10px", textDecoration: "none" }}>
                            WA · Remind
                          </a>
                        )}
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
                {ops && ops.stageRates.lb !== null ? (
                  <p style={{ fontSize: 10, color: MUTED, marginTop: 8 }}>
                    Lead→Booked {ops.stageRates.lb}%{ops.stageRates.bs !== null ? ` · Booked→Showed ${ops.stageRates.bs}%` : ""}{ops.stageRates.sc !== null ? ` · Showed→Closed ${ops.stageRates.sc}%` : ""}
                  </p>
                ) : (
                  <p style={{ fontSize: 10, color: MUTED, marginTop: 8 }}>Showed/Closed fill as you mark calls below</p>
                )}
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
              {ops && (
                <div className="chart-card" style={card}>
                  <p style={cardTitle}>Lead arrivals by weekday</p>
                  <HBars data={ops.arrivals} color={PURPLE} />
                  <p style={{ fontSize: 9.5, color: MUTED, marginTop: 6 }}>
                    {ops.arrivalsInsight ?? "Feeds ad scheduling — heavy days deserve heavier budget"}
                  </p>
                </div>
              )}
              {ops && (
                <div className="chart-card" style={card}>
                  <p style={cardTitle}>Show-rate by lead score</p>
                  {ops.insights ? (
                    <>
                      <HBars data={ops.insights} color={PURPLE} suffix="%" />
                      <p style={{ fontSize: 9.5, color: MUTED, marginTop: 6 }}>If high scores show more, the scoring is honest — trust the tiers</p>
                    </>
                  ) : (
                    <p style={{ fontSize: 12, color: MUTED }}>
                      Unlocks at {ops.INSIGHT_MIN} marked calls — {ops.outcomes}/{ops.INSIGHT_MIN} done. Keep tapping Showed / No-show after every session.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── Ad Performance: is the money working? ── */}
            {adPerf && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 12 }}>
                  {(
                    [
                      { label: "Spend · 7d", v: `₹${Math.round(adPerf.cur.spend).toLocaleString("en-IN")}`, cur: adPerf.cur.spend, prev: adPerf.prev.spend, lowerBetter: false, neutral: true },
                      { label: "Cost / Lead · 7d", v: adPerf.cur.cpl !== null ? `₹${Math.round(adPerf.cur.cpl)}` : "–", cur: adPerf.cur.cpl, prev: adPerf.prev.cpl, lowerBetter: true },
                      { label: "Cost / Booked · 7d", v: adPerf.cur.cpb !== null ? `₹${Math.round(adPerf.cur.cpb)}` : "–", cur: adPerf.cur.cpb, prev: adPerf.prev.cpb, lowerBetter: true },
                      { label: "CTR · 7d", v: adPerf.cur.ctr !== null ? `${adPerf.cur.ctr.toFixed(2)}%` : "–", cur: adPerf.cur.ctr, prev: adPerf.prev.ctr, lowerBetter: false },
                      { label: "CPM · 7d", v: adPerf.cur.cpm !== null ? `₹${Math.round(adPerf.cur.cpm)}` : "–", cur: adPerf.cur.cpm, prev: adPerf.prev.cpm, lowerBetter: true },
                    ] as { label: string; v: string; cur: number | null; prev: number | null; lowerBetter: boolean; neutral?: boolean }[]
                  ).map((t) => {
                    let delta: React.ReactNode = <span style={{ color: MUTED }}>vs prev 7d: –</span>;
                    if (t.cur !== null && t.prev !== null && t.prev > 0) {
                      const pct = ((t.cur - t.prev) / t.prev) * 100;
                      const up = pct >= 0;
                      const good = t.neutral ? null : t.lowerBetter ? !up : up;
                      const color = good === null ? MUTED : good ? GOOD : CRIT;
                      delta = (
                        <span style={{ color }}>
                          {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% vs prev 7d
                        </span>
                      );
                    }
                    return (
                      <div key={t.label} style={card}>
                        <p style={cardTitle}>{t.label}</p>
                        <p style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{t.v}</p>
                        <p style={{ fontSize: 10, marginTop: 6 }}>{delta}</p>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10, marginBottom: 12 }}>
                  <div className="chart-card" style={card}>
                    <p style={cardTitle}>Cost per lead — 30-day trend</p>
                    <TrendChart data={adPerf.cplSeries} unit="₹" />
                  </div>
                  <div className="chart-card" style={{ ...card, overflowX: "auto" }}>
                    <p style={cardTitle}>Per-ad verdict — last 14 days · spend × lead quality</p>
                    {adPerf.adRows.length === 0 ? (
                      <p style={{ fontSize: 12, color: MUTED }}>No ads with spend in the last 14 days</p>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 460 }}>
                        <thead>
                          <tr style={{ color: MUTED, textAlign: "left" }}>
                            {["Ad", "Spend", "Leads", "CPL", "Score", "Bkd", "₹/Bkd", "Verdict"].map((h) => (
                              <th key={h} style={{ padding: "5px 6px", fontWeight: 600, fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${GRID}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {adPerf.adRows.map((a) => (
                            <tr key={a.adId} style={{ borderBottom: `1px solid ${GRID}` }} title={a.verdict.why}>
                              <td style={{ padding: "6px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${a.adName} (…${a.adId.slice(-5)}) — ${a.verdict.why}`}>
                                {a.adName || `…${a.adId.slice(-5)}`}
                              </td>
                              <td style={{ padding: "6px", fontVariantNumeric: "tabular-nums" }}>₹{Math.round(a.spend).toLocaleString("en-IN")}</td>
                              <td style={{ padding: "6px", fontVariantNumeric: "tabular-nums" }}>{a.leads}</td>
                              <td style={{ padding: "6px", fontVariantNumeric: "tabular-nums" }}>{a.cpl !== null ? `₹${Math.round(a.cpl)}` : "–"}</td>
                              <td style={{ padding: "6px", fontVariantNumeric: "tabular-nums" }}>{a.avgScore ?? "–"}</td>
                              <td style={{ padding: "6px", fontVariantNumeric: "tabular-nums" }}>{a.booked}</td>
                              <td style={{ padding: "6px", fontVariantNumeric: "tabular-nums" }}>{a.cpb !== null ? `₹${Math.round(a.cpb)}` : "–"}</td>
                              <td style={{ padding: "6px" }}>
                                <span style={{ color: a.verdict.color, fontWeight: 800, fontSize: 10.5, letterSpacing: "0.06em" }}>{a.verdict.label}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <p style={{ fontSize: 9.5, color: MUTED, marginTop: 6 }}>
                      Tap/hover a row for the reason. Judge on ₹/Booked + Score, never CPL alone.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ── WhatsApp inbox ──────────────────────────────────────────
                Cloud API has no inbox of its own; replies arrive on a webhook
                and vanish unless something catches them. Sitting it above the
                lead table is deliberate — an unanswered message is worth more
                than any chart on this page. */}
            {threads && threads.length > 0 && (
              <div style={{ ...card, marginBottom: 12, padding: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px 10px" }}>
                  <p style={{ ...cardTitle, marginBottom: 0 }}>WhatsApp inbox</p>
                  {threads.reduce((n, t) => n + t.unread, 0) > 0 && (
                    <span style={{ background: CRIT, color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "2px 8px" }}>
                      {threads.reduce((n, t) => n + t.unread, 0)} new
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: openThread ? "minmax(0,260px) minmax(0,1fr)" : "1fr", borderTop: `1px solid ${GRID}` }}>
                  {/* thread list */}
                  <div style={{ borderRight: openThread ? `1px solid ${GRID}` : "none", maxHeight: 420, overflowY: "auto" }}>
                    {threads.map((t) => {
                      const last = t.messages[t.messages.length - 1];
                      const active = openThread === t.phone;
                      const lead = leads?.find((l) => l.phone && t.phone.endsWith(l.phone.slice(-10)));
                      return (
                        <button
                          key={t.phone}
                          onClick={() => openConversation(t.phone)}
                          style={{
                            display: "block", width: "100%", textAlign: "left", padding: "11px 14px", cursor: "pointer",
                            background: active ? "rgba(168,85,247,0.10)" : "transparent",
                            border: "none", borderBottom: `1px solid ${GRID}`,
                            borderLeft: `2px solid ${active ? PURPLE : "transparent"}`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: INK1 }}>
                              {t.name || lead?.name || `+${t.phone}`}
                            </span>
                            {t.unread > 0 && <span style={{ width: 7, height: 7, borderRadius: 999, background: CRIT }} />}
                            {/* Her budget bracket, right here in the inbox. No
                                external tool could show this next to her message. */}
                            {lead?.budget && (
                              <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, color: budgetRank(lead.budget) === 3 ? GOOD : MUTED }}>
                                {budgetShort(lead.budget)}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 11, color: t.unread ? INK2 : MUTED, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {last?.direction === "out" ? "You: " : ""}{last?.text || ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* conversation */}
                  {openThread && (() => {
                    const t = threads.find((x) => x.phone === openThread);
                    if (!t) return null;
                    const lead = leads?.find((l) => l.phone && t.phone.endsWith(l.phone.slice(-10)));
                    const open = t.windowMinutesLeft > 0;
                    const hrs = Math.floor(t.windowMinutesLeft / 60);
                    return (
                      <div style={{ display: "flex", flexDirection: "column", maxHeight: 420 }}>
                        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${GRID}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t.name || lead?.name || `+${t.phone}`}</span>
                          {lead?.score != null && <span style={{ fontSize: 10.5, color: MUTED }}>score {lead.score}</span>}
                          {lead?.paid && <span style={{ fontSize: 10, fontWeight: 700, color: GOOD }}>PAID</span>}
                          <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: open ? GOOD : WARN }}>
                            {open ? `${hrs > 0 ? `${hrs}h` : `${t.windowMinutesLeft}m`} free-reply window` : "window closed"}
                          </span>
                          <button onClick={() => setOpenThread(null)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 15 }}>×</button>
                        </div>

                        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "grid", gap: 8 }}>
                          {t.messages.map((m, i) => (
                            <div key={i} style={{ justifySelf: m.direction === "out" ? "end" : "start", maxWidth: "78%" }}>
                              <div style={{
                                background: m.direction === "out" ? "rgba(168,85,247,0.16)" : CARD,
                                border: `1px solid ${m.direction === "out" ? "rgba(168,85,247,0.32)" : GRID}`,
                                borderRadius: 12, padding: "8px 11px", fontSize: 12.5, color: INK1, whiteSpace: "pre-wrap", wordBreak: "break-word",
                              }}>
                                {m.text}
                              </div>
                              <p style={{ fontSize: 9.5, color: MUTED, marginTop: 3, textAlign: m.direction === "out" ? "right" : "left" }}>
                                {new Date(m.ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div style={{ borderTop: `1px solid ${GRID}`, padding: "10px 12px" }}>
                          {open ? (
                            <>
                              <div style={{ display: "flex", gap: 8 }}>
                                <textarea
                                  value={draft}
                                  onChange={(e) => setDraft(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply(); }}
                                  placeholder="Reply… (⌘/Ctrl + Enter to send)"
                                  rows={2}
                                  style={{ flex: 1, resize: "none", background: "#0f1014", border: `1px solid ${GRID}`, borderRadius: 10, color: INK1, fontSize: 12.5, padding: "8px 10px", fontFamily: "inherit" }}
                                />
                                <button
                                  onClick={sendReply}
                                  disabled={sending || !draft.trim()}
                                  style={{ alignSelf: "stretch", padding: "0 16px", borderRadius: 10, border: "none", background: draft.trim() ? PURPLE : GRID, color: draft.trim() ? "#fff" : MUTED, fontSize: 12.5, fontWeight: 800, cursor: draft.trim() && !sending ? "pointer" : "default" }}
                                >
                                  {sending ? "…" : "Send"}
                                </button>
                              </div>
                              <p style={{ fontSize: 9.5, color: MUTED, marginTop: 6 }}>Free-form replies cost nothing inside her 24-hour window.</p>
                            </>
                          ) : (
                            <p style={{ fontSize: 11, color: WARN }}>
                              Her 24-hour window has closed — a free reply is no longer possible. Send an approved template from WhatsApp Manager, or wait for her to message again.
                            </p>
                          )}
                          {sendError && <p style={{ fontSize: 11, color: CRIT, marginTop: 6 }}>{sendError}</p>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* lead table */}
            <div style={{ ...card, overflowX: "auto" }}>
              <p style={cardTitle}>Latest leads — tap to act</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {["All", "₹20k ready", "Best 75+", "New", "Booked", "Cancelled", "No-show"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setLeadFilter(f)}
                    style={{
                      padding: "4px 11px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      background: leadFilter === f ? "#a855f7" : "transparent",
                      color: leadFilter === f ? "#fff" : INK2,
                      border: `1px solid ${leadFilter === f ? "#a855f7" : GRID}`,
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
                <thead>
                  <tr style={{ color: MUTED, textAlign: "left" }}>
                    {["When", "Name", "Score", "Budget", "Src", "Session", "Contact", "Outcome"].map((h) => (
                      <th key={h} style={{ padding: "6px 8px", fontWeight: 600, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: `1px solid ${GRID}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inRange
                    .filter((l) => {
                      // Sorting follow-up by who can actually fund the programme
                      // is the whole point of asking the budget question.
                      if (leadFilter === "₹20k ready") return budgetRank(l.budget) === 3;
                      if (leadFilter === "Best 75+") return (l.score ?? 0) >= 75;
                      // A cancelled lead has booked:false but is emphatically not
                      // "New" — she is further down the funnel than a fresh lead.
                      if (leadFilter === "New") return !l.booked && !l.cancelled && l.showed === "" && (l.closedAmt ?? 0) <= 0;
                      if (leadFilter === "Booked") return l.booked && l.showed === "";
                      if (leadFilter === "Cancelled") return l.cancelled;
                      if (leadFilter === "No-show") return l.showed === "N";
                      return true;
                    })
                    .slice(0, 25)
                    .map((l) => {
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
                        <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                          {l.budget ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: budgetRank(l.budget) === 3 ? GOOD : budgetRank(l.budget) === 2 ? WARN : MUTED }}>
                              {budgetShort(l.budget)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: MUTED }}>—</span>
                          )}
                          {l.paid && (
                            <><br /><span style={{ fontSize: 10, fontWeight: 700, color: GOOD }}>PAID{l.paidAmount ? ` ₹${l.paidAmount}` : ""}</span></>
                          )}
                        </td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, display: "inline-block", background: SRC_COLORS[l.source === "fb" || l.source === "ig" ? l.source : "other"], marginRight: 5 }} />
                          {l.source || "—"}
                        </td>
                        <td style={{ padding: "8px", whiteSpace: "nowrap", color: l.cancelled ? CRIT : l.booked ? INK1 : MUTED }}>
                          {l.cancelled ? (
                            <>
                              <span style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: "0.04em" }}>✕ CANCELLED</span>
                              {l.sessionDate && (
                                <>
                                  <br />
                                  <span style={{ fontSize: 10.5, color: MUTED, textDecoration: "line-through" }}>
                                    {l.sessionDate.replace(/ \d{4}/, "")}
                                  </span>
                                </>
                              )}
                            </>
                          ) : l.booked ? (
                            l.sessionDate.replace(/ \d{4}/, "")
                          ) : (
                            "not booked"
                          )}
                        </td>
                        <td style={{ padding: "8px", minWidth: 190 }}>
                          {l.booked && l.showed !== "Y" && l.showed !== "N" && (l.closedAmt ?? 0) <= 0 ? (
                            <div style={{ display: "grid", gap: 5 }}>
                              <SequenceButtons lead={l} onSend={(row, step) => mark(row, step, new Date().toISOString())} />
                              <MeetLinkEditor lead={l} onSave={(row, url) => mark(row, "meetlink", url)} />
                            </div>
                          ) : (
                            (() => {
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
                              if (!msg) return <span style={{ color: MUTED, fontSize: 11 }}>—</span>;
                              return (
                                <span style={{ display: "inline-flex", gap: 5, alignItems: "center", whiteSpace: "nowrap" }}>
                                  <a href={waHref(l.phone, msg.text)} target="_blank" rel="noreferrer"
                                    title={`Opens WhatsApp with the ${msg.kind} message pre-typed — review, then send`}
                                    style={{ color: GOOD, fontWeight: 700, textDecoration: "none" }}>
                                    WA · {msg.kind} ↗
                                  </a>
                                  <CopyBtn text={msg.text} />
                                </span>
                              );
                            })()
                          )}
                        </td>
                        <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                          {(l.closedAmt ?? 0) > 0 ? (
                            <>
                              <span style={{ color: GOOD, fontWeight: 700 }}>✓ ₹{(l.closedAmt ?? 0).toLocaleString("en-IN")}</span>
                              {metaSend?.row === l.row && (
                                <span
                                  title={
                                    metaSend.status === "sent"
                                      ? `Sale sent to Meta with ${metaSend.keys} match signals`
                                      : metaSend.status === "already_sent"
                                      ? "Already reported to Meta — not sent twice"
                                      : "Meta did not accept this conversion — check Vercel logs"
                                  }
                                  style={{
                                    display: "block",
                                    fontSize: 10,
                                    marginTop: 2,
                                    color:
                                      metaSend.status === "sent"
                                        ? GOOD
                                        : metaSend.status === "already_sent"
                                        ? MUTED
                                        : CRIT,
                                  }}
                                >
                                  {metaSend.status === "sent"
                                    ? `→ Meta ✓ (${metaSend.keys} signals)`
                                    : metaSend.status === "already_sent"
                                    ? "→ Meta ✓ earlier"
                                    : "→ Meta failed"}
                                </span>
                              )}
                            </>
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
