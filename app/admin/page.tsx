"use client";

/**
 * /admin — the shell. Two tabs over one URL:
 *
 *   Pipeline   → what is happening with each lead, and what to do next
 *   Analytics  → funnel, ROAS, ad quality, follow-up queue
 *
 * The analytics view is the original /admin page, moved to AnalyticsDashboard
 * verbatim rather than rewritten. Every number in it is load-bearing — ROAS,
 * cost per booking, per-ad lead quality — and replacing a working dashboard to
 * make room for a new one would have cost more than it bought.
 *
 * The tab lives in the URL hash so a reload, a bookmark and the back button all
 * land where you left off.
 */

import { useEffect, useState } from "react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import Pipeline from "./Pipeline";

const BG = "#0e0e11";
const CARD = "#17181c";
const GRID = "#26242c";
const INK1 = "#f4f2f7";
const MUTED = "#8a8494";
const ACCENT = "#d4bbff";

type Tab = "pipeline" | "analytics";

export default function AdminShell() {
  const [tab, setTab] = useState<Tab>("pipeline");

  // Hash is the source of truth so reload/back/bookmark all behave.
  useEffect(() => {
    const read = () => {
      const h = (window.location.hash || "").replace("#", "");
      setTab(h === "analytics" ? "analytics" : "pipeline");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    // replaceState rather than assigning location.hash: it updates the URL
    // without pushing a history entry per tab click, so Back still leaves /admin.
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${t}`);
  };

  return (
    <main style={{ background: BG, minHeight: "100vh", color: INK1, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(14,14,17,.86)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${GRID}`,
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "11px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 15, letterSpacing: "-.02em" }}>
            Thyro<span style={{ color: ACCENT }}>Well</span> Ops
          </strong>
          <nav style={{ display: "flex", gap: 4, background: CARD, border: `1px solid ${GRID}`, borderRadius: 99, padding: 3 }}>
            {([
              { id: "pipeline" as const, label: "Pipeline" },
              { id: "analytics" as const, label: "Analytics" },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                style={{
                  background: tab === t.id ? ACCENT : "transparent",
                  color: tab === t.id ? "#1a1320" : MUTED,
                  border: 0,
                  padding: "6px 15px",
                  borderRadius: 99,
                  fontSize: 12.5,
                  fontWeight: tab === t.id ? 800 : 500,
                  cursor: "pointer",
                  transition: "background .15s ease, color .15s ease",
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <a
            href="/inbox"
            style={{ marginLeft: "auto", fontSize: 12, color: MUTED, textDecoration: "none", border: `1px solid ${GRID}`, padding: "6px 12px", borderRadius: 8 }}
          >
            Inbox
          </a>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 16px 80px" }}>
        {/* Both mount; only one is shown. The analytics tab holds a lot of fetched
            state and re-mounting it on every tab switch would re-run every call. */}
        <div style={{ display: tab === "pipeline" ? "block" : "none" }}>
          <Pipeline />
        </div>
        <div style={{ display: tab === "analytics" ? "block" : "none" }}>
          <AnalyticsDashboard />
        </div>
      </div>
    </main>
  );
}
