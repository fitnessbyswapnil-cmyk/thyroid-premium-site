"use client";

/**
 * /crm — the pipeline on a phone.
 *
 * Renders the SAME component as the Pipeline tab of /admin rather than a second
 * implementation, so the two can never drift apart. The only difference is the
 * chrome: no tab bar, no analytics, just the pipeline on a dark full-height
 * page — which is what is wanted when this is opened between calls.
 */

import Pipeline from "../admin/Pipeline";

export default function CrmPage() {
  return (
    <main style={{ background: "#0e0e11", minHeight: "100vh", color: "#f4f2f7", fontFamily: "system-ui, -apple-system, sans-serif", padding: "16px 14px 80px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <h1 style={{ fontSize: 22, margin: 0, letterSpacing: "-.03em" }}>Pipeline</h1>
          <a href="/admin" style={{ marginLeft: "auto", fontSize: 12, color: "#8a8494", textDecoration: "none" }}>
            Full dashboard →
          </a>
        </header>
        <Pipeline />
      </div>
    </main>
  );
}
