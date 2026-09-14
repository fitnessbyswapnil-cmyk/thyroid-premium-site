-- Each woman's furthest stage and nurture state, kept by the daily
-- /api/cron/journey job. Accessed only through lib/journey-store.ts.
--
-- PRIVACY: no raw name, phone or email. A row is keyed by the SHA-256 of one
-- identity ("p:" + last 10 digits of a phone, or "e:" + canonical email); a
-- woman with both has two rows, read back together. Stored values are stage
-- names, ISO dates and flags.
--
-- NOTHING IS EVER DELETED. Nurture is a date on the row, cleared when she comes
-- back; stages only ever move forward (lib/journey ratchet).
--
-- Every *_at column is Unix epoch MILLISECONDS.
-- Apply with: npx wrangler d1 migrations apply thyroid-ledger --remote

CREATE TABLE IF NOT EXISTS lead_journey (
  key_hash        TEXT PRIMARY KEY,
  -- {"new":{"at":"…","inferred":false},"booked":{…},…} — lib/journey Reached
  reached_json    TEXT NOT NULL,
  furthest_stage  TEXT NOT NULL CHECK (furthest_stage IN ('new','booked','attended','pitched','won')),
  current_state   TEXT NOT NULL,
  -- When the job moved her to nurture. NULL = in the working pipeline.
  nurture_since   INTEGER,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_journey_nurture ON lead_journey (nurture_since);

-- One row per run, so "how many moved" is answerable after the fact.
CREATE TABLE IF NOT EXISTS journey_runs (
  run_at            INTEGER PRIMARY KEY,
  people            INTEGER NOT NULL,
  moved_to_nurture  INTEGER NOT NULL,
  released          INTEGER NOT NULL,
  inferred_stages   INTEGER NOT NULL,
  dry_run           INTEGER NOT NULL DEFAULT 0
);
