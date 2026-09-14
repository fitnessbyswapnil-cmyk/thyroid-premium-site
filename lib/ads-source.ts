/**
 * lib/ads-source.ts — SERVER ONLY. Fetches ad spend and delivery from
 * Windsor.ai, falling back to the Meta Marketing API.
 *
 * Called by ONE place: /api/cron/ads-refresh, which stores the result in D1
 * (lib/ads-cache.ts). Admin pages never import this — they read the cache.
 * This reads insights; it sends nothing to Meta.
 *
 * Moved here from /api/admin/ads unchanged in what it asks for:
 *   1. Windsor.ai (WINDSOR_API_KEY) — the already-authorized Meta Ads
 *      connection; Windsor keys don't expire, which is how the direct Meta
 *      token died. Primary.
 *   2. Meta Marketing API (META_ADS_TOKEN, else META_CAPI_TOKEN) — fallback
 *      for when Windsor is unreachable.
 */
import type { AdRow, AdsFetch, CampaignRow, DailyRow } from "./ads-cache.ts";

const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID || "1120707423412525";
const GRAPH = "https://graph.facebook.com/v21.0";
const WINDSOR = "https://connectors.windsor.ai/facebook";

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (v == null ? "" : String(v));

/** YYYY-MM-DD for `daysAgo` days before today (UTC). */
function isoDaysAgo(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86400_000).toISOString().slice(0, 10);
}

type Json = Record<string, unknown>;

// ── source 1: Windsor.ai ─────────────────────────────────────────────────

