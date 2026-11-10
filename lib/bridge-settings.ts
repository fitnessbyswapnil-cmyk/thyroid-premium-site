/**
 * lib/bridge-settings.ts — SERVER ONLY. The Drive bridge pairing that
 * "Connect Google Drive" stores, in D1 (thyroid-ledger, table settings,
 * migrations/0004_settings.sql).
 *
 * WHY D1 AND NOT THE WORKER'S ENV
 * Setting DRIVE_BRIDGE_URL and DRIVE_BRIDGE_SECRET means a terminal or the
 * Cloudflare dashboard, one secret typed into two places, and a redeploy. He
 * pastes one URL into the admin instead: the site makes the secret, the script
 * adopts it on first use (scripts/drive-bridge.gs, pair), and both halves land
 * here. The env vars still work and still win when set (lib/drive
 * resolveBridgeConfig), so the manual set-up is untouched.
 *
 * The secret is a credential — whoever holds it can write into his Drive
 * through the script. It lives here and in the script's properties; never
 * return it from a route.
 *
 * The table is also created lazily, once per database binding, so Connect
 * works before the migration is applied. Off Cloudflare (next dev, node
 * --test, the Vercel copy) there is no D1: loading answers null, and saving
 * or clearing throws. A save that silently went nowhere would leave the
 * script holding a secret the site has already forgotten, and every later
 * Connect would answer already_paired.
 *
 * Each function takes an optional database for the tests; called with no
 * argument it uses the worker's binding, getLedgerDb().
 */
import { getLedgerDb, type D1Database } from "./ledger.ts";
import {
  BRIDGE_SECRET_ENV, BRIDGE_URL_ENV, resolveBridgeConfig, type ResolvedBridgeConfig, type StoredPairing,
} from "./drive.ts";

const URL_KEY = "drive_bridge_url";
const SECRET_KEY = "drive_bridge_secret";

/** The same table migrations/0004_settings.sql makes (bridge-settings.test.ts holds them together). */
export const SETTINGS_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)";

const NO_DB =
  `There is no D1 database here (the LEDGER binding exists only on the Cloudflare worker), so the Drive pairing cannot be stored. ` +
  `Set ${BRIDGE_URL_ENV} and ${BRIDGE_SECRET_ENV} instead.`;

/** Keyed by the binding, so a test's fresh database gets its table too. */
const tableReady = new WeakMap<D1Database, Promise<void>>();

function ensureTable(db: D1Database): Promise<void> {
  let ready = tableReady.get(db);
  if (!ready) {
    ready = db.prepare(SETTINGS_TABLE_SQL).run().then(() => undefined);
    // A failed attempt is not remembered: the next call tries again.
    ready.catch(() => tableReady.delete(db));
    tableReady.set(db, ready);
  }
  return ready;
}

/** undefined: the worker's binding. null: no database, as off Cloudflare. */
async function settingsDb(db: D1Database | null | undefined): Promise<D1Database | null> {
  return db === undefined ? getLedgerDb() : db;
}

/**
 * The pairing saved by "Connect Google Drive", or null when there is none.
 * A database that cannot be read throws rather than answering null: "not
 * paired" would invite him to pair again, and the script would refuse.
 */
export async function loadBridgePairing(db?: D1Database | null): Promise<StoredPairing | null> {
  const d = await settingsDb(db);
  if (!d) return null;
  await ensureTable(d);
  const row = await d
    .prepare("SELECT (SELECT value FROM settings WHERE key = ?1) AS url, (SELECT value FROM settings WHERE key = ?2) AS secret")
    .bind(URL_KEY, SECRET_KEY)
    .first<{ url: string | null; secret: string | null }>();
  const url = String(row?.url ?? "").trim();
  const secret = String(row?.secret ?? "");
  // Half a pairing is no pairing: a URL without its secret can only be refused.
  return url && secret ? { url, secret } : null;
}

/** Save (or overwrite) the pairing. */
export async function saveBridgePairing(pairing: StoredPairing, db?: D1Database | null): Promise<void> {
  const url = String(pairing?.url ?? "").trim();
  const secret = String(pairing?.secret ?? "");
  if (!url || !secret) throw new Error("A Drive pairing needs both the Web app URL and its secret.");
  const d = await settingsDb(db);
  if (!d) throw new Error(NO_DB);
  await ensureTable(d);
  // One statement, so the two can never be stored half-updated: a new URL
  // beside the old secret is a pairing that fails on every call.
  await d
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?5), (?3, ?4, ?5)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(URL_KEY, url, SECRET_KEY, secret, Date.now())
    .run();
}

/** Forget the pairing, so the next Connect starts fresh. */
export async function clearBridgePairing(db?: D1Database | null): Promise<void> {
  const d = await settingsDb(db);
  if (!d) throw new Error(NO_DB);
  await ensureTable(d);
  await d.prepare("DELETE FROM settings WHERE key IN (?1, ?2)").bind(URL_KEY, SECRET_KEY).run();
}

/** The config every route uses: env first, then the stored pairing. */
export async function liveBridgeConfig(db?: D1Database | null): Promise<ResolvedBridgeConfig> {
  return resolveBridgeConfig(() => loadBridgePairing(db));
}
