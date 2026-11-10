"use client";

/**
 * The pre-call PDF on a booked card: "Why your weight isn't moving: what your
 * answers and your report show". The journey card mounts it before her call.
 *
 * One button opens a small form: her report's markers, one row each (marker,
 * value, range, flag), typed by him or pre-filled by "Read her report", which
 * asks the AI to copy the values off her newest saved report. Either way he
 * checks the rows; the PDF is built only from what is in the form when he
 * presses Generate, or, when he leaves every row empty, from the marker table
 * in her notes Doc. Generate opens the PDF in a tab made inside the tap, as
 * Notes and Summary do (./RowTools pendingTab), so no popup blocker eats it.
 *
 * SEND ONLY WHAT HE REVIEWED
 * Send re-posts the exact rows the open PDF was made from. Edit a row after
 * generating and Send waits until he generates again, so what reaches her is
 * always the PDF he looked at. Outside her 24-hour window the business number
 * cannot send a file, and the button becomes "Send from your phone".
 *
 * The decisions behind every state (what a reply means, how a reading merges
 * into rows he already typed, when two sets of rows are the same PDF) live in
 * lib/precall.ts, pure and tested; this file only renders them.
 */
import { useCallback, useId, useRef, useState, type CSSProperties, type JSX } from "react";
import type { Tokens } from "./tokens";
import { pendingTab } from "./RowTools";
import { readAdminKey } from "./adminKey";
import { istClock } from "@/lib/admin-actions";
import { draftWaLink } from "@/lib/draft-message";
import {
  afterPrecallSend,
  extractFromReply,
  mergeReadRows,
  precallCaption,
  precallFromReply,
  sameRows,
  type ExtractView,
  type MarkerRow,
  type PrecallView,
} from "@/lib/precall";

type Row = { id: number; marker: string; value: string; range: string; flag: string };
type Field = "marker" | "value" | "range" | "flag";

