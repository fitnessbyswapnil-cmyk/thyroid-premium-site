/**
 * GET /api/cron/ads-refresh
 *
 * The ONLY caller of Windsor.ai. Hourly — "7 * * * *" in wrangler.jsonc,
 * routed by CRON_ROUTES in custom-worker.js — it fetches ad spend and delivery
 * (lib/ads-source.ts) and stores them in D1 (lib/ads-cache.ts). The admin
 * pages read that cache and show its time; no page load calls Windsor.
 *
 * Recent days are re-fetched every run, because a day's spend keeps settling
 * for a while. The first run, or ?full=1, fetches ~400 days of history so
 * "all time" has something to add up.
 *
 * Reads ad insights only. Sends nothing to Meta and touches no lead data.
 *
 * AUTHORIZATION — one of (same as /api/cron/meta-retry):
 *   Authorization: Bearer <CRON_SECRET>   (the worker cron)
 *   x-admin-key: <admin key>              (by hand, e.g. the first fill)
 *
 * Off Cloudflare there is no D1: it still fetches, reports, and stores nothing.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../../admin/_lib";
import { fetchAds } from "@/lib/ads-source";
import { countCachedDays, daysToFetch, writeAdsCache } from "@/lib/ads-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron && !checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const full = req.nextUrl.searchParams.get("full") === "1";
  const cached = await countCachedDays();
  const days = daysToFetch(cached, full);
  const now = Date.now();

  const f = await fetchAds(days);
  const stored = await writeAdsCache(f, now);
  const summary = {
    source: f.source,
    daysRequested: days,
    daysCachedBefore: cached,
    daily: f.daily.length,
    ads14: f.ads14.length,
    ads90: f.ads90.length,
    campaigns30: f.campaigns30.length,
    error: f.error,
    stored,
  };
  console.log(`[ads-refresh] ${JSON.stringify(summary)}`);
  return NextResponse.json(summary);
}
