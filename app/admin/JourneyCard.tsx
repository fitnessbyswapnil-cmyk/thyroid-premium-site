"use client";

/**
 * One woman, one card (lib/next-action): her name and where she is, the
 * steps strip, ONE primary button for the next thing to do, and quiet links
 * for everything else. Today and Pipeline both render this, so the two tabs
 * can never offer her different buttons.
 *
 * What the card decides is decided in lib/next-action, where it is tested;
 * this file only carries out the press. Three rules shape every press here:
 *
 *  - A message goes in ONE click by the path her thread allows (sendPath):
 *    her 24-hour window open → the business number (POST /api/admin/messages);
 *    shut, with the step's template approved → the template
 *    (/api/admin/send-template); otherwise WhatsApp opens on his phone with
 *    the words written. Both server paths write the messages log, which is
 *    what moves her card on. Nothing goes without his click.
 *  - A second tap while a send is in flight is dropped (useOnce). The kit's
 *    `busy` only blocks after a re-render, and a double tap would send her the
 *    same WhatsApp twice.
 *  - Anything that opens a tab opens it inside the tap, before any await, or
 *    the browser blocks it without a word.
 *
 * The inline controls that already were the action stay the action: "Did
 * she join?" with its ten checks, "Did she pay?" with its amounts and date.
 */
import { useState, type JSX } from "react";
import { FONT, RADIUS, ELEV, type Tokens } from "./tokens";
import { Button, type ButtonVariant } from "./ui/Button";
import { StatusPill } from "./ui/StatusPill";
import { JourneySteps } from "./ui/JourneySteps";
import { PrecallTools } from "./PrecallTools";
import { DriveStatus, useDriveTools, useOnce, type DriveTools, type Ink } from "./RowTools";
import { inr, sameIstDay, sendPath, span, type CardAction, type ClientCard, type SendPlan } from "@/lib/next-action";
import { draftWaLink, firstName } from "@/lib/draft-message";
import { META_ATTRIBUTION_WINDOW_DAYS, paymentDateStatus, toDateInputValue } from "@/lib/payment-date";
import { SCORECARD_KEYS, SCORECARD_LABEL, type ScorecardKey } from "@/lib/scorecard";

export type CardHooks = {
  adminKey: string;
  /** Her card changed on the server: reload the feed. */
  onChanged: () => void;
  /** A sentence worth showing at the top of the screen. */
  onNotice?: (m: string) => void;
  onBridgeResult?: (code: string) => void;
};

type Props = {
  t: Tokens;
  ink: Ink;
  card: ClientCard;
  hooks: CardHooks;
  /** The clock, ticked by the screen, for the summary countdown. */
  nowMs: number;
  /** Today: the checks missed most often, said before a call. */
  missedMost?: { key: string; label: string }[];
  /** Pipeline: her details, under the card. */
  children?: React.ReactNode;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function post(adminKey: string, url: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify(body),
  });
}

/** The click is the record (lib/journey-marks). A failure here costs the mark, never the message. */
const recordMark = (adminKey: string, phone: string, kind: string, url = "") =>
  post(adminKey, "/api/admin/journey-mark", { phone, kind, url }).catch(() => undefined);

function Note({ t, children, tone = "dim" }: { t: Tokens; children: React.ReactNode; tone?: "dim" | "bad" | "warn" }) {
  const color = tone === "bad" ? t.clay : tone === "warn" ? t.amber : t.ink2;
  return <div style={{ marginTop: 6, fontFamily: FONT.sans, fontSize: 12, lineHeight: 1.45, color }}>{children}</div>;
}

// ── A message, in one click ─────────────────────────────────────────────────

