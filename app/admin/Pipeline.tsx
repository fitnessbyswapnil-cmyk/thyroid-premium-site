"use client";

/**
 * The PIPELINE half of /admin — one lead, one story.
 *
 * Set like a clinical case file rather than a product. The design decisions and
 * their measured contrast live in app/admin/tokens.ts; three of them shape
 * almost every component here:
 *
 *  - Stage is a SEQUENCE, so it is drawn as chevrons in one hue getting darker —
 *    a single object moving forward, not four categories. The outcomes are
 *    detached pills with different shapes, because Won/No-show/Cancelled/Lost
 *    are not further steps.
 *  - Among the outcomes only WON carries colour. A screen that scolds him every
 *    morning stops getting opened.
 *  - Clay red means exactly one thing: should have happened, didn't. Rationing
 *    it to that is what keeps the board readable.
 *
 * Rendered by app/admin/page.tsx and by /crm — one implementation, so the phone
 * and the desk can never drift.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { LIGHT, DARK, FONT, RADIUS, ELEV, stageRamp, type Tokens } from "./tokens";

export type Stage = "new" | "booked" | "attended" | "pitched" | "won" | "no_show" | "cancelled" | "lost";

/** The four ordinal steps, in order. Everything else is an outcome. */
const SEQUENCE: { id: Stage; label: string }[] = [
  { id: "new", label: "New lead" },
  { id: "booked", label: "Booked" },
  { id: "attended", label: "Attended" },
  { id: "pitched", label: "Pitched" },
];
const OUTCOMES: { id: Stage; label: string; glyph: string }[] = [
  { id: "won", label: "Won", glyph: "●" },
  { id: "no_show", label: "No-show", glyph: "◐" },
  { id: "cancelled", label: "Cancelled", glyph: "○" },
  { id: "lost", label: "Lost", glyph: "✕" },
];

const SCORE_LABELS: Record<string, string> = {
  past_spend_totalled: "Totalled her past spend before naming the price",
  range_tested: "Asked what she had tried and why it stopped",
  proof_shown_before_price: "Showed proof before the number",
  decision_maker_found: "Handled the husband objection with her, not for her",
  price_said_cleanly: "Named the price cleanly, with the guarantee",
  silence_after_ask: "Held the price in silence for ten seconds",
  total_held: "The total never went down",
  results_gate_used: "Used the results gate, not a discount",
  payment_on_screen: "Asked for payment while she was still on the call",
  ended_with_clock_time: "Set a decision date before ending the call",
};

type Check = { passed: boolean; evidence: string };
export type MilestoneState = "done" | "not_applicable" | "missing";
export type Milestone = { id: string; label: string; state: MilestoneState; value: string; note?: string };

export type Rec = {
  key: string;
  bookingUid: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  sessionStart: string;
  score: number | null;
  budget: string;
  paid: boolean;
  paidAmount: number | null;
  stage: Stage;
  nextAction: { label: string; urgency: string; reason: string };
  agreedButUnpaid: boolean;
  milestones: Milestone[];
  missing: number;
  recent: boolean;
  call: {
    attended: boolean;
    pricePitched: number | null;
    lowestPriceSaid: number | null;
    discountOffered: boolean;
    discountAt: string;
    objection: string;
    excuse: string;
    agreedCallbackAt: string;
    summary: string;
    scorecardFailed: number | null;
    scorecard: Record<string, Check> | null;
    coachTalkPct: number | null;
    fathomUrl: string;
    reviewed: boolean;
    occurredAt: string;
  } | null;
};

type Ev = { at: string; kind: string; title: string; body?: string; meta?: Record<string, string> };

const KEY_STORE = "admin_dash_key";
const rupee = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);
const initials = (n: string) =>
  (n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
};
const dayOnly = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "Undated"
    : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
};

// ── primitives ──────────────────────────────────────────────────────────────

const micro = (t: Tokens): React.CSSProperties => ({
  fontFamily: FONT.sans,
  fontSize: 11,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: t.ink3,
  fontWeight: 500,
});
const mono = (t: Tokens): React.CSSProperties => ({ fontFamily: FONT.mono, fontVariantNumeric: "tabular-nums", color: t.ink1 });

function Card({ t, children, style }: { t: Tokens; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ background: t.card, border: `1px solid ${t.hairline}`, borderRadius: RADIUS.card, boxShadow: ELEV.e1, padding: "18px 20px", ...style }}>
      {children}
    </section>
  );
}

function SectionTitle({ t, children, aside }: { t: Tokens; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
      <h3 style={{ margin: 0, fontFamily: FONT.serif, fontWeight: 500, fontSize: 22, color: t.ink1, letterSpacing: "-.01em" }}>{children}</h3>
      {aside ? <span style={{ fontFamily: FONT.sans, fontSize: 13, color: t.ink3 }}>{aside}</span> : null}
    </div>
  );
}

/** A sentence under a chart. Every chart here ends in one. */
function Conclusion({ t, children }: { t: Tokens; children: React.ReactNode }) {
  return (
    <p style={{ margin: "12px 0 0", fontFamily: FONT.sans, fontSize: 12.5, lineHeight: 1.5, color: t.ink2 }}>{children}</p>
  );
}

