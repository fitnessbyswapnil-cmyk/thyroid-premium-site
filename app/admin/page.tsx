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
 * make room for a new one would have cost more than it bought. It keeps its own
 * dark chrome; only the pipeline carries the case-file design.
 *
 * The tab lives in the URL hash so a reload, a bookmark and the back button all
 * land where you left off. Theme is remembered per device — dark exists for the
 * 6am and late-night reads, and is a designed variant rather than an inversion.
 */

import { useEffect, useState } from "react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import Pipeline from "./Pipeline";
import { LIGHT, DARK, FONT, RADIUS, type Tokens } from "./tokens";

type Tab = "pipeline" | "analytics";
const THEME_STORE = "admin_theme";

export default function AdminShell() {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [dark, setDark] = useState(false);
  const t: Tokens = dark ? (DARK as unknown as Tokens) : LIGHT;

  useEffect(() => {
    const read = () => {
      const h = (window.location.hash || "").replace("#", "");
      setTab(h === "analytics" ? "analytics" : "pipeline");
    };
    read();
    window.addEventListener("hashchange", read);
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDark(localStorage.getItem(THEME_STORE) === "dark");
    } catch {}
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = (x: Tab) => {
    setTab(x);
    // replaceState rather than assigning location.hash: it updates the URL
    // without pushing a history entry per tab click, so Back still leaves /admin.
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${x}`);
  };

  const toggleTheme = () => {
    setDark((d) => {
      const next = !d;
      try {
        localStorage.setItem(THEME_STORE, next ? "dark" : "light");
      } catch {}
      return next;
    });
  };

  // The analytics tab is its own dark instrument panel and always sits on its
  // own ground, so the page surface follows the pipeline's theme only.
  const onPipeline = tab === "pipeline";

  return (
    <main style={{ background: onPipeline ? t.paper : "#0e0e11", minHeight: "100vh", color: t.ink1 }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: onPipeline ? t.card : "#17181c",
          borderBottom: `1px solid ${onPipeline ? t.hairline : "#26242c"}`,
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 18px", display: "flex", alignItems: "baseline", gap: 20, flexWrap: "wrap" }}>
          <strong style={{ fontFamily: FONT.serif, fontWeight: 500, fontSize: 21, letterSpacing: "-.01em", color: onPipeline ? t.ink1 : "#f4f2f7" }}>
            Practice
          </strong>

          <nav style={{ display: "flex", gap: 18 }}>
            {([
              { id: "pipeline" as const, label: "Pipeline" },
              { id: "analytics" as const, label: "Analytics" },
            ]).map((x) => {
              const on = tab === x.id;
              return (
                <button
                  key={x.id}
                  onClick={() => go(x.id)}
                  aria-current={on ? "page" : undefined}
                  style={{
                    background: "transparent",
                    border: 0,
                    padding: "2px 0 5px",
                    fontFamily: FONT.sans,
                    fontSize: 13.5,
                    fontWeight: on ? 600 : 400,
                    color: on ? (onPipeline ? t.ink1 : "#f4f2f7") : onPipeline ? t.ink3 : "#8a8494",
                    borderBottom: on ? `2px solid ${onPipeline ? t.teal : "#c793ff"}` : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  {x.label}
                </button>
              );
            })}
          </nav>

          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 11.5, color: onPipeline ? t.ink3 : "#8a8494" }}>
              {new Date().toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
            </span>
            <button
              onClick={toggleTheme}
              aria-label={dark ? "Switch to light" : "Switch to dark"}
              style={{ background: "transparent", border: `1px solid ${onPipeline ? t.hairline : "#26242c"}`, color: onPipeline ? t.ink2 : "#b9b3c4", padding: "4px 11px", borderRadius: RADIUS.chip, fontSize: 11.5, fontFamily: FONT.sans, cursor: "pointer" }}
            >
              {dark ? "Light" : "Dark"}
            </button>
            <a href="/inbox" style={{ fontFamily: FONT.sans, fontSize: 12.5, color: onPipeline ? t.teal : "#8a8494", textDecoration: "none" }}>
              Inbox
            </a>
          </span>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 18px 90px" }}>
        {/* Both mount; only one is shown. The analytics tab holds a lot of fetched
            state and re-mounting it on every tab switch would re-run every call. */}
        <div style={{ display: onPipeline ? "block" : "none" }}>
          <Pipeline dark={dark} />
        </div>
        <div style={{ display: tab === "analytics" ? "block" : "none" }}>
          <AnalyticsDashboard />
        </div>
      </div>
    </main>
  );
}
