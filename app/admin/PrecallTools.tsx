"use client";

/**
 * The pre-call PDF on a booked card: "Why your weight isn't moving: what your
 * answers and your report show". The journey card mounts it before her call.
 *
 * One button opens a small form: her report's markers, one row each (marker,
 * value, range, flag), typed by him, or pre-filled by Claude reading her
 * report through the report-reader slot (ReportReaderSlot, below). Either way
 * he checks the rows; the PDF is built only from what is in the form when he
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
 * Buttons and pills are the admin kit's (./ui), one primary per card:
 * Generate until there is a PDF, then the send. The kit's `busy` only blocks a
 * press after a re-render, so every request here also goes through `once`,
 * which drops a second tap while the first is in flight: she must never get
 * the WhatsApp twice.
 *
 * The decisions behind every state (what a reply means, how a reading merges
 * into rows he already typed, when two sets of rows are the same PDF) live in
 * lib/precall.ts, pure and tested; this file only renders them.
 */
import { useCallback, useId, useRef, useState, type CSSProperties, type JSX } from "react";
import { FONT, RADIUS, type Tokens } from "./tokens";
import { Button } from "./ui/Button";
import { StatusPill } from "./ui/StatusPill";
import { pendingTab } from "./RowTools";
import { readAdminKey } from "./adminKey";
import { istClock } from "@/lib/admin-actions";
import { draftWaLink } from "@/lib/draft-message";
import {
  afterPrecallSend,
  cleanMarkerRows,
  mergeReadRows,
  precallCaption,
  precallFromReply,
  sameRows,
  type MarkerRow,
  type PrecallView,
} from "@/lib/precall";

type Row = { id: number; marker: string; value: string; range: string; flag: string };
type Field = "marker" | "value" | "range" | "flag";

const plain = (rows: Row[]): MarkerRow[] => rows.map(({ marker, value, range, flag }) => ({ marker, value, range, flag }));
const filled = (r: Row) => Boolean(r.marker.trim() || r.value.trim() || r.range.trim() || r.flag.trim());
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Exactly what <ReadReportWithClaude> takes, so mounting it in the slot is a one-line swap. */
export type ReportReaderProps = {
  t: Tokens;
  phone: string;
  /** Her newest saved report's WhatsApp media id (lib/report-save newestReportFor); absent when she has none. */
  mediaId?: string;
  /** Pre-fills the form's rows, through the same setter as his typing. */
  onMarkers: (rows: MarkerRow[]) => void;
};

/**
 * ── SLOT: <ReadReportWithClaude t phone mediaId onMarkers /> ──────────────
 * Claude reads her report through a Claude Code routine that another session
 * is building; it ships this component from its own PR. It is not on main
 * yet, so it is NOT imported here, and until it lands this slot renders
 * nothing: the card works on manual entry alone.
 *
 * When it lands: import it, and render
 *   <ReadReportWithClaude t={p.t} phone={p.phone} mediaId={p.mediaId} onMarkers={p.onMarkers} />
 * in place of `null` below (or mount it directly where <ReportReaderSlot> is
 * mounted, beside the manual rows). Nothing else changes: its rows arrive
 * through onMarkers, which is the card's own setRows path (mergeReadRows), so
 * they only pre-fill the boxes, never overwrite a value he typed, and reach a
 * PDF only after he has checked them and pressed Generate.
 */
function ReportReaderSlot(p: ReportReaderProps): JSX.Element | null {
  void p;
  return null;
}

