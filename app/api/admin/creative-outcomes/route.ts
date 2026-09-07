/**
 * GET /api/admin/creative-outcomes   (x-admin-key)
 *
 * Cost per CLIENT by creative. Spend per ad from Windsor (last 90 days, by ad
 * name); outcomes from the Leads sheet joined on UTM Content, which the
 * middleware cookies on landing and the lead writer copies into the row. A
 * cheap booking that never closes is the most expensive click in the account —
 * this is where it shows.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";

export const dynamic = "force-dynamic";

type Row = { creative: string; spend: number; leads: number; booked: number; showed: number; clients: number; revenue: number };

async function windsorSpendByAd(apiKey: string): Promise<Map<string, number>> {
  const url = `https://connectors.windsor.ai/facebook?api_key=${encodeURIComponent(apiKey)}&date_preset=last_90d&fields=ad_name,spend`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`windsor ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ ad_name?: string; spend?: string | number }> };
  const out = new Map<string, number>();
  for (const r of json.data ?? []) {
    const k = String(r.ad_name ?? "").trim(); if (!k) continue;
    out.set(k, (out.get(k) ?? 0) + (parseFloat(String(r.spend ?? "0")) || 0));
  }
  return out;
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sheets, sheetId } = await getSheetsClient();
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!A1:BZ` });
  const all = (r.data.values as string[][]) ?? [];
  const header = (all[0] ?? []).map((h) => String(h ?? "").trim().toLowerCase());
  const col = (n: string) => header.indexOf(n.toLowerCase());
  const iUtm = col("UTM Content"), iBooked = col("Booking Status"), iShowed = col("Showed"), iClosed = col("Closed ₹"), iPaid = col("Paid Amount"), iName = col("Name");
  const byCreative = new Map<string, Row>();
  for (const row of all.slice(1)) {
    const g = (i: number) => (i >= 0 ? String(row[i] ?? "").trim() : "");
    if (/swapnil/i.test(g(iName))) continue;
    const creative = g(iUtm) || "(no utm_content)";
    const e = byCreative.get(creative) ?? { creative, spend: 0, leads: 0, booked: 0, showed: 0, clients: 0, revenue: 0 };
    e.leads++;
    if (g(iBooked) && !/cancel/i.test(g(iBooked))) e.booked++;
    if (/^y$/i.test(g(iShowed))) e.showed++;
    const closed = parseFloat(g(iClosed).replace(/[^\d.]/g, "")) || 0;
    const paid = parseFloat(g(iPaid).replace(/[^\d.]/g, "")) || 0;
    const rev = Math.max(closed, paid >= 1000 ? paid : 0); // a Rs 299 consult is not a client
    if (rev > 0) { e.clients++; e.revenue += rev; }
    byCreative.set(creative, e);
  }
  let spendNote = "";
  try {
    const key = process.env.WINDSOR_API_KEY;
    if (key) {
      const spend = await windsorSpendByAd(key);
      for (const [name, amt] of spend) {
        const hit = [...byCreative.keys()].find((k) => k.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(k.toLowerCase()));
        if (hit) byCreative.get(hit)!.spend += amt;
        else byCreative.set(name, { creative: name, spend: amt, leads: 0, booked: 0, showed: 0, clients: 0, revenue: 0 });
      }
    } else spendNote = "WINDSOR_API_KEY not set — spend omitted";
  } catch (e) { spendNote = `spend unavailable: ${e instanceof Error ? e.message : String(e)}`; }
  const rows = [...byCreative.values()]
    .map((x) => ({ ...x, costPerBooking: x.booked ? x.spend / x.booked : null, costPerClient: x.clients ? x.spend / x.clients : null }))
    .sort((p, q) => q.spend - p.spend);
  return NextResponse.json({ rows, spendNote, generatedAt: new Date().toISOString() });
}
