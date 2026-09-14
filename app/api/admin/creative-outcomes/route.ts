/**
 * GET /api/admin/creative-outcomes   (x-admin-key)
 *
 * Cost per CLIENT by creative. Spend per ad over the last 90 days, from the D1
 * cache the hourly /api/cron/ads-refresh keeps (lib/ads-cache — no live
 * Windsor call); outcomes from the Leads sheet joined on UTM Content, which the
 * middleware cookies on landing and the lead writer copies into the row. A
 * cheap booking that never closes is the most expensive click in the account —
 * this is where it shows.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";
import { readAdsCache } from "@/lib/ads-cache";
import { isTestIdentity, isWonRow, PROGRAMME_MIN_AMOUNT } from "@/lib/metrics";

export const dynamic = "force-dynamic";

type Row = { creative: string; spend: number; leads: number; booked: number; showed: number; clients: number; revenue: number };

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sheets, sheetId } = await getSheetsClient();
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!A1:ZZ` });
  const all = (r.data.values as string[][]) ?? [];
  const header = (all[0] ?? []).map((h) => String(h ?? "").trim().toLowerCase());
  const col = (n: string) => header.indexOf(n.toLowerCase());
  const iUtm = col("UTM Content"), iBooked = col("Booking Status"), iShowed = col("Showed"), iClosed = col("Closed ₹"), iPaid = col("Paid Amount"), iName = col("Name");
  const iEmail = col("Email"), iPhone = col("Phone"), iProgramme = col("Programme Value");
  const byCreative = new Map<string, Row>();
  for (const row of all.slice(1)) {
    const g = (i: number) => (i >= 0 ? String(row[i] ?? "").trim() : "");
    // The one test rule (lib/metrics): his emails, his phone, his name.
    if (isTestIdentity({ name: g(iName), email: g(iEmail), phone: g(iPhone) })) continue;
    const creative = g(iUtm) || "(no utm_content)";
    const e = byCreative.get(creative) ?? { creative, spend: 0, leads: 0, booked: 0, showed: 0, clients: 0, revenue: 0 };
    e.leads++;
    if (g(iBooked) && !/cancel/i.test(g(iBooked))) e.booked++;
    if (/^y$/i.test(g(iShowed))) e.showed++;
    const amt = (i: number) => { const n = parseFloat(g(i).replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
    const closed = amt(iClosed), paid = amt(iPaid), programme = amt(iProgramme);
    // A client is lib/metrics' win: a programme payment or a sale marked by hand.
    if (isWonRow({ closedAmt: closed, paidAmount: paid, programmeValue: programme })) {
      e.clients++;
      e.revenue += closed ?? programme ?? (paid !== null && paid >= PROGRAMME_MIN_AMOUNT ? paid : 0);
    }
    byCreative.set(creative, e);
  }
  let spendNote = "";
  let spendAsOf: string | null = null;
  const cache = await readAdsCache(new Date().toISOString().slice(0, 10));
  if (cache && cache.ads90.length) {
    spendAsOf = cache.ads90AsOf;
    // Keyed by BOTH ad_id and ad_name: this account's ad URLs put the Meta ad
    // id in utm_content, and a few older ones the name.
    for (const { adId: id, adName: name, spend: amt } of cache.ads90) {
      const key = id || name;
      const hit = [...byCreative.keys()].find((k) => k === key || k.toLowerCase() === name.toLowerCase());
      if (hit) { const e = byCreative.get(hit)!; e.spend += amt; if (e.creative === id && name) e.creative = `${name} (${id})`; }
      else byCreative.set(key, { creative: name && id ? `${name} (${id})` : key, spend: amt, leads: 0, booked: 0, showed: 0, clients: 0, revenue: 0 });
    }
  } else {
    spendNote = "no ad spend cached yet — the hourly refresh fills it";
  }
  const rows = [...byCreative.values()]
    .map((x) => ({ ...x, costPerBooking: x.booked ? x.spend / x.booked : null, costPerClient: x.clients ? x.spend / x.clients : null }))
    .sort((p, q) => q.spend - p.spend);
  return NextResponse.json({ rows, spendNote, spendAsOf, generatedAt: new Date().toISOString() });
}