export function PrecallTools({ t, name, phone, when, apiKey, mediaId }: {
  t: Tokens;
  name: string;
  phone: string;
  when: string;
  apiKey?: string;
  /** Her newest saved report's WhatsApp media id, handed to the report-reader slot. */
  mediaId?: string;
}): JSX.Element {
  const flagList = useId();
  const nextId = useRef(1);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ id: 0, marker: "", value: "", range: "", flag: "" }]);
  const [busy, setBusy] = useState({ make: false, send: false });
  // Set when the report reader has pre-filled rows, so the card asks him to check them.
  const [prefilled, setPrefilled] = useState(false);
  const [view, setView] = useState<PrecallView | null>(null);
  // The rows the open PDF was made from: Send posts these, never the live form.
  const [madeFrom, setMadeFrom] = useState<MarkerRow[] | null>(null);
  const mark = (k: keyof typeof busy, v: boolean) => setBusy((b) => ({ ...b, [k]: v }));

  // One tap, one request: a second tap while the first is running is dropped,
  // not queued (a double tap is two tabs and two PDFs, or two WhatsApps).
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

  // The report reader's way into the form (the slot's onMarkers): the same
  // setRows his typing goes through. Rows he already typed stay as they are;
  // only markers he has not typed are added, cleaned like typed rows.
  const prefillFromReport = (incoming: MarkerRow[]) => {
    if (!cleanMarkerRows(incoming).rows.length) return;
    setRows((cur) => {
      const kept = cur.filter(filled);
      const added = mergeReadRows(plain(kept), incoming).slice(kept.length).map(newRow);
      const next = [...kept, ...added];
      return next.length ? next : [newRow()];
    });
    setPrefilled(true);
  };

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
  // 16px: anything smaller and iOS zooms the page when a box takes focus.
  const box: CSSProperties = {
    width: "100%", minWidth: 0, boxSizing: "border-box", border: `1px solid ${t.hairline}`, borderRadius: RADIUS.cell,
    background: t.card, color: t.ink1, padding: "8px 9px", fontSize: 16, lineHeight: 1.3, fontFamily: FONT.sans,
  };
  const line = (color: string): CSSProperties => ({ marginTop: 8, fontSize: 12, lineHeight: 1.45, color });
  const bar: CSSProperties = { marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 };

  const ready = view?.phase === "ready" ? view : null;
  const changed = Boolean(ready && madeFrom && !sameRows(plain(rows), madeFrom));
  const noPhone = phone.replace(/\D/g, "").length < 10;

  let status: React.ReactNode = null;
  if (ready) {
    const wa = ready.sentAt || ready.windowOpen ? "" : draftWaLink(phone, ready.waText || precallCaption(name));
    status = (
      <>
        <div style={bar}>
          {ready.sentAt
            ? <StatusPill t={t} tone="ok">Sent {istClock(ready.sentAt)}</StatusPill>
            : <StatusPill t={t} tone="progress">PDF ready</StatusPill>}
          <Button t={t} variant="quiet" size="sm" href={ready.pdfUrl} target="_blank" title="Open the PDF in her Drive folder">
            Open
          </Button>
          {!ready.sentAt && ready.windowOpen ? (
            <Button t={t} variant="primary" size="sm" onClick={sendNow} busy={busy.send} disabled={changed || busy.make}
              status={ready.sendError ? "failed" : undefined}
              title={changed ? "Generate again first: the markers changed" : "Send this PDF to her on WhatsApp"}>
              Send to her
            </Button>
          ) : null}
        </div>
        {changed && !ready.sentAt && (
          <div style={line(t.amber)}>You changed the markers after making this PDF. Generate again and check it before you send.</div>
        )}
        {/* The phone fallback is a different act (he attaches the file himself), so it gets its own line. */}
        {!ready.sentAt && !ready.windowOpen && (
          wa ? (
            <div style={{ marginTop: 10 }}>
              <Button t={t} variant="primary" size="sm" href={wa} target="_blank" onClick={() => sentFromPhone(ready.pdfUrl)}
                title="Open WhatsApp on your phone with the message ready">
                Send from your phone
              </Button>
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
      <Button t={t} variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}
        title="Her pre-call PDF: her answers and her report, before the call">
        {open ? "Close pre-call PDF" : "Pre-call PDF"}
      </Button>
      {open && (
        <div style={{ marginTop: 10, border: `1px solid ${t.hairline}`, borderRadius: RADIUS.card, background: t.card, padding: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: t.ink2, fontWeight: 700 }}>
              Her report markers
            </div>
            {/* SLOT, beside the manual rows: <ReadReportWithClaude> mounts here (see ReportReaderSlot above). */}
            <ReportReaderSlot t={t} phone={phone} mediaId={mediaId} onMarkers={prefillFromReport} />
          </div>
          {prefilled && (
            <div style={line(t.ink2)}>Pre-filled from her report. Check every value against the report before you generate.</div>
          )}

          {rows.map((r, i) => (
            <div key={r.id} style={{ marginTop: 10, paddingTop: i ? 10 : 0, borderTop: i ? `1px solid ${t.hairline}` : "none" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input aria-label={`Marker ${i + 1}`} placeholder="Marker, like TSH" value={r.marker}
                  onChange={(e) => update(r.id, "marker", e.target.value)} style={{ ...box, flex: 1 }} />
                <Button t={t} variant="secondary" size="sm" onClick={() => removeRow(r.id)}
                  ariaLabel={`Remove marker ${i + 1}`} title="Remove this row">
                  ×
                </Button>
              </div>
              {/* A value carries its unit ("5.8 µIU/mL"), so it gets the widest box. */}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 4fr) minmax(0, 3fr) minmax(0, 3fr)", gap: 6, marginTop: 6 }}>
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

          <div style={{ marginTop: 8 }}>
            <Button t={t} variant="quiet" size="sm" onClick={addRow}>+ Add marker</Button>
          </div>
          <div style={line(t.ink2)}>Leave every row empty to use the marker table in her notes Doc.</div>

          <div style={bar}>
            <Button t={t} variant={ready ? "secondary" : "primary"} onClick={generate} busy={busy.make} disabled={noPhone || busy.send}
              title="Make her pre-call PDF, save it in her folder and open it">
              {ready ? "Generate again" : "Generate PDF"}
            </Button>
          </div>
          {noPhone && <div style={line(t.ink2)}>No phone number on this card, so there is no folder to save it in.</div>}
          {status}
        </div>
      )}
    </div>
  );
}

export default PrecallTools;
