"use client";

/**
 * /crm — the pipeline on a phone, standing up between calls.
 *
 * Renders the SAME component as the Pipeline tab of /admin rather than a second
 * implementation, so the two can never drift. Only the chrome differs: no tabs,
 * no analytics, and the page surface comes from the same token set.
 */

import { useEffect, useState } from "react";
import Pipeline from "../admin/Pipeline";
import { LIGHT, DARK, FONT, type Tokens } from "../admin/tokens";

export default function CrmPage() {
  const [dark, setDark] = useState(false);
  const t: Tokens = dark ? (DARK as unknown as Tokens) : LIGHT;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDark(localStorage.getItem("admin_theme") === "dark");
    } catch {}
  }, []);

  return (
    <main style={{ background: t.paper, minHeight: "100vh", color: t.ink1, padding: "18px 14px 90px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontFamily: FONT.serif, fontWeight: 500, fontSize: 26, letterSpacing: "-.015em" }}>Practice</h1>
          <a href="/admin" style={{ marginLeft: "auto", fontFamily: FONT.sans, fontSize: 12.5, color: t.teal, textDecoration: "none" }}>
            Full desk →
          </a>
        </header>
        <Pipeline dark={dark} />
      </div>
    </main>
  );
}
