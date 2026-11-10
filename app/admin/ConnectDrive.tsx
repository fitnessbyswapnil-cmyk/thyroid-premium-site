"use client";

/**
 * "Connect Google Drive", the one-time set-up, done from the top of Today.
 *
 * Everything the system writes into his Drive (notes Docs, her reports, her
 * summary PDF) goes through a small Apps Script that runs as him, because the
 * service account may not own files there (lib/drive). This card is the whole
 * set-up of that script: copy it, deploy it, paste back one URL. The worker
 * makes the secret and hands it over itself (/api/admin/drive-setup), so there
 * is nothing to invent, type or keep, and no terminal.
 *
 * It shows only while Drive is not connected, or when a button has just met a
 * script that refuses the stored pairing (showConnectCard in lib/admin-actions).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { appsScriptUrlProblem, type DriveStatus } from "@/lib/admin-actions";
import { NOTES_FOLDER_ENV } from "@/lib/drive";
import { FONT } from "./tokens";
import type { Ink } from "./RowTools";

const SCRIPT_HOME = "https://script.google.com/home/start";
/** The account the script must be deployed from: it owns "Client Notes". */
const DRIVE_ACCOUNT = "fitnessbyswapnil@gmail.com";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function ConnectDrive({ adminKey, ink, status, onConnected }: {
  adminKey: string;
  ink: Ink;
  status: DriveStatus;
  onConnected: () => void;
}) {
  const [script, setScript] = useState("");
  const [copy, setCopy] = useState<"idle" | "busy" | "done" | "manual">("idle");
  const [copyErr, setCopyErr] = useState("");
  const [url, setUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [err, setErr] = useState("");
  const inFlight = useRef(false);

  const fetchScript = useCallback(async (): Promise<string> => {
    const r = await fetch("/api/admin/drive-setup?script=1", { headers: { "x-admin-key": adminKey }, cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { script?: string; hint?: string; error?: string };
    if (!r.ok || !j.script) throw new Error(j.hint || j.error || `HTTP ${r.status}`);
    return j.script;
  }, [adminKey]);

  // Fetched when the card appears, not on the tap. Safari lets a page write
  // the clipboard only inside the tap itself, and a fetch awaited in between
  // breaks the copy without a word. A failure here is retried by the tap,
  // which then says why.
  useEffect(() => {
    let live = true;
    fetchScript().then((s) => { if (live) setScript(s); }).catch(() => {});
    return () => { live = false; };
  }, [fetchScript]);

  const copyScript = async () => {
    if (copy === "busy") return;
    setCopy("busy");
    setCopyErr("");
    let text = script;
    if (!text) {
      try {
        text = await fetchScript();
        setScript(text);
      } catch (e) {
        setCopy("idle");
        setCopyErr(message(e));
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopy("done");
    } catch {
      // An old browser, or Safari after that await: hand him the text to copy
      // himself rather than a button that did nothing.
      setCopy("manual");
    }
  };

  const typed = url.trim();
  const problem = typed ? appsScriptUrlProblem(typed) : null;

  const connect = async () => {
    if (inFlight.current) return;
    const p = appsScriptUrlProblem(url);
    if (p) {
      setErr(p);
      return;
    }
    inFlight.current = true;
    setConnecting(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/drive-setup", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ url: typed }),
      });
      const j = (await r.json().catch(() => ({}))) as { connected?: boolean; hint?: string; error?: string };
      if (!r.ok || !j.connected) throw new Error(j.hint || j.error || `HTTP ${r.status}`);
      onConnected();
    } catch (e) {
      setErr(message(e));
    } finally {
      inFlight.current = false;
      setConnecting(false);
    }
  };

  const kicker: React.CSSProperties = { fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: ink.dim };
  const strong: React.CSSProperties = { fontWeight: 600, color: ink.text };
  const note = (color: string): React.CSSProperties => ({ marginTop: 8, fontSize: 12, lineHeight: 1.5, color });
  const step = (n: number, body: React.ReactNode) => (
    <li style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span aria-hidden style={{ flex: "none", width: 24, height: 24, borderRadius: 999, background: ink.sunk,
        border: `1px solid ${ink.line}`, color: ink.dim, fontSize: 12, fontWeight: 600, fontFamily: FONT.mono,
        display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {n}
      </span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.55, color: ink.dim }}>{body}</div>
    </li>
  );

  return (
    <section aria-label="Connect Google Drive"
      style={{ background: ink.card, border: `1px solid ${ink.line}`, borderLeft: `3px solid ${ink.accent}`, borderRadius: 14, padding: 16, marginTop: 14 }}>
      <div style={kicker}>Connect Google Drive</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6, color: ink.text }}>
        Her notes, reports and summaries are saved in your Drive. Three steps, once.
      </div>

      <ol style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "grid", gap: 16 }}>
        {step(1, (
          <>
            <button type="button" onClick={copyScript} disabled={copy === "busy"} aria-busy={copy === "busy"}
              style={{ background: "transparent", border: `1px solid ${copy === "done" ? ink.good : ink.accent}`,
                color: copy === "done" ? ink.good : ink.accent, borderRadius: 999, padding: "7px 15px",
                fontSize: 13, fontWeight: 700, cursor: copy === "busy" ? "wait" : "pointer", whiteSpace: "nowrap" }}>
              {copy === "busy" ? "Copying…" : copy === "done" ? "Copied" : "Copy script"}
            </button>
            {copyErr && <div style={note(ink.bad)}>{copyErr}</div>}
            {copy === "manual" && (
              <>
                <div style={note(ink.warn)}>This browser would not copy it. Press and hold in the box, Select All, then Copy.</div>
                <textarea readOnly value={script} rows={4} aria-label="The script"
                  onFocus={(e) => e.currentTarget.select()}
                  style={{ width: "100%", boxSizing: "border-box", marginTop: 6, padding: 8, borderRadius: 8,
                    border: `1px solid ${ink.line}`, background: ink.bg, color: ink.text, fontFamily: FONT.mono, fontSize: 11 }} />
              </>
            )}
          </>
        ))}

        {step(2, (
          <>
            Open{" "}
            {/* Inline colour and underline: globals.css resets every link to inherit. */}
            <a href={SCRIPT_HOME} target="_blank" rel="noopener noreferrer"
              style={{ color: ink.accent, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>
              script.google.com
            </a>
            . Signed in as <span style={strong}>{DRIVE_ACCOUNT}</span>: New project → paste → Save → Deploy → New
            deployment → Web app → <span style={strong}>Execute as: Me</span> → <span style={strong}>Who has access: Anyone</span> →
            Deploy → Authorize (Advanced → Go to … → Allow).
          </>
        ))}

        {step(3, (
          <form onSubmit={(e) => { e.preventDefault(); void connect(); }}>
            Paste the Web app URL it gives you. It ends in /exec.
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {/* 16px, not the screen's 13: iOS zooms the page into any
                  smaller field on focus and leaves it zoomed. */}
              <input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" autoComplete="off"
                spellCheck={false} enterKeyHint="go" aria-label="Web app URL" aria-invalid={Boolean(problem)}
                placeholder="https://script.google.com/macros/s/…/exec"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setErr(""); }}
                style={{ flex: "1 1 220px", minWidth: 0, boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
                  border: `1px solid ${problem ? ink.warn : ink.line}`, background: ink.bg, color: ink.text,
                  fontSize: 16, fontFamily: "inherit" }} />
              <button type="submit" disabled={!typed || Boolean(problem) || connecting} aria-busy={connecting}
                style={{ flex: "none", background: ink.accent, color: ink.onAccent, border: 0, borderRadius: 999,
                  padding: "10px 20px", fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap",
                  cursor: connecting ? "wait" : "pointer", opacity: !typed || problem ? 0.5 : 1 }}>
                {connecting ? "Connecting…" : "Connect"}
              </button>
            </div>
            {problem && <div style={note(ink.warn)}>{problem}</div>}
          </form>
        ))}
      </ol>

      {!status.folderConfigured && (
        <div style={note(ink.warn)}>
          The Client Notes folder is not set on the worker yet ({NOTES_FOLDER_ENV}), so Connect cannot finish until it is.
        </div>
      )}
      {err && <div style={note(ink.bad)}>{err}</div>}
    </section>
  );
}