function SendAction({ t, card, action, hooks, variant, full }: { t: Tokens; card: ClientCard; action: CardAction; hooks: CardHooks; variant: ButtonVariant; full: boolean }) {
  const once = useOnce();
  const [plan, setPlan] = useState<SendPlan>(action.send!);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"sent" | "failed" | undefined>();
  const [err, setErr] = useState("");
  const path = sendPath(plan);
  // "Send from your phone" when it opens his phone with her message written;
  // with no words to carry (Pipeline has no quiz draft), the verb stays.
  const label = path === "phone" && plan.text && !plan.phoneOnly ? "Send from your phone" : action.label;

  const send = () =>
    once("send", async () => {
      setErr("");
      if (path === "phone") {
        if (!plan.wa) {
          setErr("There is no phone number on her card.");
          return;
        }
        window.open(plan.wa, "_blank", "noopener");
        if (action.mark) await recordMark(hooks.adminKey, card.phone, action.mark);
        setStatus("sent");
        if (action.mark) hooks.onChanged();
        return;
      }
      setBusy(true);
      try {
        const r =
          path === "session"
            ? await post(hooks.adminKey, "/api/admin/messages", { phone: card.phone, text: plan.text })
            : await post(hooks.adminKey, "/api/admin/send-template", { phone: card.phone, template: plan.template!.name, params: plan.template!.params });
        const j = (await r.json().catch(() => ({}))) as { error?: string; hint?: string };
        if (!r.ok) {
          const m = String(j.hint || j.error || `HTTP ${r.status}`);
          // Her window shut after the card was built: the retry takes the next path.
          if (path === "session" && /window|24|re-?engag|131047/i.test(m)) {
            setPlan({ ...plan, windowOpen: false });
            setErr(plan.template ? "Her 24-hour window has shut. Press again to send the approved template." : "Her 24-hour window has shut. Press again to send it from your phone.");
          } else {
            // A bare code ("send_failed") says nothing to him; the sentence does.
            setErr(/^[a-z0-9_:]+$/i.test(m) ? `WhatsApp did not send it (${m}). Press again to retry.` : m);
          }
          setStatus("failed");
          return;
        }
        if (action.mark) await recordMark(hooks.adminKey, card.phone, action.mark);
        setStatus("sent");
        hooks.onChanged();
      } catch (e) {
        setErr(message(e));
        setStatus("failed");
      } finally {
        setBusy(false);
      }
    });

  const how =
    status
      ? ""
      : path === "session"
        ? "Sends from the business number, inside her 24-hour window."
        : path === "template"
          ? "Her window is shut, so this sends the approved template."
          : plan.phoneOnly
            ? "Opens WhatsApp on your phone, with the words written."
            : plan.text
              ? "Her 24-hour window is shut, so this opens WhatsApp on your phone with the message written."
              : "Opens her chat on your phone.";
  return (
    <div>
      <Button t={t} variant={variant} fullWidth={full} busy={busy} status={status} onClick={() => void send()} ariaLabel={`${label}, ${card.name || "her"}`}>
        {busy ? "Sending…" : label}
      </Button>
      {full && how ? <Note t={t}>{how}</Note> : null}
      {err ? <Note t={t} tone="bad">{err}</Note> : null}
    </div>
  );
}

// ── Her summary: make it, look at it, send it ───────────────────────────────

function SummaryAction({ t, action, tools, full }: { t: Tokens; action: CardAction; tools: DriveTools; full: boolean }) {
  const s = tools.summary;
  const variant: ButtonVariant = action.danger ? "danger" : "primary";
  if (s?.phase === "ready") {
    if (s.sentAt) {
      return (
        <Button t={t} variant={variant} fullWidth={full} status="sent">
          Summary sent
        </Button>
      );
    }
    if (s.windowOpen) {
      return (
        <Button t={t} variant={variant} fullWidth={full} busy={tools.busy.send} onClick={() => void tools.sendSummary()}>
          {tools.busy.send ? "Sending…" : "Send to her"}
        </Button>
      );
    }
    return (
      <Button t={t} variant={variant} fullWidth={full} onClick={() => void tools.sendSummaryFromPhone()}>
        Send from your phone
      </Button>
    );
  }
  // Made earlier (after a reload): opening the PDF IS the review.
  if (action.pdfUrl) {
    return (
      <Button t={t} variant={variant} fullWidth={full} onClick={() => tools.reviewSummary(action.pdfUrl!, !!action.send?.windowOpen)}>
        {action.label}
      </Button>
    );
  }
  // Making it opens it, which is the review; the button then becomes the send.
  return (
    <Button t={t} variant={variant} fullWidth={full} busy={tools.busy.summary} onClick={() => void tools.makeSummary()}>
      {tools.busy.summary ? "Making her summary…" : action.label}
    </Button>
  );
}

