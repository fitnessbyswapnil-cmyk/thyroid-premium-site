"use client";

/**
 * /admin → Today. The only screen worth opening between calls.
 *
 * The owner, 10-Nov-2026: "from client coming to consultation call I want
 * everything one click button to automate, keep flow clean easy to
 * understand, better colour, buttons, graph/chart for representation". He
 * approved this order, top to bottom:
 *
 *   0. Anything overdue that is his to do: a summary past its 30 minutes. It
 *      sits above everything, in clay, because it is the one thing on this
 *      screen with a clock that has already run out.
 *   1. Four tiles: calls today, summaries to send, follow-ups due, paid this
 *      week. The first three are counts of the cards below; the fourth is
 *      lib/metrics' wins. This screen computes no business number itself.
 *   2. This week: where clients drop off. Lead → Confirmed → Report → Call →
 *      Summary → Paid, from the today feed. A bar filters the cards to it.
 *   3. Do now: one card per woman (lib/next-action, ./JourneyCard), with ONE
 *      button for the next thing to do. The four lists this screen used to
 *      be (Mark your calls, Calls in the next 24 hours, Needs me now, Did she
 *      pay?) are her card's inline controls now, so a woman can no longer sit
 *      in three of them at once with three sets of buttons.
 *   4. What has not changed: what he misses most on calls, the headline
 *      numbers for the shared range, the decision-maker rate, what
 *      acquisition costs, whether the automation delivered, capacity against
 *      the seven-client ceiling, and the switches (automation, payment links).
 *
 * Phone-first: designed at 375px and allowed to breathe wider, not a desktop
 * grid crushed down.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DecisionBadge } from "@/lib/decision-maker";
import { DM_PRESENCE_TARGET_PCT, formatDmPresence, type PresenceRate } from "@/lib/dm-presence";
import type { Summary, ChecklistSummary } from "@/lib/metrics";
import { showConnectCard, type DriveStatus, type SavedReport } from "@/lib/admin-actions";
import { inDropBar, type ClientCard, type DropKey, type FunnelBar } from "@/lib/next-action";
import { useRange, RANGE_CHOICES, rangeLabel, pct } from "./useMetrics";
import { LIGHT, DARK, FONT, RADIUS, type Tokens } from "./tokens";
import { inkOf } from "./RowTools";
import ConnectDrive from "./ConnectDrive";
import JourneyCard, { type CardHooks } from "./JourneyCard";
import { Button } from "./ui/Button";
import { StageFunnel } from "./charts/StageFunnel";
import { AutomationToggles } from "./AutomationToggles";
import { PaymentLinksCard } from "./PaymentLinksCard";

type Data = {
  generatedAt: string;
  /** Drive bridge status, folded into the feed; null when it could not be read. */
  drive?: DriveStatus | null;
  window: { days: number };
  acquisition: {
    spend: number | null; consultPayers: number; programmeCloses: number;
    contracted: number; collected: number; costPerConsultPayer: number | null;
    costPerProgrammeClient: number | null; spendAvailable: boolean;
    /** When the cached ad spend was fetched (hourly refresh). */
    spendAsOf?: string | null;
  };
  /** The one needs-action list (lib/journey): each item carries her card. */
  queue: { name: string; phone: string; kind: string; waitMin: number; overdue: boolean; report?: SavedReport; card?: ClientCard | null }[];
  needsAction: { count: number; overdue: number };
  callsToday: { name: string; phone: string; when: string; bookingUid: string; badge?: DecisionBadge; report?: SavedReport; card?: ClientCard | null }[];
  dmPresence?: PresenceRate;
  testMode?: boolean;
  health: { sent24: number; failed24: number; byTemplate: { name: string; sent: number; last: string }[] };
  capacity: { closed: number; ceiling: number };
  caveats: string[];
  metrics: Summary;
  checklist: ChecklistSummary;
  /** One card per woman on this screen, sorted by urgency (lib/next-action). */
  cards?: ClientCard[];
  cardCounts?: { callsToday: number; summariesToSend: number; followUpsDue: number };
  dropFunnel?: { days: number; bars: FunnelBar[] };
  week?: { won: number; revenue: number };
};

