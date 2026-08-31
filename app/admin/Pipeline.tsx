"use client";

/**
 * The PIPELINE half of /admin — one lead, one story.
 *
 * Design (per the dataviz method, palette computed not eyeballed):
 *  - Stage is ORDINAL, not categorical, so the four progression stages use a
 *    single-hue purple ramp. On a dark surface the ramp ascends in lightness
 *    (dim -> bright) as the lead advances; the light->dark ramp used on the
 *    analytics tab inverts here, and its deepest step measured 2.49:1 against
 *    #17181c — invisible. These four steps are monotonic in lightness and clear
 *    3:1 (3.33 / 4.74 / 6.72 / 10.43).
 *  - Won / cancelled / no-show / lost are STATUS, never ramp steps, and every
 *    one ships with its text label so identity is never colour alone.
 *  - Every mark carries a direct label, so the stage bar needs no legend box.
 *
 * Rendered by app/admin/page.tsx (desktop command centre) and by /crm (the same
 * component on a phone) — one implementation, so the two can never drift.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

// ── surfaces & ink (shared with the analytics tab) ──────────────────────────
const BG = "#0e0e11";
const CARD = "#17181c";
const RAISED = "#1d1e23";
const GRID = "#26242c";
const INK1 = "#f4f2f7";
const INK2 = "#b9b3c4";
const MUTED = "#8a8494";

// ── ordinal ramp: progression only, ascending lightness on dark ─────────────
const RAMP = { new: "#7c5bab", booked: "#9670d8", attended: "#b48cf0", pitched: "#d4bbff" } as const;
// ── status: reserved, never reused as a series colour ───────────────────────
const STATUS = { won: "#3ddc84", cancelled: "#ff6b6b", no_show: "#fab219", lost: "#8a8494" } as const;

export type Stage = keyof typeof RAMP | keyof typeof STATUS;

const STAGE_META: { id: Stage; label: string; color: string; ordinal: boolean }[] = [
  { id: "new", label: "New lead", color: RAMP.new, ordinal: true },
  { id: "booked", label: "Booked", color: RAMP.booked, ordinal: true },
  { id: "attended", label: "Attended", color: RAMP.attended, ordinal: true },
  { id: "pitched", label: "Pitched", color: RAMP.pitched, ordinal: true },
  { id: "won", label: "Won", color: STATUS.won, ordinal: false },
  { id: "no_show", label: "No-show", color: STATUS.no_show, ordinal: false },
  { id: "cancelled", label: "Cancelled", color: STATUS.cancelled, ordinal: false },
  { id: "lost", label: "Lost", color: STATUS.lost, ordinal: false },
];
const colorOf = (s: Stage) => STAGE_META.find((m) => m.id === s)?.color ?? MUTED;
const labelOf = (s: Stage) => STAGE_META.find((m) => m.id === s)?.label ?? s;

const SCORE_LABELS: Record<string, string> = {
  past_spend_totalled: "Totalled her past spend before the price",
  range_tested: "Tested what she could invest",
  proof_shown_before_price: "Showed proof before the number",
  decision_maker_found: "Found the real decision-maker",
  price_said_cleanly: "Price said cleanly, with the guarantee",
  silence_after_ask: "After the ask, the next voice was hers",
  total_held: "The total never went down",
  results_gate_used: "Results gate, not a discount",
  payment_on_screen: "Payment on screen, on the call",
  ended_with_clock_time: "Ended with an amount and a time",
};

type Check = { passed: boolean; evidence: string };
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
  (n || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

function fmt(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}
function dayOnly(iso: string): string {
  if (!iso) return "Undated";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Undated";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// ── tiny chart primitives ───────────────────────────────────────────────────

/** Horizontal ordinal stage bar. 2px surface gaps, every segment direct-labeled. */
function StageBar({
  counts,
  onPick,
  active,
}: {
  counts: { stage: Stage; n: number }[];
  onPick: (s: Stage) => void;
  active: Stage | null;
}) {
  const total = counts.reduce((s, c) => s + c.n, 0) || 1;
  const [hover, setHover] = useState<Stage | null>(null);
  return (
    <div>
      <div style={{ display: "flex", gap: 2, height: 34, borderRadius: 7, overflow: "hidden" }}>
        {counts
          .filter((c) => c.n > 0)
          .map((c) => {
            const pct = (100 * c.n) / total;
            const on = active === c.stage || hover === c.stage;
            return (
              <button
                key={c.stage}
                onClick={() => onPick(c.stage)}
                onMouseEnter={() => setHover(c.stage)}
                onMouseLeave={() => setHover(null)}
                title={`${labelOf(c.stage)} — ${c.n} (${Math.round(pct)}%)`}
                aria-label={`${labelOf(c.stage)}, ${c.n} leads`}
                style={{
                  width: `${pct}%`,
                  minWidth: 30,
                  background: colorOf(c.stage),
                  border: 0,
                  cursor: "pointer",
                  opacity: active && active !== c.stage ? 0.38 : on ? 1 : 0.88,
                  transition: "opacity .16s ease, filter .16s ease",
                  filter: on ? "brightness(1.12)" : "none",
                  color: "#12111a",
                  fontWeight: 800,
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {c.n}
              </button>
            );
          })}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 9 }}>
        {counts
          .filter((c) => c.n > 0)
          .map((c) => (
            <span key={c.stage} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: active === c.stage ? INK1 : MUTED }}>
              <i style={{ width: 8, height: 8, borderRadius: 2, background: colorOf(c.stage), display: "inline-block" }} />
              {labelOf(c.stage)}
            </span>
          ))}
      </div>
    </div>
  );
}