// ── Thank-you (T's route), one tap after the call ───────────────────────────

function ThanksAction({ t, card, action, hooks, variant, full }: { t: Tokens; card: ClientCard; action: CardAction; hooks: CardHooks; variant: ButtonVariant; full: boolean }) {
  const once = useOnce();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"sent" | "failed" | undefined>();
  const [waText, setWaText] = useState("");
  const [err, setErr] = useState("");
  const press = () =>
    once("thanks", async () => {
      setErr("");
      if (waText) {
        const wa = draftWaLink(card.phone, waText);
        if (!wa) return;
        window.open(wa, "_blank", "noopener");
        await recordMark(hooks.adminKey, card.phone, "thank_you_sent");
        setStatus("sent");
        return;
      }
      setBusy(true);
      try {
        const r = await post(hooks.adminKey, "/api/admin/thank-you", { name: card.name, phone: card.phone, bookingUid: card.bookingUid });
        const j = (await r.json().catch(() => ({}))) as { error?: string; hint?: string; waText?: string };
        if (r.status === 409 && j.error === "window_closed") {
          // Her window is shut and no approved template can go: his phone, with the words written.
          setWaText(String(j.waText || `Hi ${firstName(card.name)}, thank you for your time on our call.`));
          return;
        }
        if (!r.ok) throw new Error(j.hint || j.error || `HTTP ${r.status}`);
        setStatus("sent");
      } catch (e) {
        setErr(message(e));
        setStatus("failed");
      } finally {
        setBusy(false);
      }
    });
  return (
    <div>
      <Button t={t} variant={variant} fullWidth={full} busy={busy} status={status} onClick={() => void press()}>
        {busy ? "Sending…" : waText ? "Thanks from your phone" : action.label}
      </Button>
      {waText && !status ? <Note t={t}>Her 24-hour window is shut, so this opens WhatsApp on your phone.</Note> : null}
      {err ? <Note t={t} tone="bad">{err}</Note> : null}
    </div>
  );
}

// ── Onboarding: his record that she has started ─────────────────────────────

