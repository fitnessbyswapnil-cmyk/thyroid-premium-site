"use client";

/**
 * Her Drive tools: Notes, Summary, Drive, and her report.
 *
 * One button per job, each doing the whole job in one tap: Notes opens the Doc
 * he types into on the call, Summary turns that Doc into her PDF and opens it,
 * Drive opens her folder. Which row gets which button is decided in
 * lib/admin-actions (rowTools) or by her journey card (lib/next-action), not
 * here, so the rule is tested.
 *
 * The jobs live in a hook, useDriveTools, so her journey card can put any one
 * of them on its ONE primary button ("Open notes" around her call, "Review and
 * send summary" after it) and keep the rest as quiet links, without a second
 * copy of the tab handling below. RowTools, the strip, is the same hook drawn
 * as three quiet buttons.
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
import { DARK, LIGHT, type Tokens } from "./tokens";
import { Button } from "./ui/Button";

/** The slice of Today's palette this strip paints with — all from ./tokens. */
export type Ink = {
  bg: string; card: string; line: string; text: string; dim: string;
  accent: string; good: string; warn: string; bad: string; onAccent: string; sunk: string;
};

/**
 * The tokens as Ink, for either theme. `dim` maps to ink2, not ink3: these
 * strips carry 12.5px sentences a man reads between calls, and ink3 is a
 * 3.25:1 label grey. `onAccent` is the text ON a filled chip, which flips with
 * the theme because the fills do.
 */
