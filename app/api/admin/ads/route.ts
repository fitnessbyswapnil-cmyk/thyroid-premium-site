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
 * Two sources, tried in order:
 *   1. Windsor.ai (WINDSOR_API_KEY) — reads the already-authorized Meta Ads
 *      connection. Windsor keys don't expire, which is exactly how the
 *      direct Meta token died; this is the primary source.
 *   2. Meta Marketing API directly (META_ADS_TOKEN, else META_CAPI_TOKEN) —
 *      kept as fallback for when Windsor is unreachable.
 *
 * Every outcome is reported in `status` so the dashboard shows exactly why
 * data is missing instead of failing silently — same pattern as the Cal.com
 * sync. Auth: x-admin-key, same as the other admin routes. Nothing writes.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";

export const dynamic = "force-dynamic";

const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID || "1120707423412525";
const GRAPH = "https://graph.facebook.com/v21.0";
const WINDSOR = "https://connectors.windsor.ai/facebook";

type AdsStatus = {
  tokenSet: boolean;
  tokenSource: "WINDSOR_API_KEY" | "META_ADS_TOKEN" | "META_CAPI_TOKEN" | "none";
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

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown) => (v == null ? "" : String(v));

/** YYYY-MM-DD for `daysAgo` days before today (UTC). */
function isoDaysAgo(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400_000);
  return d.toISOString().slice(0, 10);
}

// ── source 1: Windsor.ai ─────────────────────────────────────────────────

type WindsorRow = Record<string, unknown>;

async function windsorQuery(
  apiKey: string,
  fields: string[],
  daysBack: number,
): Promise<{ rows?: WindsorRow[]; error?: string }> {
  const params = new URLSearchParams({
    api_key: apiKey,
    fields: fields.join(","),
    date_from: isoDaysAgo(daysBack - 1),
    date_to: isoDaysAgo(0),
    _renderer: "json",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${WINDSOR}?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      return { error: `Windsor HTTP ${res.status}${body ? `: ${body}` : ""}` };
    }
    const json = (await res.json()) as { data?: WindsorRow[]; error?: string };
    if (json.error) return { error: json.error };
    return { rows: json.data ?? [] };
  } catch {
    return { error: "Windsor API unreachable (timeout)" };
  } finally {
    clearTimeout(timeout);
  }
}

// Windsor returns one row per (dimension) group; link clicks come from the
// Actions table (`actions_link_click`), with all-clicks kept as a fallback
// so a missing join never zeroes the column.
const linkClicksOf = (r: WindsorRow) =>
  num(r.actions_link_click) || num(r.clicks);

