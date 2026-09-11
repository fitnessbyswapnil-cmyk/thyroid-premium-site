-- thyroid-ledger (Cloudflare D1), binding LEDGER. Accessed only through lib/ledger.ts.
--
-- PRIVACY: this database must never hold a raw name, phone number or email.
-- It stores ids, amounts, statuses, timestamps, and the CAPI event object Meta
-- receives, whose personal fields are already SHA-256 hashed. lib/ledger.ts
-- also keeps any event whose event_id embeds a phone number out of this table,
-- and drops client_ip_address from a row once it can no longer be retried.
--
-- Every *_at column is Unix epoch MILLISECONDS. The payload's event_time is
-- Meta's own field and stays in Unix SECONDS.
--
-- Apply with: npx wrangler d1 migrations apply thyroid-ledger --remote

-- One row per Meta event_id. A row that reached 'sent' is final: a later send of
-- the same id is skipped as a duplicate before any network call is made.
CREATE TABLE IF NOT EXISTS meta_events (
  event_id      TEXT PRIMARY KEY,
  event_name    TEXT NOT NULL,
  -- 'failed' is retried by /api/cron/meta-retry. It becomes 'dead' after 5
  -- attempts, or when the event is too old for Meta to accept.
  status        TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'dead')),
  attempts      INTEGER NOT NULL DEFAULT 1,
  last_error    TEXT,
  -- The exact event object sent to Meta, including the ORIGINAL event_time,
  -- which a retry resends unchanged.
  payload_json  TEXT NOT NULL,
  -- Set for Meta Test Events sends. Those rows are never retried and never
  -- block the real event from being sent.
  test_code     TEXT,
  created_at    INTEGER NOT NULL,
  sent_at       INTEGER,
  next_retry_at INTEGER
);

-- The retry cron's lookup: status = 'failed' AND next_retry_at <= now.
CREATE INDEX IF NOT EXISTS idx_meta_events_status_retry ON meta_events (status, next_retry_at);
-- The admin view's "last 7 days".
CREATE INDEX IF NOT EXISTS idx_meta_events_created ON meta_events (created_at);

-- One row per Cashfree reference (order_id for ORDER, link_id for LINK). The
-- primary key makes a replayed webhook a no-op.
CREATE TABLE IF NOT EXISTS payments (
  order_ref    TEXT PRIMARY KEY,
  lead_id      TEXT,
  amount       REAL NOT NULL,
  currency     TEXT NOT NULL,
  -- 'paid', or 'duplicate' when the Leads sheet showed the lead was already
  -- paid under this reference. Totals count 'paid' only.
  status       TEXT NOT NULL,
  -- ORDER | LINK | FORM (lib/cashfree-payload.ts PaymentSource)
  source       TEXT NOT NULL,
  -- What the Leads sheet write returned: updated | already_paid |
  -- orphan_appended | failed. Makes a sheet write that did not land findable.
  sheet_result TEXT,
  paid_at      INTEGER NOT NULL,
  recorded_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments (paid_at);