// ── stage: sequence vs outcome ──────────────────────────────────────────────

function StageFlow({
  t,
  counts,
  active,
  onPick,
}: {
  t: Tokens;
  counts: Record<Stage, number>;
  active: Stage | null;
  onPick: (s: Stage) => void;
}) {
  const ramp = stageRamp(t);
  return (
    <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 420px", minWidth: 300 }}>
        <div style={{ display: "flex" }}>
          {SEQUENCE.map((s, i) => {
            const on = active === s.id;
            const fill = ramp[i];
            // Counts sit UNDER the bar and names below them, so the segment
            // colour only ever has to clear 3:1 against paper — it never has to
            // carry text.
            return (
              <button
                key={s.id}
                onClick={() => onPick(s.id)}
                aria-label={`${s.label}, ${counts[s.id] ?? 0}`}
                style={{
                  flex: 1,
                  height: 30,
                  border: 0,
                  padding: 0,
                  cursor: "pointer",
                  background: fill,
                  opacity: active && !on ? 0.4 : 1,
                  transition: "opacity .16s ease",
                  // The first segment is flat on the left (nothing precedes it)
                  // and the last is flat on the right (the sequence ends there).
                  // Rounded ends would read as terminal; chevrons read as onward.
                  clipPath:
                    i === 0
                      ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
                      : i === SEQUENCE.length - 1
                        ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)"
                        : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)",
                  marginLeft: i === 0 ? 0 : -6,
                  borderRadius: i === 0 ? `${RADIUS.cell}px 0 0 ${RADIUS.cell}px` : 0,
                }}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", marginTop: 7 }}>
          {SEQUENCE.map((s, i) => (
            <div key={s.id} style={{ flex: 1, paddingLeft: i === 0 ? 2 : 10 }}>
              <div style={{ ...mono(t), fontSize: 15, color: active === s.id ? t.ink1 : t.ink2 }}>{counts[s.id] ?? 0}</div>
              <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: t.ink3, marginTop: 1 }}>
                {i + 1} · {s.label}
              </div>
            </div>
          ))}
        </div>
        <p style={{ ...micro(t), margin: "10px 0 0", fontSize: 10 }}>In progress — a sequence</p>
      </div>

      <div style={{ flex: "0 1 auto" }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {OUTCOMES.map((o) => {
            const on = active === o.id;
            const isWon = o.id === "won";
            // Only Won is coloured. The three losses are neutral by design.
            return (
              <button
                key={o.id}
                onClick={() => onPick(o.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  borderRadius: RADIUS.chip,
                  cursor: "pointer",
                  fontFamily: FONT.sans,
                  fontSize: 12,
                  background: isWon ? t.won : on ? t.sunk : "transparent",
                  color: isWon ? t.card : t.ink2,
                  border: isWon ? "none" : o.id === "no_show" ? `1px solid ${t.ink3}` : o.id === "cancelled" ? `1px dashed ${t.ink3}` : `1px solid ${t.hairline}`,
                  opacity: active && !on ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: 9 }}>{o.glyph}</span>
                {o.label} {counts[o.id] ?? 0}
              </button>
            );
          })}
        </div>
        <p style={{ ...micro(t), margin: "10px 0 0", fontSize: 10 }}>Closed — an outcome, not a step</p>
      </div>
    </div>
  );
}

// ── milestones ──────────────────────────────────────────────────────────────

/**
 * Three states, three carriers each — so they survive colourblindness and a
 * phone in sunlight. Done: a filled square marker plus the value. Missing: a
 * tint, a ring, a full boundary and a word. Not applicable: a recessed
 * half-step with one flat rule and no text at all, so it reads as "the page
 * continues" rather than "you failed".
 */
function cellStyle(t: Tokens, state: MilestoneState): React.CSSProperties {
  if (state === "missing")
    return { background: t.clayTint, border: `1px solid ${t.clay}`, color: t.clay, borderRadius: RADIUS.cell };
  if (state === "not_applicable")
    return { background: t.sunk, border: `1px solid transparent`, color: t.ink3, borderRadius: RADIUS.cell };
  return { background: t.card, border: `1px solid ${t.hairline}`, color: t.ink1, borderRadius: RADIUS.cell };
}

function MilestoneCell({ t, m }: { t: Tokens; m: Milestone }) {
  const s = cellStyle(t, m.state);
  return (
    <div
      title={m.note || `${m.label}: ${m.state.replace("_", " ")}`}
      style={{ ...s, padding: "7px 9px", minHeight: 32, display: "flex", alignItems: "center", gap: 6, fontFamily: FONT.mono, fontSize: 11.5, fontVariantNumeric: "tabular-nums", lineHeight: 1.25 }}
    >
      {m.state === "done" ? (
        <>
          <span style={{ width: 6, height: 6, background: t.ink1, flex: "none" }} />
          <span>{m.value || "done"}</span>
        </>
      ) : m.state === "missing" ? (
        <>
          <span style={{ width: 7, height: 7, borderRadius: 99, border: `1.5px solid ${t.clay}`, flex: "none" }} />
          <span>{m.value || "not done"}</span>
        </>
      ) : (
        <span style={{ color: t.ink3 }}>—</span>
      )}
    </div>
  );
}

/** Nine marks, left to right, same order as the board. */
function MilestoneStrip({ t, ms }: { t: Tokens; ms: Milestone[] }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {ms.map((m) => (
        <span
          key={m.id}
          title={`${m.label}: ${m.state === "done" ? m.value || "done" : m.state === "missing" ? "MISSING" : "nothing owed"}${m.note ? ` — ${m.note}` : ""}`}
          style={{
            width: 17,
            height: 14,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            fontSize: 9,
            fontFamily: FONT.mono,
            background: m.state === "done" ? t.ink1 : m.state === "missing" ? t.clayTint : "transparent",
            border: m.state === "missing" ? `1px solid ${t.clay}` : m.state === "not_applicable" ? `1px solid ${t.hairline}` : "none",
            color: m.state === "missing" ? t.clay : t.ink3,
          }}
        >
          {m.state === "missing" ? "!" : m.state === "not_applicable" ? "–" : ""}
        </span>
      ))}
    </div>
  );
}

