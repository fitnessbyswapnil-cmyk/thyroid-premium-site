-- Her WhatsApp reports, copied into her folder in the coach's Drive by
-- lib/report-save.ts. One row per WhatsApp media id the system has finished
-- with. Accessed only through lib/report-save.ts.
--
-- WHY: Cloud API hands over a media id, never the file, and the id stops
-- resolving after about 30 days. A report she sent before her call is what he
-- needs on the call. This row is how a report is never downloaded twice, how
-- the inbox and Today link straight to the copy, and how the 30-day backfill
-- knows what is left to do.
--
-- PRIVACY: no raw name, phone or email, and never the file. phone_key is the
-- SHA-256 of "p:" + the last 10 digits (lib/journey-store hashKey, the same key
-- as migrations/0003). The report itself lives only in his Drive, written by
-- his own Apps Script; this table holds the Drive file's id and link.
--
-- A media id that can never be saved (gone from WhatsApp, or over the 20 MB
-- limit) gets a row too, with an empty file_id and url and kind
-- 'skip:<reason>', so the backfill stops retrying it. Every reader of a saved
-- file asks for url <> ''.
--
-- Every *_at column is Unix epoch MILLISECONDS.
-- Apply with: npx wrangler d1 migrations apply thyroid-ledger --remote

CREATE TABLE IF NOT EXISTS drive_files (
  media_id   TEXT PRIMARY KEY,
  phone_key  TEXT NOT NULL,
  -- 'image' | 'document', or 'skip:<reason>' for one that can never be saved
  kind       TEXT NOT NULL,
  file_id    TEXT NOT NULL,
  url        TEXT NOT NULL,
  saved_at   INTEGER NOT NULL
);

-- The "Report" chip on Today: every report for the numbers on screen.
CREATE INDEX IF NOT EXISTS idx_drive_files_phone ON drive_files (phone_key);
