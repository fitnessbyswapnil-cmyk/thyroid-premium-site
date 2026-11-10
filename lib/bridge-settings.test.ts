/**
 * The pairing store, against a fake D1 that is real SQLite underneath
 * (node:sqlite — D1 is SQLite), so the upsert, the numbered parameters and
 * the migration file are executed rather than pattern-matched.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { D1Database } from "./ledger.ts";
import { BRIDGE_SECRET_ENV, BRIDGE_URL_ENV, NOTES_FOLDER_ENV } from "./drive.ts";
import {
  SETTINGS_TABLE_SQL, clearBridgePairing, liveBridgeConfig, loadBridgePairing, saveBridgePairing,
} from "./bridge-settings.ts";

// Loaded through require: the installed @types/node predates node:sqlite.
type SqliteStatement = { get(...p: unknown[]): unknown; run(...p: unknown[]): { changes: number | bigint }; all(...p: unknown[]): unknown[] };
type Sqlite = { prepare(sql: string): SqliteStatement; exec(sql: string): void };
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Sqlite };

const MIGRATION = readFileSync(new URL("../migrations/0004_settings.sql", import.meta.url), "utf8");

/** prepare / bind / first / run / all, as D1 has them, over an in-memory SQLite. */
function fakeD1(opts: { failCreates?: number; failReads?: boolean } = {}) {
  const sql = new DatabaseSync(":memory:");
  const log: string[] = [];
  let createFailures = opts.failCreates ?? 0;
  const db = {
    prepare(query: string) {
      let params: unknown[] = [];
      const exec = <T,>(work: (s: SqliteStatement) => T): T => {
        log.push(query);
        if (/^\s*CREATE/i.test(query) && createFailures > 0) {
          createFailures--;
          throw new Error("D1_ERROR: Network connection lost.");
        }
        if (/^\s*SELECT/i.test(query) && opts.failReads) throw new Error("D1_ERROR: Network connection lost.");
        return work(sql.prepare(query));
      };
      const stmt = {
        bind(...values: unknown[]) { params = values; return stmt; },
        async first<T>() { return (exec((s) => s.get(...params)) as T | undefined) ?? null; },
        async run() { const r = exec((s) => s.run(...params)); return { meta: { changes: Number(r.changes) } }; },
        async all<T>() { return { results: exec((s) => s.all(...params)) as T[] }; },
      };
      return stmt;
    },
    async batch() { throw new Error("batch is not used here"); },
  };
  const rows = () => sql.prepare("SELECT key, value, updated_at FROM settings ORDER BY key").all() as { key: string; value: string; updated_at: number }[];
  return { db: db as unknown as D1Database, sql, log, rows };
}

const creates = (log: string[]) => log.filter((q) => /^\s*CREATE/i.test(q)).length;
const PAIRING = { url: "https://script.google.com/macros/s/AKfyc1/exec", secret: "pair-secret-0123456789abcdef" };

test("off Cloudflare there is no pairing to load, and saving or clearing says why instead of pretending", async () => {
  assert.equal(await loadBridgePairing(null), null);
  // No argument at all is the worker's binding — absent under node --test.
  assert.equal(await loadBridgePairing(), null);
  for (const attempt of [() => saveBridgePairing(PAIRING, null), () => clearBridgePairing(null), () => saveBridgePairing(PAIRING)]) {
    await assert.rejects(attempt(), (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /no D1 database/);
      assert.match(e.message, new RegExp(`${BRIDGE_URL_ENV} and ${BRIDGE_SECRET_ENV}`));
      return true;
    });
  }
});

test("a saved pairing loads back, on a database the migration was never applied to", async () => {
  const d = fakeD1();
  assert.equal(await loadBridgePairing(d.db), null);
  await saveBridgePairing(PAIRING, d.db);
  assert.deepEqual(await loadBridgePairing(d.db), PAIRING);
  const stored = d.rows();
  assert.deepEqual(stored.map((r) => [r.key, r.value]), [["drive_bridge_secret", PAIRING.secret], ["drive_bridge_url", PAIRING.url]]);
  for (const r of stored) assert.ok(Math.abs(r.updated_at - Date.now()) < 60_000, "updated_at is epoch milliseconds");
});

test("the table is made once per database, not once per call", async () => {
  const d = fakeD1();
  await loadBridgePairing(d.db);
  await saveBridgePairing(PAIRING, d.db);
  await loadBridgePairing(d.db);
  await clearBridgePairing(d.db);
  assert.equal(creates(d.log), 1);
  // A different binding is a different database, and gets its own.
  const e = fakeD1();
  await loadBridgePairing(e.db);
  assert.equal(creates(e.log), 1);
});

