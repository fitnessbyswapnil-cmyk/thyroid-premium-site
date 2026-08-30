"use client";

/**
 * /crm — the pipeline. Every stage on this page is derived, never typed.
 *
 * Deliberately a separate route from /admin. That page answers "how is the
 * funnel doing"; this one answers "what do I do next, for this woman". Mixing
 * them would bury the second question inside 120KB of charts.
 *
 * The one editable thing here is a correction: if the extraction got a price or
 * an objection wrong, fixing it stamps the row Reviewed, which permanently
 * protects it from being overwritten by a later re-extraction.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

const INK1 = "#f4f2f7";
const INK2 = "#b9b3c4";
const MUTED = "#8a8494";
const GRID = "#26242c";
const CARD = "#17181c";
const BG = "#0e0e11";
const PURPLE = "#c793ff";
const GOOD = "#0ca30c";
const WARN = "#fab219";
const CRIT = "#d03b3b";
const KEY_STORE = "admin_dash_key";

type Stage = "new" | "booked" | "cancelled" | "no_show" | "attended" | "pitched" | "won" | "lost";

const STAGES: { id: Stage; label: string; tone: string }[] = [
  { id: "new", label: "New lead", tone: MUTED },
  { id: "booked", label: "Booked", tone: "#3987e5" },
  { id: "cancelled", label: "Cancelled", tone: CRIT },
  { id: "no_show", label: "No-show", tone: WARN },
  { id: "attended", label: "Attended", tone: PURPLE },
  { id: "pitched", label: "Pitched", tone: "#a855f7" },
  { id: "won", label: "Won", tone: GOOD },
  { id: "lost", label: "Lost", tone: "#5c5866" },
];

type Check = { passed: boolean; evidence: string };

type Rec = {
  key: string;
  bookingUid: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  sessionStart: string;
  score: number | null;
  answered: number;
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

const SCORE_LABELS: Record<string, string> = {
  past_spend_totalled: "Totalled her past spend before the price",
  range_tested: "Tested what she could invest",
  proof_shown_before_price: "Showed proof on screen before the number",
  decision_maker_found: "Found the real decision-maker",
  price_said_cleanly: "Price said cleanly, with the guarantee",
  silence_after_ask: "After the ask, the next voice was hers",
  total_held: "The total never went down",
  results_gate_used: "Used the results gate, not a discount",
  payment_on_screen: "Payment on screen while she was on the call",
  ended_with_clock_time: "Ended with an amount and a clock time",
};

const rupee = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function CrmPage() {
  const [key, setKey] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [records, setRecords] = useState<Rec[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<Stage | "all" | "urgent">("urgent");
  const [saving, setSaving] = useState(false);

  // sessionStorage is client-only, so the key cannot be read during render on a
  // prerendered route — one deliberate post-mount tick to hydrate the gate.
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

  // Fetch when the key arrives or changes. load() is async, so every setState it
  // performs already lands in a later microtask, not synchronously in the effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (key) void load(key);
  }, [key, load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of records ?? []) c[r.stage] = (c[r.stage] ?? 0) + 1;
    return c;
  }, [records]);

  const shown = useMemo(() => {
    const all = records ?? [];
    const list =
      filter === "all"
        ? all
        : filter === "urgent"
          ? all.filter((r) => r.nextAction.urgency === "now" || r.agreedButUnpaid)
          : all.filter((r) => r.stage === filter);
    const rank = (r: Rec) => (r.agreedButUnpaid ? 0 : r.nextAction.urgency === "now" ? 1 : r.nextAction.urgency === "today" ? 2 : 3);
    return [...list].sort((a, b) => rank(a) - rank(b) || (b.score ?? -1) - (a.score ?? -1));
  }, [records, filter]);

  /** Coaching signal across every extracted call: which check fails most. */
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
      .filter(([, v]) => v.total > 0)
      .map(([k, v]) => ({ k, ...v, pct: Math.round((100 * v.failed) / v.total) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  }, [records]);

  async function correct(uid: string, fields: Record<string, string>) {
    if (!key) return;
    setSaving(true);
    try {
      await fetch("/api/admin/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({ bookingUid: uid, fields }),
      });
      await load(key);
    } finally {
      setSaving(false);
    }
  }

  if (!key) {
    return (
      <main style={{ background: BG, minHeight: "100vh", color: INK1, display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
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
          style={{ display: "grid", gap: 12, width: "min(360px, 100%)" }}
        >
          <h1 style={{ fontSize: 22, margin: 0, letterSpacing: "-0.02em" }}>Pipeline</h1>
          <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>Enter the admin key.</p>
          <input
            type="password"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            autoFocus
            style={{ background: CARD, border: `1px solid ${GRID}`, color: INK1, padding: "11px 13px", borderRadius: 9, fontSize: 15 }}
          />
          <button type="submit" style={{ background: PURPLE, color: "#1a1320", border: 0, padding: "11px 13px", borderRadius: 9, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Unlock
          </button>
          {err ? <p style={{ color: CRIT, fontSize: 13, margin: 0 }}>{err}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main style={{ background: BG, minHeight: "100vh", color: INK1, fontFamily: "system-ui, sans-serif", padding: "18px 14px 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <h1 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.03em" }}>Pipeline</h1>
          <span style={{ color: MUTED, fontSize: 12 }}>{records ? `${records.length} people` : "loading…"}</span>
          <button onClick={() => key && load(key)} style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${GRID}`, color: INK2, padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
            Refresh
          </button>
        </header>

        {warnings.length ? (
          <div style={{ background: "#2a1d0d", border: `1px solid ${WARN}55`, borderRadius: 9, padding: "10px 12px", marginBottom: 12, fontSize: 12.5, color: "#f0d9a8" }}>
            {warnings.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
        ) : null}

        {weakest.length ? (
          <section style={{ background: CARD, border: `1px solid ${GRID}`, borderRadius: 11, padding: "14px 16px", marginBottom: 14 }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED }}>
              What you fail most, across every recorded call
            </p>
            {weakest.map((w) => (
              <div key={w.k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                <div style={{ flex: 1, fontSize: 13.5 }}>{SCORE_LABELS[w.k] ?? w.k}</div>
                <div style={{ width: 110, height: 6, background: GRID, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${w.pct}%`, height: "100%", background: w.pct >= 60 ? CRIT : w.pct >= 30 ? WARN : GOOD }} />
                </div>
                <div style={{ width: 74, textAlign: "right", fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {w.failed}/{w.total} failed
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <nav style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
          {([{ id: "urgent", label: "Needs you now" }, { id: "all", label: "Everyone" }] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              style={chip(filter === t.id, PURPLE)}
            >
              {t.label}
            </button>
          ))}
          {STAGES.map((s) => (
            <button key={s.id} onClick={() => setFilter(s.id)} style={chip(filter === s.id, s.tone)}>
              {s.label} <span style={{ opacity: 0.6 }}>{counts[s.id] ?? 0}</span>
            </button>
          ))}
        </nav>

        {!records ? (
          <p style={{ color: MUTED }}>Loading…</p>
        ) : shown.length === 0 ? (
          <p style={{ color: MUTED }}>Nothing here.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {shown.map((r) => {
              const stage = STAGES.find((s) => s.id === r.stage)!;
              const isOpen = open === r.key;
              return (
                <article key={r.key} style={{ background: CARD, border: `1px solid ${isOpen ? stage.tone + "66" : GRID}`, borderRadius: 12, overflow: "hidden" }}>
                  <button
                    onClick={() => setOpen(isOpen ? null : r.key)}
                    style={{ width: "100%", textAlign: "left", background: "transparent", border: 0, color: INK1, padding: "13px 15px", cursor: "pointer", display: "grid", gap: 7 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: stage.tone, flex: "none" }} />
                      <strong style={{ fontSize: 16, letterSpacing: "-0.01em" }}>{r.name || r.email || "Unknown"}</strong>
                      <span style={{ fontSize: 11, color: MUTED, border: `1px solid ${GRID}`, padding: "2px 7px", borderRadius: 99 }}>{stage.label}</span>
                      {r.score != null ? <span style={{ fontSize: 11, color: PURPLE }}>score {r.score}</span> : null}
                      {r.city ? <span style={{ fontSize: 11, color: MUTED }}>{r.city}</span> : null}
                      {r.agreedButUnpaid ? (
                        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: CRIT, border: `1px solid ${CRIT}66`, padding: "2px 8px", borderRadius: 99 }}>
                          agreed · never charged
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: INK2 }}>
                      {r.sessionStart ? <span>{fmtDate(r.sessionStart)}</span> : null}
                      {r.call?.pricePitched != null ? (
                        <span>
                          pitched <b style={{ color: INK1 }}>{rupee(r.call.pricePitched)}</b>
                          {r.call.discountOffered && r.call.lowestPriceSaid != null && r.call.lowestPriceSaid < r.call.pricePitched ? (
                            <b style={{ color: CRIT }}> → {rupee(r.call.lowestPriceSaid)}</b>
                          ) : null}
                        </span>
                      ) : null}
                      {r.budget ? <span style={{ color: MUTED }}>said: {r.budget}</span> : null}
                      {r.paid ? <span style={{ color: GOOD }}>paid {rupee(r.paidAmount)}</span> : null}
                      {r.call?.scorecardFailed != null ? (
                        <span style={{ color: r.call.scorecardFailed >= 5 ? CRIT : WARN }}>{r.call.scorecardFailed}/10 missed</span>
                      ) : null}
                    </div>

                    {r.call?.objection ? <div style={{ fontSize: 12.5, color: INK2 }}>blocker: {r.call.objection}</div> : null}

                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: urgencyColor(r.nextAction.urgency) }}>
                        {r.nextAction.urgency === "none" ? "next" : r.nextAction.urgency}
                      </span>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.nextAction.label}</span>
                    </div>
                  </button>

                  {isOpen ? (
                    <div style={{ borderTop: `1px solid ${GRID}`, padding: "14px 15px", display: "grid", gap: 12 }}>
                      <p style={{ margin: 0, fontSize: 13, color: INK2, lineHeight: 1.5 }}>{r.nextAction.reason}</p>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {r.phone ? (
                          <a href={`https://wa.me/${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={linkBtn}>
                            WhatsApp
                          </a>
                        ) : null}
                        {r.call?.fathomUrl ? (
                          <a href={r.call.fathomUrl} target="_blank" rel="noreferrer" style={linkBtn}>
                            Recording
                          </a>
                        ) : null}
                      </div>

                      {r.call ? (
                        <>
                          {r.call.summary ? (
                            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{r.call.summary}</p>
                          ) : null}

                          <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 14px", margin: 0, fontSize: 13 }}>
                            {r.call.excuse ? (
                              <>
                                <dt style={dt}>She said</dt>
                                <dd style={dd}>{r.call.excuse}</dd>
                              </>
                            ) : null}
                            {r.call.discountOffered ? (
                              <>
                                <dt style={dt}>Discount</dt>
                                <dd style={{ ...dd, color: CRIT }}>
                                  offered{r.call.discountAt ? ` at ${r.call.discountAt}` : ""}
                                </dd>
                              </>
                            ) : null}
                            {r.call.agreedCallbackAt ? (
                              <>
                                <dt style={dt}>She agreed</dt>
                                <dd style={{ ...dd, color: WARN }}>to decide by {r.call.agreedCallbackAt}</dd>
                              </>
                            ) : null}
                            {r.call.coachTalkPct != null ? (
                              <>
                                <dt style={dt}>You talked</dt>
                                <dd style={dd}>{r.call.coachTalkPct}% of the call</dd>
                              </>
                            ) : null}
                          </dl>

                          {r.call.scorecard ? (
                            <div>
                              <p style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: MUTED }}>The ten checks</p>
                              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 5 }}>
                                {Object.entries(r.call.scorecard).map(([k, v]) => (
                                  <li key={k} style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 9, alignItems: "start", fontSize: 12.5 }}>
                                    <span style={{ color: v.passed ? GOOD : CRIT, fontWeight: 700, lineHeight: 1.4 }}>{v.passed ? "✓" : "✕"}</span>
                                    <span style={{ color: v.passed ? INK2 : INK1 }}>
                                      {SCORE_LABELS[k] ?? k}
                                      {!v.passed && v.evidence ? <em style={{ display: "block", color: MUTED, fontStyle: "normal", fontSize: 11.5, marginTop: 2 }}>{v.evidence}</em> : null}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${GRID}`, paddingTop: 11 }}>
                            <span style={{ fontSize: 11, color: MUTED }}>{r.call.reviewed ? "Reviewed by you — safe from re-extraction" : "Auto-extracted"}</span>
                            <button
                              disabled={saving}
                              onClick={() => {
                                const p = window.prompt("Correct the price pitched (₹). Leave blank to skip.", r.call?.pricePitched?.toString() ?? "");
                                const o = window.prompt("Correct the real objection. Leave blank to skip.", r.call?.objection ?? "");
                                const fields: Record<string, string> = {};
                                if (p && /^\d+$/.test(p.trim())) fields.pricePitched = p.trim();
                                if (o && o.trim()) fields.objection = o.trim();
                                if (Object.keys(fields).length) void correct(r.bookingUid, fields);
                              }}
                              style={{ ...linkBtn, marginLeft: "auto", cursor: saving ? "wait" : "pointer" }}
                            >
                              {saving ? "Saving…" : "Correct"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
                          No call record yet. It appears automatically once Fathom finishes processing the recording.
                        </p>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

const dt: React.CSSProperties = { color: MUTED, fontSize: 12 };
const dd: React.CSSProperties = { margin: 0, color: INK1 };
const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${GRID}`,
  color: INK2,
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 12,
  textDecoration: "none",
  cursor: "pointer",
};

function chip(active: boolean, tone: string): React.CSSProperties {
  return {
    background: active ? tone + "22" : "transparent",
    border: `1px solid ${active ? tone + "88" : GRID}`,
    color: active ? INK1 : MUTED,
    padding: "6px 11px",
    borderRadius: 99,
    fontSize: 12,
    cursor: "pointer",
  };
}

function urgencyColor(u: string): string {
  return u === "now" ? CRIT : u === "today" ? WARN : u === "soon" ? PURPLE : MUTED;
}