/** "14:07" today, "13 Sep 14:07" otherwise — IST, the coach's clock. */
function asOfLabel(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "unknown";
  const opts: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false };
  const day = (x: Date) => x.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  return day(t) === day(new Date())
    ? t.toLocaleTimeString("en-IN", opts)
    : `${t.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })} ${t.toLocaleTimeString("en-IN", opts)}`;
}

const inr = (n: number | null) => (n === null ? "—" : "₹" + n.toLocaleString("en-IN"));

/**
 * GET /api/admin/drive-setup, or null when it could not be read. Unknown is
 * not "disconnected": a failed read leaves the Connect card hidden rather than
 * nagging him about a set-up that may be fine.
 */
async function readDriveStatus(adminKey: string): Promise<DriveStatus | null> {
  try {
    const r = await fetch("/api/admin/drive-setup", { headers: { "x-admin-key": adminKey }, cache: "no-store" });
    return r.ok ? ((await r.json()) as DriveStatus) : null;
  } catch {
    return null;
  }
}

/** The biggest single drop between two bars, for the sentence under the chart. */
function worstDrop(bars: FunnelBar[]): { label: string; lost: number; from: number } | null {
  let worst: { label: string; lost: number; from: number } | null = null;
  for (let i = 1; i < bars.length; i++) {
    const lost = bars[i - 1].count - bars[i].count;
    if (lost > 0 && (!worst || lost > worst.lost)) worst = { label: bars[i].label, lost, from: bars[i - 1].count };
  }
  return worst;
}

