"use client";

/** Cost per client by creative — the report that decides budget, not clicks. */
import { useEffect, useState } from "react";

type Row = { creative: string; spend: number; leads: number; booked: number; showed: number; clients: number; revenue: number; costPerBooking: number | null; costPerClient: number | null };
const rupee = (n: number | null) => (n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);

export default function CreativeOutcomes() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    let key: string | null = null;
    try { key = sessionStorage.getItem("admin_dash_key"); } catch { /* none */ }
    if (!key) return;
    fetch("/api/admin/creative-outcomes", { headers: { "x-admin-key": key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rows?: Row[]; spendNote?: string } | null) => { if (d?.rows) setRows(d.rows); if (d?.spendNote) setNote(d.spendNote); })
      .catch(() => {});
  }, []);
  if (!rows) return null;
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>Cost per client, by creative</h2>
      <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 10px" }}>
        Spend per ad (last 90 days) joined to closes on UTM content. A cheap booking that never closes is the most expensive click you buy.{note ? ` — ${note}` : ""}
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["Creative", "Spend", "Leads", "Booked", "Showed", "Clients", "Revenue", "₹ / booking", "₹ / client"].map((h) => (
            <th key={h} style={{ textAlign: h === "Creative" ? "left" : "right", padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,.15)", fontWeight: 600 }}>{h}</th>))}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.creative}>
              <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,.07)" }}>{r.creative}</td>
              {[rupee(r.spend), r.leads, r.booked, r.showed, r.clients, rupee(r.revenue), rupee(r.costPerBooking), rupee(r.costPerClient)].map((v, i) => (
                <td key={i} style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,.07)", fontVariantNumeric: "tabular-nums", fontWeight: i === 7 ? 600 : 400 }}>{v}</td>))}
            </tr>))}</tbody>
        </table>
      </div>
    </section>
  );
}