const plain = (rows: Row[]): MarkerRow[] => rows.map(({ marker, value, range, flag }) => ({ marker, value, range, flag }));
const filled = (r: Row) => Boolean(r.marker.trim() || r.value.trim() || r.range.trim() || r.flag.trim());
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Text on a filled teal button: white on the light theme, the paper colour on the dark one, where teal is light. */
function onAccent(t: Tokens): string {
  const hex = t.paper.replace("#", "");
  const n = parseInt(hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex, 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum < 0.5 ? t.paper : "#FFFFFF";
}

export function PrecallTools({ t, name, phone, when, apiKey }: { t: Tokens; name: string; phone: string; when: string; apiKey?: string }): JSX.Element {
  const flagList = useId();
  const nextId = useRef(1);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ id: 0, marker: "", value: "", range: "", flag: "" }]);
  const [busy, setBusy] = useState({ read: false, make: false, send: false });
  const [reading, setReading] = useState<ExtractView | null>(null);
  const [view, setView] = useState<PrecallView | null>(null);
  // The rows the open PDF was made from: Send posts these, never the live form.
  const [madeFrom, setMadeFrom] = useState<MarkerRow[] | null>(null);
  const mark = (k: keyof typeof busy, v: boolean) => setBusy((b) => ({ ...b, [k]: v }));

  // One tap, one request: a second tap while the first is running is dropped,
  // not queued (a double tap is two tabs and two PDFs otherwise).
  const running = useRef(new Set<string>());
  const once = useCallback(async (key: string, run: () => Promise<void>) => {
    if (running.current.has(key)) return;
    running.current.add(key);
    try {
      await run();
    } finally {
      running.current.delete(key);
    }
  }, []);

  const post = (url: string, body: unknown) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": apiKey || readAdminKey() },
      body: JSON.stringify(body),
    });

  const newRow = (m?: MarkerRow): Row => ({
    id: nextId.current++,
    marker: m?.marker ?? "",
    value: m?.value ?? "",
    range: m?.range ?? "",
    flag: m?.flag ?? "",
  });
  const update = (id: number, field: Field, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const addRow = () => setRows((rs) => [...rs, newRow()]);
  const removeRow = (id: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : [newRow()]));

  // The AI copies the values off her newest saved report into the form. Rows
  // he already typed stay as they are; only markers he has not typed are added.
  const readReport = () =>
    once("read", async () => {
      mark("read", true);
      try {
        const r = await post("/api/admin/precall/extract", { name, phone });
        const v = extractFromReply(r.status, await r.json().catch(() => null));
        setReading(v);
        if (v.phase === "read" && v.rows.length) {
          setRows((cur) => {
            const kept = cur.filter(filled);
            const added = mergeReadRows(plain(kept), v.rows).slice(kept.length).map(newRow);
            const next = [...kept, ...added];
            return next.length ? next : [newRow()];
          });
        }
      } catch (e) {
        setReading({ phase: "error", code: "network", hint: message(e), reportUrl: "" });
      } finally {
        mark("read", false);
      }
    });

  // The PDF, saved in her folder and opened in a tab made inside the tap.
  // Same lock as Send: a send racing a regenerate would report on the wrong PDF.
  const generate = () =>
    once("make", async () => {
      const snapshot = plain(rows);
      mark("make", true);
      const tab = pendingTab("Making her pre-call PDF…", { bg: t.paper, dim: t.ink2 });
      try {
        const r = await post("/api/admin/precall", { name, phone, when, markers: snapshot });
        const v = precallFromReply(r.status, await r.json().catch(() => null), new Date().toISOString());
        setView(v);
        if (v.phase === "ready") {
          setMadeFrom(snapshot);
          // No tab means the browser refused one; the card's Open link does the same job.
          tab?.location.replace(v.pdfUrl);
        } else {
          tab?.close();
        }
      } catch (e) {
        tab?.close();
        setView({ phase: "error", code: "network", hint: message(e) });
      } finally {
        mark("make", false);
      }
    });

  const sendNow = () =>
    once("make", async () => {
      if (view?.phase !== "ready" || !madeFrom) return;
      const prev = view;
      mark("send", true);
      try {
        const r = await post("/api/admin/precall", { name, phone, when, markers: madeFrom, send: true });
        setView(afterPrecallSend(prev, r.status, await r.json().catch(() => null), new Date().toISOString()));
      } catch (e) {
        setView({ ...prev, sendError: message(e) });
      } finally {
        mark("send", false);
      }
    });

  // His own WhatsApp opens with the words; the tap is recorded for the
  // journey card's Pre-call step. Recording it must never block the link.
  const sentFromPhone = (pdfUrl: string) => {
    void post("/api/admin/precall", { phone, sentFromPhone: true, pdfUrl }).catch(() => {});
  };

  // ── look ─────────────────────────────────────────────────────────────────
  const ink = onAccent(t);
  const pill = (on: boolean): CSSProperties => ({
    background: "transparent", border: `1px solid ${t.hairline}`, color: t.ink1,
    borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, lineHeight: 1.2,
    cursor: on ? "wait" : "pointer", whiteSpace: "nowrap", opacity: on ? 0.75 : 1,
  });
  const primary = (on: boolean, off = false): CSSProperties => ({
    background: t.teal, color: ink, border: 0, borderRadius: 999, padding: "9px 16px",
    fontSize: 13, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap",
    cursor: on ? "wait" : off ? "not-allowed" : "pointer", opacity: on ? 0.8 : off ? 0.45 : 1,
  });
  // 16px: anything smaller and iOS zooms the page when a box takes focus.
  const box: CSSProperties = {
    width: "100%", minWidth: 0, boxSizing: "border-box", border: `1px solid ${t.hairline}`, borderRadius: 6,
    background: t.card, color: t.ink1, padding: "8px 10px", fontSize: 16, lineHeight: 1.3, fontFamily: "inherit",
  };
  const line = (color: string): CSSProperties => ({ marginTop: 8, fontSize: 12, lineHeight: 1.45, color });
  // Inline colour and underline: globals.css resets every link to inherit.
  const link: CSSProperties = { color: t.teal, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 };
  const dot = <span aria-hidden style={{ color: t.ink2 }}>·</span>;

  const makeBusy = busy.make || busy.send;
  const ready = view?.phase === "ready" ? view : null;
  const changed = Boolean(ready && madeFrom && !sameRows(plain(rows), madeFrom));
  const noPhone = phone.replace(/\D/g, "").length < 10;

  let readLine: React.ReactNode = null;
  if (reading?.phase === "read") {
    readLine = (
      <>
        <div style={line(reading.rows.length ? t.ink2 : t.amber)}>
          {reading.rows.length ? `Filled ${reading.rows.length} ${reading.rows.length === 1 ? "row" : "rows"} from her report. ` : ""}
          {reading.note}
          {reading.reportUrl ? (
            <>
              {" "}
              <a href={reading.reportUrl} target="_blank" rel="noopener noreferrer" style={link}>Open her report</a>
            </>
          ) : null}
        </div>
        {reading.warnings.map((w) => <div key={w} style={line(t.ink2)}>{w}</div>)}
      </>
    );
  } else if (reading?.phase === "error") {
    readLine = (
      <div style={line(reading.code === "no_ai_key" ? t.amber : t.clay)}>
        {reading.code === "no_ai_key" ? <strong style={{ fontWeight: 700 }}>Add the AI key. </strong> : null}
        {reading.hint}
        {reading.reportUrl ? (
          <>
            {" "}
            <a href={reading.reportUrl} target="_blank" rel="noopener noreferrer" style={link}>Open her report</a>
          </>
        ) : null}
      </div>
    );
  }

  let status: React.ReactNode = null;
  if (ready) {
    const wa = ready.sentAt || ready.windowOpen ? "" : draftWaLink(phone, ready.waText || precallCaption(name));
    status = (
      <>
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 8px", fontSize: 12.5, lineHeight: 1.4 }}>
          <span style={{ color: t.teal, fontWeight: 700 }}>PDF ready</span>
          {dot}
          <a href={ready.pdfUrl} target="_blank" rel="noopener noreferrer" style={link}>Open</a>
          {ready.sentAt ? (
            <>
              {dot}
              <span style={{ color: t.won, fontWeight: 700 }}>Sent {istClock(ready.sentAt)}</span>
            </>
          ) : ready.windowOpen ? (
            <>
              {dot}
              <button type="button" onClick={sendNow} disabled={makeBusy || changed} aria-busy={busy.send}
                title={changed ? "Generate again first: the markers changed" : "Send this PDF to her on WhatsApp"}
                style={{ ...primary(busy.send, changed), padding: "5px 13px", fontSize: 12.5 }}>
                {busy.send ? "Sending…" : "Send to her"}
              </button>
            </>
          ) : null}
        </div>
        {changed && !ready.sentAt && (
          <div style={line(t.amber)}>You changed the markers after making this PDF. Generate again and check it before you send.</div>
        )}
        {/* The phone fallback is a different act (he attaches the file himself), so it gets its own line. */}
        {!ready.sentAt && !ready.windowOpen && (
          wa ? (
            <div style={{ marginTop: 9 }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => sentFromPhone(ready.pdfUrl)}
                style={{ display: "inline-block", border: `1px solid ${t.teal}`, color: t.teal, borderRadius: 999,
                  padding: "6px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                Send from your phone
              </a>
              <div style={line(t.ink2)}>
                {ready.sendError ? "This opens WhatsApp on your phone." : "Her 24-hour window has shut, so this opens WhatsApp on your phone."}
                {" "}Attach the PDF there.
              </div>
            </div>
          ) : (
            <div style={line(t.ink2)}>No phone number on this card to send it to.</div>
          )
        )}
        {ready.sendError && <div style={line(t.clay)}>{ready.sendError}</div>}
        {ready.warnings.map((w) => <div key={w} style={line(t.ink2)}>{w}</div>)}
      </>
    );
  } else if (view?.phase === "error") {
    status = <div style={line(t.clay)}>{view.hint}</div>;
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        title="Her pre-call PDF: her answers and her report, before the call" style={pill(false)}>
        Pre-call PDF
      </button>
      {open && (
        <div style={{ marginTop: 10, border: `1px solid ${t.hairline}`, borderRadius: 6, background: t.card, padding: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: t.ink2, fontWeight: 700 }}>
              Her report markers
            </div>
            <button type="button" onClick={readReport} disabled={busy.read || noPhone} aria-busy={busy.read}
              title="Copy the values off her newest saved report into the rows below" style={pill(busy.read)}>
              {busy.read ? "Reading…" : "Read her report"}
            </button>
          </div>
          {readLine}

          {rows.map((r, i) => (
            <div key={r.id} style={{ marginTop: 10, paddingTop: i ? 10 : 0, borderTop: i ? `1px solid ${t.hairline}` : "none" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input aria-label={`Marker ${i + 1}`} placeholder="Marker, like TSH" value={r.marker}
                  onChange={(e) => update(r.id, "marker", e.target.value)} style={{ ...box, flex: 1 }} />
                <button type="button" onClick={() => removeRow(r.id)} aria-label={`Remove marker ${i + 1}`} title="Remove this row"
                  style={{ ...pill(false), padding: 0, width: 36, height: 36, flex: "0 0 36px", fontSize: 18, lineHeight: 1, color: t.ink2 }}>
                  ×
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, marginTop: 6 }}>
                <input aria-label={`Value ${i + 1}`} placeholder="Value" value={r.value}
                  onChange={(e) => update(r.id, "value", e.target.value)} style={box} />
                <input aria-label={`Range ${i + 1}`} placeholder="Range" value={r.range}
                  onChange={(e) => update(r.id, "range", e.target.value)} style={box} />
                <input aria-label={`Flag ${i + 1}`} placeholder="Flag" list={flagList} value={r.flag}
                  onChange={(e) => update(r.id, "flag", e.target.value)} style={box} />
              </div>
            </div>
          ))}
          <datalist id={flagList}>
            <option value="high" />
            <option value="low" />
            <option value="borderline" />
          </datalist>

          <button type="button" onClick={addRow}
            style={{ marginTop: 10, background: "transparent", border: 0, padding: "4px 0", color: t.teal, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Add marker
          </button>
          <div style={line(t.ink2)}>Leave every row empty to use the marker table in her notes Doc.</div>

          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button type="button" onClick={generate} disabled={makeBusy || noPhone} aria-busy={busy.make}
              title="Make her pre-call PDF, save it in her folder and open it" style={primary(busy.make, noPhone)}>
              {busy.make ? "Making…" : ready ? "Generate again" : "Generate PDF"}
            </button>
          </div>
          {noPhone && <div style={line(t.ink2)}>No phone number on this card, so there is no folder to save it in.</div>}
          {status}
        </div>
      )}
    </div>
  );
}

export default PrecallTools;