export default function Today({ adminKey, dark = false }: { adminKey: string; dark?: boolean }) {
  const t = (dark ? DARK : LIGHT) as unknown as Tokens;
  const N = inkOf(dark);
  // Shared with Pipeline and Analytics: one range, the same numbers everywhere.
  const [days, setDays] = useRange();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  const [showSettings, setShowSettings] = useState(false);

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

  // load() flips the button to "Syncing…" before it fetches, on purpose: the
  // first paint and every range change should say a fetch is under way.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // A press that changed her card reloads the feed, once, a moment later:
  // three quick sends are one reload, not three Sheets reads.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => { void load(); }, 2500);
  }, [load]);
  useEffect(() => () => { if (reloadTimer.current) clearTimeout(reloadTimer.current); }, []);

  // The clock the cards count down against. Ticked by state, not read during
  // render, so two cards on one screen never disagree about what "now" is.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Whether the bridge to his Drive is set up at all, read from config and
  // never by calling the script, so the Connect card shows only while it is
  // needed. A card whose Drive button meets a script that refuses the stored
  // pairing brings the card back (showConnectCard): every hint for that
  // failure tells him to use the card, so the card has to be there.
  // A fresh read wins (right after he connects); otherwise the status that came
  // in the today feed. Derived, not copied into state by an effect.
  const [driveFresh, setDriveFresh] = useState<DriveStatus | null>(null);
  const [bridgeCode, setBridgeCode] = useState("");
  const [driveJustConnected, setDriveJustConnected] = useState(false);
  const loadDrive = useCallback(() => {
    void readDriveStatus(adminKey).then((s) => { if (s) setDriveFresh(s); });
  }, [adminKey]);
  // The status rides in the today feed (one request on load, not two); the
  // separate read stays for the moment right after he connects.
  const drive = driveFresh ?? d?.drive ?? null;
  const onBridgeResult = useCallback((code: string) => {
    setBridgeCode(code);
    if (code) setDriveJustConnected(false);
  }, []);

  const hooks: CardHooks = useMemo(
    () => ({ adminKey, onChanged: scheduleReload, onNotice: setNotice, onBridgeResult }),
    [adminKey, scheduleReload, onBridgeResult],
  );

  // A funnel bar narrows the cards to the women in it.
  const [bar, setBar] = useState<DropKey | null>(null);
  const [showWaiting, setShowWaiting] = useState(false);

  const cards = d?.cards ?? [];
  const generated = Date.parse(d?.generatedAt ?? "") || nowMs;
  const week = { from: generated - 7 * 86_400_000, to: generated + 1 };
  const shown = bar ? cards.filter((c) => inDropBar(c, bar, week)) : cards;
  const overdue = shown.filter((c) => c.primary?.danger);
  const doNow = shown.filter((c) => !c.primary?.danger && (c.primary || c.secondary.length));
  const waiting = shown.filter((c) => !c.primary && !c.secondary.length);
  const bars = d?.dropFunnel?.bars ?? [];
  const drop = worstDrop(bars);
  const checksMissed = d?.checklist.checks.slice(0, 3) ?? [];

  const page: React.CSSProperties = { background: t.paper, color: t.ink1, minHeight: "100vh", padding: "0 0 48px", fontFamily: FONT.sans };
  const inner: React.CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "0 16px" };
  const box: React.CSSProperties = { background: t.card, border: `1px solid ${t.hairline}`, borderRadius: RADIUS.card, padding: 16 };
  const kicker: React.CSSProperties = { fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: t.ink2, fontWeight: 600 };
  const h6: React.CSSProperties = { ...kicker, margin: "26px 0 10px" };

  const a = d?.acquisition;
  const dmp = d?.dmPresence;
  const diverge = a && a.costPerConsultPayer !== null && a.costPerProgrammeClient !== null
    && a.costPerProgrammeClient > a.costPerConsultPayer * 12;

  const card = (c: ClientCard) => (
    <JourneyCard key={c.key} t={t} ink={N} card={c} hooks={hooks} nowMs={nowMs} missedMost={checksMissed} />
  );

  const counts = d?.cardCounts;
  const overdueSummaries = cards.filter((c) => c.primary?.id === "summary" && c.primary.danger).length;
  const tiles: { label: string; value: string; sub: string; tone?: string }[] = [
    { label: "Calls today", value: counts ? String(counts.callsToday) : "…", sub: "on your calendar" },
    {
      label: "Summaries to send", value: counts ? String(counts.summariesToSend) : "…",
      sub: overdueSummaries ? `${overdueSummaries} past 30 minutes` : "30 minutes after each call",
      tone: overdueSummaries ? t.clay : undefined,
    },
    { label: "Follow-ups due", value: counts ? String(counts.followUpsDue) : "…", sub: "day 1, 3 and 7" },
    {
      label: "Paid this week", value: d?.week ? String(d.week.won) : "…",
      sub: d?.week ? (d.week.revenue > 0 ? `${inr(d.week.revenue)} collected` : "no programme sales") : "",
      tone: d?.week && d.week.won > 0 ? t.won : undefined,
    },
  ];

  return (
    <div style={page}>
      <div style={inner}>
        {d?.testMode ? (
          <div style={{ background: t.clay, color: N.onAccent, borderRadius: RADIUS.card, padding: "12px 14px", margin: "14px 0 0", fontWeight: 700, letterSpacing: 0.2 }}>
            TEST MODE IS ON — Cashfree is charging ₹1, not ₹299. Every page still shows ₹299. Turn it off before any ad runs.
          </div>
        ) : null}
        <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "22px 0 4px", gap: 12 }}>
          <div>
            <div style={{ fontFamily: FONT.serif, fontSize: 24, fontWeight: 500, letterSpacing: "-.01em" }}>Today</div>
            <div style={{ ...kicker, fontWeight: 500 }}>
              {new Date(nowMs).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <Button t={t} variant="secondary" size="sm" busy={busy} onClick={() => { setNowMs(Date.now()); void load(); void loadDrive(); }}>
            {busy ? "Syncing…" : "Refresh"}
          </Button>
        </header>

        {err && <div style={{ ...box, borderColor: t.clay, color: t.clay, marginTop: 12 }}>Could not load: {err}</div>}
        {notice && (
          <div style={{ ...box, borderColor: t.amber, color: t.amber, marginTop: 12, fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ flex: 1 }}>{notice}</span>
            <Button t={t} variant="quiet" size="sm" ariaLabel="Dismiss" onClick={() => setNotice("")}>Close</Button>
          </div>
        )}

        {/* Before everything else on the screen, because every Drive button
            below depends on it. Gone the moment it has done its job. */}
        {driveJustConnected ? (
          <div style={{ ...box, marginTop: 14, padding: "11px 14px", fontSize: 13.5, fontWeight: 600, color: t.won }}>
            Google Drive connected
          </div>
        ) : drive && showConnectCard(drive, bridgeCode) ? (
          <ConnectDrive adminKey={adminKey} ink={N} status={drive}
            onConnected={() => { setDriveJustConnected(true); setBridgeCode(""); void loadDrive(); }} />
        ) : null}

        {/* 0 — Overdue: impossible to miss, and the button is right there. */}
        {overdue.length > 0 && (
          <section aria-label="Overdue" style={{ marginTop: 16 }}>
            <div style={{ ...kicker, color: t.clay, marginBottom: 8 }}>
              Overdue · {overdue.length} {overdue.length === 1 ? "summary" : "summaries"} past 30 minutes
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>{overdue.map(card)}</div>
          </section>
        )}

        {/* 1 — Four tiles. Counts of the cards below, and lib/metrics' wins. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginTop: 16 }}>
          {tiles.map((x) => (
            <div key={x.label} style={{ ...box, padding: 12 }}>
              <div style={kicker}>{x.label}</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 26, fontWeight: 500, marginTop: 4, color: x.tone ?? t.ink1, letterSpacing: "-.02em" }}>{x.value}</div>
              <div style={{ fontSize: 11.5, color: t.ink2, marginTop: 3, lineHeight: 1.35 }}>{x.sub}</div>
            </div>
          ))}
        </div>

        {/* 2 — Where this week's women stop. A bar filters the cards to them. */}
        <div style={{ ...box, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontFamily: FONT.serif, fontWeight: 500, fontSize: 19, color: t.ink1 }}>This week: where clients drop off</h2>
            <span style={{ fontSize: 11.5, color: t.ink2 }}>last 7 days · tap a bar</span>
          </div>
          {d ? (
            <StageFunnel t={t} stages={bars} ariaLabel="This week: where clients drop off"
              onSelect={(key) => setBar((b) => (b === key ? null : (key as DropKey)))} />
          ) : (
            <div style={{ fontSize: 13, color: t.ink2 }}>…</div>
          )}
          <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.5, color: t.ink2 }}>
            Women who came in over the last 7 days, by the furthest step each reached.
            {drop ? <> The biggest loss: <strong style={{ color: t.ink1 }}>{drop.lost} of {drop.from}</strong> never reached {drop.label}.</> : null}
          </p>
        </div>

        {/* 3 — Do now: one card per woman, one button per card. */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, margin: "26px 0 10px", flexWrap: "wrap" }}>
          <span style={{ ...kicker, margin: 0 }}>Do now · one button per client</span>
          {d ? (
            <span style={{ fontSize: 12, color: t.ink2 }}>
              {d.needsAction.count} on the action list
              {d.needsAction.overdue > 0 ? <span style={{ color: t.clay }}> · {d.needsAction.overdue} waiting over 6 hr</span> : null}
            </span>
          ) : null}
        </div>
        {bar ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12.5, color: t.ink2 }}>
            <span>Showing the women at {bars.find((b) => b.key === bar)?.label ?? bar} or further who are on this screen.</span>
            <Button t={t} variant="quiet" size="sm" onClick={() => setBar(null)}>Show all</Button>
          </div>
        ) : null}
        {d && doNow.length === 0 && overdue.length === 0 && (
          <div style={{ ...box, color: t.ink2, fontSize: 14 }}>{bar ? "Nobody in that bar needs you right now." : "Nothing waiting on you. Rare — enjoy it."}</div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>{doNow.map(card)}</div>

        {waiting.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <Button t={t} variant="quiet" size="sm" onClick={() => setShowWaiting((v) => !v)}>
              {showWaiting ? "Hide" : "Show"} {waiting.length} with nothing to do yet
            </Button>
            {showWaiting ? <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, marginTop: 8 }}>{waiting.map(card)}</div> : null}
          </div>
        )}

        {/* 4 — What you miss most on calls: what to change tomorrow. */}
        {d?.checklist && d.checklist.callsScored > 0 && (
          <div style={{ ...box, marginTop: 26, borderLeft: `3px solid ${t.amber}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span style={kicker}>What you miss most on calls</span>
              <span style={{ fontSize: 13, color: t.amber, fontWeight: 700 }}>
                {d.checklist.avgMisses}/10 missed per call
              </span>
            </div>
            <ol style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 6 }}>
              {d.checklist.checks.slice(0, 3).map((c) => (
                <li key={c.key} style={{ fontSize: 14, lineHeight: 1.45 }}>
                  {c.label} <span style={{ color: t.ink2, fontSize: 12 }}>· missed {c.missed} of {c.total}</span>
                </li>
              ))}
            </ol>
            <div style={{ fontSize: 11.5, color: t.ink2, marginTop: 8 }}>
              From {d.checklist.callsScored} scored call{d.checklist.callsScored === 1 ? "" : "s"}. Tick the checklist after each call to keep this true.
            </div>
          </div>
        )}

        {/* Headline numbers. From lib/metrics, over the shared range. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "26px 0 8px", gap: 8, flexWrap: "wrap" }}>
          <span style={kicker}>Numbers</span>
          <div style={{ display: "flex", gap: 4 }}>
            {RANGE_CHOICES.map((w) => (
              <Button key={w} t={t} size="sm" variant={days === w ? "primary" : "secondary"} onClick={() => setDays(w)}>
                {rangeLabel(w)}
              </Button>
            ))}
          </div>
        </div>
        {(() => {
          const m = d?.metrics;
          const numberTiles: { label: string; value: string; sub: string; tone?: string }[] = [
            { label: "Leads", value: m ? String(m.leads) : "…", sub: m ? `${pct(m.leadToBooked)} booked` : "" },
            { label: "Booked", value: m ? String(m.booked) : "…", sub: m ? `${m.cancelled} cancelled` : "" },
            {
              label: "Show-up rate", value: m ? pct(m.showUpRate) : "…",
              sub: m ? `${m.attended} came · ${m.noShow} no-show${m.attendanceUnknown ? ` · ${m.attendanceUnknown} unknown` : ""}` : "",
              tone: m && m.showUpRate !== null && m.showUpRate < 0.6 ? t.amber : undefined,
            },
            { label: "Won", value: m ? String(m.won) : "…", sub: m ? (m.revenue > 0 ? `${inr(m.revenue)} collected` : "no programme sales") : "", tone: m && m.won > 0 ? t.won : undefined },
            { label: "₹299 fees", value: m ? String(m.consultFees.count) : "…", sub: m ? `${inr(m.consultFees.amount)} · not revenue` : "" },
          ];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(104px,1fr))", gap: 8 }}>
              {numberTiles.map((x) => (
                <div key={x.label} style={{ ...box, padding: 12 }}>
                  <div style={kicker}>{x.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: x.tone ?? t.ink1 }}>{x.value}</div>
                  <div style={{ fontSize: 11.5, color: t.ink2, marginTop: 3, lineHeight: 1.35 }}>{x.sub}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* The one number this screen is trying to move. Shown as an em dash,
            never 0%, until something has actually been marked. */}
        <div style={{ ...box, marginTop: 12, padding: "10px 14px",
          display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5,
            color: dmp && dmp.pct !== null && dmp.pct >= DM_PRESENCE_TARGET_PCT ? t.won : t.ink1 }}>
            {dmp ? formatDmPresence(dmp) : "Decision-maker present: …"}
          </span>
          <span style={{ fontSize: 11.5, color: t.ink2 }}>
            {dmp && dmp.unmarked > 0
              ? `${dmp.unmarked} held call${dmp.unmarked === 1 ? "" : "s"} not marked · target ${DM_PRESENCE_TARGET_PCT}%`
              : `target ${DM_PRESENCE_TARGET_PCT}%`}
          </span>
        </div>

        {/* Acquisition */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 10px", gap: 8, flexWrap: "wrap" }}>
          <span style={kicker}>Acquisition cost</span>
          <span style={{ fontSize: 12, color: t.ink2 }}>
            {rangeLabel(days)} · same range as above
            {d?.acquisition.spendAsOf ? ` · ad spend as of ${asOfLabel(d.acquisition.spendAsOf)}` : ""}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
          <div style={box}>
            <div style={kicker}>Cost per ₹299 payer</div>
            <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.02em", marginTop: 6 }}>
              {inr(a?.costPerConsultPayer ?? null)}
            </div>
            <div style={{ fontSize: 12, color: t.ink2, marginTop: 6 }}>
              {a?.consultPayers ?? 0} payers · {a?.spendAvailable ? inr(Math.round(a.spend ?? 0)) : "spend n/a"} spend
            </div>
            <div style={{ height: 1, background: t.hairline, margin: "10px 0" }} />
            <div style={{ fontSize: 11, color: t.ink2 }}>Target under ₹1,500</div>
          </div>
          <div style={box}>
            <div style={kicker}>Cost per programme client</div>
            <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.02em", marginTop: 6, color: diverge ? t.amber : t.ink1 }}>
              {inr(a?.costPerProgrammeClient ?? null)}
            </div>
            <div style={{ fontSize: 12, color: t.ink2, marginTop: 6 }}>
              {a?.programmeCloses ?? 0} closes · {inr(a?.contracted ?? 0)} contracted
              {(a?.collected ?? 0) > 0 && (a?.collected ?? 0) !== (a?.contracted ?? 0)
                ? ` · ${inr(a?.collected ?? 0)} collected` : ""}
            </div>
            <div style={{ height: 1, background: t.hairline, margin: "10px 0" }} />
            <div style={{ fontSize: 11, color: t.ink2 }}>
              {(a?.programmeCloses ?? 0) === 0 ? "No closes in window — too young to judge" : "Against ₹15,000–30,000 per client"}
            </div>
          </div>
        </div>
        {diverge && (
          <div style={{ ...box, marginTop: 12, borderColor: t.amber, display: "flex", gap: 10 }}>
            <span style={{ color: t.amber, fontSize: 18, lineHeight: 1 }}>▲</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Cheap payers, expensive clients</div>
              <div style={{ fontSize: 13, color: t.ink2, marginTop: 3 }}>
                You are buying ₹299 payments efficiently but they are not converting to programmes.
                Look at the call, not the ad.
              </div>
            </div>
          </div>
        )}

        {/* Automation health */}
        <div style={h6}>Automation health · 24h</div>
        <div style={box}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99,
              background: (d?.health.failed24 ?? 0) > 0 ? t.clay : (d?.health.sent24 ?? 0) > 0 ? t.won : t.ink3 }} />
            <span style={{ fontSize: 14 }}>
              {d ? `${d.health.sent24} delivered · ${d.health.failed24} failed` : "…"}
            </span>
          </div>
          {(d?.health.failed24 ?? 0) > 0 && (
            <div style={{ fontSize: 12.5, color: t.clay, marginTop: 8 }}>
              Failures are usually Meta&rsquo;s marketing frequency cap. The message was sent and never arrived.
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {d?.health.byTemplate.map((x) => (
              <div key={x.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: t.ink2, gap: 10 }}>
                <span style={{ overflowWrap: "anywhere" }}>{x.name}</span><span>{x.sent}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Capacity */}
        <div style={h6}>Capacity · {new Date(nowMs).toLocaleDateString("en-IN", { month: "long" })}</div>
        <div style={box}>
          <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
            {Array.from({ length: d?.capacity.ceiling ?? 7 }, (_, i) => (
              <span key={i} style={{ width: 26, height: 26, borderRadius: 8,
                background: i < (d?.capacity.closed ?? 0) ? t.won : "transparent",
                border: `1px solid ${i < (d?.capacity.closed ?? 0) ? t.won : t.hairline}` }} />
            ))}
          </div>
          <div style={{ fontSize: 14 }}>
            {d?.capacity.closed ?? 0} of {d?.capacity.ceiling ?? 7} clients this month
          </div>
          <div style={{ fontSize: 12, color: t.ink2, marginTop: 4 }}>
            {(d?.capacity.closed ?? 0) >= (d?.capacity.ceiling ?? 7)
              ? "Sold out. More spend buys a waitlist, not revenue."
              : `${(d?.capacity.ceiling ?? 7) - (d?.capacity.closed ?? 0)} places left`}
          </div>
        </div>

        {/* The switches: what may go by itself, and the links the follow-ups carry. */}
        <div style={h6}>Settings</div>
        {/* Mounted on demand: each card reads its own settings, and two more
            requests on every load cost cold-start CPU for something he opens
            rarely. */}
        {showSettings ? (
          <div id="payment-links" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            <div style={box}><AutomationToggles t={t} apiKey={adminKey} /></div>
            <div style={box}><PaymentLinksCard t={t} apiKey={adminKey} /></div>
          </div>
        ) : (
          <Button t={t} variant="secondary" size="md" onClick={() => setShowSettings(true)}>
            Open settings: automatic messages and payment links
          </Button>
        )}

        {d?.caveats?.length ? (
          <div style={{ marginTop: 18, fontSize: 11.5, color: t.ink2, lineHeight: 1.6 }}>
            {d.caveats.map((c) => <div key={c}>· {c}</div>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
