/**
 * lib/ads-cache.ts — ad spend and delivery, cached in D1 (thyroid-ledger,
 * tables ad_spend_daily and ads_snapshot, migrations/0002_ads_cache.sql).
 *
 * WHY (CRM brief, 14-Sep-2026). Every admin page load called Windsor live:
 * slow, rate-limited, and a Windsor hiccup blanked the spend figures mid-call.
 * Now one hourly cron (/api/cron/ads-refresh) is the ONLY thing that talks to
 * Windsor, and pages read what it last stored, with its time — "as of 14:07" —
 * so a stale number is visibly stale instead of silently wrong.
 *
 * The pure half is unit-tested in ads-cache.test.ts. The D1 half degrades to
 * null off Cloudflare (next dev, node --test, the Vercel rollback copy), the
 * same way lib/ledger.ts does.
 */
import { getLedgerDb, type D1Database } from "./ledger.ts";

export type DailyRow = {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  linkClicks: number;
  cpm: number;
  frequency: number;
};

export type AdRow = {
  adId: string;
  adName: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  cpm: number;
  frequency: number;
};

export type CampaignRow = { campaignId: string; campaignName: string; spend: number };

export type AdsSource = "windsor" | "meta" | "none";

/** What one refresh fetched. Empty arrays mean "fetched nothing", not "unchanged". */
export type AdsFetch = {
  source: AdsSource;
  daily: DailyRow[];
  ads14: AdRow[];
  ads90: AdRow[];
  campaigns30: CampaignRow[];
  /** Partial failures, joined. Empty when everything came back. */
  error: string;
};

// ── Pure ────────────────────────────────────────────────────────────────────

/** Recent days re-fetched every run; spend for a day keeps settling for a while. */
export const RECENT_DAYS = 35;
/** When the table is this thin, fetch the long history once. */
export const HISTORY_DAYS = 400;
export const HISTORY_MIN_ROWS = 90;

export function daysToFetch(rowsCached: number, full: boolean): number {
  return full || rowsCached < HISTORY_MIN_ROWS ? HISTORY_DAYS : RECENT_DAYS;
}

/** YYYY-MM-DD in UTC — the same date basis the pages used with Windsor directly. */
export const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Total spend over [from, to] inclusive, by date string. */
export function sumSpend(rows: { date: string; spend: number }[], from: string, to: string): number {
  let total = 0;
  for (const r of rows) if (r.date >= from && r.date <= to) total += Number.isFinite(r.spend) ? r.spend : 0;
  return Math.round(total * 100) / 100;
}

/** Hours since a timestamp, for "stale" warnings. */
export const ageHours = (fetchedAt: number, now: number): number => (now - fetchedAt) / 3_600_000;

/** A refresh older than this is flagged on the page. The cron runs hourly. */
export const STALE_AFTER_HOURS = 3;

// ── D1 ──────────────────────────────────────────────────────────────────────

type SnapshotRow = { kind: string; payload_json: string; source: string; error: string | null; fetched_at: number };

async function db(): Promise<D1Database | null> {
  return getLedgerDb();
}