test("a failed table check is not remembered as done", async () => {
  const d = fakeD1({ failCreates: 1 });
  await assert.rejects(loadBridgePairing(d.db), /Network connection lost/);
  assert.equal(await loadBridgePairing(d.db), null);
  assert.equal(creates(d.log), 2);
});

test("connecting again overwrites both halves together", async () => {
  const d = fakeD1();
  await saveBridgePairing(PAIRING, d.db);
  const next = { url: "https://script.google.com/macros/s/AKfyc2/exec", secret: "second-secret-abcdef0123456789" };
  await saveBridgePairing(next, d.db);
  assert.deepEqual(await loadBridgePairing(d.db), next);
  assert.equal(d.rows().length, 2);
});

test("a pairing missing either half is refused on save, and not a pairing on load", async () => {
  const d = fakeD1();
  for (const bad of [{ ...PAIRING, url: "  " }, { ...PAIRING, secret: "" }]) {
    await assert.rejects(saveBridgePairing(bad, d.db), /needs both/);
  }
  assert.equal(await loadBridgePairing(d.db), null);
  assert.equal(d.rows().length, 0);
  // Half a pairing written some other way still does not count.
  d.sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('drive_bridge_url', ?1, 1)").run(PAIRING.url);
  assert.equal(await loadBridgePairing(d.db), null);
});

test("clearing forgets the pairing and nothing else", async () => {
  const d = fakeD1();
  await saveBridgePairing(PAIRING, d.db);
  d.sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('something_else', 'kept', 1)").run();
  await clearBridgePairing(d.db);
  assert.equal(await loadBridgePairing(d.db), null);
  assert.deepEqual(d.rows().map((r) => r.key), ["something_else"]);
});

test("a database that cannot be read throws, rather than claiming nothing is paired", async () => {
  // "Not paired" would send him to Connect again, and the script, which
  // still holds the old secret, would answer already_paired.
  const broken = fakeD1({ failReads: true });
  await saveBridgePairing(PAIRING, broken.db);
  await assert.rejects(loadBridgePairing(broken.db), /Network connection lost/);
});

test("the migration makes exactly the table the code makes on its own", async () => {
  const migrated = fakeD1();
  migrated.sql.exec(MIGRATION);
  const lazy = fakeD1();
  lazy.sql.exec(SETTINGS_TABLE_SQL);
  const columns = (s: Sqlite) => s.prepare("PRAGMA table_info(settings)").all();
  assert.deepEqual(columns(migrated.sql), columns(lazy.sql));
  // And the code works on the migrated one, its own CREATE a no-op.
  await saveBridgePairing(PAIRING, migrated.db);
  assert.deepEqual(await loadBridgePairing(migrated.db), PAIRING);
  assert.match(MIGRATION, /Apply with: npx wrangler d1 migrations apply thyroid-ledger --remote/);
});

test("routes get env first, then the stored pairing, then nothing", async () => {
  const keys = [BRIDGE_URL_ENV, BRIDGE_SECRET_ENV, NOTES_FOLDER_ENV];
  const before = keys.map((k) => process.env[k]);
  try {
    process.env[NOTES_FOLDER_ENV] = "FOLDER";
    delete process.env[BRIDGE_URL_ENV];
    delete process.env[BRIDGE_SECRET_ENV];
    const d = fakeD1();
    assert.equal((await liveBridgeConfig(d.db)).source, "none");

    await saveBridgePairing(PAIRING, d.db);
    const stored = await liveBridgeConfig(d.db);
    assert.deepEqual(stored, { ...PAIRING, folderId: "FOLDER", missing: [], source: "stored" });

    process.env[BRIDGE_URL_ENV] = "https://env.example/exec";
    process.env[BRIDGE_SECRET_ENV] = "env-secret";
    const reads = d.log.length;
    const env = await liveBridgeConfig(d.db);
    assert.equal(env.source, "env");
    assert.equal(env.url, "https://env.example/exec");
    assert.equal(d.log.length, reads, "with the env set, D1 is not even asked");

    // A broken database is "not connected" to a route, never a crash.
    delete process.env[BRIDGE_URL_ENV];
    assert.equal((await liveBridgeConfig(fakeD1({ failReads: true }).db)).source, "none");
  } finally {
    keys.forEach((k, i) => {
      if (before[i] === undefined) delete process.env[k];
      else process.env[k] = before[i];
    });
  }
});