function MilestoneBoard({ t, rows }: { t: Tokens; rows: Rec[] }) {
  if (!rows.length) return <p style={{ fontFamily: FONT.sans, fontSize: 13, color: t.ink3, margin: 0 }}>Nobody has moved in the last 3 days.</p>;
  const cols = rows[0].milestones;
  const totalMissing = rows.reduce((s, r) => s + r.missing, 0);

  return (
    <>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 12 }}>
        {([
          ["done", "Done — shows the value"],
          ["not_applicable", "Not applicable — nothing owed"],
          ["missing", "Missing — should have happened"],
        ] as [MilestoneState, string][]).map(([st, label]) => (
          <span key={st} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT.sans, fontSize: 11.5, color: t.ink2 }}>
            {st === "done" ? (
              <span style={{ width: 7, height: 7, background: t.ink1 }} />
            ) : st === "missing" ? (
              <span style={{ width: 8, height: 8, borderRadius: 99, border: `1.5px solid ${t.clay}` }} />
            ) : (
              <span style={{ width: 9, height: 1, background: t.ink3 }} />
            )}
            {label}
          </span>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: "4px 5px", minWidth: 900, width: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...micro(t), textAlign: "left", padding: "0 10px 6px 2px", fontSize: 10 }}>Customer</th>
              {cols.map((c, i) => (
                <th key={c.id} style={{ ...micro(t), textAlign: "left", padding: "0 4px 6px", fontSize: 10, whiteSpace: "nowrap" }}>
                  {i + 1} {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td style={{ padding: "0 10px 0 2px", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                  <div style={{ fontFamily: FONT.sans, fontSize: 13.5, fontWeight: 600, color: t.ink1 }}>{r.name || r.email || "Unknown"}</div>
                  <div style={{ fontFamily: FONT.sans, fontSize: 11, color: t.ink3 }}>
                    {[r.city, r.sessionStart ? dayOnly(r.sessionStart).toLowerCase() : ""].filter(Boolean).join(" · ")}
                  </div>
                </td>
                {r.milestones.map((m) => (
                  <td key={m.id} style={{ padding: 0 }}>
                    <MilestoneCell t={t} m={m} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Conclusion t={t}>
        {totalMissing === 0
          ? "Nothing is owed on anyone here."
          : `${totalMissing} thing${totalMissing === 1 ? "" : "s"} across ${rows.filter((r) => r.missing > 0).length} of these ${rows.length} women should have happened and hasn't.`}
      </Conclusion>
    </>
  );
}

// ── charts ──────────────────────────────────────────────────────────────────

function Funnel({ t, steps }: { t: Tokens; steps: { label: string; n: number }[] }) {
  const max = Math.max(1, steps[0]?.n ?? 1);
  let worst = { label: "", drop: 0, from: 0 };
  steps.forEach((s, i) => {
    if (i === 0) return;
    const prev = steps[i - 1];
    const drop = prev.n - s.n;
    if (drop > worst.drop) worst = { label: s.label, drop, from: prev.n };
  });

  return (
    <>
      <div style={{ display: "grid", gap: 8 }}>
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1] : null;
          const conv = prev && prev.n > 0 ? Math.round((100 * s.n) / prev.n) : null;
          return (
            <div key={s.label} style={{ display: "grid", gridTemplateColumns: "76px 1fr 34px 42px", gap: 10, alignItems: "center" }}>
              <span style={{ fontFamily: FONT.sans, fontSize: 12.5, color: t.ink2 }}>{s.label}</span>
              <div style={{ background: t.sunk, height: 14, borderRadius: 2 }}>
                <div style={{ width: `${Math.max((100 * s.n) / max, s.n > 0 ? 2 : 0)}%`, height: "100%", background: t.teal, borderRadius: 2, transition: "width .5s cubic-bezier(.16,1,.3,1)" }} />
              </div>
              <span style={{ ...mono(t), fontSize: 12.5, textAlign: "right" }}>{s.n}</span>
              <span style={{ ...mono(t), fontSize: 11, color: t.ink3, textAlign: "right" }}>{conv != null ? `${conv}%` : ""}</span>
            </div>
          );
        })}
      </div>
      <Conclusion t={t}>
        Percentages are of the step directly above, not of all leads.
        {worst.drop > 0 ? (
          <>
            {" "}Biggest single loss: <strong style={{ color: t.ink1 }}>{worst.drop} of {worst.from}</strong> never reached {worst.label.toLowerCase()}.
          </>
        ) : null}
      </Conclusion>
    </>
  );
}

function Scorecard({ t, rows }: { t: Tokens; rows: { k: string; failed: number; total: number; pct: number }[] }) {
  if (!rows.length)
    return <p style={{ fontFamily: FONT.sans, fontSize: 13, color: t.ink3, margin: 0 }}>No recorded calls ingested yet — this fills in as calls are processed.</p>;
  return (
    <>
      <div style={{ display: "grid", gap: 7 }}>
        {rows.map((r, i) => (
          <div key={r.k} style={{ display: "grid", gridTemplateColumns: "16px 1fr 92px 34px", gap: 10, alignItems: "center" }}>
            <span style={{ ...mono(t), fontSize: 11, color: t.ink3 }}>{i + 1}</span>
            <span style={{ fontFamily: FONT.sans, fontSize: 12.5, color: r.pct >= 60 ? t.ink1 : t.ink2 }}>{SCORE_LABELS[r.k] ?? r.k}</span>
            <div style={{ background: t.sunk, height: 7, borderRadius: 2 }}>
              <div style={{ width: `${r.pct}%`, height: "100%", background: r.pct >= 60 ? t.clay : t.ink1, borderRadius: 2, transition: "width .5s cubic-bezier(.16,1,.3,1)" }} />
            </div>
            <span style={{ ...mono(t), fontSize: 11, color: t.ink3, textAlign: "right" }}>{r.failed}/{r.total}</span>
          </div>
        ))}
      </div>
      <Conclusion t={t}>Ranked by failure rate across every recorded call. The top rows are the habit to fix first.</Conclusion>
    </>
  );
}

function Tile({ t, label, value, sub, bad, tone }: { t: Tokens; label: string; value: string; sub?: string; bad?: boolean; tone?: string }) {
  return (
    <div
      style={{
        background: bad ? t.amberTint : t.card,
        border: `1px solid ${bad ? t.amber + "55" : t.hairline}`,
        borderTop: bad ? `2px solid ${t.amber}` : `1px solid ${t.hairline}`,
        borderRadius: RADIUS.card,
        padding: "13px 15px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        <span style={{ ...micro(t), fontSize: 10 }}>{label}</span>
        {bad ? (
          <span style={{ fontFamily: FONT.sans, fontSize: 9.5, color: t.amber, border: `1px solid ${t.amber}66`, borderRadius: RADIUS.chip, padding: "1px 6px" }}>high is bad</span>
        ) : null}
      </div>
      <div style={{ ...mono(t), fontSize: 26, marginTop: 6, color: tone ?? t.ink1, letterSpacing: "-.02em" }}>{value}</div>
      {sub ? <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: t.ink3, marginTop: 3, lineHeight: 1.35 }}>{sub}</div> : null}
    </div>
  );
}

// ── timeline ────────────────────────────────────────────────────────────────

function Timeline({ t, events }: { t: Tokens; events: Ev[] }) {
  if (!events.length) return <p style={{ fontFamily: FONT.sans, fontSize: 13, color: t.ink3 }}>Nothing recorded yet.</p>;
  const SRC: Record<string, string> = {
    booked: "CAL.COM · BOOKING",
    cancelled: "CAL.COM · CANCELLED",
    quiz: "INTAKE FORM",
    call: "RECORDED CALL",
    payment: "PAYMENT GATEWAY",
  };
  return (
    <div>
      {events.map((e, i) => {
        const day = dayOnly(e.at);
        const newDay = i === 0 || dayOnly(events[i - 1].at) !== day;
        const isMsg = e.kind === "message_in" || e.kind === "message_out";
        const out = e.kind === "message_out";
        return (
          <div key={i}>
            {newDay ? <p style={{ ...micro(t), fontSize: 10, margin: "16px 0 8px" }}>{day}</p> : null}
            <div style={{ display: "grid", gridTemplateColumns: "62px 1fr", gap: 12, paddingBottom: 12 }}>
              <span style={{ ...mono(t), fontSize: 11, color: t.ink3, paddingTop: 2 }}>
                {new Date(e.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase()}
              </span>
              <div style={{ minWidth: 0 }}>
                {isMsg ? (
                  <div style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "82%" }}>
                      <div style={{ ...micro(t), fontSize: 9.5, marginBottom: 3, textAlign: out ? "right" : "left" }}>{out ? "You →" : "← Her"}</div>
                      <div
                        style={{
                          background: out ? t.sunk : t.card,
                          border: `1px solid ${t.hairline}`,
                          borderRadius: RADIUS.card,
                          padding: "9px 12px",
                          fontFamily: FONT.sans,
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: t.ink1,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {e.body || e.title}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ ...micro(t), fontSize: 9.5, marginBottom: 3 }}>{SRC[e.kind] ?? e.kind.toUpperCase()}</div>
                    <div style={{ fontFamily: FONT.sans, fontSize: 13, color: t.ink1, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                      {e.body || e.title}
                    </div>
                    {e.meta && Object.keys(e.meta).length ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        {Object.entries(e.meta).map(([k, v]) => {
                          const bad = k === "droppedTo" || k === "discountAt";
                          return (
                            <span key={k} style={{ fontFamily: FONT.mono, fontSize: 10.5, color: bad ? t.clay : t.ink2, border: `1px solid ${bad ? t.clay + "66" : t.hairline}`, borderRadius: RADIUS.chip, padding: "2px 8px" }}>
                              {k}: {v}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────────────

export default function Pipeline({ dark = false }: { dark?: boolean }) {
  const t: Tokens = dark ? (DARK as unknown as Tokens) : LIGHT;

  const [key, setKey] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [records, setRecords] = useState<Rec[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<Stage | null>(null);
  const [view, setView] = useState<"urgent" | "all">("urgent");
  const [timeline, setTimeline] = useState<Record<string, Ev[] | "loading">>({});

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKey(sessionStorage.getItem(KEY_STORE));
    } catch {
      setKey(null);
    }
  }, []);

  const load = useCallback(async (k: string) => {
    setErr("");
    try {
      const res = await fetch("/api/admin/crm", { headers: { "x-admin-key": k } });
      if (res.status === 401) {
        try {
          sessionStorage.removeItem(KEY_STORE);
        } catch {}
        setKey(null);
        setErr("That key was rejected.");
        return;
      }
      const json = (await res.json()) as { records: Rec[]; warnings: string[] };
      setRecords(json.records ?? []);
      setWarnings(json.warnings ?? []);
    } catch {
      setErr("Could not reach the pipeline feed.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (key) void load(key);
  }, [key, load]);

  const openLead = useCallback(
    async (r: Rec) => {
      const isOpen = open === r.key;
      setOpen(isOpen ? null : r.key);
      if (isOpen || !key || timeline[r.key]) return;
      setTimeline((x) => ({ ...x, [r.key]: "loading" }));
      const qs = r.bookingUid ? `uid=${encodeURIComponent(r.bookingUid)}` : `phone=${encodeURIComponent(r.phone)}`;
      try {
        const res = await fetch(`/api/admin/crm/timeline?${qs}`, { headers: { "x-admin-key": key } });
        const json = (await res.json()) as { events: Ev[] };
        setTimeline((x) => ({ ...x, [r.key]: json.events ?? [] }));
      } catch {
        setTimeline((x) => ({ ...x, [r.key]: [] }));
      }
    },
    [open, key, timeline],
  );

  const counts = useMemo(() => {
    const c = {} as Record<Stage, number>;
    for (const r of records ?? []) c[r.stage] = (c[r.stage] ?? 0) + 1;
    return c;
  }, [records]);

  const stats = useMemo(() => {
    const all = records ?? [];
    const won = all.filter((r) => r.stage === "won");
    const pitched = all.filter((r) => r.call?.pricePitched);
    const avgPitch = pitched.length ? Math.round(pitched.reduce((s, r) => s + (r.call!.pricePitched ?? 0), 0) / pitched.length) : null;
    const discounted = pitched.filter((r) => r.call?.discountOffered).length;
    const scored = all.filter((r) => r.call?.scorecardFailed != null);
    const avgFail = scored.length ? (scored.reduce((s, r) => s + (r.call!.scorecardFailed ?? 0), 0) / scored.length).toFixed(1) : null;
    const urgent = all.filter((r) => r.nextAction.urgency === "now" || r.agreedButUnpaid).length;
    const overdue = all.filter((r) => r.agreedButUnpaid).length;
    return {
      total: all.length,
      open: all.filter((r) => !["won", "lost"].includes(r.stage)).length,
      won: won.length,
      revenue: won.reduce((s, r) => s + (r.paidAmount ?? 0), 0),
      avgPitch,
      discounted,
      pitchedN: pitched.length,
      avgFail,
      urgent,
      overdue,
    };
  }, [records]);

  const funnel = useMemo(() => {
    const all = records ?? [];
    const has = (s: Stage[]) => all.filter((r) => s.includes(r.stage)).length;
    return [
      { label: "Leads", n: all.length },
      { label: "Booked", n: has(["booked", "attended", "pitched", "won", "no_show", "lost", "cancelled"]) },
      { label: "Attended", n: has(["attended", "pitched", "won", "lost"]) },
      { label: "Pitched", n: has(["pitched", "won", "lost"]) },
      { label: "Won", n: has(["won"]) },
    ];
  }, [records]);

  const weakest = useMemo(() => {
    const tally = new Map<string, { failed: number; total: number }>();
    for (const r of records ?? []) {
      const sc = r.call?.scorecard;
      if (!sc) continue;
      for (const [k, v] of Object.entries(sc)) {
        const e = tally.get(k) ?? { failed: 0, total: 0 };
        e.total++;
        if (!v.passed) e.failed++;
        tally.set(k, e);
      }
    }
    return [...tally.entries()]
      .map(([k, v]) => ({ k, ...v, pct: Math.round((100 * v.failed) / v.total) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [records]);

  const recent = useMemo(
    () => [...(records ?? []).filter((r) => r.recent)].sort((a, b) => b.missing - a.missing).slice(0, 12),
    [records],
  );

  const shown = useMemo(() => {
    const all = records ?? [];
    let list = stageFilter ? all.filter((r) => r.stage === stageFilter) : all;
    if (!stageFilter && view === "urgent") list = list.filter((r) => r.nextAction.urgency === "now" || r.agreedButUnpaid);
    const rank = (r: Rec) => (r.agreedButUnpaid ? 0 : r.nextAction.urgency === "now" ? 1 : r.nextAction.urgency === "today" ? 2 : 3);
    return [...list].sort((a, b) => rank(a) - rank(b) || (b.score ?? -1) - (a.score ?? -1));
  }, [records, stageFilter, view]);

  if (!key) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", padding: 24 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const k = entry.trim();
            if (!k) return;
            try {
              sessionStorage.setItem(KEY_STORE, k);
            } catch {}
            setKey(k);
          }}
          style={{ display: "grid", gap: 12, width: "min(340px,100%)" }}
        >
          <h2 style={{ margin: 0, fontFamily: FONT.serif, fontWeight: 500, fontSize: 26, color: t.ink1 }}>Practice</h2>
          <p style={{ margin: 0, fontFamily: FONT.sans, fontSize: 13, color: t.ink3 }}>Enter the admin key.</p>
          <input
            type="password"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            style={{ background: t.card, border: `1px solid ${t.hairline}`, color: t.ink1, padding: "11px 13px", borderRadius: RADIUS.card, fontSize: 15, fontFamily: FONT.sans }}
          />
          <button type="submit" style={{ background: t.ink1, color: t.card, border: 0, padding: "11px", borderRadius: RADIUS.card, fontWeight: 600, fontFamily: FONT.sans, cursor: "pointer" }}>
            Unlock
          </button>
          {err ? <p style={{ color: t.clay, fontSize: 13, margin: 0, fontFamily: FONT.sans }}>{err}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {warnings.length ? (
        <div style={{ background: t.amberTint, border: `1px solid ${t.amber}55`, borderRadius: RADIUS.card, padding: "10px 13px", fontFamily: FONT.sans, fontSize: 12.5, color: t.ink2 }}>
          {warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(158px,1fr))", gap: 10 }}>
        <Tile t={t} label="Needs you now" value={String(stats.urgent)} tone={stats.urgent ? t.clay : t.ink1} sub={stats.overdue ? `${stats.overdue} agreed but never charged` : "nothing overdue"} />
        <Tile t={t} label="In pipeline" value={String(stats.open)} sub="still open, not yet decided" />
        <Tile t={t} label="Won" value={String(stats.won)} tone={t.won} sub={stats.revenue ? `${rupee(stats.revenue)} collected` : "nothing collected yet"} />
        <Tile t={t} label="Avg price pitched" value={stats.avgPitch ? rupee(stats.avgPitch) : "—"} sub={`across ${stats.pitchedN} priced call${stats.pitchedN === 1 ? "" : "s"}`} />
        <Tile t={t} label="Discounted" value={stats.pitchedN ? `${stats.discounted}/${stats.pitchedN}` : "—"} bad={stats.discounted > 0} tone={stats.discounted ? t.amber : t.ink1} sub="calls where you came down" />
        <Tile t={t} label="Avg misses" value={stats.avgFail ? `${stats.avgFail}/10` : "—"} bad={!!stats.avgFail && parseFloat(stats.avgFail) >= 4} tone={stats.avgFail ? t.amber : t.ink1} sub="checks missed per call" />
      </div>

      <Card t={t}>
        <SectionTitle t={t} aside={stageFilter ? undefined : "click a stage to filter the list"}>
          Where everyone is
        </SectionTitle>
        {stageFilter ? (
          <button
            onClick={() => setStageFilter(null)}
            style={{ float: "right", marginTop: -46, background: "transparent", border: `1px solid ${t.hairline}`, color: t.ink2, padding: "4px 11px", borderRadius: RADIUS.chip, fontSize: 11.5, fontFamily: FONT.sans, cursor: "pointer" }}
          >
            Clear filter
          </button>
        ) : null}
        <StageFlow t={t} counts={counts} active={stageFilter} onPick={(s) => setStageFilter(stageFilter === s ? null : s)} />
      </Card>

      <Card t={t}>
        <SectionTitle t={t} aside={`${recent.length} women · hover a cell for why`}>Last 3 days</SectionTitle>
        <MilestoneBoard t={t} rows={recent} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
        <Card t={t}>
          <SectionTitle t={t}>Where they fall out</SectionTitle>
          <Funnel t={t} steps={funnel} />
        </Card>
        <Card t={t}>
          <SectionTitle t={t}>What you fail most on calls</SectionTitle>
          <Scorecard t={t} rows={weakest} />
        </Card>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", marginTop: 4 }}>
        <span style={{ ...micro(t), fontSize: 10 }}>Your people · {shown.length} shown</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {(["urgent", "all"] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setStageFilter(null);
              }}
              style={{
                background: view === v && !stageFilter ? t.ink1 : "transparent",
                color: view === v && !stageFilter ? t.card : t.ink2,
                border: `1px solid ${view === v && !stageFilter ? t.ink1 : t.hairline}`,
                padding: "5px 13px",
                borderRadius: RADIUS.chip,
                fontSize: 12,
                fontFamily: FONT.sans,
                cursor: "pointer",
              }}
            >
              {v === "urgent" ? "Needs you first" : "Everyone"}
            </button>
          ))}
          <button onClick={() => key && load(key)} style={{ background: "transparent", border: `1px solid ${t.hairline}`, color: t.ink2, padding: "5px 12px", borderRadius: RADIUS.chip, fontSize: 12, fontFamily: FONT.sans, cursor: "pointer" }}>
            Refresh
          </button>
        </span>
      </div>

      {!records ? (
        <p style={{ fontFamily: FONT.sans, color: t.ink3 }}>Loading…</p>
      ) : shown.length === 0 ? (
        <p style={{ fontFamily: FONT.sans, color: t.ink3 }}>Nothing here — try “Everyone”.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {shown.map((r) => {
            const isOpen = open === r.key;
            const severe = r.agreedButUnpaid;
            const urg = r.nextAction.urgency;
            const tl = timeline[r.key];
            const drop =
              r.call?.pricePitched && r.call?.lowestPriceSaid && r.call.lowestPriceSaid < r.call.pricePitched
                ? Math.round((100 * (r.call.pricePitched - r.call.lowestPriceSaid)) / r.call.pricePitched)
                : null;

            return (
              <article
                key={r.key}
                style={{
                  background: severe ? t.clayTint : t.card,
                  border: `1px solid ${severe ? t.clay + "77" : t.hairline}`,
                  borderRadius: RADIUS.card,
                  boxShadow: ELEV.e1,
                  overflow: "hidden",
                }}
              >
                {severe ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", borderBottom: `1px solid ${t.clay}33`, flexWrap: "wrap" }}>
                    <span style={{ background: t.clay, color: t.card, fontFamily: FONT.sans, fontSize: 9.5, fontWeight: 600, letterSpacing: ".1em", padding: "2px 7px", borderRadius: 2 }}>NOW</span>
                    <span style={{ fontFamily: FONT.sans, fontSize: 12.5, color: t.clay, fontWeight: 600 }}>Agreed · never charged</span>
                    <span style={{ fontFamily: FONT.sans, fontSize: 12.5, color: t.ink2 }}>— she said yes on the call and no payment ever arrived.</span>
                  </div>
                ) : null}

                <button onClick={() => void openLead(r)} style={{ width: "100%", textAlign: "left", background: "transparent", border: 0, padding: "14px 16px", cursor: "pointer", display: "grid", gap: 9 }}>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ flex: "1 1 380px", minWidth: 260, display: "grid", gap: 7 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        {!severe ? (
                          <span
                            style={{
                              fontFamily: FONT.sans,
                              fontSize: 9.5,
                              fontWeight: 600,
                              letterSpacing: ".1em",
                              padding: "2px 7px",
                              borderRadius: 2,
                              color: urg === "today" ? t.amber : t.ink3,
                              border: `1px solid ${urg === "today" ? t.amber : t.hairline}`,
                            }}
                          >
                            {urg === "now" ? "NOW" : urg === "today" ? "TODAY" : "SOON"}
                          </span>
                        ) : null}
                        <span style={{ width: 30, height: 30, borderRadius: 99, background: t.sunk, border: `1px solid ${t.hairline}`, color: t.ink2, display: "grid", placeItems: "center", fontSize: 11, fontFamily: FONT.sans, fontWeight: 600 }}>
                          {initials(r.name)}
                        </span>
                        <strong style={{ fontFamily: FONT.serif, fontWeight: 600, fontSize: 19, color: t.ink1, letterSpacing: "-.01em" }}>{r.name || r.email || "Unknown"}</strong>
                        <span style={{ fontFamily: FONT.sans, fontSize: 11.5, color: t.ink2, border: `1px solid ${t.hairline}`, borderRadius: RADIUS.chip, padding: "2px 9px" }}>
                          {[...SEQUENCE, ...OUTCOMES].find((s) => s.id === r.stage)?.label ?? r.stage}
                        </span>
                        {r.score != null ? <span style={{ ...mono(t), fontSize: 11, color: t.ink3 }}>score {r.score}</span> : null}
                      </div>

                      <div style={{ fontFamily: FONT.sans, fontSize: 12.5, color: t.ink2, display: "flex", gap: 14, flexWrap: "wrap" }}>
                        {r.city ? <span>{r.city}</span> : null}
                        {r.sessionStart ? <span>called {fmt(r.sessionStart)}</span> : null}
                        {r.call?.pricePitched != null ? (
                          <span style={mono(t)}>
                            pitched {rupee(r.call.pricePitched)}
                            {drop != null ? (
                              <span style={{ color: t.clay }}> ↓ {rupee(r.call.lowestPriceSaid)} (you dropped {drop}%)</span>
                            ) : null}
                          </span>
                        ) : null}
                        {r.budget ? <span>she said {r.budget}</span> : null}
                        {r.paid ? <span style={{ color: t.won, fontWeight: 600 }}>paid {rupee(r.paidAmount)}</span> : null}
                        {r.call?.scorecardFailed != null ? (
                          <span style={{ color: r.call.scorecardFailed >= 5 ? t.clay : t.ink2 }}>{r.call.scorecardFailed}/10 checks missed</span>
                        ) : null}
                      </div>

                      {r.call?.objection ? (
                        <div style={{ fontFamily: FONT.sans, fontSize: 12.5, color: t.ink2 }}>
                          <span style={{ ...micro(t), fontSize: 9.5, marginRight: 7 }}>Blocker</span>
                          {r.call.objection}
                        </div>
                      ) : null}

                      <div style={{ fontFamily: FONT.serif, fontSize: 17, color: t.ink1, marginTop: 2 }}>{r.nextAction.label}</div>
                    </div>

                    <div style={{ flex: "0 1 250px", display: "grid", gap: 6, justifyItems: "start" }}>
                      <span style={{ ...micro(t), fontSize: 9.5 }}>
                        Milestones {r.missing > 0 ? `· ${r.missing} missing` : "· nothing owed yet"}
                      </span>
                      <MilestoneStrip t={t} ms={r.milestones} />
                      {r.missing > 0 ? (
                        <span style={{ fontFamily: FONT.sans, fontSize: 11.5, color: t.ink2 }}>
                          Missing:{" "}
                          <span style={{ color: t.clay }}>{r.milestones.filter((m) => m.state === "missing").map((m) => m.label.toLowerCase()).join(", ")}</span>
                        </span>
                      ) : null}
                      <span style={{ fontFamily: FONT.sans, fontSize: 11.5, color: t.teal }}>{isOpen ? "Collapse ▴" : "Expand ▾"}</span>
                    </div>
                  </div>
                </button>

                {isOpen ? (
                  <div style={{ borderTop: `1px solid ${t.hairline}`, background: t.card }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 16px", borderBottom: `1px solid ${t.hairline}` }}>
                      {r.phone ? (
                        <a href={`https://wa.me/${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ background: t.ink1, color: t.card, border: 0, padding: "7px 15px", borderRadius: RADIUS.card, fontSize: 12.5, fontFamily: FONT.sans, textDecoration: "none", fontWeight: 500 }}>
                          WhatsApp
                        </a>
                      ) : null}
                      {r.call?.fathomUrl ? (
                        <a href={r.call.fathomUrl} target="_blank" rel="noreferrer" style={ghost(t)}>
                          Open recording
                        </a>
                      ) : null}
                      {r.email ? (
                        <a href={`mailto:${r.email}`} style={ghost(t)}>
                          Email
                        </a>
                      ) : null}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(330px,1fr))" }}>
                      <div style={{ padding: "16px 18px", borderRight: `1px solid ${t.hairline}` }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                          <h4 style={{ margin: 0, fontFamily: FONT.serif, fontWeight: 500, fontSize: 19, color: t.ink1 }}>The ten checks</h4>
                          {r.call?.scorecardFailed != null ? (
                            <span style={{ fontFamily: FONT.sans, fontSize: 12, color: t.ink3 }}>
                              {r.call.scorecardFailed} missed · {10 - r.call.scorecardFailed} held
                            </span>
                          ) : null}
                        </div>
                        {r.call?.scorecard ? (
                          <div style={{ display: "grid", gap: 0 }}>
                            {Object.entries(r.call.scorecard)
                              .sort((a, b) => Number(a[1].passed) - Number(b[1].passed))
                              .map(([k, v]) => (
                                <div key={k} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 10, padding: "9px 0", borderBottom: `1px solid ${t.hairline}` }}>
                                  <span style={{ ...micro(t), fontSize: 9.5, color: v.passed ? t.ink3 : t.clay, paddingTop: 2 }}>{v.passed ? "Held" : "Missed"}</span>
                                  <div>
                                    <div style={{ fontFamily: FONT.sans, fontSize: 13, color: v.passed ? t.ink2 : t.ink1, lineHeight: 1.4 }}>{SCORE_LABELS[k] ?? k}</div>
                                    {v.evidence ? (
                                      <div style={{ marginTop: 3, fontFamily: FONT.serif, fontStyle: "italic", fontSize: 12.5, color: t.ink2, lineHeight: 1.45 }}>{v.evidence}</div>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p style={{ fontFamily: FONT.sans, fontSize: 13, color: t.ink3 }}>No recorded call ingested for her yet.</p>
                        )}
                      </div>

                      <div style={{ padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                          <h4 style={{ margin: 0, fontFamily: FONT.serif, fontWeight: 500, fontSize: 19, color: t.ink1 }}>Her whole story</h4>
                          <span style={{ fontFamily: FONT.sans, fontSize: 11.5, color: t.ink3 }}>booking · intake · WhatsApp · call · payment</span>
                        </div>
                        {tl === "loading" ? (
                          <p style={{ fontFamily: FONT.sans, fontSize: 13, color: t.ink3 }}>Loading…</p>
                        ) : (
                          <Timeline t={t} events={(tl as Ev[]) ?? []} />
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ghost = (t: Tokens): React.CSSProperties => ({
  background: "transparent",
  border: `1px solid ${t.hairline}`,
  color: t.ink1,
  padding: "7px 15px",
  borderRadius: RADIUS.card,
  fontSize: 12.5,
  fontFamily: FONT.sans,
  textDecoration: "none",
  cursor: "pointer",
});
