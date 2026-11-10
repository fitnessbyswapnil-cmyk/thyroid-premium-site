"use client";

/**
 * The Drive strip under a Today row: Notes, Summary, Drive, and her report.
 *
 * One button per job, the same place on every row, so his thumb learns it
 * once. Each button does the whole job in one tap: Notes opens the Doc he
 * types into on the call, Summary turns that Doc into her PDF and opens it,
 * Drive opens her folder. Which row gets which button is decided in
 * lib/admin-actions (rowTools), not here, so the rule is tested.
 *
 * Every state a tap can end in is said on the row itself, in words: what is
 * missing from her notes, that her WhatsApp window has shut, the hint the
 * route gave. A button that fails silently is a button he stops pressing.
 */
import { useCallback, useRef, useState } from "react";
import {
  afterSend, istClock, reportChip, summaryFromReply, summaryWaLink,
  type RowToolSet, type SavedReport, type SummaryView,
} from "@/lib/admin-actions";

/** The slice of Today's palette this strip paints with — all from ./tokens. */
export type Ink = {
  bg: string; card: string; line: string; text: string; dim: string;
  accent: string; good: string; warn: string; bad: string; onAccent: string; sunk: string;
};

/**
 * A tab opened NOW, inside the tap, and pointed at the file once the server
 * answers. A window.open() after an await is a popup the browser blocks, and
 * it blocks it silently: he taps, nothing happens, and the button looks
 * broken. On failure the caller closes it again so no blank tab is left over.
 *
 * The blank tab says what it is waiting for, because a summary takes seconds
 * to render and a white page that long reads as a dead one. Its opener is cut
 * before it lands on a Google page, which never needs a handle back to this.
 */
export function pendingTab(label: string, ink: Pick<Ink, "bg" | "dim">): Window | null {
  const tab = window.open("", "_blank");
  if (!tab) return null;
  try {
    tab.opener = null;
    tab.document.title = label;
    tab.document.body.style.cssText = `margin:0;padding:32px 20px;font:15px/1.5 system-ui,sans-serif;background:${ink.bg};color:${ink.dim}`;
    tab.document.body.textContent = label;
  } catch {
    // A tab that cannot be written into is still a tab that can be pointed at the file.
  }
  return tab;
}

/**
 * Open `url` in the tab made inside the tap, or here when the browser refused
 * one. replace(), so Back in that tab never lands on the blank placeholder.
 */
function land(tab: Window | null, url: string) {
  if (tab) tab.location.replace(url);
  else window.location.href = url;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * One tap, one request. `disabled` only lands after React re-renders, and a
 * quick double tap gets in before that, which here means two tabs and two
 * PDFs. A second tap while the first is running is dropped, not queued.
 */
function useOnce() {
  const running = useRef(new Set<string>());
  return useCallback(async (key: string, run: () => Promise<void>) => {
    if (running.current.has(key)) return;
    running.current.add(key);
    try {
      await run();
    } finally {
      running.current.delete(key);
    }
  }, []);
}

/**
 * "Report in Drive", linking the newest report she sent, or a quiet "No report
 * yet" where the row wants the absence said (rowTools decides which rows).
 */
export function ReportChip({ report, ink, mode }: { report: SavedReport; ink: Ink; mode: RowToolSet["report"] }) {
  const chip = reportChip(report, mode);
  if (!chip) return null;
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999,
    fontSize: 11.5, fontWeight: 600, lineHeight: 1.4, whiteSpace: "nowrap",
  };
  if (!chip.url) {
    // `sunk` is the system's "nothing was owed here": absence, not a fault.
    return <span style={{ ...base, color: ink.dim, background: ink.sunk, border: `1px solid ${ink.line}` }}>{chip.label}</span>;
  }
  return (
    <a href={chip.url} target="_blank" rel="noopener noreferrer" title="Open the newest report she sent"
      // Inline colour and underline: globals.css resets every link to inherit.
      style={{ ...base, color: ink.accent, background: `${ink.accent}14`, border: `1px solid ${ink.accent}44`, textDecoration: "none" }}>
      {chip.label}
      {chip.note ? <span style={{ color: ink.dim, fontWeight: 500 }}>· {chip.note}</span> : null}
    </a>
  );
}

type Props = {
  adminKey: string;
  ink: Ink;
  name: string;
  phone: string;
  /** The booking's time on a call row. A queue row has none, and Notes files it under today. */
  notesWhen?: string;
  /** The date her summary is filed under: the call's. */
  summaryWhen: string;
  tools: RowToolSet;
  /** "" after a Drive call that worked; the route's error code after one that did not. */
  onBridgeResult?: (code: string) => void;
};