function OnboardAction({ t, card, action, hooks, variant, full }: { t: Tokens; card: ClientCard; action: CardAction; hooks: CardHooks; variant: ButtonVariant; full: boolean }) {
  const once = useOnce();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"sent" | "failed" | undefined>();
  const press = () =>
    once("onboard", async () => {
      setBusy(true);
      try {
        const r = await post(hooks.adminKey, "/api/admin/journey-mark", { phone: card.phone, kind: "onboarded" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setStatus("sent");
        hooks.onChanged();
      } catch {
        setStatus("failed");
      } finally {
        setBusy(false);
      }
    });
  return (
    <Button t={t} variant={variant} fullWidth={full} busy={busy} status={status} onClick={() => void press()}>
      {action.label}
    </Button>
  );
}

// ── Did she join? (was "Mark your calls") ───────────────────────────────────

/**
 * "Did she join?" first; a yes opens the price he named and the ten checks.
 * Saving writes the Calls sheet through /api/admin/call-outcome, which is what
 * show-up rate and the checklist read. Nothing here reaches Meta: a sale is
 * still recorded with "Did she pay?".
 */
function MarkCallControl({ t, card, hooks }: { t: Tokens; card: ClientCard; hooks: CardHooks }) {
  const once = useOnce();
  const [joined, setJoined] = useState(false);
  const [checks, setChecks] = useState<Partial<Record<ScorecardKey, boolean>>>({});
  const [priced, setPriced] = useState(-1);
  const [busy, setBusy] = useState<"" | "yes" | "no">("");
  const [err, setErr] = useState("");
  const save = (attended: boolean) =>
    once("mark", async () => {
      setBusy(attended ? "yes" : "no");
      setErr("");
      try {
        const r = await post(hooks.adminKey, "/api/admin/call-outcome", {
          bookingUid: card.bookingUid, attended, occurredAt: card.callAt,
          name: card.name, email: card.email, phone: card.phone,
          ...(attended ? { checks } : {}),
          ...(attended && priced > 0 ? { pricePitched: priced } : {}),
        });
        const j = (await r.json().catch(() => ({}))) as { reason?: string; error?: string };
        if (!r.ok) throw new Error(j.reason || j.error || `HTTP ${r.status}`);
        hooks.onNotice?.(attended ? `Saved: ${card.name || "she"} attended.` : `Saved: ${card.name || "she"} did not join.`);
        hooks.onChanged();
      } catch (e) {
        setErr(message(e));
      } finally {
        setBusy("");
      }
    });
  const pill = (on: boolean, color: string): React.CSSProperties => ({
    background: on ? `${color}22` : "transparent", color: on ? color : t.ink2,
    border: `1px solid ${on ? color : t.hairline}`, borderRadius: RADIUS.chip,
    padding: "4px 11px", fontSize: 12, fontFamily: FONT.sans, cursor: "pointer", minHeight: 30,
  });
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: t.ink1, marginRight: 2 }}>Did she join?</span>
        <Button t={t} variant={joined ? "primary" : "secondary"} size="sm" disabled={!!busy} onClick={() => setJoined(true)}>
          Yes
        </Button>
        <Button t={t} variant="secondary" size="sm" busy={busy === "no"} disabled={busy === "yes"} onClick={() => void save(false)}>
          No, no-show
        </Button>
      </div>
      {joined ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.hairline}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontFamily: FONT.sans, fontSize: 12.5, color: t.ink1, marginRight: 2 }}>Price you named</span>
            {[0, 15000, 20000, 25000, 30000].map((amt) => (
              <button key={amt} type="button" onClick={() => setPriced(amt)} style={pill(priced === amt, t.teal)}>
                {amt === 0 ? "None" : inr(amt)}
              </button>
            ))}
          </div>
          <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: t.ink2, marginBottom: 8 }}>Tap each check you did. Leave the ones that did not apply.</div>
          <div style={{ display: "grid", gap: 6 }}>
            {SCORECARD_KEYS.map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.4, color: t.ink1 }}>{SCORECARD_LABEL[k]}</span>
                {([true, false] as const).map((val) => (
                  <button key={String(val)} type="button" onClick={() => setChecks((x) => ({ ...x, [k]: val }))}
                    style={{ ...pill(checks[k] === val, val ? t.won : t.clay), flex: "none", padding: "3px 10px", fontSize: 11.5 }}>
                    {val ? "Did" : "Missed"}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Button t={t} variant="primary" fullWidth busy={busy === "yes"} onClick={() => void save(true)}>
              {busy === "yes" ? "Saving…" : "Save call"}
            </Button>
          </div>
          <Note t={t}>If she paid for the programme, record it in &ldquo;Did she pay?&rdquo;. That is what tells Meta.</Note>
        </div>
      ) : null}
      {err ? <Note t={t} tone="bad">{err}</Note> : null}
    </div>
  );
}

// ── Did she pay? (the one thing no webhook can see) ─────────────────────────

/**
 * Marking it stamps the programme columns AND sends the Purchase to Meta
 * (/api/admin/mark), so the date travels with it: the money often lands days
 * before he marks it. The decision-maker question sits BEFORE the amounts on
 * purpose: marking the money takes her off the list, so a question after it
 * would only ever be answered by accident.
 */