async function windsorQuery(apiKey: string, fields: string[], daysBack: number): Promise<{ rows?: Json[]; error?: string }> {
  const params = new URLSearchParams({
    api_key: apiKey,
    fields: fields.join(","),
    date_from: isoDaysAgo(daysBack - 1),
    date_to: isoDaysAgo(0),
    _renderer: "json",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${WINDSOR}?${params}`, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      return { error: `Windsor HTTP ${res.status}${body ? `: ${body}` : ""}` };
    }
    const json = (await res.json()) as { data?: Json[]; error?: string };
    if (json.error) return { error: json.error };
    return { rows: json.data ?? [] };
  } catch {
    return { error: "Windsor API unreachable (timeout)" };
  } finally {
    clearTimeout(timeout);
  }
}

// Link clicks come from the Actions table (`actions_link_click`), with
// all-clicks kept as a fallback so a missing join never zeroes the column.
const linkClicksOf = (r: Json) => num(r.actions_link_click) || num(r.clicks);

const adRowsOf = (rows: Json[]): AdRow[] => {
  // Windsor can return one row per ad per day even without a date field; fold by id.
  const byId = new Map<string, AdRow>();
  for (const r of rows) {
    const adId = str(r.ad_id);
    const adName = str(r.ad_name);
    const key = adId || adName;
    if (!key) continue;
    const e = byId.get(key) ?? { adId, adName, spend: 0, impressions: 0, linkClicks: 0, cpm: 0, frequency: 0 };
    e.spend += num(r.spend);
    e.impressions += num(r.impressions);
    e.linkClicks += linkClicksOf(r);
    e.cpm = num(r.cpm) || e.cpm;
    e.frequency = num(r.frequency) || e.frequency;
    byId.set(key, e);
  }
  return [...byId.values()].filter((a) => a.spend > 0).sort((a, b) => b.spend - a.spend);
};

async function fromWindsor(apiKey: string, dailyDays: number): Promise<AdsFetch | null> {
  const [dailyRes, adsRes, ads90Res, campRes] = await Promise.all([
    windsorQuery(apiKey, ["date", "spend", "impressions", "clicks", "actions_link_click", "cpm", "frequency"], dailyDays),
    windsorQuery(apiKey, ["ad_id", "ad_name", "spend", "impressions", "clicks", "actions_link_click", "cpm", "frequency"], 14),
    windsorQuery(apiKey, ["ad_id", "ad_name", "spend"], 90),
    windsorQuery(apiKey, ["campaign_id", "campaign", "spend"], 30),
  ]);
  // Everything failing means the source is down or misconfigured — let the
  // caller fall back to Meta instead of storing blanks.
  if (dailyRes.error && adsRes.error && ads90Res.error && campRes.error) return null;

  const daily: DailyRow[] = (dailyRes.rows ?? [])
    .map((r) => ({
      date: str(r.date).slice(0, 10),
      spend: num(r.spend),
      impressions: num(r.impressions),
      linkClicks: linkClicksOf(r),
      cpm: num(r.cpm),
      frequency: num(r.frequency),
    }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const campaigns30: CampaignRow[] = (campRes.rows ?? [])
    .map((r) => ({ campaignId: str(r.campaign_id), campaignName: str(r.campaign), spend: num(r.spend) }))
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  const error = [
    dailyRes.error && `daily series unavailable: ${dailyRes.error}`,
    adsRes.error && `per-ad breakdown unavailable: ${adsRes.error}`,
    ads90Res.error && `90-day per-ad spend unavailable: ${ads90Res.error}`,
    campRes.error && `campaign breakdown unavailable: ${campRes.error}`,
  ]
    .filter(Boolean)
    .join("; ");

  return { source: "windsor", daily, ads14: adRowsOf(adsRes.rows ?? []), ads90: adRowsOf(ads90Res.rows ?? []), campaigns30, error };
}

// ── source 2: Meta Marketing API (fallback) ──────────────────────────────

async function insights(token: string, params: string): Promise<{ rows?: Json[]; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${GRAPH}/act_${AD_ACCOUNT}/insights?${params}&access_token=${encodeURIComponent(token)}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: Json[]; error?: { message?: string } };
    if (!res.ok || json.error) return { error: json.error?.message || `HTTP ${res.status}` };
    return { rows: json.data ?? [] };
  } catch {
    return { error: "Meta API unreachable (timeout)" };
  } finally {
    clearTimeout(timeout);
  }
}

async function fromMeta(token: string): Promise<AdsFetch> {
  const [dailyRes, adsRes, ads90Res, campRes] = await Promise.all([
    insights(token, "date_preset=last_30d&time_increment=1&fields=spend,impressions,inline_link_clicks,cpm,frequency"),
    insights(token, "date_preset=last_14d&level=ad&fields=ad_id,ad_name,spend,impressions,inline_link_clicks,cpm,frequency&limit=50"),
    insights(token, "date_preset=last_90d&level=ad&fields=ad_id,ad_name,spend&limit=200"),
    insights(token, "date_preset=last_30d&level=campaign&fields=campaign_id,campaign_name,spend&limit=100"),
  ]);
  if (dailyRes.error && adsRes.error) {
    const fatal = dailyRes.error;
    return {
      source: "meta",
      daily: [],
      ads14: [],
      ads90: [],
      campaigns30: [],
      error:
        fatal.includes("permission") || fatal.includes("ads_read")
          ? "Meta token can't read ads. Easiest fix: set WINDSOR_API_KEY on the worker instead."
          : fatal,
    };
  }
  const metaAds = (rows: Json[]) =>
    adRowsOf(rows.map((r) => ({ ...r, actions_link_click: r.inline_link_clicks })));
  return {
    source: "meta",
    daily: (dailyRes.rows ?? []).map((r) => ({
      date: str(r.date_start),
      spend: num(r.spend),
      impressions: num(r.impressions),
      linkClicks: num(r.inline_link_clicks),
      cpm: num(r.cpm),
      frequency: num(r.frequency),
    })),
    ads14: metaAds(adsRes.rows ?? []),
    ads90: metaAds(ads90Res.rows ?? []),
    campaigns30: (campRes.rows ?? [])
      .map((r) => ({ campaignId: str(r.campaign_id), campaignName: str(r.campaign_name), spend: num(r.spend) }))
      .filter((c) => c.spend > 0)
      .sort((a, b) => b.spend - a.spend),
    error: [adsRes.error, ads90Res.error, campRes.error].filter(Boolean).join("; "),
  };
}

/** One refresh's worth of data, from whichever source answers. */
export async function fetchAds(dailyDays: number): Promise<AdsFetch> {
  const windsorKey = process.env.WINDSOR_API_KEY;
  let prefix = "";
  if (windsorKey) {
    const w = await fromWindsor(windsorKey, dailyDays);
    if (w) return w;
    prefix = "Windsor unreachable, tried Meta. ";
  }
  const token = process.env.META_ADS_TOKEN || process.env.META_CAPI_TOKEN || "";
  if (!token) {
    return {
      source: "none",
      daily: [],
      ads14: [],
      ads90: [],
      campaigns30: [],
      error: prefix + (windsorKey ? "No Meta token set as second source." : "No ads source configured (set WINDSOR_API_KEY on the worker)."),
    };
  }
  const m = await fromMeta(token);
  return { ...m, error: prefix + m.error };
}