export async function countCachedDays(): Promise<number> {
  const d = await db();
  if (!d) return 0;
  try {
    const r = await d.prepare("SELECT COUNT(*) AS n FROM ad_spend_daily").first<{ n: number }>();
    return Number(r?.n ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Store one refresh. Daily rows are upserted; snapshots are replaced only when
 * that part actually came back, so a partial Windsor failure keeps the last
 * good breakdown instead of overwriting it with nothing. The 'refresh' row is
 * always written — it is how a page knows the last attempt failed.
 */
export async function writeAdsCache(f: AdsFetch, now: number): Promise<{ ok: boolean; days: number; error?: string }> {
  const d = await db();
  if (!d) return { ok: false, days: 0, error: "no D1 binding (not on Cloudflare)" };
  const stmts = [];
  for (const r of f.daily) {
    stmts.push(
      d
        .prepare(
          `INSERT INTO ad_spend_daily (date, spend, impressions, link_clicks, cpm, frequency, fetched_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(date) DO UPDATE SET spend = ?2, impressions = ?3, link_clicks = ?4, cpm = ?5, frequency = ?6, fetched_at = ?7`,
        )
        .bind(r.date, r.spend, Math.round(r.impressions), Math.round(r.linkClicks), r.cpm, r.frequency, now),
    );
  }
  const snap = (kind: string, payload: unknown) =>
    d
      .prepare(
        `INSERT INTO ads_snapshot (kind, payload_json, source, error, fetched_at) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(kind) DO UPDATE SET payload_json = ?2, source = ?3, error = ?4, fetched_at = ?5`,
      )
      .bind(kind, JSON.stringify(payload), f.source, f.error || null, now);
  if (f.ads14.length) stmts.push(snap("ads_14d", f.ads14));
  if (f.ads90.length) stmts.push(snap("ads_90d", f.ads90));
  if (f.campaigns30.length) stmts.push(snap("campaigns_30d", f.campaigns30));
  stmts.push(snap("refresh", { days: f.daily.length, ads14: f.ads14.length, ads90: f.ads90.length, campaigns30: f.campaigns30.length }));
  try {
    // Chunked: one D1 batch per 100 statements keeps each call small.
    for (let i = 0; i < stmts.length; i += 100) await d.batch(stmts.slice(i, i + 100));
    return { ok: true, days: f.daily.length };
  } catch (err) {
    return { ok: false, days: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

export type CachedAds = {
  daily: DailyRow[];
  ads: AdRow[];
  ads90: AdRow[];
  /** When the 90-day per-ad breakdown was fetched — it can differ from asOf. */
  ads90AsOf: string | null;
  campaigns: CampaignRow[];
  /** When the numbers shown were fetched (the last successful daily write). */
  asOf: string | null;
  /** The last refresh attempt, which may be newer than asOf and may have failed. */
  lastRefresh: { at: string; source: AdsSource; error: string } | null;
};

const parse = <T>(s: string | undefined, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** Everything the pages need, in two queries. Null off Cloudflare or before the first refresh. */
export async function readAdsCache(dailySinceDate: string | null): Promise<CachedAds | null> {
  const d = await db();
  if (!d) return null;
  try {
    const [dailyRes, snapRes] = await d.batch([
      dailySinceDate
        ? d.prepare("SELECT * FROM ad_spend_daily WHERE date >= ?1 ORDER BY date").bind(dailySinceDate)
        : d.prepare("SELECT * FROM ad_spend_daily ORDER BY date"),
      d.prepare("SELECT * FROM ads_snapshot"),
    ]);
    const days = (dailyRes.results as Array<Record<string, unknown>>).map((r) => ({
      date: String(r.date),
      spend: Number(r.spend) || 0,
      impressions: Number(r.impressions) || 0,
      linkClicks: Number(r.link_clicks) || 0,
      cpm: Number(r.cpm) || 0,
      frequency: Number(r.frequency) || 0,
      fetchedAt: Number(r.fetched_at) || 0,
    }));
    const snaps = new Map((snapRes.results as unknown as SnapshotRow[]).map((s) => [s.kind, s]));
    const refresh = snaps.get("refresh");
    const newestDaily = days.reduce((m, r) => Math.max(m, r.fetchedAt), 0);
    if (!refresh && !days.length) return null;
    return {
      daily: days.map((r) => ({ date: r.date, spend: r.spend, impressions: r.impressions, linkClicks: r.linkClicks, cpm: r.cpm, frequency: r.frequency })),
      ads: parse<AdRow[]>(snaps.get("ads_14d")?.payload_json, []),
      ads90: parse<AdRow[]>(snaps.get("ads_90d")?.payload_json, []),
      ads90AsOf: snaps.get("ads_90d") ? new Date(Number(snaps.get("ads_90d")!.fetched_at)).toISOString() : null,
      campaigns: parse<CampaignRow[]>(snaps.get("campaigns_30d")?.payload_json, []),
      asOf: newestDaily ? new Date(newestDaily).toISOString() : null,
      lastRefresh: refresh
        ? { at: new Date(Number(refresh.fetched_at)).toISOString(), source: refresh.source as AdsSource, error: refresh.error ?? "" }
        : null,
    };
  } catch (err) {
    console.error("[ads-cache] read failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Spend between two instants, from the cache. spend null = nothing cached yet. */
export async function cachedSpend(fromMs: number, toMs: number): Promise<{ spend: number | null; asOf: string | null }> {
  const from = fromMs > 0 ? isoDate(fromMs) : null;
  const c = await readAdsCache(from);
  if (!c || !c.daily.length) return { spend: null, asOf: c?.asOf ?? null };
  return { spend: sumSpend(c.daily, from ?? "0000-00-00", isoDate(toMs)), asOf: c.asOf };
}