function PaidControl({ t, card, hooks, nowMs }: { t: Tokens; card: ClientCard; hooks: CardHooks; nowMs: number }) {
  const ask = card.paidAsk!;
  const once = useOnce();
  const todayValue = toDateInputValue(new Date(nowMs));
  const [payDate, setPayDate] = useState(todayValue);
  const [saving, setSaving] = useState(false);
  const [dm, setDm] = useState<"" | "yes" | "no">("");
  const [dmBusy, setDmBusy] = useState(false);
  const [err, setErr] = useState("");
  const when = paymentDateStatus(payDate, nowMs);
  const dmAnswer = dm || (ask.dmPresent ?? "").trim().toLowerCase();
  const amounts = ask.pitched > 0 ? [ask.pitched] : [15000, 20000, 25000, 30000];

  const markClosed = (amount: number, collected?: number) =>
    once("paid", async () => {
      if (!when.valid || when.ms === null) {
        setErr(when.future ? "That payment date is in the future." : "That payment date is not a real date.");
        return;
      }
      setSaving(true);
      setErr("");
      try {
        const r = await post(hooks.adminKey, "/api/admin/mark", {
          row: ask.row, field: "closed", value: String(amount),
          paidAt: new Date(when.ms).toISOString(),
          ...(collected ? { collected } : {}),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        // The server says what Meta did with the timestamp; a clamped event must not read as a clean one.
        const body = (await r.json().catch(() => ({}))) as { meta?: { status?: string; tooOld?: boolean } };
        const m = body.meta;
        if (m?.tooOld) hooks.onNotice?.(`Saved. Meta had to move the event time forward: this sale is older than ${META_ATTRIBUTION_WINDOW_DAYS} days, so its attribution is unreliable.`);
        else if (m && m.status !== "sent" && m.status !== "already_sent") hooks.onNotice?.(`Saved to the sheet, but Meta did not accept the sale (${m.status}).`);
        hooks.onChanged();
      } catch (e) {
        setErr(message(e));
      } finally {
        setSaving(false);
      }
    });

  const markDm = (present: "yes" | "no") =>
    once("dm", async () => {
      setDmBusy(true);
      setDm(present);
      try {
        const r = await post(hooks.adminKey, "/api/admin/mark", { row: ask.row, field: "dmPresent", value: present });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } catch (e) {
        // Put the answer back rather than leaving a tap that looks saved and is not.
        setDm("");
        setErr(message(e));
      } finally {
        setDmBusy(false);
      }
    });

  return (
    <div>
      <div style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: t.ink1 }}>Did she pay?</div>
      <div style={{ fontFamily: FONT.sans, fontSize: 12.5, color: t.ink2, marginTop: 2 }}>
        {ask.pitched > 0 ? `Pitched ${inr(ask.pitched)}` : "No price captured"}
        {" · "}
        {ask.daysSince === 0 ? "today" : `${ask.daysSince}d ago`}
      </div>
      {ask.objection ? <div style={{ fontFamily: FONT.sans, fontSize: 12, color: t.amber, marginTop: 4 }}>{ask.objection.slice(0, 70)}</div> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <span style={{ fontFamily: FONT.sans, fontSize: 12, color: t.ink2 }}>Paid on</span>
        <input type="date" value={payDate} max={todayValue} onChange={(e) => setPayDate(e.target.value)}
          style={{ background: "transparent", color: t.ink1, border: `1px solid ${t.hairline}`, borderRadius: 8, padding: "6px 8px", fontSize: 13, fontFamily: FONT.sans }} />
      </div>
      {when.stale ? (
        <Note t={t} tone="warn">Older than {META_ATTRIBUTION_WINDOW_DAYS} days, so Meta may not attribute this sale. Mark payments the same day.</Note>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONT.sans, fontSize: 12, color: t.ink2, marginRight: 2 }}>Decision-maker on the call?</span>
        {(["yes", "no"] as const).map((v) => (
          <Button key={v} t={t} variant={dmAnswer === v ? "primary" : "secondary"} size="sm" disabled={dmBusy} onClick={() => void markDm(v)}>
            {v === "yes" ? "Yes" : "No"}
          </Button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {amounts.map((amt) => (
          <Button key={amt} t={t} variant={amounts.length === 1 ? "primary" : "secondary"} busy={saving} onClick={() => void markClosed(amt)}>
            Paid {inr(amt)}
          </Button>
        ))}
        <Button t={t} variant="quiet" disabled={saving}
          onClick={() => {
            const v = window.prompt("Total agreed (₹)", ask.pitched ? String(ask.pitched) : "");
            if (!v) return;
            const total = Number(v.replace(/[^\d]/g, ""));
            if (!total) return;
            const c = window.prompt(`Received now (₹). Leave as ${total} if paid in full`, String(total));
            const got = Number(String(c ?? total).replace(/[^\d]/g, "")) || total;
            void markClosed(total, got);
          }}>
          Part payment…
        </Button>
      </div>
      {err ? <Note t={t} tone="bad">{err}</Note> : null}
    </div>
  );
}

// ── The card ────────────────────────────────────────────────────────────────

function ActionView({ t, card, action, hooks, tools, nowMs, role }: {
  t: Tokens; card: ClientCard; action: CardAction; hooks: CardHooks; tools: DriveTools; nowMs: number; role: "primary" | "secondary";
}): JSX.Element | null {
  const full = role === "primary";
  const variant: ButtonVariant = role === "primary" ? (action.danger ? "danger" : "primary") : "secondary";
  switch (action.kind) {
    case "message":
      return <SendAction t={t} card={card} action={action} hooks={hooks} variant={variant} full={full} />;
    case "notes":
      return (
        <Button t={t} variant={variant} fullWidth={full} busy={tools.busy.notes} onClick={() => void tools.openNotes()}>
          {tools.busy.notes ? "Opening her notes…" : action.label}
        </Button>
      );
    case "summary":
      return <SummaryAction t={t} action={action} tools={tools} full={full} />;
    case "precall":
      return <PrecallTools t={t} name={card.name} phone={card.phone} when={card.callAt} apiKey={hooks.adminKey} />;
    case "thanks":
      return <ThanksAction t={t} card={card} action={action} hooks={hooks} variant={variant} full={full} />;
    case "onboard":
      return <OnboardAction t={t} card={card} action={action} hooks={hooks} variant={variant} full={full} />;
    case "link":
      return (
        <Button t={t} variant={variant} fullWidth={full} href={action.href}>
          {action.label}
        </Button>
      );
    case "mark_call":
      return card.bookingUid ? <MarkCallControl t={t} card={card} hooks={hooks} /> : null;
    case "paid":
      return card.paidAsk ? <PaidControl t={t} card={card} hooks={hooks} nowMs={nowMs} /> : null;
    default:
      return null;
  }
}

/** The countdown is the screen's clock, not the feed's: it keeps moving between reloads. */
function pillOf(card: ClientCard, tools: DriveTools, nowMs: number): { tone: ClientCard["status"]["tone"]; label: string } {
  if (card.status.tone === "failed") return card.status;
  if (tools.summary?.phase === "ready" && tools.summary.sentAt) return { tone: "ok", label: "Summary sent" };
  const due = Date.parse(card.summaryDue?.at ?? "");
  if (Number.isFinite(due)) {
    return nowMs > due
      ? { tone: "attention", label: `Summary overdue ${span(nowMs - due)}` }
      : { tone: "progress", label: `Summary due in ${span(due - nowMs)}` };
  }
  return card.status;
}

export default function JourneyCard({ t, ink, card, hooks, nowMs, missedMost, children }: Props) {
  const tools = useDriveTools({
    adminKey: hooks.adminKey,
    ink,
    name: card.name,
    phone: card.phone,
    // Her call's time dates the Doc and the PDF: a Doc opened from a row the
    // day after her call used to be filed under the day of the tap.
    notesWhen: card.callAt || undefined,
    summaryWhen: card.callAt,
    onBridgeResult: hooks.onBridgeResult,
  });
  const p = card.primary;
  const pill = pillOf(card, tools, nowMs);
  const danger = !!p?.danger && !(tools.summary?.phase === "ready" && tools.summary.sentAt);
  const start = Date.parse(card.callAt);
  const callToday = card.stage === "booked" && sameIstDay(start, nowMs);
  const beforeCall = card.stage === "booked" && Number.isFinite(start) && nowMs < start;
  const hasJob = (kind: CardAction["kind"]) => p?.kind === kind || card.secondary.some((a) => a.kind === kind);
  const postCall = ["attended", "pitched", "lost", "won", "unknown"].includes(card.stage) && !!card.callAt;
  const showNotes = !!card.callAt && !!card.phone && !hasJob("notes");
  const showSummary = postCall && card.phone.length === 10 && !hasJob("summary");

  return (
    <article
      style={{
        background: t.card,
        border: `1px solid ${danger ? t.clay : t.hairline}`,
        borderLeft: `3px solid ${danger ? t.clay : t.hairline}`,
        borderRadius: RADIUS.card,
        boxShadow: ELEV.e1,
        padding: "14px 14px 10px",
        fontFamily: FONT.sans,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: t.ink1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.name || "(no name)"}
          </div>
          <div style={{ fontSize: 12.5, color: t.ink2, marginTop: 2, lineHeight: 1.4 }}>{card.context}</div>
        </div>
        <div style={{ flex: "none", paddingTop: 1 }}>
          <StatusPill t={t} tone={pill.tone} title={card.stageLabel}>
            {pill.label}
          </StatusPill>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <JourneySteps t={t} steps={card.steps} compact ariaLabel={`${card.name || "Her"} journey`} />
      </div>

      {card.badge ? (
        <div style={{ marginTop: 8 }}>
          <StatusPill t={t} tone={card.badge.tone === "warn" ? "attention" : "ok"}>
            {card.badge.label}
          </StatusPill>
        </div>
      ) : null}

      <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.45, color: danger ? t.clay : t.ink2 }}>{card.reason}</div>

      {p ? (
        // Full width on a phone; on a desk-wide card a 1,100px button is a banner, not a button.
        <div style={{ marginTop: 10, maxWidth: 480 }}>
          {/* Keyed by the action, so a reload that moves her on gets a fresh button, not the last one's "Sent". */}
          <ActionView key={`${p.id}:${p.label}`} t={t} card={card} action={p} hooks={hooks} tools={tools} nowMs={nowMs} role="primary" />
          {p.note ? <Note t={t} tone="warn">{p.note}</Note> : null}
        </div>
      ) : null}

      {card.secondary.length ? (
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {card.secondary.map((a) => (
            <ActionView key={`${a.id}:${a.label}`} t={t} card={card} action={a} hooks={hooks} tools={tools} nowMs={nowMs} role="secondary" />
          ))}
        </div>
      ) : null}

      {/* Her pre-call PDF is his to make on any booked card before the call;
          when it is the next thing to do it already sits in the primary slot. */}
      {beforeCall && p?.kind !== "precall" && card.phone ? (
        <div style={{ marginTop: 10 }}>
          <PrecallTools t={t} name={card.name} phone={card.phone} when={card.callAt} apiKey={hooks.adminKey} />
        </div>
      ) : null}

      <DriveStatus tools={tools} t={t} ink={ink} name={card.name} phone={card.phone} inlineSend={!hasJob("summary")} />

      {/* Quiet links: everything that is not the next thing, one tap away. */}
      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, marginLeft: -6 }}>
        {card.wa ? (
          <Button t={t} variant="quiet" size="sm" href={card.wa} target="_blank" ariaLabel={`WhatsApp ${card.name || "her"}`}>
            WhatsApp
          </Button>
        ) : null}
        {card.phone ? (
          <Button t={t} variant="quiet" size="sm" busy={tools.busy.drive} title="Open her folder in Google Drive" onClick={() => void tools.openFolder()}>
            Drive
          </Button>
        ) : null}
        {showNotes ? (
          <Button t={t} variant="quiet" size="sm" busy={tools.busy.notes} title="Open her call-notes Doc" onClick={() => void tools.openNotes()}>
            Notes
          </Button>
        ) : null}
        {showSummary ? (
          <Button t={t} variant="quiet" size="sm" busy={tools.busy.summary} title="Make her summary PDF again" onClick={() => void tools.makeSummary()}>
            Summary
          </Button>
        ) : null}
        {card.report?.url ? (
          <Button t={t} variant="quiet" size="sm" href={card.report.url} target="_blank" title="The newest report she sent">
            {card.report.count > 1 ? `Report (${card.report.count})` : "Report"}
          </Button>
        ) : null}
      </div>

      {/* Before the call, not after it: the checks missed most often. */}
      {callToday && missedMost?.length ? (
        <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px solid ${t.hairline}`, fontSize: 12.5, lineHeight: 1.5 }}>
          <div style={{ color: t.amber, fontWeight: 700, marginBottom: 3 }}>On this call, don&rsquo;t miss:</div>
          {missedMost.slice(0, 3).map((ck, i) => (
            <div key={ck.key} style={{ color: t.ink1 }}>
              {i + 1}. {ck.label}
            </div>
          ))}
        </div>
      ) : null}
      {card.badge?.prompt ? (
        <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px solid ${t.hairline}`, fontSize: 12.5, lineHeight: 1.5, color: t.amber }}>{card.badge.prompt}</div>
      ) : null}

      {children}
    </article>
  );
}