export default function RowTools({ adminKey, ink, name, phone, notesWhen, summaryWhen, tools, onBridgeResult }: Props) {
  const once = useOnce();
  const [busy, setBusy] = useState<Record<"notes" | "summary" | "send" | "drive", boolean>>(
    { notes: false, summary: false, send: false, drive: false },
  );
  const mark = (k: keyof typeof busy, v: boolean) => setBusy((b) => ({ ...b, [k]: v }));
  const [notesErr, setNotesErr] = useState("");
  const [folderErr, setFolderErr] = useState("");
  const [summary, setSummary] = useState<SummaryView | null>(null);

  const post = (url: string, body: unknown) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(body),
    });

  // His call notes, as a Doc. Made by the server, so nothing later has to
  // guess which notes belong to which call (lib/drive).
  const openNotes = () =>
    once("notes", async () => {
      setNotesErr("");
      mark("notes", true);
      const tab = pendingTab("Opening her notes…", ink);
      try {
        const r = await post("/api/admin/call-notes", { name, phone, when: notesWhen ?? "" });
        const j = (await r.json().catch(() => ({}))) as { url?: string; hint?: string; error?: string };
        if (!r.ok || !j.url) {
          onBridgeResult?.(j.error ?? "");
          throw new Error(j.hint || j.error || `HTTP ${r.status}`);
        }
        onBridgeResult?.("");
        land(tab, j.url);
      } catch (e) {
        tab?.close();
        setNotesErr(message(e));
      } finally {
        mark("notes", false);
      }
    });

  // His notes Doc, read back and laid out as her two-page PDF in her folder.
  // When it is ready the tab lands on it; when it is not, the row says what
  // to fill in, and the tab closes rather than showing him an error page.
  const makeSummary = () =>
    once("summary", async () => {
      mark("summary", true);
      const tab = pendingTab("Making her summary…", ink);
      try {
        const r = await post("/api/admin/summary", { name, phone, when: summaryWhen });
        const view = summaryFromReply(r.status, await r.json().catch(() => null), new Date().toISOString());
        setSummary(view);
        onBridgeResult?.(view.phase === "error" ? view.code : "");
        // No tab means the browser refused one; the row's Open link does the same job.
        if (view.phase === "ready") tab?.location.replace(view.pdfUrl);
        else tab?.close();
      } catch (e) {
        tab?.close();
        setSummary({ phase: "error", code: "network", hint: message(e) });
      } finally {
        mark("summary", false);
      }
    });

  // The same PDF, sent to her on WhatsApp from the business number. Only
  // offered while her 24-hour window is open; when the server finds it shut
  // after all, the row swaps to the phone fallback instead of failing. Same
  // lock as Summary: a send racing a regenerate would report on the wrong PDF.
  const sendSummary = () =>
    once("summary", async () => {
      if (summary?.phase !== "ready") return;
      const prev = summary;
      mark("send", true);
      try {
        const r = await post("/api/admin/summary", { name, phone, when: summaryWhen, send: true });
        setSummary(afterSend(prev, r.status, await r.json().catch(() => null), new Date().toISOString()));
      } catch (e) {
        setSummary({ ...prev, sendError: message(e) });
      } finally {
        mark("send", false);
      }
    });

  // Her folder: every Doc, report and PDF about her, in one place.
  const openFolder = () =>
    once("drive", async () => {
      setFolderErr("");
      mark("drive", true);
      const tab = pendingTab("Opening her folder…", ink);
      try {
        const q = new URLSearchParams({ phone, name });
        const r = await fetch(`/api/admin/client-folder?${q}`, { headers: { "x-admin-key": adminKey }, cache: "no-store" });
        const j = (await r.json().catch(() => ({}))) as { url?: string; hint?: string; error?: string };
        if (!r.ok || !j.url) {
          onBridgeResult?.(j.error ?? "");
          throw new Error(j.hint || j.error || `HTTP ${r.status}`);
        }
        onBridgeResult?.("");
        land(tab, j.url);
      } catch (e) {
        tab?.close();
        setFolderErr(message(e));
      } finally {
        mark("drive", false);
      }
    });

  const tool = (on: boolean): React.CSSProperties => ({
    background: "transparent", border: `1px solid ${ink.line}`, color: ink.text,
    borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, lineHeight: 1.2,
    cursor: on ? "wait" : "pointer", whiteSpace: "nowrap", opacity: on ? 0.75 : 1,
  });
  const line = (color: string): React.CSSProperties => ({ marginTop: 8, fontSize: 12, lineHeight: 1.45, color });
  const link: React.CSSProperties = { color: ink.accent, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 };
  const dot = <span aria-hidden style={{ color: ink.dim }}>·</span>;
  // A separator travels with the item after it, so a wrapped line never ends on a dot.
  const after = (item: React.ReactNode) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{dot}{item}</span>
  );
  // Summary and its send share the PDF: neither runs while the other is in flight.
  const summaryBusy = busy.summary || busy.send;

  let status: React.ReactNode = null;
  if (summary?.phase === "ready") {
    const wa = summary.sentAt || summary.windowOpen ? "" : summaryWaLink(phone, name, summary.waText);
    status = (
      <>
        <div style={{ marginTop: 9, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 8px", fontSize: 12.5, lineHeight: 1.4 }}>
          <span style={{ color: ink.accent, fontWeight: 700 }}>Summary ready</span>
          {after(<a href={summary.pdfUrl} target="_blank" rel="noopener noreferrer" style={link}>Open</a>)}
          {summary.sentAt
            ? after(<span style={{ color: ink.good, fontWeight: 700 }}>Sent {istClock(summary.sentAt)}</span>)
            : summary.windowOpen
              ? after(
                <button type="button" onClick={sendSummary} disabled={summaryBusy} aria-busy={busy.send}
                  style={{ background: ink.accent, color: ink.onAccent, border: 0, borderRadius: 999, padding: "5px 13px",
                    fontSize: 12.5, fontWeight: 700, cursor: busy.send ? "wait" : "pointer", whiteSpace: "nowrap" }}>
                  {busy.send ? "Sending…" : "Send to her"}
                </button>,
              )
              : null}
        </div>
        {/* The phone fallback is a different act (he attaches the file
            himself), so it gets its own line and its own sentence. */}
        {!summary.sentAt && !summary.windowOpen && (
          wa ? (
            <div style={{ marginTop: 9 }}>
              <a href={wa} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", border: `1px solid ${ink.accent}`, color: ink.accent, borderRadius: 999,
                  padding: "6px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                Send from your phone
              </a>
              {/* Names the shut window only when that is the reason; a send
                  that failed for another one says so in its own line below. */}
              <div style={line(ink.dim)}>
                {summary.sendError ? "This opens WhatsApp on your phone." : "Her 24-hour window has shut, so this opens WhatsApp on your phone."}
                {" "}Attach the PDF there.
              </div>
            </div>
          ) : (
            <div style={line(ink.dim)}>No phone number on this row to send it to.</div>
          )
        )}
        {summary.sendError && <div style={line(ink.bad)}>{summary.sendError}</div>}
        {summary.warnings.map((w) => (
          <div key={w} style={line(ink.dim)}>{w}</div>
        ))}
      </>
    );
  } else if (summary?.phase === "fill_notes") {
    status = (
      <div style={line(ink.warn)}>
        {summary.missing.length ? (
          <>Fill these in her notes first: <span style={{ fontWeight: 700 }}>{summary.missing.join(", ")}</span></>
        ) : (
          summary.hint || "Fill in her notes first."
        )}
        {summary.notesUrl ? (
          <>
            {" "}
            <span style={{ whiteSpace: "nowrap" }}>
              {dot}{" "}
              <a href={summary.notesUrl} target="_blank" rel="noopener noreferrer" style={link}>Open notes</a>
            </span>
          </>
        ) : null}
      </div>
    );
  } else if (summary?.phase === "error") {
    status = <div style={line(ink.bad)}>{summary.hint}</div>;
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {tools.notes && (
          <button type="button" onClick={openNotes} disabled={busy.notes} aria-busy={busy.notes}
            title="Open her call-notes Doc" style={tool(busy.notes)}>
            {busy.notes ? "Opening…" : "Notes"}
          </button>
        )}
        {tools.summary && (
          <button type="button" onClick={makeSummary} disabled={summaryBusy} aria-busy={busy.summary}
            title="Turn her notes into the consultation summary PDF" style={tool(busy.summary)}>
            {busy.summary ? "Making…" : "Summary"}
          </button>
        )}
        {tools.drive && (
          <button type="button" onClick={openFolder} disabled={busy.drive} aria-busy={busy.drive}
            title="Open her folder in Google Drive" style={tool(busy.drive)}>
            {busy.drive ? "Opening…" : "Drive"}
          </button>
        )}
      </div>
      {notesErr && <div style={line(ink.bad)}>{notesErr}</div>}
      {folderErr && <div style={line(ink.bad)}>{folderErr}</div>}
      {status}
    </div>
  );
}
