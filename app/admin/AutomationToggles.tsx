"use client";

/**
 * The automation switches: a compact block on Today, one row per switch in
 * lib/automation-flags.
 *
 * Every switch starts off, and the screen never guesses: a switch that could
 * not be read says so instead of showing "off". Three kinds of row:
 *  - a real switch (thank_you_auto);
 *  - an approval: the fact that Meta approved a drafted template, which the
 *    code cannot see. Shown read-only as "Draft, not submitted to Meta" until
 *    he confirms, in two taps, that WhatsApp Manager shows it approved;
 *  - reserved: shown disabled, "Coming later".
 *
 * ROWS is keyed by FlagKey, so a switch added to lib/automation-flags without
 * a row here fails the type check rather than quietly not appearing.
 *
 * Imports only TYPES from lib/automation-flags: that module reaches the D1
 * binding, which must never be bundled for the browser.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { FlagKey, Flags } from "@/lib/automation-flags";
import { readAdminKey } from "./adminKey";
import { DARK, type Tokens } from "./tokens";

type Row = { kind: "switch" | "approval" | "later"; label: string; help: string; template?: string };

const ROWS: Record<FlagKey, Row> = {
  thank_you_auto: {
    kind: "switch",
    label: "Thank her automatically",
    help: "When you mark a call attended, or Fathom hears her on it, the thank-you goes by itself. Off: you send it from Today.",
  },
  thank_you_template_approved: {
    kind: "approval",
    label: "Thank-you template",
    help: "Lets the thank-you reach her after her 24-hour window shuts. Until then, you send it from your phone.",
    template: "call_thank_you_v1",
  },
  followup_templates_approved: {
    kind: "approval",
    label: "Follow-up templates",
    help: "Lets your day 1, 3 and 7 follow-ups go from the business number after her window shuts. Each is still your tap.",
    template: "followup_day1_v1, followup_day3_v1 and followup_day7_v1",
  },
  confirm_reminder_template_approved: {
    kind: "approval",
    label: "Confirm-your-call template",
    help: "Lets the reminder asking her to reply YES go from the business number after her window shuts.",
    template: "confirm_reminder_v1",
  },
  followups_enabled: { kind: "later", label: "Automatic follow-ups", help: "Follow-ups stay one tap each, sent by you." },
  onboarding_enabled: { kind: "later", label: "Onboarding messages", help: "Onboarding stays a button you press." },
};

const ORDER = Object.keys(ROWS) as FlagKey[];

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function AutomationToggles(p: { t: Tokens; apiKey?: string }) {
  const { t } = p;
  // Text on a teal fill, flipped with the theme as Today does. Tokens is LIGHT's literal type, so compare as strings.
  const onAccent = String(t.paper) === DARK.paper ? t.paper : "#FFFFFF";
  const [flags, setFlags] = useState<Flags | null>(null);
  const [stored, setStored] = useState(true);
  const [note, setNote] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<FlagKey | null>(null);
  const [confirming, setConfirming] = useState<FlagKey | null>(null);
  const [rowError, setRowError] = useState<Partial<Record<FlagKey, string>>>({});
  const inFlight = useRef(false);

  // Read at the moment of the request: the key can be entered after mount.
  const key = useCallback(() => p.apiKey ?? readAdminKey(), [p.apiKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const r = await fetch("/api/admin/automation", { headers: { "x-admin-key": key() }, cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { flags?: Flags; stored?: boolean; hint?: string; error?: string };
      if (!r.ok || !j.flags) throw new Error(j.hint || j.error || `HTTP ${r.status}`);
      setFlags(j.flags);
      setStored(j.stored !== false);
      setNote(j.stored === false ? j.hint ?? "" : "");
    } catch (e) {
      setFlags(null);
      setLoadError(message(e));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = async (k: FlagKey, on: boolean) => {
    // One change at a time: a quick double tap must not send two opposite writes.
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(k);
    setRowError((prev) => ({ ...prev, [k]: "" }));
    try {
      const r = await fetch("/api/admin/automation", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": key() },
        body: JSON.stringify({ key: k, on }),
      });
      const j = (await r.json().catch(() => ({}))) as { flags?: Flags; hint?: string; error?: string };
      if (!r.ok || !j.flags) throw new Error(j.hint || j.error || `HTTP ${r.status}`);
      setFlags(j.flags);
      setConfirming(null);
    } catch (e) {
      setRowError((prev) => ({ ...prev, [k]: message(e) }));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const chip = (text: string, color: string, background: string): React.ReactNode => (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
      lineHeight: 1.4, color, background, border: `1px solid ${t.hairline}`, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );

  const quiet = (label: string, onClick: () => void, disabled = false): React.ReactNode => (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ background: "transparent", border: 0, padding: "8px 2px", color: t.teal, fontSize: 13, fontWeight: 600,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, textDecoration: "underline", textUnderlineOffset: 2 }}>
      {label}
    </button>
  );

  const sw = (k: FlagKey, on: boolean, disabled: boolean): React.ReactNode => {
    const saving = busy === k;
    return (
      <button type="button" role="switch" aria-checked={on} aria-label={ROWS[k].label} aria-busy={saving}
        disabled={disabled || saving} onClick={() => void set(k, !on)}
        // A 48 x 44 target around a 40 x 24 track: big enough for a thumb.
        style={{ flex: "none", width: 48, height: 44, padding: 0, background: "transparent", border: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          cursor: disabled ? "not-allowed" : saving ? "wait" : "pointer", opacity: disabled ? 0.45 : 1 }}>
        <span aria-hidden style={{ position: "relative", width: 40, height: 24, borderRadius: 999,
          background: on ? t.teal : t.sunk, border: `1px solid ${on ? t.teal : t.hairline}`, boxSizing: "border-box",
          transition: "background .15s" }}>
          <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: 999,
            background: on ? onAccent : t.card, border: on ? "none" : `1px solid ${t.hairline}`, boxSizing: "border-box",
            transition: "left .15s" }} />
        </span>
      </button>
    );
  };

  const control = (k: FlagKey): React.ReactNode => {
    const row = ROWS[k];
    const on = flags?.[k] === true;
    const saving = busy === k;
    if (row.kind === "later") {
      return <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{chip("Coming later", t.ink2, t.sunk)}{sw(k, false, true)}</div>;
    }
    if (row.kind === "approval" && !on) {
      return chip(saving ? "Saving…" : "Draft, not submitted to Meta", t.ink2, t.sunk);
    }
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: saving ? t.ink2 : on ? (row.kind === "approval" ? t.won : t.teal) : t.ink2 }}>
          {saving ? "Saving…" : row.kind === "approval" ? "Approved in Meta" : on ? "On" : "Off"}
        </span>
        {sw(k, on, !stored)}
      </div>
    );
  };

  return (
    <section aria-label="Automation" aria-busy={loading}
      style={{ background: t.card, border: `1px solid ${t.hairline}`, borderRadius: 14, padding: 16, marginTop: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: t.ink2 }}>Automation</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6, color: t.ink1 }}>
        What the system may send on its own. Everything starts off.
      </div>

      {loading && !flags && <div style={{ marginTop: 12, fontSize: 13, color: t.ink2 }}>Reading the switches…</div>}
      {loadError && (
        <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5, color: t.clay }}>
          The switches could not be read ({loadError}). Nothing automatic is sent while they cannot be read.{" "}
          {quiet("Try again", () => void load(), loading)}
        </div>
      )}
      {note && <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: t.amber }}>{note}</div>}

      {flags && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
          {ORDER.map((k) => {
            const row = ROWS[k];
            const askApproval = row.kind === "approval" && flags[k] !== true;
            return (
              <li key={k} style={{ borderTop: `1px solid ${t.hairline}`, padding: "10px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: row.kind === "later" ? t.ink2 : t.ink1 }}>{row.label}</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.45, color: t.ink2, marginTop: 2 }}>{row.help}</div>
                  </div>
                  <div style={{ flex: "none" }}>{control(k)}</div>
                </div>
                {askApproval && stored && confirming !== k &&
                  quiet("Meta approved it", () => { setConfirming(k); setRowError((prev) => ({ ...prev, [k]: "" })); }, busy !== null)}
                {askApproval && confirming === k && (
                  <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: t.sunk, border: `1px solid ${t.hairline}` }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: t.ink1 }}>
                      Turn this on only once WhatsApp Manager shows <span style={{ fontWeight: 600 }}>{row.template}</span> as
                      Approved. Until it is, sends fall back to your phone.
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      <button type="button" onClick={() => void set(k, true)} disabled={busy !== null} aria-busy={busy === k}
                        style={{ background: t.teal, color: onAccent, border: 0, borderRadius: 999, padding: "9px 16px",
                          fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy && busy !== k ? 0.5 : 1 }}>
                        {busy === k ? "Saving…" : "Yes, it is approved"}
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} disabled={busy === k}
                        style={{ background: "transparent", color: t.ink2, border: `1px solid ${t.hairline}`, borderRadius: 999,
                          padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {rowError[k] && <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: t.clay }}>{rowError[k]}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default AutomationToggles;