export function inkOf(dark: boolean): Ink {
  const t = (dark ? DARK : LIGHT) as unknown as Tokens;
  return {
    bg: t.paper, card: t.card, line: t.hairline, text: t.ink1, dim: t.ink2,
    accent: t.teal, good: t.won, warn: t.amber, bad: t.clay,
    onAccent: dark ? t.paper : "#FFFFFF", sunk: t.sunk,
  };
}

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
 * One tap, one request. `disabled` (and the kit Button's `busy`) only lands
 * after React re-renders, and a quick double tap gets in before that, which
 * here means two tabs and two PDFs, or two WhatsApps to her. A second tap
 * while the first is running is dropped, not queued.
 *
 * `run` starts inside the tap, so anything it opens before its first await is
 * still a click the browser lets open a tab.
 */
export function useOnce() {
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

export type DriveToolsOptions = {
  adminKey: string;
  ink: Ink;
  name: string;
  phone: string;
  /** Her call's time: dates the Doc. Without one, the route files it under today. */
  notesWhen?: string;
  /** The date her summary is filed under: the call's. */
  summaryWhen: string;
  /** "" after a Drive call that worked; the route's error code after one that did not. */
  onBridgeResult?: (code: string) => void;
};

export type DriveTools = {
  busy: Record<"notes" | "summary" | "send" | "drive", boolean>;
  summary: SummaryView | null;
  notesErr: string;
  folderErr: string;
  openNotes: () => Promise<void>;
  makeSummary: () => Promise<void>;
  /** Open a PDF made earlier (her journey card knows its link) and ready the send. */
  reviewSummary: (pdfUrl: string, windowOpen: boolean) => void;
  sendSummary: () => Promise<void>;
  /** Her window is shut: open WhatsApp on his phone, and record that he sent it. */
  sendSummaryFromPhone: () => Promise<void>;
  openFolder: () => Promise<void>;
};

export function useDriveTools({ adminKey, ink, name, phone, notesWhen, summaryWhen, onBridgeResult }: DriveToolsOptions): DriveTools {
  const once = useOnce();
  const [busy, setBusy] = useState<DriveTools["busy"]>({ notes: false, summary: false, send: false, drive: false });
  const mark = (k: keyof DriveTools["busy"], v: boolean) => setBusy((b) => ({ ...b, [k]: v }));
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
  // When it is ready the tab lands on it, which is the review; when it is
  // not, the row says what to fill in, and the tab closes rather than showing
  // him an error page.
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

  // A PDF made earlier, after a reload: the card holds its link (the
  // summary_made mark). Opening it is the review; the send comes next.
  const reviewSummary = (pdfUrl: string, windowOpen: boolean) => {
    window.open(pdfUrl, "_blank", "noopener");
    setSummary({ phase: "ready", pdfUrl, notesUrl: "", warnings: [], windowOpen, sentAt: "", waText: "", sendError: "" });
  };

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

  // Her window is shut, so he sends it himself. Opened inside the tap (before
  // any await), and the click is the record (lib/journey-marks): the card must
  // not ask for the same summary again on the next load.
  const sendSummaryFromPhone = () =>
    once("summary", async () => {
      if (summary?.phase !== "ready") return;
      const wa = summaryWaLink(phone, name, summary.waText);
      if (!wa) return;
      window.open(wa, "_blank", "noopener");
      setSummary({ ...summary, sentAt: new Date().toISOString(), sendError: "" });
      await post("/api/admin/journey-mark", { phone, kind: "summary_sent", url: summary.pdfUrl }).catch(() => undefined);
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

  return { busy, summary, notesErr, folderErr, openNotes, makeSummary, reviewSummary, sendSummary, sendSummaryFromPhone, openFolder };
}

/**
 * What the last tap ended in, in words, under the buttons. `inlineSend` draws
 * the summary's own Send controls; a journey card leaves them to its primary
 * button, so the same send is never offered twice on one card.
 */
export function DriveStatus({ tools, t, ink, name, phone, inlineSend = true }: {
  tools: DriveTools; t: Tokens; ink: Ink; name: string; phone: string; inlineSend?: boolean;
}) {
  const { summary, busy } = tools;
  const line = (color: string): React.CSSProperties => ({ marginTop: 8, fontSize: 12, lineHeight: 1.45, color });
  const link: React.CSSProperties = { color: ink.accent, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 };
  const dot = <span aria-hidden style={{ color: ink.dim }}>·</span>;
  // A separator travels with the item after it, so a wrapped line never ends on a dot.
  const after = (item: React.ReactNode) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{dot}{item}</span>
  );
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
            : summary.windowOpen && inlineSend
              ? after(
                <Button t={t} variant="primary" size="sm" busy={busy.send} disabled={summaryBusy && !busy.send} onClick={() => void tools.sendSummary()}>
                  {busy.send ? "Sending…" : "Send to her"}
                </Button>,
              )
              : null}
        </div>
        {/* The phone fallback is a different act (he attaches the file
            himself), so it gets its own line and its own sentence. */}
        {!summary.sentAt && !summary.windowOpen && (
          wa ? (
            <div style={{ marginTop: 9 }}>
              {inlineSend ? (
                <Button t={t} variant="secondary" size="sm" onClick={() => void tools.sendSummaryFromPhone()}>
                  Send from your phone
                </Button>
              ) : null}
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
    <>
      {tools.notesErr && <div style={line(ink.bad)}>{tools.notesErr}</div>}
      {tools.folderErr && <div style={line(ink.bad)}>{tools.folderErr}</div>}
      {status}
    </>
  );
}

type Props = DriveToolsOptions & { t: Tokens; tools: RowToolSet };

/** The strip: the same three jobs as quiet buttons, on any row that is not a journey card. */
export default function RowTools({ t, tools, ...opts }: Props) {
  const d = useDriveTools(opts);
  const summaryBusy = d.busy.summary || d.busy.send;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {tools.notes && (
          <Button t={t} variant="quiet" size="sm" busy={d.busy.notes} title="Open her call-notes Doc" onClick={() => void d.openNotes()}>
            {d.busy.notes ? "Opening…" : "Notes"}
          </Button>
        )}
        {tools.summary && (
          <Button t={t} variant="quiet" size="sm" busy={d.busy.summary} disabled={summaryBusy && !d.busy.summary}
            title="Turn her notes into the consultation summary PDF" onClick={() => void d.makeSummary()}>
            {d.busy.summary ? "Making…" : "Summary"}
          </Button>
        )}
        {tools.drive && (
          <Button t={t} variant="quiet" size="sm" busy={d.busy.drive} title="Open her folder in Google Drive" onClick={() => void d.openFolder()}>
            {d.busy.drive ? "Opening…" : "Drive"}
          </Button>
        )}
      </div>
      <DriveStatus tools={d} t={t} ink={opts.ink} name={opts.name} phone={opts.phone} />
    </div>
  );
}