async function fromWindsor(apiKey: string): Promise<{
  daily: DailyRow[];
  ads: AdRow[];
  campaigns: CampaignRow[];
  error?: string;
} | null> {
  const [dailyRes, adsRes, campRes] = await Promise.all([
    windsorQuery(apiKey, ["date", "spend", "impressions", "clicks", "actions_link_click", "cpm", "frequency"], 30),
    windsorQuery(apiKey, ["ad_id", "ad_name", "spend", "impressions", "clicks", "actions_link_click", "cpm", "frequency"], 14),
    windsorQuery(apiKey, ["campaign_id", "campaign", "spend"], 30),
  ]);

  // All three failing means the source is down/misconfigured — let the
  // caller fall back to the direct Meta path instead of returning blanks.
  if (dailyRes.error && adsRes.error && campRes.error) return null;

  const daily: DailyRow[] = (dailyRes.rows ?? [])
    .map((r) => ({
      date: str(r.date).slice(0, 10),
      spend: num(r.spend),
      impressions: num(r.impressions),
      linkClicks: linkClicksOf(r),
      cpm: num(r.cpm),
      frequency: num(r.frequency),
    }))
    .filter((d) => d.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const ads: AdRow[] = (adsRes.rows ?? [])
    .map((r) => ({
      adId: str(r.ad_id),
      adName: str(r.ad_name),
      spend: num(r.spend),
      impressions: num(r.impressions),
      linkClicks: linkClicksOf(r),
      cpm: num(r.cpm),
      frequency: num(r.frequency),
    }))
    .filter((a) => a.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  const campaigns: CampaignRow[] = (campRes.rows ?? [])
    .map((r) => ({
      campaignId: str(r.campaign_id),
      campaignName: str(r.campaign),
      spend: num(r.spend),
    }))
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  const error =
    dailyRes.error ? `daily series unavailable: ${dailyRes.error}`
    : adsRes.error ? `per-ad breakdown unavailable: ${adsRes.error}`
    : campRes.error ? `campaign breakdown unavailable: ${campRes.error}`
    : undefined;

  return { daily, ads, campaigns, error };
}

// ── source 2: Meta Marketing API (fallback) ──────────────────────────────

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

async function fromMeta(token: string): Promise<{
  daily: DailyRow[];
  ads: AdRow[];
  campaigns: CampaignRow[];
  error?: string;
  fatal?: string;
}> {
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
    return { daily: [], ads: [], campaigns: [], fatal: dailyRes.error };
  }

  const daily: DailyRow[] = (dailyRes.rows ?? []).map((r) => ({
    date: r.date_start ?? "",
    spend: num(r.spend),
    impressions: num(r.impressions),
    linkClicks: num(r.inline_link_clicks),
    cpm: num(r.cpm),
    frequency: num(r.frequency),
  }));

  const ads: AdRow[] = (adsRes.rows ?? [])
    .map((r) => ({
      adId: r.ad_id ?? "",
      adName: r.ad_name ?? "",
      spend: num(r.spend),
      impressions: num(r.impressions),
      linkClicks: num(r.inline_link_clicks),
      cpm: num(r.cpm),
      frequency: num(r.frequency),
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
      spend: num(r.spend),
    }))
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  const error =
    dailyRes.error ? `daily series unavailable: ${dailyRes.error}`
    : adsRes.error ? `per-ad breakdown unavailable: ${adsRes.error}`
    : campRes.error ? `campaign breakdown unavailable: ${campRes.error}`
    : undefined;

  return { daily, ads, campaigns, error };
}

// ── route ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const windsorKey = process.env.WINDSOR_API_KEY;
  const adsToken = process.env.META_ADS_TOKEN;
  const capiToken = process.env.META_CAPI_TOKEN;

  const status: AdsStatus = {
    tokenSet: !!(windsorKey || adsToken || capiToken),
    tokenSource: "none",
    ok: false,
    error: "",
  };

  if (windsorKey) {
    const w = await fromWindsor(windsorKey);
    if (w) {
      status.tokenSource = "WINDSOR_API_KEY";
      status.ok = true;
      status.error = w.error ?? "";
      return NextResponse.json({ daily: w.daily, ads: w.ads, campaigns: w.campaigns, status });
    }
    // Windsor completely down — fall through to the direct Meta path.
    status.error = "Windsor unreachable, tried Meta fallback. ";
  }

  const token = adsToken || capiToken || "";
  if (!token) {
    status.error += windsorKey
      ? "No Meta token set as second source."
      : "No ads source configured (set WINDSOR_API_KEY in Vercel — windsor.ai key, doesn't expire — then redeploy)";
    return NextResponse.json({ daily: [], ads: [], campaigns: [], status });
  }
  status.tokenSource = adsToken ? "META_ADS_TOKEN" : "META_CAPI_TOKEN";

  const m = await fromMeta(token);
  if (m.fatal) {
    // Most common: token lacks ads_read → Meta error mentions permission.
    status.error += m.fatal.includes("permission") || m.fatal.includes("ads_read")
      ? `Token can't read ads (${status.tokenSource}). Easiest fix: set WINDSOR_API_KEY in Vercel instead.`
      : m.fatal;
    return NextResponse.json({ daily: [], ads: [], campaigns: [], status });
  }

  status.ok = true;
  status.error += m.error ?? "";
  return NextResponse.json({ daily: m.daily, ads: m.ads, campaigns: m.campaigns, status });
}
