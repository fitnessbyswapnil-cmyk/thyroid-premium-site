-- Settings the dashboard writes, so a set-up step he does in the admin needs
-- no terminal and no redeploy. Accessed only through lib/bridge-settings.ts.
--
-- Today it holds one thing: the Drive bridge pairing. "Connect Google Drive"
-- stores the Apps Script's Web app URL and the secret the script adopted on
-- first use (keys drive_bridge_url, drive_bridge_secret). The worker's env
-- vars DRIVE_BRIDGE_URL / DRIVE_BRIDGE_SECRET still win when they are set.
--
-- The secret is a credential: whoever holds it can write into his Drive
-- through the script. Nothing here is personal data.
--
-- lib/bridge-settings.ts also creates this table lazily, so Connect works
-- before this file is applied; applying it keeps the schema on record.
--
-- Every *_at column is Unix epoch MILLISECONDS.
-- Apply with: npx wrangler d1 migrations apply thyroid-ledger --remote

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