/** Conversion funnel. One series, so no legend — the title names it. */
function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const max = Math.max(1, steps[0]?.n ?? 1);
  return (
    <div style={{ display: "grid", gap: 7 }}>
      {steps.map((s, i) => {
        const pct = (100 * s.n) / max;
        const prev = i > 0 ? steps[i - 1].n : null;
        const conv = prev && prev > 0 ? Math.round((100 * s.n) / prev) : null;
        return (
          <div key={s.label} style={{ display: "grid", gridTemplateColumns: "88px 1fr 64px", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 11.5, color: MUTED }}>{s.label}</span>
            <div style={{ background: GRID, borderRadius: 4, height: 16, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.max(pct, s.n > 0 ? 3 : 0)}%`,
                  height: "100%",
                  background: RAMP.attended,
                  borderRadius: "0 4px 4px 0",
                  transition: "width .5s cubic-bezier(.16,1,.3,1)",
                }}
              />
            </div>
            <span style={{ fontSize: 12.5, color: INK1, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
              {s.n}
              {conv != null ? <em style={{ color: MUTED, fontStyle: "normal", fontSize: 10.5, display: "block" }}>{conv}%</em> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Which of the ten checks fails most. Sequential magnitude → status colour by severity. */
function ScorecardBars({ rows }: { rows: { k: string; failed: number; total: number; pct: number }[] }) {
  if (!rows.length)
    return <p style={{ color: MUTED, fontSize: 12.5, margin: 0 }}>No extracted calls yet. This fills in as calls are ingested.</p>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r) => (
        <div key={r.k} style={{ display: "grid", gridTemplateColumns: "1fr 96px 58px", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: r.pct >= 60 ? INK1 : INK2 }}>{SCORE_LABELS[r.k] ?? r.k}</span>
          <div style={{ background: GRID, height: 8, borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${r.pct}%`,
                height: "100%",
                background: r.pct >= 60 ? STATUS.cancelled : r.pct >= 30 ? STATUS.no_show : STATUS.won,
                borderRadius: "0 4px 4px 0",
                transition: "width .5s cubic-bezier(.16,1,.3,1)",
              }}
            />
          </div>
          <span style={{ fontSize: 11.5, color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {r.failed}/{r.total}
          </span>
        </div>
      ))}
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${GRID}`, borderRadius: 11, padding: "13px 15px" }}>
      <p style={{ margin: 0, fontSize: 10.5, letterSpacing: ".11em", textTransform: "uppercase", color: MUTED }}>{label}</p>
      <p style={{ margin: "7px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.03em", color: tone ?? INK1, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      {sub ? <p style={{ margin: "3px 0 0", fontSize: 11.5, color: MUTED }}>{sub}</p> : null}
    </div>
  );
}

const EV_STYLE: Record<string, { dot: string; icon: string }> = {
  booked: { dot: RAMP.booked, icon: "📅" },
  cancelled: { dot: STATUS.cancelled, icon: "✕" },
  quiz: { dot: MUTED, icon: "❓" },
  message_in: { dot: RAMP.attended, icon: "←" },
  message_out: { dot: GRID, icon: "→" },
  call: { dot: RAMP.pitched, icon: "🎙" },
  payment: { dot: STATUS.won, icon: "₹" },
};

function Timeline({ events }: { events: Ev[] }) {
  if (!events.length) return <p style={{ color: MUTED, fontSize: 12.5 }}>Nothing recorded yet.</p>;
  return (
    <div style={{ display: "grid", gap: 0 }}>
      {events.map((e, i) => {
        const st = EV_STYLE[e.kind] ?? { dot: MUTED, icon: "•" };
        const day = dayOnly(e.at);
        // Derived from the previous event rather than a running variable — the
        // map body must stay pure.
        const newDay = i === 0 || dayOnly(events[i - 1].at) !== day;
        const outbound = e.kind === "message_out";
        return (
          <div key={i}>
            {newDay ? (
              <p style={{ margin: "12px 0 7px", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED }}>{day}</p>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 11, alignItems: "start", paddingBottom: 11 }}>
              <div style={{ display: "grid", justifyItems: "center", gap: 3 }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 99,
                    background: outbound ? "transparent" : st.dot + "22",
                    border: `1px solid ${st.dot}`,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 9.5,
                    color: st.dot,
                    lineHeight: 1,
                  }}
                >
                  {st.icon}
                </span>
                {i < events.length - 1 ? <span style={{ width: 1, flex: 1, minHeight: 12, background: GRID }} /> : null}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13, fontWeight: 600, color: INK1 }}>{e.title}</strong>
                  <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{fmt(e.at)}</span>
                </div>
                {e.body ? (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: INK2,
                      whiteSpace: "pre-wrap",
                      background: outbound ? "transparent" : RAISED,
                      border: outbound ? `1px dashed ${GRID}` : `1px solid ${GRID}`,
                      borderRadius: 8,
                      padding: "8px 10px",
                    }}
                  >
                    {e.body}
                  </p>
                ) : null}
                {e.meta && Object.keys(e.meta).length ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    {Object.entries(e.meta).map(([k, v]) => (
                      <span
                        key={k}
                        style={{
                          fontSize: 11,
                          color: k === "droppedTo" || k === "discountAt" ? STATUS.cancelled : INK2,
                          border: `1px solid ${k === "droppedTo" || k === "discountAt" ? STATUS.cancelled + "55" : GRID}`,
                          padding: "2px 7px",
                          borderRadius: 99,
                        }}
                      >
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── the page ────────────────────────────────────────────────────────────────

export default function Pipeline() {
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
      if (isOpen || !key) return;
      // Already fetched (or in flight) — a second open must not refetch.
      if (timeline[r.key]) return;
      setTimeline((t) => ({ ...t, [r.key]: "loading" }));
      const qs = r.bookingUid ? `uid=${encodeURIComponent(r.bookingUid)}` : `phone=${encodeURIComponent(r.phone)}`;
      try {
        const res = await fetch(`/api/admin/crm/timeline?${qs}`, { headers: { "x-admin-key": key } });
        const json = (await res.json()) as { events: Ev[] };
        setTimeline((t) => ({ ...t, [r.key]: json.events ?? [] }));
      } catch {
        setTimeline((t) => ({ ...t, [r.key]: [] }));
      }
    },
    [open, key, timeline],
  );

  const counts = useMemo(() => {
    const map = new Map<Stage, number>();
    for (const r of records ?? []) map.set(r.stage, (map.get(r.stage) ?? 0) + 1);
    return STAGE_META.map((m) => ({ stage: m.id, n: map.get(m.id) ?? 0 }));
  }, [records]);

  const stats = useMemo(() => {
    const all = records ?? [];
    const won = all.filter((r) => r.stage === "won");
    const revenue = won.reduce((s, r) => s + (r.paidAmount ?? 0), 0);
    const pitched = all.filter((r) => r.call?.pricePitched);
    const avgPitch = pitched.length ? Math.round(pitched.reduce((s, r) => s + (r.call!.pricePitched ?? 0), 0) / pitched.length) : null;
    const discounted = pitched.filter((r) => r.call?.discountOffered).length;
    const scored = all.filter((r) => r.call?.scorecardFailed != null);
    const avgFail = scored.length ? (scored.reduce((s, r) => s + (r.call!.scorecardFailed ?? 0), 0) / scored.length).toFixed(1) : null;
    const urgent = all.filter((r) => r.nextAction.urgency === "now" || r.agreedButUnpaid).length;
    return { total: all.length, won: won.length, revenue, avgPitch, discounted, pitchedN: pitched.length, avgFail, urgent };
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
      .slice(0, 5);
  }, [records]);

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
          style={{ display: "grid", gap: 12, width: "min(360px,100%)" }}
        >
          <h2 style={{ fontSize: 20, margin: 0, color: INK1 }}>Pipeline</h2>
          <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>Enter the admin key.</p>
          <input
            type="password"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            style={{ background: CARD, border: `1px solid ${GRID}`, color: INK1, padding: "11px 13px", borderRadius: 9, fontSize: 15 }}
          />
          <button type="submit" style={{ background: RAMP.pitched, color: "#1a1320", border: 0, padding: "11px", borderRadius: 9, fontWeight: 800, cursor: "pointer" }}>
            Unlock
          </button>
          {err ? <p style={{ color: STATUS.cancelled, fontSize: 13, margin: 0 }}>{err}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {warnings.length ? (
        <div style={{ background: "#2a1d0d", border: `1px solid ${STATUS.no_show}55`, borderRadius: 9, padding: "10px 12px", fontSize: 12.5, color: "#f0d9a8" }}>
          {warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      ) : null}

      {/* ── stat tiles ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <Tile label="Needs you now" value={String(stats.urgent)} tone={stats.urgent ? STATUS.cancelled : INK1} sub="urgent or unpaid" />
        <Tile label="In pipeline" value={String(stats.total)} sub="all leads" />
        <Tile label="Won" value={String(stats.won)} tone={STATUS.won} sub={stats.revenue ? rupee(stats.revenue) : "no revenue yet"} />
        <Tile label="Avg pitch" value={stats.avgPitch ? rupee(stats.avgPitch) : "—"} sub={`${stats.pitchedN} priced calls`} />
        <Tile
          label="Discounted"
          value={stats.pitchedN ? `${stats.discounted}/${stats.pitchedN}` : "—"}
          tone={stats.discounted ? STATUS.cancelled : INK1}
          sub="calls where you came down"
        />
        <Tile label="Avg misses" value={stats.avgFail ? `${stats.avgFail}/10` : "—"} tone={STATUS.no_show} sub="scorecard failures" />
      </div>

      {/* ── stage bar ── */}
      <section style={{ background: CARD, border: `1px solid ${GRID}`, borderRadius: 12, padding: "15px 17px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 13.5, color: INK1, fontWeight: 700 }}>Stages</h3>
          <span style={{ fontSize: 11.5, color: MUTED }}>tap a band to filter</span>
          {stageFilter ? (
            <button
              onClick={() => setStageFilter(null)}
              style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${GRID}`, color: INK2, padding: "4px 10px", borderRadius: 99, fontSize: 11.5, cursor: "pointer" }}
            >
              Clear · {labelOf(stageFilter)}
            </button>
          ) : null}
        </div>
        <StageBar counts={counts} active={stageFilter} onPick={(s) => setStageFilter(stageFilter === s ? null : s)} />
      </section>

      {/* ── funnel + scorecard ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 10 }}>
        <section style={{ background: CARD, border: `1px solid ${GRID}`, borderRadius: 12, padding: "15px 17px" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 13.5, color: INK1, fontWeight: 700 }}>Conversion</h3>
          <Funnel steps={funnel} />
        </section>
        <section style={{ background: CARD, border: `1px solid ${GRID}`, borderRadius: 12, padding: "15px 17px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 13.5, color: INK1, fontWeight: 700 }}>What you fail most on calls</h3>
          <p style={{ margin: "0 0 12px", fontSize: 11.5, color: MUTED }}>across every extracted call</p>
          <ScorecardBars rows={weakest} />
        </section>
      </div>

      {/* ── list ── */}
      <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
        {(["urgent", "all"] as const).map((v) => (
          <button
            key={v}
            onClick={() => {
              setView(v);
              setStageFilter(null);
            }}
            style={{
              background: view === v && !stageFilter ? RAMP.pitched + "22" : "transparent",
              border: `1px solid ${view === v && !stageFilter ? RAMP.pitched + "88" : GRID}`,
              color: view === v && !stageFilter ? INK1 : MUTED,
              padding: "6px 13px",
              borderRadius: 99,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {v === "urgent" ? "Needs you now" : "Everyone"}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: MUTED }}>{shown.length} shown</span>
        <button
          onClick={() => key && load(key)}
          style={{ background: "transparent", border: `1px solid ${GRID}`, color: INK2, padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      {!records ? (
        <p style={{ color: MUTED }}>Loading…</p>
      ) : shown.length === 0 ? (
        <p style={{ color: MUTED }}>Nothing here — try “Everyone”.</p>
      ) : (
        <div style={{ display: "grid", gap: 9 }}>
          {shown.map((r) => {
            const isOpen = open === r.key;
            const c = colorOf(r.stage);
            const tl = timeline[r.key];
            return (
              <article
                key={r.key}
                style={{
                  background: CARD,
                  // Longhand on all four sides: mixing the `border` shorthand
                  // with `borderLeft` makes React warn and mis-apply the rail
                  // colour on rerender.
                  borderTop: `1px solid ${isOpen ? c + "66" : GRID}`,
                  borderRight: `1px solid ${isOpen ? c + "66" : GRID}`,
                  borderBottom: `1px solid ${isOpen ? c + "66" : GRID}`,
                  borderLeft: `3px solid ${c}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  transition: "border-color .16s ease",
                }}
              >
                <button
                  onClick={() => void openLead(r)}
                  style={{ width: "100%", textAlign: "left", background: "transparent", border: 0, padding: "13px 15px", cursor: "pointer", display: "grid", gap: 8 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 99,
                        background: c + "22",
                        border: `1px solid ${c}66`,
                        color: c,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 800,
                        flex: "none",
                      }}
                    >
                      {initials(r.name)}
                    </span>
                    <strong style={{ fontSize: 15.5, color: INK1, letterSpacing: "-.01em" }}>{r.name || r.email || "Unknown"}</strong>
                    <span style={{ fontSize: 11, color: c, border: `1px solid ${c}55`, padding: "2px 8px", borderRadius: 99 }}>{labelOf(r.stage)}</span>
                    {r.score != null ? <span style={{ fontSize: 11, color: MUTED }}>score {r.score}</span> : null}
                    {r.city ? <span style={{ fontSize: 11, color: MUTED }}>{r.city}</span> : null}
                    {r.agreedButUnpaid ? (
                      <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, color: STATUS.cancelled, border: `1px solid ${STATUS.cancelled}66`, padding: "3px 9px", borderRadius: 99 }}>
                        AGREED · NEVER CHARGED
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: INK2 }}>
                    {r.sessionStart ? <span>{fmt(r.sessionStart)}</span> : null}
                    {r.call?.pricePitched != null ? (
                      <span>
                        pitched <b style={{ color: INK1 }}>{rupee(r.call.pricePitched)}</b>
                        {r.call.discountOffered && r.call.lowestPriceSaid != null && r.call.lowestPriceSaid < r.call.pricePitched ? (
                          <b style={{ color: STATUS.cancelled }}> → {rupee(r.call.lowestPriceSaid)}</b>
                        ) : null}
                      </span>
                    ) : null}
                    {r.budget ? <span style={{ color: MUTED }}>said: {r.budget}</span> : null}
                    {r.paid ? <span style={{ color: STATUS.won }}>paid {rupee(r.paidAmount)}</span> : null}
                    {r.call?.scorecardFailed != null ? (
                      <span style={{ color: r.call.scorecardFailed >= 5 ? STATUS.cancelled : STATUS.no_show }}>{r.call.scorecardFailed}/10 missed</span>
                    ) : null}
                  </div>

                  {r.call?.objection ? <div style={{ fontSize: 12.5, color: INK2 }}>blocker: {r.call.objection}</div> : null}

                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span
                      style={{
                        fontSize: 10,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        color: r.nextAction.urgency === "now" ? STATUS.cancelled : r.nextAction.urgency === "today" ? STATUS.no_show : MUTED,
                      }}
                    >
                      {r.nextAction.urgency === "none" ? "next" : r.nextAction.urgency}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: INK1 }}>{r.nextAction.label}</span>
                  </div>
                </button>

                {isOpen ? (
                  <div style={{ borderTop: `1px solid ${GRID}`, padding: "14px 15px", display: "grid", gap: 13 }}>
                    <p style={{ margin: 0, fontSize: 13, color: INK2, lineHeight: 1.5 }}>{r.nextAction.reason}</p>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {r.phone ? (
                        <a href={`https://wa.me/${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={btn}>
                          WhatsApp
                        </a>
                      ) : null}
                      {r.call?.fathomUrl ? (
                        <a href={r.call.fathomUrl} target="_blank" rel="noreferrer" style={btn}>
                          Recording
                        </a>
                      ) : null}
                      {r.email ? (
                        <a href={`mailto:${r.email}`} style={btn}>
                          Email
                        </a>
                      ) : null}
                    </div>

                    {r.call?.scorecard ? (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: 10.5, letterSpacing: ".11em", textTransform: "uppercase", color: MUTED }}>The ten checks</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: "5px 16px" }}>
                          {Object.entries(r.call.scorecard).map(([k, v]) => (
                            <div key={k} style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 8, fontSize: 12.5 }}>
                              <span style={{ color: v.passed ? STATUS.won : STATUS.cancelled, fontWeight: 800 }}>{v.passed ? "✓" : "✕"}</span>
                              <span style={{ color: v.passed ? MUTED : INK1 }}>
                                {SCORE_LABELS[k] ?? k}
                                {!v.passed && v.evidence ? <em style={{ display: "block", color: MUTED, fontStyle: "normal", fontSize: 11.5, marginTop: 2 }}>{v.evidence}</em> : null}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: 10.5, letterSpacing: ".11em", textTransform: "uppercase", color: MUTED }}>Her whole story</p>
                      {tl === "loading" ? <p style={{ color: MUTED, fontSize: 12.5 }}>Loading…</p> : <Timeline events={(tl as Ev[]) ?? []} />}
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

const btn: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${GRID}`,
  color: INK2,
  padding: "6px 13px",
  borderRadius: 8,
  fontSize: 12,
  textDecoration: "none",
  cursor: "pointer",
};

export { BG };
