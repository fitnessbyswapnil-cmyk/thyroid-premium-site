"use client";

/**
 * Mobile WhatsApp inbox for the Cloud API number.
 *
 * A number registered to the Cloud API cannot be opened in the WhatsApp app —
 * Meta blocks it — so these conversations exist nowhere else. This is the
 * phone-shaped view of them: thread list, media, free-form reply, tags.
 *
 * Installable: app/manifest.ts + "Add to Home Screen" gives it an icon and a
 * fullscreen shell, so on Android it behaves like any other chat app.
 *
 * The key lives in localStorage, not sessionStorage like /admin. An installed
 * app that logged you out on every close would not get used, and this is the
 * coach's own phone.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readAdminKey, saveAdminKey, clearAdminKey } from "../admin/adminKey";
import { LIGHT, DARK, FONT, RADIUS, type Tokens } from "../admin/tokens";
import { mediaSrc, useMediaPass, type MediaPass } from "@/app/admin/useMediaPass";
import { canSaveToDrive } from "@/lib/admin-actions";

/**
 * The palette is app/admin/tokens.ts, the measured system Today and Pipeline
 * render from. It used to be ten colour literals of its own, violet on
 * near-black, so the screen he opens most between calls looked like a
 * different product from the desk whose header links to it. Every colour is
 * mapped by what it means, not by where it used to be:
 *
 *  - Surfaces: paper under everything, card for the bars and for her bubbles,
 *    sunk for read avatars and files. Hairlines, not boxes.
 *  - Teal is movement, so it marks what moves a conversation: his own bubbles
 *    (the lightest teal fill), unread, and Send. The ↗ out to WhatsApp is teal
 *    because it is a link.
 *  - A selected filter or an applied tag is ink, not teal. Selection is not
 *    progress.
 *  - Her 24-hour window is neutral while open and amber once closed: a closed
 *    window needs attention, but nothing failed.
 *  - Clay means one thing: something he did that didn't happen. A send, a
 *    load, a tag save, a rejected key.
 *
 * ink3 carries no text. It measures 3.4:1 on paper, 3.7:1 on a card and 2.6:1
 * on his teal bubble, under the 4.5:1 text needs, so timestamps are ink2, and
 * ink1 inside his bubble, where ink2 is 4.3:1. ink3 draws only the input
 * boundaries, which need 3:1 and get 3.7:1.
 */

/** The dashboard's theme switch: THEME_STORE in app/admin/page.tsx. */
const THEME_STORE = "admin_theme";

/**
 * Dark if the dashboard's switch says so on this device, otherwise whatever
 * the phone itself is set to. The inbox has no switch of its own, and an app
 * added to an iPhone home screen keeps storage of its own, so there it never
 * sees the dashboard's choice and the phone's setting is the only signal.
 */
