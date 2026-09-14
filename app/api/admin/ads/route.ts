/**
 * GET /api/admin/ads
 *
 * Meta Ads spend/delivery feed for the /admin dashboard's Ad Performance
 * section and the ROAS ledger:
 *   - daily account-level insights, last 30 days (spend, impressions,
 *     link clicks, CPM, frequency)
 *   - per-ad insights, last 14 days (the kill/scale decision window)
 *   - per-campaign spend, last 30 days
 *
 * READS THE D1 CACHE ONLY (since 14-Sep-2026). The hourly
 * /api/cron/ads-refresh job is what talks to Windsor (or Meta, as fallback);
 * this route returns what it last stored, with `asOf`, so the page can say how
 * old the numbers are. A page load never waits on Windsor.
 *
 * `status` keeps its old shape so the dashboard's source line still works, and
 * says exactly why data is missing rather than failing silently.
 * Auth: x-admin-key. Nothing writes.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { readAdsCache, isoDate, ageHours, STALE_AFTER_HOURS } from "@/lib/ads-cache";

export const dynamic = "force-dynamic";

const SOURCE_LABEL = { windsor: "Windsor", meta: "Meta API", none: "none" } as const;

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const c = await readAdsCache(isoDate(now - 29 * 86400_000));
  if (!c) {
    return NextResponse.json({
      daily: [],
      ads: [],
      campaigns: [],
      asOf: null,
      status: {
        tokenSet: false,
        tokenSource: "cache",
        ok: false,
        error: "No ad data cached yet — the hourly refresh has not run. It fills itself within the hour.",
      },
    });
  }

  const warnings: string[] = [];
  if (c.lastRefresh?.error) warnings.push(`last refresh: ${c.lastRefresh.error}`);
  if (c.asOf && ageHours(Date.parse(c.asOf), now) > STALE_AFTER_HOURS) {
    warnings.push(`numbers are ${Math.round(ageHours(Date.parse(c.asOf), now))} hours old`);
  }

  return NextResponse.json({
    daily: c.daily,
    ads: c.ads,
    campaigns: c.campaigns,
    asOf: c.asOf,
    status: {
      tokenSet: true,
      tokenSource: SOURCE_LABEL[c.lastRefresh?.source ?? "none"] ?? "cache",
      ok: c.daily.length > 0 || c.ads.length > 0,
      error: warnings.join("; "),
    },
  });
}
