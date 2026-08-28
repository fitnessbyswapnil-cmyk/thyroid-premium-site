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

const KEY_STORE = "admin_dash_key";

const BG = "#0e0e11";
const PANEL = "#17171b";
const PANEL_2 = "#1e1e24";
const LINE = "#2a2a32";
const INK = "#f2f2f4";
const MUTED = "#8b8b96";
const ACCENT = "#7c5cff";
const GOOD = "#38c172";
const WARN = "#e3a008";
const OUT_BUBBLE = "#3b2f6e";

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

/** Renders an attachment inline; the key rides in the URL because <img> cannot send headers. */
function Media({ m, apiKey }: { m: WaMessage; apiKey: string }) {
  const src = `/api/admin/media?id=${encodeURIComponent(m.mediaId)}&k=${encodeURIComponent(apiKey)}`;
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div style={{ fontSize: 12, color: WARN, padding: "6px 0" }}>
        Attachment unavailable — WhatsApp deletes media after about 30 days.
      </div>
    );
  }
  if (m.mediaType === "image" || m.mediaType === "sticker") {
    return (
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
  }
  if (m.mediaType === "audio") {
    return <audio controls src={src} style={{ width: "100%", marginBottom: 6 }} />;
  }
  if (m.mediaType === "video") {
    return <video controls src={src} style={{ maxWidth: "100%", borderRadius: 10, marginBottom: 6 }} />;
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", marginBottom: 6,
        background: "rgba(255,255,255,0.06)", borderRadius: 10, color: INK,
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

export default function InboxClient() {
  const [apiKey, setApiKey] = useState<string>("");
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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // Deferred a tick: reading storage and setting state synchronously inside
      // an effect cascades a second render before the first has painted.
      await Promise.resolve();
      if (!alive) return;
      let k = "";
      try {
        k = localStorage.getItem(KEY_STORE) || sessionStorage.getItem(KEY_STORE) || "";
      } catch { /* storage blocked */ }
      if (!alive) return;
      setApiKey(k);
    })();
    return () => { alive = false; };
  }, []);

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
        try { localStorage.removeItem(KEY_STORE); } catch { /* ignore */ }
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

  // ── key gate ─────────────────────────────────────────────────────────────
  if (!apiKey) {
    return (
      <main style={{ ...page, minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 340 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Inbox</h1>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 18px" }}>
            WhatsApp conversations for your business number.
          </p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Admin key"
            style={input}
          />
          <button
            onClick={() => {
              const k = keyInput.trim();
              if (!k) return;
              try { localStorage.setItem(KEY_STORE, k); } catch { /* ignore */ }
              setApiKey(k);
            }}
            style={{ ...primaryBtn, width: "100%", marginTop: 10 }}
          >
            Open inbox
          </button>
          {err && <p style={{ color: WARN, fontSize: 12, marginTop: 10 }}>{err}</p>}
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
      <main style={{ ...page, display: "flex", flexDirection: "column", height: "100dvh" }}>
        <header style={{ ...bar, gap: 10 }}>
          <button onClick={() => setOpenPhone(null)} style={iconBtn} aria-label="Back">←</button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {open.name || open.phone}
            </div>
            <div style={{ fontSize: 11, color: canReply ? GOOD : WARN }}>
              {canReply ? `${hrs}h ${mins}m free-reply window` : "Window closed — template only"}
            </div>
          </div>
          <a href={`https://wa.me/${open.phone}`} target="_blank" rel="noopener noreferrer" style={iconBtn}>↗</a>
        </header>

        {/* tags */}
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${LINE}`, background: PANEL }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {open.tags.map((t) => (
              <button
                key={t}
                onClick={() => saveTags(open.phone, open.tags.filter((x) => x !== t))}
                style={{ ...chip, background: ACCENT, color: "#fff", borderColor: ACCENT }}
              >
                {t} ✕
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
              style={{ ...chip, width: 78, background: "transparent", color: INK }}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {suggested.filter((s) => !open.tags.includes(s)).slice(0, 5).map((s) => (
              <button key={s} onClick={() => saveTags(open.phone, [...open.tags, s])} style={chip}>
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
                    background: mine ? OUT_BUBBLE : PANEL_2,
                    borderBottomRightRadius: mine ? 4 : 14,
                    borderBottomLeftRadius: mine ? 14 : 4,
                  }}
                >
                  {m.mediaId && <Media m={m} apiKey={apiKey} />}
                  {m.text && <div style={{ fontSize: 14.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>}
                  <div style={{ fontSize: 10, color: MUTED, textAlign: "right", marginTop: 3 }}>{clock(m.ts)}</div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* reply */}
        <div style={{ borderTop: `1px solid ${LINE}`, background: PANEL, padding: 10, paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}>
          {err && <div style={{ color: WARN, fontSize: 12, marginBottom: 6 }}>{err}</div>}
          {canReply ? (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message…"
                rows={1}
                style={{ ...input, flex: 1, resize: "none", maxHeight: 120, marginBottom: 0 }}
              />
              <button onClick={send} disabled={sending || !draft.trim()} style={{ ...primaryBtn, opacity: sending || !draft.trim() ? 0.5 : 1 }}>
                {sending ? "…" : "Send"}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
              Her 24-hour window has closed. Free replies are no longer allowed —
              send an approved template from the desktop dashboard.
            </p>
          )}
        </div>
      </main>
    );
  }

  // ── thread list ──────────────────────────────────────────────────────────
  const totalUnread = threads.reduce((n, t) => n + t.unread, 0);
  return (
    <main style={{ ...page, minHeight: "100dvh" }}>
      <header style={bar}>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 18 }}>
          Inbox {totalUnread > 0 && <span style={badge}>{totalUnread}</span>}
        </div>
        <button onClick={() => load(apiKey)} style={iconBtn} aria-label="Refresh">{loading ? "…" : "⟳"}</button>
      </header>

      <div style={{ display: "flex", gap: 6, padding: "10px 12px", overflowX: "auto", borderBottom: `1px solid ${LINE}` }}>
        {["All", "Unread", "Open window", ...allTags].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...chip, whiteSpace: "nowrap", background: filter === f ? ACCENT : "transparent", color: filter === f ? "#fff" : INK, borderColor: filter === f ? ACCENT : LINE }}
          >
            {f}
          </button>
        ))}
      </div>

      {err && <p style={{ color: WARN, fontSize: 12, padding: "10px 12px" }}>{err}</p>}
      {!threads.length && !loading && <p style={{ color: MUTED, fontSize: 13, padding: 20 }}>No conversations yet.</p>}

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {visible.map((t) => {
          const last = t.messages[t.messages.length - 1];
          return (
            <li key={t.phone}>
              <button onClick={() => openThread(t)} style={row}>
                <span style={{ ...avatar, background: t.unread ? ACCENT : PANEL_2 }}>{initials(t.name, t.phone)}</span>
                <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.name || t.phone}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: MUTED, flex: "none" }}>{timeAgo(t.lastTs)}</span>
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {last?.direction === "out" ? "You: " : ""}{last?.text || ""}
                  </span>
                  {(t.tags.length > 0 || t.windowMinutesLeft > 0) && (
                    <span style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                      {t.windowMinutesLeft > 0 && (
                        <span style={{ ...miniChip, color: GOOD, borderColor: "rgba(56,193,114,.4)" }}>
                          {Math.floor(t.windowMinutesLeft / 60)}h open
                        </span>
                      )}
                      {t.tags.map((tag) => <span key={tag} style={miniChip}>{tag}</span>)}
                    </span>
                  )}
                </span>
                {t.unread > 0 && <span style={badge}>{t.unread}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

const page: React.CSSProperties = {
  background: BG, color: INK, margin: 0,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};
const bar: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "calc(10px + env(safe-area-inset-top)) 12px 10px",
  borderBottom: `1px solid ${LINE}`, background: PANEL,
  position: "sticky", top: 0, zIndex: 10,
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 11, width: "100%",
  padding: "11px 12px", background: "transparent", border: "none",
  borderBottom: `1px solid ${LINE}`, color: INK, cursor: "pointer", textAlign: "left",
};
const avatar: React.CSSProperties = {
  width: 42, height: 42, borderRadius: "50%", flex: "none",
  display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, color: "#fff",
};
const badge: React.CSSProperties = {
  background: ACCENT, color: "#fff", fontSize: 11, fontWeight: 700,
  borderRadius: 999, padding: "2px 7px", flex: "none",
};
const chip: React.CSSProperties = {
  fontSize: 12, padding: "5px 10px", borderRadius: 999,
  border: `1px solid ${LINE}`, background: "transparent", color: INK, cursor: "pointer",
};
const miniChip: React.CSSProperties = {
  fontSize: 10, padding: "1px 7px", borderRadius: 999,
  border: `1px solid ${LINE}`, color: MUTED,
};
const input: React.CSSProperties = {
  width: "100%", padding: "11px 12px", borderRadius: 10,
  border: `1px solid ${LINE}`, background: PANEL_2, color: INK,
  fontSize: 16, // 16px stops Android/iOS zooming the page on focus
  outline: "none",
};
const primaryBtn: React.CSSProperties = {
  padding: "11px 16px", borderRadius: 10, border: "none",
  background: ACCENT, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
};
const iconBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 10, border: `1px solid ${LINE}`,
  background: "transparent", color: INK, fontSize: 16, cursor: "pointer",
  display: "grid", placeItems: "center", textDecoration: "none", flex: "none",
};
