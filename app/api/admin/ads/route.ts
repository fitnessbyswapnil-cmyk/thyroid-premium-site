/**
 * GET /api/admin/ads
 *
 * Meta Ads spend/delivery feed for the /admin dashboard's Ad Performance
 * section. Read-only against the Marketing API:
 *   - daily account-level insights, last 30 days (spend, impressions,
 *     link clicks, CPM, frequency)
 *   - per-ad insights, last 14 days (the kill/scale decision window)
 *   - per-campaign spend, last 30 days — what the ROAS panel divides by, and
 *     the only place the dashboard can answer "how many campaigns am I paying
 *     for" without opening Ads Manager
 *
 * Token: META_ADS_TOKEN if set, else the existing META_CAPI_TOKEN (system
 * user tokens often carry ads_read for the assigned ad account). Every
 * outcome is reported in `status` so the dashboard shows exactly why data
 * is missing instead of failing silently — same pattern as the Cal.com sync.
 *
 * Auth: x-admin-key, same as the other admin routes. Nothing here writes.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";

export const dynamic = "force-dynamic";

const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID || "1120707423412525";
const GRAPH = "https://graph.facebook.com/v21.0";

type AdsStatus = {
  tokenSet: boolean;
  tokenSource: "META_ADS_TOKEN" | "META_CAPI_TOKEN" | "none";
  ok: boolean;
  error: string;
};

type DailyRow = {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  linkClicks: number;
  cpm: number;
  frequency: number;
};

type CampaignRow = {
  campaignId: string;
  campaignName: string;
  spend: number;
};

type AdRow = {
  adId: string;
  adName: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  cpm: number;
  frequency: number;
};

type MetaInsightRow = {
  date_start?: string;
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  cpm?: string;
  frequency?: string;
};

const f = (v?: string) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
};

async function insights(token: string, params: string): Promise<{ rows?: MetaInsightRow[]; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${GRAPH}/act_${AD_ACCOUNT}/insights?${params}&access_token=${encodeURIComponent(token)}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: MetaInsightRow[]; error?: { message?: string; code?: number } };
    if (!res.ok || json.error) {
      return { error: json.error?.message || `HTTP ${res.status}` };
    }
    return { rows: json.data ?? [] };
  } catch {
    return { error: "Meta API unreachable (timeout)" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const adsToken = process.env.META_ADS_TOKEN;
  const capiToken = process.env.META_CAPI_TOKEN;
  const token = adsToken || capiToken || "";
  const status: AdsStatus = {
    tokenSet: !!token,
    tokenSource: adsToken ? "META_ADS_TOKEN" : capiToken ? "META_CAPI_TOKEN" : "none",
    ok: false,
    error: "",
  };
  if (!token) {
    status.error = "No Meta token found (set META_ADS_TOKEN in Vercel, then redeploy)";
    return NextResponse.json({ daily: [], ads: [], campaigns: [], status });
  }

  const [dailyRes, adsRes, campRes] = await Promise.all([
    insights(
      token,
      "date_preset=last_30d&time_increment=1&fields=spend,impressions,inline_link_clicks,cpm,frequency",
    ),
    insights(
      token,
      "date_preset=last_14d&level=ad&fields=ad_id,ad_name,spend,impressions,inline_link_clicks,cpm,frequency&limit=50",
    ),
    insights(
      token,
      "date_preset=last_30d&level=campaign&fields=campaign_id,campaign_name,spend&limit=100",
    ),
  ]);

  if (dailyRes.error && adsRes.error) {
    // Most common: token lacks ads_read → Meta error mentions permission.
    status.error = dailyRes.error.includes("permission") || dailyRes.error.includes("ads_read")
      ? `Token can't read ads (${status.tokenSource}). Create a token with ads_read as META_ADS_TOKEN in Vercel.`
      : dailyRes.error;
    return NextResponse.json({ daily: [], ads: [], campaigns: [], status });
  }

  const daily: DailyRow[] = (dailyRes.rows ?? []).map((r) => ({
    date: r.date_start ?? "",
    spend: f(r.spend),
    impressions: f(r.impressions),
    linkClicks: f(r.inline_link_clicks),
    cpm: f(r.cpm),
    frequency: f(r.frequency),
  }));

  const ads: AdRow[] = (adsRes.rows ?? [])
    .map((r) => ({
      adId: r.ad_id ?? "",
      adName: r.ad_name ?? "",
      spend: f(r.spend),
      impressions: f(r.impressions),
      linkClicks: f(r.inline_link_clicks),
      cpm: f(r.cpm),
      frequency: f(r.frequency),
    }))
    .filter((a) => a.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  // Only campaigns that actually took money — a paused campaign with zero
  // spend is not something the owner is "running", and counting it would
  // overstate how much of the account is live.
  const campaigns: CampaignRow[] = (campRes.rows ?? [])
    .map((r) => ({
      campaignId: r.campaign_id ?? "",
      campaignName: r.campaign_name ?? "",
      spend: f(r.spend),
    }))
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  status.ok = true;
  if (dailyRes.error) status.error = `daily series unavailable: ${dailyRes.error}`;
  else if (adsRes.error) status.error = `per-ad breakdown unavailable: ${adsRes.error}`;
  else if (campRes.error) status.error = `campaign breakdown unavailable: ${campRes.error}`;

  return NextResponse.json({ daily, ads, campaigns, status });
}
