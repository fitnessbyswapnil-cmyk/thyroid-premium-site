"use client";

/**
 * His Cashfree payment link for each programme price, pasted once.
 *
 * A follow-up after a call carries the link for the price he quoted her, and
 * only that price (lib/payment-links payLinkFor). One row per price: paste,
 * Save. An empty box saved removes that price's link. The server checks every
 * link (https, a Cashfree address, not a payment form, not a test link) and
 * its reason is shown on the row, word for word.
 *
 * The rows come from the server's own list (GET .../payment-links `tiers`),
 * and only TYPES are imported from lib/payment-links, which reaches the D1
 * binding and must never be bundled for the browser.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PaymentLinks, TierKey } from "@/lib/payment-links";
import { readAdminKey } from "./adminKey";
import { DARK, type Tokens } from "./tokens";

type Reply = { links?: PaymentLinks; tiers?: number[]; stored?: boolean; hint?: string; error?: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const label = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function PaymentLinksCard(p: { t: Tokens; apiKey?: string }) {
  const { t } = p;
  // Text on a teal fill, flipped with the theme as Today does. Tokens is LIGHT's literal type, so compare as strings.
  const onAccent = String(t.paper) === DARK.paper ? t.paper : "#FFFFFF";
  const [tiers, setTiers] = useState<number[] | null>(null);
  const [links, setLinks] = useState<PaymentLinks>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [stored, setStored] = useState(true);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(false);

  const key = useCallback(() => p.apiKey ?? readAdminKey(), [p.apiKey]);

  const take = (j: Reply) => {
    const next = j.links ?? {};
    setLinks(next);
    if (Array.isArray(j.tiers)) setTiers(j.tiers);
    return next;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const r = await fetch("/api/admin/payment-links", { headers: { "x-admin-key": key() }, cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as Reply;
      if (!r.ok || !Array.isArray(j.tiers)) throw new Error(j.hint || j.error || `HTTP ${r.status}`);
      const next = j.links ?? {};
      setLinks(next);
      setTiers(j.tiers);
      setDrafts(Object.fromEntries(j.tiers.map((n) => [String(n), next[String(n) as TierKey] ?? ""])));
      setStored(j.stored !== false);
      setNote(j.stored === false ? j.hint ?? "" : "");
    } catch (e) {
      setLoadError(message(e));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (tier: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(tier);
    setJustSaved(null);
    setErrors((prev) => ({ ...prev, [tier]: "" }));
    try {
      const r = await fetch("/api/admin/payment-links", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": key() },
        body: JSON.stringify({ amount: Number(tier), url: (drafts[tier] ?? "").trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as Reply;
      if (!r.ok || !j.links) throw new Error(j.hint || j.error || `HTTP ${r.status}`);
      const next = take(j);
      setDrafts((prev) => ({ ...prev, [tier]: next[tier as TierKey] ?? "" }));
      setJustSaved(tier);
    } catch (e) {
      setErrors((prev) => ({ ...prev, [tier]: message(e) }));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  return (
    <section aria-label="Payment links" aria-busy={loading}
      style={{ background: t.card, border: `1px solid ${t.hairline}`, borderRadius: 14, padding: 16, marginTop: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: t.ink2 }}>Payment links</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6, color: t.ink1 }}>
        Paste your Cashfree Payment Link for each price. A follow-up carries the link for the price you quoted her.
      </div>

      {loading && !tiers && <div style={{ marginTop: 12, fontSize: 13, color: t.ink2 }}>Reading your links…</div>}
      {loadError && (
        <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5, color: t.clay }}>
          The links could not be read ({loadError}).{" "}
          <button type="button" onClick={() => void load()} disabled={loading}
            style={{ background: "transparent", border: 0, padding: "8px 2px", color: t.teal, fontSize: 13, fontWeight: 600,
              cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
            Try again
          </button>
        </div>
      )}
      {note && <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: t.amber }}>{note}</div>}

      {tiers && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
          {tiers.map((n) => {
            const tier = String(n);
            const saved = links[tier as TierKey] ?? "";
            const draft = drafts[tier] ?? "";
            const changed = draft.trim() !== saved;
            const removing = changed && !draft.trim();
            const saving = busy === tier;
            return (
              <li key={tier} style={{ borderTop: `1px solid ${t.hairline}`, padding: "12px 0" }}>
                <form onSubmit={(e) => { e.preventDefault(); if (changed) void save(tier); }}>
                  <label htmlFor={`paylink-${tier}`} style={{ display: "block", fontSize: 14, fontWeight: 600, color: t.ink1 }}>
                    {label(n)}
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {/* 16px, not the card's 13: iOS zooms the page into any smaller field on focus. */}
                    <input id={`paylink-${tier}`} type="url" inputMode="url" autoCapitalize="none" autoCorrect="off"
                      autoComplete="off" spellCheck={false} enterKeyHint="done"
                      placeholder="https://payments.cashfree.com/links/…"
                      value={draft} disabled={!stored}
                      aria-invalid={Boolean(errors[tier])}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDrafts((prev) => ({ ...prev, [tier]: v }));
                        setErrors((prev) => ({ ...prev, [tier]: "" }));
                        setJustSaved(null);
                      }}
                      style={{ flex: "1 1 220px", minWidth: 0, boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
                        border: `1px solid ${errors[tier] ? t.clay : t.hairline}`, background: t.paper, color: t.ink1,
                        fontSize: 16, fontFamily: "inherit" }} />
                    <button type="submit" disabled={!changed || saving || busy !== null || !stored} aria-busy={saving}
                      style={{ flex: "none", background: removing ? "transparent" : t.teal, color: removing ? t.clay : onAccent,
                        border: removing ? `1px solid ${t.clay}` : 0, borderRadius: 999, padding: "10px 20px",
                        fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", cursor: saving ? "wait" : "pointer",
                        opacity: !changed || !stored || (busy !== null && !saving) ? 0.5 : 1 }}>
                      {saving ? "Saving…" : removing ? "Remove" : "Save"}
                    </button>
                  </div>
                </form>
                <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5, color: t.ink2 }}>
                  {justSaved === tier && !changed ? (
                    <span style={{ color: t.won, fontWeight: 600 }}>{saved ? "Saved. " : "Removed. "}</span>
                  ) : null}
                  {saved ? (
                    <>
                      Follow-ups for {label(n)} carry this link.{" "}
                      {/* Inline colour and underline: globals.css resets every link to inherit. */}
                      <a href={saved} target="_blank" rel="noopener noreferrer"
                        style={{ color: t.teal, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>
                        Open it
                      </a>
                    </>
                  ) : (
                    <>No link yet: a follow-up for {label(n)} goes without one.</>
                  )}
                </div>
                {errors[tier] && <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: t.clay }}>{errors[tier]}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default PaymentLinksCard;
