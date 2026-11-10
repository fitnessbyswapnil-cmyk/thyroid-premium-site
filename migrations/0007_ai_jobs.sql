-- Jobs the dashboard hands to the Claude routine (lib/ai-jobs.ts).
--
-- Holds a WhatsApp media id, a status and, for 48 hours only, the lab values
-- Claude read from that report, so the owner can check them. No name and no
-- phone number. lib/ai-jobs.ts purgeOld() clears results after 48 hours and
-- deletes rows after 30 days.
--
-- lib/ai-jobs.ts also creates this table lazily, so jobs work before this file
-- is applied; applying it keeps the schema on record.
--
-- Every *_at column is Unix epoch MILLISECONDS.
-- Apply with: npx wrangler d1 migrations apply thyroid-ledger --remote

CREATE TABLE IF NOT EXISTS ai_jobs (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  media_id    TEXT NOT NULL,
  mime        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL,
  result      TEXT,
  error       TEXT NOT NULL DEFAULT '',
  session_url TEXT NOT NULL DEFAULT '',
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_media ON ai_jobs (media_id, created_at);
