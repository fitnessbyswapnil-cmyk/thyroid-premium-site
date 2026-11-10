/**
 * lib/automation-flags.ts — SERVER ONLY. The switches that decide what the
 * system may do on its own, stored in D1 (thyroid-ledger, table settings,
 * migrations/0004_settings.sql) under the keys "flag:<name>".
 *
 * THE RULE THESE EXIST FOR
 * Nothing is sent to a client without his click unless a switch he turned on
 * says so. So every flag starts OFF, and every way of not knowing reads as
 * OFF: no database (next dev, node --test, the Vercel copy), a row that was
 * never written, a value that is not exactly "on", a read that failed. A
 * switch that cannot be read can only ever stop an automatic message, never
 * start one.
 *
 * TWO KINDS OF FLAG
 *  - thank_you_auto turns automation on: the thank-you after an attended call
 *    goes by itself (lib/thank-you).
 *  - The *_approved flags record a fact the code cannot see: that Meta has
 *    approved a template drafted in docs/templates. Until he says so, the
 *    message falls back to "Send from your phone" once her 24-hour window is
 *    shut, because sending an unapproved template fails the whole message.
 *  - followups_enabled and onboarding_enabled are reserved. The owner decided
 *    (10-Nov-2026) that follow-ups and onboarding stay his click, so nothing
 *    reads them and the admin route refuses to turn them on (COMING_LATER).
 *
 * Client components must not import this file (it reaches the D1 binding
 * through lib/ledger). They import its types only, which are erased.
 *
 * Each function takes an optional database for the tests; called with no
 * argument it uses the worker's binding, getLedgerDb().
 */
import { getLedgerDb, type D1Database } from "./ledger.ts";
import { SETTINGS_TABLE_SQL } from "./bridge-settings.ts";

export const FLAG_KEYS = [
  "thank_you_auto",
  "thank_you_template_approved",
  "followup_templates_approved",
  "confirm_reminder_template_approved",
  "followups_enabled",
  "onboarding_enabled",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];
export type Flags = Record<FlagKey, boolean>;

/** Reserved switches: shown as "Coming later", never turned on from the admin. */
export const COMING_LATER: ReadonlySet<FlagKey> = new Set<FlagKey>(["followups_enabled", "onboarding_enabled"]);

export const FLAG_PREFIX = "flag:";
const ON = "on";
const OFF = "off";

const NO_DB =
  "There is no D1 database here (the LEDGER binding exists only on the Cloudflare worker), so a switch cannot be stored. Change it on the live dashboard.";

export function isFlagKey(key: unknown): key is FlagKey {
  return typeof key === "string" && (FLAG_KEYS as readonly string[]).includes(key);
}

/** Every flag OFF: the state of a fresh database, and of any read that failed. */
export function defaultFlags(): Flags {
  return Object.fromEntries(FLAG_KEYS.map((k) => [k, false])) as Flags;
}

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
async function flagsDb(db: D1Database | null | undefined): Promise<D1Database | null> {
  return db === undefined ? getLedgerDb() : db;
}

/**
 * The stored switches, for the admin route. Throws when the database cannot
 * be read, so the screen can say so instead of showing a switch as off when
 * it may be on. `stored: false` means there is no database at all.
 */
export async function loadFlags(db?: D1Database | null): Promise<{ flags: Flags; stored: boolean }> {
  const flags = defaultFlags();
  const d = await flagsDb(db);
  if (!d) return { flags, stored: false };
  await ensureTable(d);
  const { results } = await d
    .prepare("SELECT key, value FROM settings WHERE key LIKE ?1")
    .bind(`${FLAG_PREFIX}%`)
    .all<{ key: string; value: string }>();
  for (const row of results ?? []) {
    const name = String(row?.key ?? "").slice(FLAG_PREFIX.length);
    // Exactly "on" is on. Anything else, including a typo, is the safe side.
    if (isFlagKey(name)) flags[name] = String(row?.value ?? "") === ON;
  }
  return { flags, stored: true };
}

/**
 * Every switch, for code that decides whether to send. NEVER THROWS: a
 * database that cannot be read answers all-off, which stops automatic
 * messages and starts none.
 */
export async function readFlags(db?: D1Database | null): Promise<Flags> {
  try {
    return (await loadFlags(db)).flags;
  } catch (err) {
    console.error("[automation-flags] read failed, every switch treated as off:", err instanceof Error ? err.message : String(err));
    return defaultFlags();
  }
}

/**
 * Turn one switch on or off. Throws when there is nowhere to store it: a
 * switch the screen shows as on while nothing was saved would be a lie about
 * what the system will do.
 */
export async function setFlag(key: FlagKey, on: boolean, db?: D1Database | null): Promise<void> {
  if (!isFlagKey(key)) throw new Error(`Unknown switch "${String(key)}".`);
  if (typeof on !== "boolean") throw new Error("A switch is on or off: true or false.");
  const d = await flagsDb(db);
  if (!d) throw new Error(NO_DB);
  await ensureTable(d);
  // "off" is written, not deleted: the row's updated_at then records when he
  // turned it off, which is the question asked after an automatic send.
  await d
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(`${FLAG_PREFIX}${key}`, on ? ON : OFF, Date.now())
    .run();
}

export const NO_DATABASE_HINT = NO_DB;
