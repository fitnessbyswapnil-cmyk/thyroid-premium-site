"use client";

/**
 * /admin → Today. The only screen worth opening between calls.
 *
 * Four blocks, ordered by how fast they change a decision:
 *   1. What acquisition costs — both numbers, because the Rs299 is a qualifier
 *      and the programme is the product. When they diverge, the screen says so.
 *   2. Who needs me now — ONE merged queue sorted by money at risk, not four
 *      lists sorted by time. Every row is a name, a reason and a WhatsApp link.
 *   3. Whether the automation actually delivered — sends are not arrivals.
 *   4. Capacity against the seven-client ceiling, because a solo coach can be
 *      sold out, and that changes whether more spend is even useful.
 *
 * Anything that cannot be acted on within the hour is deliberately NOT here.
 * Funnel, creatives and cohort work live on their own screens; mixing decision
 * cadences is what teaches you to stop reading a dashboard.
 *
 * Phone-first: designed at 560px and allowed to breathe wider, not a desktop
 * grid crushed down.
 */

import { useCallback, useEffect, useState } from "react";
import { paymentDateStatus, toDateInputValue, META_ATTRIBUTION_WINDOW_DAYS } from "@/lib/payment-date";
import type { DecisionBadge } from "@/lib/decision-maker";
import { DM_PRESENCE_TARGET_PCT, formatDmPresence, type PresenceRate } from "@/lib/dm-presence";

const N = {
  bg: "#0B0E14",
  card: "#141922",
  line: "#232A36",
  text: "#E6E9EF",
  dim: "#8A93A6",
  accent: "#6E8BFF",
  good: "#3FBF7F",
  warn: "#E0A93B",
  bad: "#E5544B",
};

type Data = {
  generatedAt: string;
  window: { days: number };
  acquisition: {
    spend: number | null; consultPayers: number; programmeCloses: number;
    contracted: number; collected: number; costPerConsultPayer: number | null;
    costPerProgrammeClient: number | null; spendAvailable: boolean;
  };
  queue: { name: string; phone: string; reason: string; kind: string; risk: number; when: string; leadId: string; wa: string; badge?: DecisionBadge }[];
  decide: { row: number; name: string; phone: string; pitched: number; objection: string; daysSince: number; dmPresent?: string }[];
  dmPresence?: PresenceRate;
  health: { sent24: number; failed24: number; byTemplate: { name: string; sent: number; last: string }[] };
  capacity: { closed: number; ceiling: number };
  caveats: string[];
};

const inr = (n: number | null) => (n === null ? "—" : "₹" + n.toLocaleString("en-IN"));