function wantsDark(): boolean {
  try {
    const chosen = localStorage.getItem(THEME_STORE);
    if (chosen === "dark" || chosen === "light") return chosen === "dark";
  } catch { /* storage blocked: use the phone's setting */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

type WaMessage = {
  ts: string;
  phone: string;
  direction: "in" | "out";
  text: string;
  messageId: string;
  name: string;
  read: boolean;
  mediaId: string;
  mediaType: string;
  mediaMime: string;
  mediaName: string;
  /** Her copy of this attachment in Drive, or null when there is none (media messages only). */
  driveUrl?: string | null;
};

type Thread = {
  phone: string;
  name: string;
  messages: WaMessage[];
  lastTs: string;
  unread: number;
  windowMinutesLeft: number;
  tags: string[];
};

const initials = (name: string, phone: string) => {
  const n = (name || "").trim();
  if (!n) return phone.slice(-2);
  const parts = n.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || phone.slice(-2);
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

const clock = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

/**
 * Renders an attachment inline. <img> cannot send headers, so the URL carries a
 * short-lived pass (lib/media-pass.ts), never the admin key itself.
 */
function Media({ m, apiKey, pass, passFailed, phone, clientName, t }: {
  m: WaMessage; apiKey: string; pass: MediaPass | null; passFailed: boolean;
  phone: string; clientName: string; t: Tokens;
}) {
  const src = pass ? mediaSrc(m.mediaId, pass) : "";
  const [failed, setFailed] = useState(false);

  let media: React.ReactNode;
  if (failed) {
    media = (
      <div style={{ fontSize: 12, color: t.amber, padding: "6px 0" }}>
        Attachment unavailable — WhatsApp deletes media after about 30 days.
      </div>
    );
  } else if (!src) {
    media = (
      <div style={{ fontSize: 12, color: passFailed ? t.clay : t.ink2, padding: "6px 0" }}>
        {passFailed ? "Attachments can't load right now. Retrying every minute." : "Loading attachment…"}
      </div>
    );
  } else if (m.mediaType === "image" || m.mediaType === "sticker") {
    media = (
      <a href={src} target="_blank" rel="noopener noreferrer">
        {/* next/image cannot sign this request; the bytes come from an
            authenticated proxy, not a public URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={m.mediaName || "attachment"}
          onError={() => setFailed(true)}
          style={{ maxWidth: "100%", borderRadius: 10, display: "block", marginBottom: 6 }}
        />
      </a>
    );
  } else if (m.mediaType === "audio") {
    media = <audio controls src={src} style={{ width: "100%", marginBottom: 6 }} />;
  } else if (m.mediaType === "video") {
    media = <video controls src={src} style={{ maxWidth: "100%", borderRadius: 10, marginBottom: 6 }} />;
  } else {
    // A document, usually her blood report: recessed like a file in a folder,
    // its name in teal because the whole chip is a link.
    media = (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", marginBottom: 6,
          background: t.sunk, border: `1px solid ${t.hairline}`, borderRadius: 10, color: t.teal,
          textDecoration: "none", fontSize: 13, fontWeight: 600,
        }}
      >
        <span style={{ fontSize: 18 }}>📄</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {m.mediaName || "Open document"}
        </span>
      </a>
    );
  }
  // Under the media even when WhatsApp has deleted it: past 30 days the Drive
  // copy is the only one that still opens.
  return (
    <>
      {media}
      <DriveCopy m={m} apiKey={apiKey} phone={phone} clientName={clientName} t={t} />
    </>
  );
}

/**
 * Her report's copy in Drive, or the button that makes one. Ported from the
 * dashboard's inbox tile (DriveCopy in app/admin/AnalyticsDashboard.tsx) with
 * the same request, the same conditions and the same states, so a report can
 * be filed from the phone too; only the colours are this screen's.
 *
 * Reports are saved automatically as they arrive; this is the fallback for
 * one that arrived before that existed, or while the save failed. One tap,
 * and the route says in words why when it cannot (not a lead, too large,
 * Drive not connected). A failure is clay, because a save he asked for did
 * not happen. Saved is plain ink: among outcomes only a won client is coloured.
 */
function DriveCopy({ m, apiKey, phone, clientName, t }: { m: WaMessage; apiKey: string; phone: string; clientName: string; t: Tokens }) {
  const [savedUrl, setSavedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  // disabled lands only after a re-render; a double tap must not save twice.
  const inFlight = useRef(false);

  const url = m.driveUrl || savedUrl;
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: t.teal, textDecoration: "underline", textUnderlineOffset: 2 }}>
        In Drive
      </a>
    );
  }
  if (!canSaveToDrive(m)) return null;

  const save = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/save-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": apiKey },
        body: JSON.stringify({
          mediaId: m.mediaId, phone, name: clientName, messageId: m.messageId ?? "",
          mime: m.mediaMime ?? "", filename: m.mediaName ?? "", kind: m.mediaType ?? "", ts: m.ts,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { saved?: boolean; url?: string; reason?: string; hint?: string; error?: string };
      if (res.ok && j.saved) {
        if (j.url) setSavedUrl(j.url);
        else setNote({ text: "Saved to her Drive folder", ok: true });
      } else {
        setNote({ text: j.hint || j.reason || j.error || `HTTP ${res.status}`, ok: false });
      }
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : String(e), ok: false });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
      {!note?.ok && (
        <button type="button" onClick={save} disabled={busy} aria-busy={busy}
          style={{ ...chip(t), padding: "4px 11px", fontWeight: 600, cursor: busy ? "wait" : "pointer", whiteSpace: "nowrap" }}>
          {busy ? "Saving…" : "Save to Drive"}
        </button>
      )}
      {note && <span style={{ fontSize: 12, lineHeight: 1.4, color: note.ok ? t.ink2 : t.clay, whiteSpace: "normal" }}>{note.text}</span>}
    </div>
  );
}

/**
 * The ground under the inbox: the body, which shows during overscroll and
 * under short screens, and the placeholder colour, which no inline style can
 * reach. Tailwind's preflight sets placeholders to half-strength text, 3.3:1
 * on a card; ink2 is 6.0:1.
 */
function Ground({ t }: { t: Tokens }) {
  return <style>{`body{background:${t.paper};margin:0}[data-inbox] ::placeholder{color:${t.ink2};opacity:1}`}</style>;
}

export default function InboxClient() {
  const [apiKey, setApiKey] = useState<string>("");
  const { pass: mediaPass, failed: mediaPassFailed } = useMediaPass(apiKey);
  const [keyInput, setKeyInput] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  // null until the device has been read. The server cannot know which theme
  // this phone wants, so nothing coloured is rendered before then.
  const [dark, setDark] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // Deferred a tick: reading storage and setting state synchronously inside
      // an effect cascades a second render before the first has painted.
      await Promise.resolve();
      if (!alive) return;
      let k = "";
      k = readAdminKey();
      if (!alive) return;
      setApiKey(k);
      setDark(wantsDark());
    })();
    return () => { alive = false; };
  }, []);

  // A phone can turn dark at sunset with the app still open. The status bar's
  // theme-color follows it by itself, so the page has to as well.
  useEffect(() => {
    const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!scheme) return;
    const follow = () => setDark(wantsDark());
    scheme.addEventListener("change", follow);
    return () => scheme.removeEventListener("change", follow);
  }, []);

  // page.tsx colours the status bar by the phone's setting. When the
  // dashboard's switch overrides that, repaint it to this header's surface so
  // the bar never sits in the other theme's colour above the header.
  useEffect(() => {
    if (dark === null) return;
    const header = (dark ? DARK : LIGHT).card;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", header));
  }, [dark]);

  const load = useCallback(async (k: string) => {
    if (!k) return;
    await Promise.resolve(); // callers include effects; never set state in their tick
    setLoading(true);
    setErr("");
    try {
      const [mRes, tRes] = await Promise.all([
        fetch("/api/admin/messages", { headers: { "x-admin-key": k } }),
        fetch("/api/admin/tags", { headers: { "x-admin-key": k } }),
      ]);
      if (mRes.status === 401) {
        setErr("That key was rejected.");
        setApiKey("");
        clearAdminKey();
        return;
      }
      const m = (await mRes.json()) as { threads?: Thread[] };
      const t = (await tRes.json()) as { suggested?: string[] };
      setThreads(m.threads ?? []);
      setSuggested(t.suggested ?? []);
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load whenever the key changes — on restore from storage, and on login.
  // load() defers its first setState by a microtask, so the cascading render
  // this rule guards against cannot happen here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (apiKey) void load(apiKey); }, [apiKey, load]);

  // Poll while the app is in the foreground so a new message appears without a
  // manual pull. Stops when backgrounded — no point burning battery.
  useEffect(() => {
    if (!apiKey) return;
    const tick = () => { if (document.visibilityState === "visible") void load(apiKey); };
    const id = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [apiKey, load]);

  const open = useMemo(
    () => threads.find((t) => t.phone === openPhone) ?? null,
    [threads, openPhone],
  );

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [open]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const t of threads) for (const tag of t.tags) s.add(tag);
    return [...s].sort();
  }, [threads]);

  const visible = useMemo(() => {
    if (filter === "All") return threads;
    if (filter === "Unread") return threads.filter((t) => t.unread > 0);
    if (filter === "Open window") return threads.filter((t) => t.windowMinutesLeft > 0);
    return threads.filter((t) => t.tags.includes(filter));
  }, [threads, filter]);

  const openThread = async (t: Thread) => {
    setOpenPhone(t.phone);
    setDraft("");
    setTagDraft("");
    if (t.unread > 0) {
      // Optimistic: clearing the badge should not wait on a round trip.
      setThreads((prev) => prev.map((x) => (x.phone === t.phone ? { ...x, unread: 0 } : x)));
      try {
        await fetch("/api/admin/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": apiKey },
          body: JSON.stringify({ phone: t.phone, markRead: true }),
        });
      } catch { /* badge already cleared locally */ }
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !open || sending) return;
    setSending(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": apiKey },
        body: JSON.stringify({ phone: open.phone, text }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) { setErr(j.error || "Send failed"); return; }
      setDraft("");
      await load(apiKey);
    } catch {
      setErr("Send failed");
    } finally {
      setSending(false);
    }
  };

  const saveTags = async (phone: string, tags: string[]) => {
    setThreads((prev) => prev.map((t) => (t.phone === phone ? { ...t, tags } : t)));
    try {
      await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": apiKey },
        body: JSON.stringify({ phone, tags }),
      });
    } catch { setErr("Tag not saved"); }
  };

  // ── before the device has been read ──────────────────────────────────────
  // Nothing coloured until the theme is known. The server-rendered key gate
  // used to flash for a moment on every open, saved key or not; in a theme
  // chosen on the device it would flash in the wrong one, white on a phone at
  // night. page.tsx paints the body by the phone's own setting, so this frame
  // is plain ground.
  if (dark === null) return <main data-inbox style={{ minHeight: "100dvh" }} />;

  const t: Tokens = dark ? (DARK as unknown as Tokens) : LIGHT;

  // ── key gate ─────────────────────────────────────────────────────────────
  if (!apiKey) {
    return (
      <main data-inbox style={{ ...page(t, dark), minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
        <Ground t={t} />
        <div style={{ width: "100%", maxWidth: 340 }}>
          <h1 style={{ fontFamily: FONT.serif, fontSize: 22, fontWeight: 500, letterSpacing: "-.01em", color: t.ink1, margin: "0 0 6px" }}>Inbox</h1>
          <p style={{ color: t.ink2, fontSize: 13, margin: "0 0 18px" }}>
            WhatsApp conversations for your business number.
          </p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Admin key"
            style={input(t)}
          />
          <button
            onClick={() => {
              const k = keyInput.trim();
              if (!k) return;
              saveAdminKey(k);
              setApiKey(k);
            }}
            style={{ ...primaryBtn(t), width: "100%", marginTop: 10 }}
          >
            Open inbox
          </button>
          {err && <p style={{ color: t.clay, fontSize: 12, marginTop: 10 }}>{err}</p>}
        </div>
      </main>
    );
  }

  // ── thread view ──────────────────────────────────────────────────────────
  if (open) {
    const canReply = open.windowMinutesLeft > 0;
    const hrs = Math.floor(open.windowMinutesLeft / 60);
    const mins = open.windowMinutesLeft % 60;
    return (
      <main data-inbox style={{ ...page(t, dark), display: "flex", flexDirection: "column", height: "100dvh" }}>
        <Ground t={t} />
        <header style={{ ...bar(t), gap: 10 }}>
          <button onClick={() => setOpenPhone(null)} style={iconBtn(t)} aria-label="Back">←</button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FONT.serif, fontWeight: 600, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {open.name || open.phone}
            </div>
            <div style={{ fontSize: 11, color: canReply ? t.ink2 : t.amber }}>
              {canReply ? `${hrs}h ${mins}m free-reply window` : "Window closed — template only"}
            </div>
          </div>
          <a href={`https://wa.me/${open.phone}`} target="_blank" rel="noopener noreferrer" style={{ ...iconBtn(t), color: t.teal }}>↗</a>
        </header>

        {/* tags */}
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.hairline}`, background: t.card }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {open.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => saveTags(open.phone, open.tags.filter((x) => x !== tag))}
                style={{ ...chip(t), background: t.ink1, color: t.card, borderColor: t.ink1 }}
              >
                {tag} ✕
              </button>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const v = tagDraft.trim();
                if (!v) return;
                saveTags(open.phone, [...open.tags, v]);
                setTagDraft("");
              }}
              placeholder="+ tag"
              style={{ ...chip(t), width: 78, background: "transparent", color: t.ink1, borderColor: t.ink3 }}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {suggested.filter((s) => !open.tags.includes(s)).slice(0, 5).map((s) => (
              <button key={s} onClick={() => saveTags(open.phone, [...open.tags, s])} style={chip(t)}>
                + {s}
              </button>
            ))}
          </div>
        </div>

        {/* messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", WebkitOverflowScrolling: "touch" }}>
          {open.messages.map((m, i) => {
            const mine = m.direction === "out";
            return (
              <div key={m.messageId || `${m.ts}-${i}`} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
                <div
                  style={{
                    maxWidth: "82%", padding: "8px 11px", borderRadius: 14,
                    // Hers is a card on the paper, edged with a hairline because
                    // white on paper is a 1.1:1 lift a bright screen washes out.
                    // His border is his own fill, so both bubbles keep one size.
                    background: mine ? t.tealFill1 : t.card,
                    border: `1px solid ${mine ? t.tealFill1 : t.hairline}`,
                    borderBottomRightRadius: mine ? 4 : 14,
                    borderBottomLeftRadius: mine ? 14 : 4,
                  }}
                >
                  {m.mediaId && <Media m={m} apiKey={apiKey} phone={open.phone} clientName={open.name} t={t} pass={mediaPass} passFailed={mediaPassFailed} />}
                  {m.text && <div style={{ fontSize: 14.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>}
                  <div style={{ fontFamily: FONT.mono, fontVariantNumeric: "tabular-nums", fontSize: 10, color: mine ? t.ink1 : t.ink2, textAlign: "right", marginTop: 3 }}>{clock(m.ts)}</div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* reply */}
        <div
          style={{
            // A shut window is attention, not failure: amber's tint, not clay's.
            borderTop: `1px solid ${canReply ? t.hairline : `${t.amber}55`}`,
            background: canReply ? t.card : t.amberTint,
            padding: 10, paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
          }}
        >
          {err && <div style={{ color: t.clay, background: t.clayTint, borderRadius: RADIUS.cell, padding: "6px 9px", fontSize: 12, marginBottom: 6 }}>{err}</div>}
          {canReply ? (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message…"
                rows={1}
                style={{ ...input(t), flex: 1, resize: "none", maxHeight: 120, marginBottom: 0 }}
              />
              <button onClick={send} disabled={sending || !draft.trim()} style={{ ...primaryBtn(t), opacity: sending || !draft.trim() ? 0.5 : 1 }}>
                {sending ? "…" : "Send"}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: t.ink2, margin: 0 }}>
              Her 24-hour window has closed. Free replies are no longer allowed —
              send an approved template from the desktop dashboard.
            </p>
          )}
        </div>
      </main>
    );
  }

  // ── thread list ──────────────────────────────────────────────────────────
  const totalUnread = threads.reduce((n, th) => n + th.unread, 0);
  return (
    <main data-inbox style={{ ...page(t, dark), minHeight: "100dvh" }}>
      <Ground t={t} />
      <header style={bar(t)}>
        <div style={{ flex: 1, fontFamily: FONT.serif, fontWeight: 500, fontSize: 21, letterSpacing: "-.01em" }}>
          Inbox {totalUnread > 0 && <span style={badge(t)}>{totalUnread}</span>}
        </div>
        <button onClick={() => load(apiKey)} style={iconBtn(t)} aria-label="Refresh">{loading ? "…" : "⟳"}</button>
      </header>

      <div style={{ display: "flex", gap: 6, padding: "10px 12px", overflowX: "auto", borderBottom: `1px solid ${t.hairline}` }}>
        {["All", "Unread", "Open window", ...allTags].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...chip(t), whiteSpace: "nowrap", background: filter === f ? t.ink1 : "transparent", color: filter === f ? t.card : t.ink2, borderColor: filter === f ? t.ink1 : t.hairline }}
          >
            {f}
          </button>
        ))}
      </div>

      {err && <p style={{ color: t.clay, fontSize: 12, padding: "10px 12px" }}>{err}</p>}
      {!threads.length && !loading && <p style={{ color: t.ink2, fontSize: 13, padding: 20 }}>No conversations yet.</p>}

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {visible.map((th) => {
          const last = th.messages[th.messages.length - 1];
          return (
            <li key={th.phone}>
              <button onClick={() => openThread(th)} style={row(t)}>
                {/* Unread is teal for the reason his replies are: something
                    moved. The ring is the 3:1 mark; the fill only softens it. */}
                <span
                  style={{
                    ...avatar,
                    background: th.unread ? t.tealFill1 : t.sunk,
                    border: `1px solid ${th.unread ? t.teal : t.hairline}`,
                    color: th.unread ? t.ink1 : t.ink2,
                  }}
                >
                  {initials(th.name, th.phone)}
                </span>
                <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: FONT.serif, fontWeight: 600, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {th.name || th.phone}
                    </span>
                    <span style={{ marginLeft: "auto", fontFamily: FONT.mono, fontSize: 11, color: t.ink2, flex: "none" }}>{timeAgo(th.lastTs)}</span>
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, color: t.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {last?.direction === "out" ? "You: " : ""}{last?.text || ""}
                  </span>
                  {(th.tags.length > 0 || th.windowMinutesLeft > 0) && (
                    <span style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                      {th.windowMinutesLeft > 0 && (
                        // Open is the normal state, so it is neutral. Mono, being
                        // a figure, which also keeps it apart from her tags.
                        <span style={{ ...miniChip(t), fontFamily: FONT.mono }}>
                          {Math.floor(th.windowMinutesLeft / 60)}h open
                        </span>
                      )}
                      {th.tags.map((tag) => <span key={tag} style={miniChip(t)}>{tag}</span>)}
                    </span>
                  )}
                </span>
                {th.unread > 0 && <span style={badge(t)}>{th.unread}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

// Styles take the tokens as an argument, so one set serves both themes.
const page = (t: Tokens, dark: boolean): React.CSSProperties => ({
  background: t.paper, color: t.ink1, margin: 0, fontFamily: FONT.sans,
  // Native controls (audio, video, scrollbars) follow the theme, not the OS.
  colorScheme: dark ? "dark" : "light",
});
const bar = (t: Tokens): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 8,
  padding: "calc(10px + env(safe-area-inset-top)) 12px 10px",
  borderBottom: `1px solid ${t.hairline}`, background: t.card,
  position: "sticky", top: 0, zIndex: 10,
});
const row = (t: Tokens): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 11, width: "100%",
  padding: "11px 12px", background: "transparent", border: "none",
  borderBottom: `1px solid ${t.hairline}`, color: t.ink1, cursor: "pointer", textAlign: "left",
});
const avatar: React.CSSProperties = {
  width: 42, height: 42, borderRadius: "50%", flex: "none",
  display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600,
};
const badge = (t: Tokens): React.CSSProperties => ({
  background: t.teal, color: t.card, fontFamily: FONT.mono, fontSize: 11, fontWeight: 500,
  borderRadius: RADIUS.chip, padding: "2px 7px", flex: "none",
});
const chip = (t: Tokens): React.CSSProperties => ({
  fontSize: 12, padding: "5px 10px", borderRadius: RADIUS.chip,
  border: `1px solid ${t.hairline}`, background: "transparent", color: t.ink2, cursor: "pointer",
});
const miniChip = (t: Tokens): React.CSSProperties => ({
  fontSize: 10, padding: "1px 7px", borderRadius: RADIUS.chip,
  border: `1px solid ${t.hairline}`, color: t.ink2,
});
const input = (t: Tokens): React.CSSProperties => ({
  width: "100%", padding: "11px 12px", borderRadius: 10,
  // ink3, not the hairline: a field is a boundary he has to find, and the
  // hairline is 1.2:1 on purpose. ink3 clears the 3:1 a boundary needs.
  border: `1px solid ${t.ink3}`, background: t.card, color: t.ink1,
  fontSize: 16, // 16px stops Android/iOS zooming the page on focus
  outline: "none",
});
const primaryBtn = (t: Tokens): React.CSSProperties => ({
  padding: "11px 16px", borderRadius: 10, border: "none",
  background: t.teal, color: t.card, fontWeight: 600, fontSize: 14, cursor: "pointer",
});
const iconBtn = (t: Tokens): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.hairline}`,
  background: "transparent", color: t.ink1, fontSize: 16, cursor: "pointer",
  display: "grid", placeItems: "center", textDecoration: "none", flex: "none",
});
