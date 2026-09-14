-- Ad spend and delivery, cached from Windsor.ai (Meta Ads) by the hourly
-- /api/cron/ads-refresh job. The admin pages read ONLY these tables — no page
-- load calls Windsor. Accessed only through lib/ads-cache.ts.
--
-- Holds ad-account numbers and creative names only: no personal data.
-- Every *_at column is Unix epoch MILLISECONDS.
--
-- Apply with: npx wrangler d1 migrations apply thyroid-ledger --remote

-- One row per day of account-level delivery. Upserted every run for the recent
-- stretch, so late-settling spend corrects itself; older days stay as last seen.
CREATE TABLE IF NOT EXISTS ad_spend_daily (
  date         TEXT PRIMARY KEY,            -- YYYY-MM-DD as the ad account reports it
  spend        REAL NOT NULL,
  impressions  INTEGER NOT NULL DEFAULT 0,
  link_clicks  INTEGER NOT NULL DEFAULT 0,
  cpm          REAL NOT NULL DEFAULT 0,
  frequency    REAL NOT NULL DEFAULT 0,
  fetched_at   INTEGER NOT NULL
);

-- Whole-window breakdowns that cannot be summed from days: per-ad (14 and 90
-- days) and per-campaign (30 days). kind 'refresh' records the last attempt,
-- successful or not, so a page can say how old its numbers are and why.
CREATE TABLE IF NOT EXISTS ads_snapshot (
  kind          TEXT PRIMARY KEY,           -- ads_14d | ads_90d | campaigns_30d | refresh
  payload_json  TEXT NOT NULL,
  source        TEXT NOT NULL,              -- windsor | meta | none
  error         TEXT,
  fetched_at    INTEGER NOT NULL
);