export default function Today({ adminKey }: { adminKey: string }) {
  const [days, setDays] = useState(7);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/admin/today?days=${days}`, { headers: { "x-admin-key": adminKey }, cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setD((await r.json()) as Data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, [days, adminKey]);

  useEffect(() => { void load(); }, [load]);

  // The only write this screen makes. field "closed" stamps the programme
  // columns and fires the Purchase to Meta, so one tap both records the money
  // and teaches the algorithm what a real buyer looks like.
  //
  // The date travels with it. Marking is a between-calls job that often happens
  // days after the money landed, and the send used to timestamp the sale at the
  // moment of the tap — so the one number Meta optimises on was attributed to
  // the wrong day. Today stays the default, so the fast path is still one tap.
  const [saving, setSaving] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const markClosed = useCallback(async (row: number, amount: number, payDate: string, collected?: number) => {
    const when = paymentDateStatus(payDate, Date.now());
    if (!when.valid || when.ms === null) {
      setErr(when.future ? "That payment date is in the future." : "That payment date is not a real date.");
      return;
    }
    setSaving(row); setNotice("");
    try {
      const r = await fetch("/api/admin/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
          row, field: "closed", value: String(amount),
          paidAt: new Date(when.ms).toISOString(),
          ...(collected ? { collected } : {}),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // The server says what Meta actually did with the timestamp. Saying
      // nothing would let a clamped, badly-attributed event read as a clean one.
      const body = (await r.json()) as { meta?: { status?: string; tooOld?: boolean } };
      const m = body.meta;
      if (m?.tooOld) {
        setNotice(`Saved. Meta had to move the event time forward — this sale is older than ${META_ATTRIBUTION_WINDOW_DAYS} days, so its attribution is unreliable.`);
      } else if (m && m.status !== "sent" && m.status !== "already_sent") {
        setNotice(`Saved to the sheet, but Meta did not accept the sale (${m.status}).`);
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(null); }
  }, [adminKey, load]);

  // The second write this screen makes, and the cheapest. One tap, straight
  // after the call, while he still remembers who was on it. Held optimistically
  // so the pill flips under his thumb instead of waiting on a sheet round-trip
  // — the row it belongs to often disappears moments later, when the same call
  // gets marked as closed.
  const [dmSaved, setDmSaved] = useState<Record<number, "yes" | "no">>({});
  const [dmBusy, setDmBusy] = useState<number | null>(null);
  const markDmPresent = useCallback(async (row: number, present: "yes" | "no") => {
    setDmBusy(row); setDmSaved((m) => ({ ...m, [row]: present }));
    try {
      const r = await fetch("/api/admin/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ row, field: "dmPresent", value: present }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e) {
      // Put the pill back rather than leaving a tap that looks saved and is not.
      setDmSaved((m) => { const n = { ...m }; delete n[row]; return n; });
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setDmBusy(null); }
  }, [adminKey, load]);

  // Reading the clock during render is impure — React can re-render at any
  // moment and two rows on the same screen would disagree about what "today"
  // is. Captured once, and refreshed on Refresh so a dashboard left open
  // overnight does not keep offering yesterday.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const todayValue = toDateInputValue(new Date(nowMs));

  // Per-row payment date, defaulting to today. Held outside the row so the
  // picker survives a re-render mid-edit.
  const [payDates, setPayDates] = useState<Record<number, string>>({});
  const payDateFor = (row: number) => payDates[row] ?? todayValue;

  const wrap: React.CSSProperties = { background: N.bg, color: N.text, minHeight: "100vh", padding: "0 0 48px", fontFamily: "Inter, system-ui, sans-serif" };
  const inner: React.CSSProperties = { maxWidth: 620, margin: "0 auto", padding: "0 16px" };
  const card: React.CSSProperties = { background: N.card, border: `1px solid ${N.line}`, borderRadius: 14, padding: 16 };
  const kicker: React.CSSProperties = { fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: N.dim };
  const h6: React.CSSProperties = { ...kicker, margin: "26px 0 10px" };

  const a = d?.acquisition;
  const dmp = d?.dmPresence;
  const diverge = a && a.costPerConsultPayer !== null && a.costPerProgrammeClient !== null
    && a.costPerProgrammeClient > a.costPerConsultPayer * 12;

  return (
    <div style={wrap}>
      <div style={inner}>
        <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "22px 0 4px" }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 600 }}>Today</div>
            <div style={kicker}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <button onClick={() => { setNowMs(Date.now()); void load(); }} disabled={busy}
            style={{ background: "none", border: `1px solid ${N.line}`, color: N.dim, borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
            {busy ? "Syncing…" : "Refresh"}
          </button>
        </header>

        {/* The one number this screen is trying to move. It sits above the
            money because the money follows it: a consultation held without the
            person who shares the decision is a consultation that ends in "let
            me talk to it over". Shown as an em dash, never 0%, until something
            has actually been marked. */}
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12,
          border: `1px solid ${N.line}`, background: N.card,
          display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5,
            color: dmp && dmp.pct !== null && dmp.pct >= DM_PRESENCE_TARGET_PCT ? N.good : N.text }}>
            {dmp ? formatDmPresence(dmp) : "Decision-maker present: …"}
          </span>
          <span style={{ fontSize: 11.5, color: N.dim }}>
            {dmp && dmp.unmarked > 0
              ? `${dmp.unmarked} held call${dmp.unmarked === 1 ? "" : "s"} not marked · target ${DM_PRESENCE_TARGET_PCT}%`
              : `target ${DM_PRESENCE_TARGET_PCT}%`}
          </span>
        </div>

        {err && <div style={{ ...card, borderColor: N.bad, color: N.bad, marginTop: 12 }}>Could not load: {err}</div>}
        {notice && (
          <div style={{ ...card, borderColor: N.warn, color: N.warn, marginTop: 12, fontSize: 13, display: "flex", gap: 10 }}>
            <span style={{ flex: 1 }}>{notice}</span>
            <button onClick={() => setNotice("")}
              style={{ background: "none", border: 0, color: N.dim, cursor: "pointer", fontSize: 13 }}>✕</button>
          </div>
        )}

        {/* 1 — Acquisition */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 10px" }}>
          <span style={kicker}>Acquisition cost</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[7, 14, 30].map((w) => (
              <button key={w} onClick={() => setDays(w)}
                style={{ background: days === w ? N.accent : "transparent", color: days === w ? "#0B0E14" : N.dim,
                  border: `1px solid ${days === w ? N.accent : N.line}`, borderRadius: 999, padding: "4px 11px", fontSize: 12, cursor: "pointer" }}>
                {w}d
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
          <div style={card}>
            <div style={kicker}>Cost per ₹299 payer</div>
            <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-.02em", marginTop: 6 }}>
              {inr(a?.costPerConsultPayer ?? null)}
            </div>
            <div style={{ fontSize: 12, color: N.dim, marginTop: 6 }}>
              {a?.consultPayers ?? 0} payers · {a?.spendAvailable ? inr(Math.round(a.spend ?? 0)) : "spend n/a"} spend
            </div>
            <div style={{ height: 1, background: N.line, margin: "10px 0" }} />
            <div style={{ fontSize: 11, color: N.dim }}>Target under ₹1,500</div>
          </div>

          <div style={card}>
            <div style={kicker}>Cost per programme client</div>
            <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-.02em", marginTop: 6,
              color: diverge ? N.warn : N.text }}>
              {inr(a?.costPerProgrammeClient ?? null)}
            </div>
            <div style={{ fontSize: 12, color: N.dim, marginTop: 6 }}>
              {a?.programmeCloses ?? 0} closes · {inr(a?.contracted ?? 0)} contracted
              {(a?.collected ?? 0) > 0 && (a?.collected ?? 0) !== (a?.contracted ?? 0)
                ? ` · ${inr(a?.collected ?? 0)} collected` : ""}
            </div>
            <div style={{ height: 1, background: N.line, margin: "10px 0" }} />
            <div style={{ fontSize: 11, color: N.dim }}>
              {(a?.programmeCloses ?? 0) === 0 ? "No closes in window — too young to judge" : "Against ₹15,000–30,000 per client"}
            </div>
          </div>
        </div>

        {diverge && (
          <div style={{ ...card, marginTop: 12, borderColor: N.warn, display: "flex", gap: 10 }}>
            <span style={{ color: N.warn, fontSize: 18, lineHeight: 1 }}>▲</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Cheap payers, expensive clients</div>
              <div style={{ fontSize: 13, color: N.dim, marginTop: 3 }}>
                You are buying ₹299 payments efficiently but they are not converting to programmes.
                Look at the call, not the ad.
              </div>
            </div>
          </div>
        )}

        {/* 2 — Queue */}
        <div style={h6}>Needs me now{d ? ` · ${d.queue.length}` : ""}</div>
        {d && d.queue.length === 0 && (
          <div style={{ ...card, color: N.dim, fontSize: 14 }}>Nothing waiting on you. Rare — enjoy it.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {d?.queue.map((q) => {
            const accent = q.kind === "call_today" ? N.bad : q.kind === "paid_not_booked" ? N.warn : N.accent;
            // Green means nothing to do about it. Amber means open the call a
            // particular way — and the way is printed underneath, because a
            // label he has to remember the meaning of is a label he stops
            // reading. No badge at all is a lead from before the question
            // existed; silence is honest there.
            const badgeColor = q.badge?.tone === "warn" ? N.warn : N.good;
            return (
              <div key={q.leadId + q.kind} style={{ ...card, padding: 14, borderLeft: `3px solid ${accent}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.name}</div>
                    <div style={{ fontSize: 12.5, color: N.dim, marginTop: 2 }}>{q.reason}</div>
                    {q.badge && (
                      <span style={{ display: "inline-block", marginTop: 6, padding: "2px 8px", borderRadius: 999,
                        fontSize: 10, fontWeight: 800, letterSpacing: ".07em", color: badgeColor,
                        border: `1px solid ${badgeColor}44`, background: `${badgeColor}14` }}>
                        {q.badge.label}
                      </span>
                    )}
                  </div>
                  <a href={q.wa || `https://wa.me/91${q.phone}`} target="_blank" rel="noreferrer"
                    style={{ flex: "none", background: accent, color: "#0B0E14", borderRadius: 999,
                      padding: "7px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                    WhatsApp
                  </a>
                </div>
                {/* Always visible. Not a tooltip, not behind a tap — he reads
                    this between calls, one-handed. */}
                {q.badge?.prompt && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${N.line}`,
                    fontSize: 12.5, lineHeight: 1.5, color: N.warn }}>
                    {q.badge.prompt}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 2b — Decide: the only manual step in the whole system */}
        {d && d.decide.length > 0 && (
          <>
            <div style={h6}>Did she pay? · {d.decide.length}</div>
            <div style={{ fontSize: 12, color: N.dim, marginBottom: 8, lineHeight: 1.5 }}>
              The one thing no webhook can see. Everything else came off the call recording.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.decide.map((p) => {
                const amounts = p.pitched > 0 ? [p.pitched] : [15000, 20000, 25000, 30000];
                const payDate = payDateFor(p.row);
                const when = paymentDateStatus(payDate, nowMs);
                // The optimistic tap wins over the sheet until the reload lands.
                const dmAnswer = dmSaved[p.row] ?? (p.dmPresent ?? "").trim().toLowerCase();
                return (
                  <div key={p.row} style={{ ...card, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                        <div style={{ fontSize: 12.5, color: N.dim, marginTop: 2 }}>
                          {p.pitched > 0 ? `Pitched ${inr(p.pitched)}` : "No price captured"}
                          {" · "}{p.daysSince === 0 ? "today" : `${p.daysSince}d ago`}
                        </div>
                        {p.objection && (
                          <div style={{ fontSize: 12, color: N.warn, marginTop: 4 }}>{p.objection.slice(0, 70)}</div>
                        )}
                      </div>
                      <a href={`https://wa.me/91${p.phone}`} target="_blank" rel="noreferrer"
                        style={{ flex: "none", alignSelf: "flex-start", color: N.accent, fontSize: 12.5, textDecoration: "none" }}>
                        WhatsApp →
                      </a>
                    </div>
                    {/* Default today, so the common case stays one tap. Future
                        dates are refused by the picker itself. */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11 }}>
                      <span style={{ fontSize: 11.5, color: N.dim }}>Paid on</span>
                      <input type="date" value={payDate} max={todayValue}
                        onChange={(e) => setPayDates((m) => ({ ...m, [p.row]: e.target.value }))}
                        style={{ background: "transparent", color: N.text, border: `1px solid ${N.line}`,
                          borderRadius: 8, padding: "5px 8px", fontSize: 12.5, colorScheme: "dark" }} />
                    </div>
                    {when.stale && (
                      <div style={{ fontSize: 12, color: N.warn, marginTop: 7, lineHeight: 1.45 }}>
                        Older than {META_ATTRIBUTION_WINDOW_DAYS} days — Meta may not attribute this sale.
                        Mark payments the same day.
                      </div>
                    )}
                    {/* Asked BEFORE the money buttons on purpose: marking the
                        money removes this row from the list, so a question
                        placed after it would only ever be answered by accident. */}
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 11, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11.5, color: N.dim }}>Decision-maker present on the call?</span>
                      {(["yes", "no"] as const).map((v) => {
                        const on = dmAnswer === v;
                        return (
                          <button key={v} disabled={dmBusy === p.row}
                            onClick={() => void markDmPresent(p.row, v)}
                            style={{ background: on ? `${N.accent}22` : "transparent",
                              color: on ? N.accent : N.dim,
                              border: `1px solid ${on ? N.accent : N.line}`, borderRadius: 999,
                              padding: "4px 12px", fontSize: 12, fontWeight: on ? 700 : 400, cursor: "pointer" }}>
                            {v === "yes" ? "Yes" : "No"}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 7, marginTop: 11, flexWrap: "wrap" }}>
                      {amounts.map((amt) => (
                        <button key={amt} disabled={saving === p.row}
                          onClick={() => void markClosed(p.row, amt, payDate)}
                          style={{ background: N.good, color: "#06210f", border: 0, borderRadius: 999,
                            padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                          Paid {inr(amt)}
                        </button>
                      ))}
                      <button disabled={saving === p.row}
                        onClick={() => {
                          const v = window.prompt("Total agreed (₹)", p.pitched ? String(p.pitched) : "");
                          if (!v) return;
                          const total = Number(v.replace(/[^\d]/g, ""));
                          if (!total) return;
                          const c = window.prompt(`Received now (₹) — leave as ${total} if paid in full`, String(total));
                          const got = Number(String(c ?? total).replace(/[^\d]/g, "")) || total;
                          void markClosed(p.row, total, payDate, got);
                        }}
                        style={{ background: "transparent", color: N.dim, border: `1px solid ${N.line}`,
                          borderRadius: 999, padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}>
                        Part payment…
                      </button>
                      {saving === p.row && <span style={{ fontSize: 12, color: N.dim, alignSelf: "center" }}>Saving…</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 3 — Automation health */}
        <div style={h6}>Automation health · 24h</div>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99,
              background: (d?.health.failed24 ?? 0) > 0 ? N.bad : (d?.health.sent24 ?? 0) > 0 ? N.good : N.dim }} />
            <span style={{ fontSize: 14 }}>
              {d ? `${d.health.sent24} delivered · ${d.health.failed24} failed` : "…"}
            </span>
          </div>
          {(d?.health.failed24 ?? 0) > 0 && (
            <div style={{ fontSize: 12.5, color: N.bad, marginTop: 8 }}>
              Failures are usually Meta&rsquo;s marketing frequency cap. The message was sent and never arrived.
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {d?.health.byTemplate.map((t) => (
              <div key={t.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: N.dim }}>
                <span>{t.name}</span><span>{t.sent}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4 — Capacity */}
        <div style={h6}>Capacity · {new Date().toLocaleDateString("en-IN", { month: "long" })}</div>
        <div style={card}>
          <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
            {Array.from({ length: d?.capacity.ceiling ?? 7 }, (_, i) => (
              <span key={i} style={{ width: 26, height: 26, borderRadius: 8,
                background: i < (d?.capacity.closed ?? 0) ? N.good : "transparent",
                border: `1px solid ${i < (d?.capacity.closed ?? 0) ? N.good : N.line}` }} />
            ))}
          </div>
          <div style={{ fontSize: 14 }}>
            {d?.capacity.closed ?? 0} of {d?.capacity.ceiling ?? 7} clients this month
          </div>
          <div style={{ fontSize: 12, color: N.dim, marginTop: 4 }}>
            {(d?.capacity.closed ?? 0) >= (d?.capacity.ceiling ?? 7)
              ? "Sold out. More spend buys a waitlist, not revenue."
              : `${(d?.capacity.ceiling ?? 7) - (d?.capacity.closed ?? 0)} places left`}
          </div>
        </div>

        {d?.caveats?.length ? (
          <div style={{ marginTop: 18, fontSize: 11.5, color: N.dim, lineHeight: 1.6 }}>
            {d.caveats.map((c) => <div key={c}>· {c}</div>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
