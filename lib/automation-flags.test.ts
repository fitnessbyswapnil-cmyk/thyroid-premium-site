/**
 * The automation switches, against a fake D1 that is real SQLite underneath
 * (node:sqlite, as bridge-settings.test.ts does), so the upsert and the
 * migration's table are executed rather than pattern-matched.
 *
 * The rule under test: every switch is OFF until he turns it on, and every
 * way of not knowing (no database, no row, a bad value, a failed read) reads
 * as off, which can only stop an automatic message, never start one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { D1Database } from "./ledger.ts";
import {
  COMING_LATER, FLAG_KEYS, FLAG_PREFIX, defaultFlags, isFlagKey, loadFlags, readFlags, setFlag, type FlagKey,
} from "./automation-flags.ts";
import { saveBridgePairing, loadBridgePairing } from "./bridge-settings.ts";

type SqliteStatement = { get(...p: unknown[]): unknown; run(...p: unknown[]): { changes: number | bigint }; all(...p: unknown[]): unknown[] };
type Sqlite = { prepare(sql: string): SqliteStatement; exec(sql: string): void };
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Sqlite };

const MIGRATION = readFileSync(new URL("../migrations/0004_settings.sql", import.meta.url), "utf8");

function fakeD1(opts: { failReads?: boolean } = {}) {
  const sql = new DatabaseSync(":memory:");
  const db = {
    prepare(query: string) {
      let params: unknown[] = [];
      const exec = <T,>(work: (s: SqliteStatement) => T): T => {
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
  return { db: db as unknown as D1Database, sql, rows };
}

const allOff = () => Object.fromEntries(FLAG_KEYS.map((k) => [k, false]));

test("the six switches, all known, and the two reserved ones", () => {
  assert.deepEqual([...FLAG_KEYS], [
    "thank_you_auto",
    "thank_you_template_approved",
    "followup_templates_approved",
    "confirm_reminder_template_approved",
    "followups_enabled",
    "onboarding_enabled",
  ]);
  for (const k of FLAG_KEYS) assert.ok(isFlagKey(k));
  for (const bad of ["", "thank_you", "flag:thank_you_auto", "THANK_YOU_AUTO", null, 1, undefined]) assert.equal(isFlagKey(bad), false);
  assert.deepEqual([...COMING_LATER].sort(), ["followups_enabled", "onboarding_enabled"]);
});

test("every switch defaults to off: no database, a fresh database, and the migrated one", async () => {
  assert.deepEqual(defaultFlags(), allOff());
  assert.deepEqual(await readFlags(null), allOff());
  // No argument is the worker's binding, absent under node --test.
  assert.deepEqual(await readFlags(), allOff());
  assert.deepEqual(await loadFlags(null), { flags: allOff(), stored: false });

  const fresh = fakeD1();
  assert.deepEqual(await readFlags(fresh.db), allOff());
  assert.deepEqual(await loadFlags(fresh.db), { flags: allOff(), stored: true });

  const migrated = fakeD1();
  migrated.sql.exec(MIGRATION);
  assert.deepEqual(await readFlags(migrated.db), allOff());
});

test("a switch turned on reads back on, stored as flag:<name> = on, with the others still off", async () => {
  const d = fakeD1();
  await setFlag("thank_you_auto", true, d.db);
  const flags = await readFlags(d.db);
  assert.equal(flags.thank_you_auto, true);
  for (const k of FLAG_KEYS.filter((x) => x !== "thank_you_auto")) assert.equal(flags[k], false, k);
  const [row] = d.rows();
  assert.equal(row.key, `${FLAG_PREFIX}thank_you_auto`);
  assert.equal(row.value, "on");
  assert.ok(Math.abs(row.updated_at - Date.now()) < 60_000, "updated_at is epoch milliseconds");
});

test("turning it off writes off rather than deleting, so the row says when", async () => {
  const d = fakeD1();
  await setFlag("thank_you_template_approved", true, d.db);
  await setFlag("thank_you_template_approved", false, d.db);
  assert.equal((await readFlags(d.db)).thank_you_template_approved, false);
  assert.deepEqual(d.rows().map((r) => [r.key, r.value]), [["flag:thank_you_template_approved", "off"]]);
});

test("only exactly 'on' is on: a hand-edited or mistyped value is the safe side", async () => {
  const d = fakeD1();
  await readFlags(d.db); // makes the table
  const put = d.sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, 1)");
  put.run("flag:thank_you_auto", "ON");
  put.run("flag:followup_templates_approved", "true");
  put.run("flag:confirm_reminder_template_approved", "1");
  put.run("flag:not_a_switch", "on");
  assert.deepEqual(await readFlags(d.db), allOff());
  put.run("flag:onboarding_enabled", "on");
  assert.equal((await readFlags(d.db)).onboarding_enabled, true);
  assert.equal(Object.keys(await readFlags(d.db)).length, FLAG_KEYS.length, "an unknown key never appears");
});

test("a read that fails is every switch off for the senders, and an error for the admin screen", async () => {
  const broken = fakeD1({ failReads: true });
  await setFlag("thank_you_auto", true, broken.db);
  assert.deepEqual(await readFlags(broken.db), allOff());
  await assert.rejects(loadFlags(broken.db), /Network connection lost/);
});

test("nowhere to save, an unknown switch or a non-boolean is refused, not pretended", async () => {
  await assert.rejects(setFlag("thank_you_auto", true, null), /no D1 database/);
  await assert.rejects(setFlag("thank_you_auto", true), /no D1 database/);
  const d = fakeD1();
  await assert.rejects(setFlag("bogus" as FlagKey, true, d.db), /Unknown switch/);
  await assert.rejects(setFlag("thank_you_auto", "yes" as unknown as boolean, d.db), /true or false/);
  // Refused before the database was touched at all: not even the table was made.
  assert.throws(() => d.rows(), /no such table/);
  assert.deepEqual(await readFlags(d.db), allOff());
});

test("the switches share the settings table with the Drive pairing and never disturb it", async () => {
  const d = fakeD1();
  const pairing = { url: "https://script.google.com/macros/s/AKfyc1/exec", secret: "pair-secret-0123456789abcdef" };
  await saveBridgePairing(pairing, d.db);
  await setFlag("thank_you_auto", true, d.db);
  await setFlag("thank_you_auto", false, d.db);
  assert.deepEqual(await loadBridgePairing(d.db), pairing);
  assert.deepEqual(d.rows().map((r) => r.key), ["drive_bridge_secret", "drive_bridge_url", "flag:thank_you_auto"]);
});

test("the admin screen has a row for every switch, and the route refuses the reserved ones", () => {
  const ui = readFileSync(new URL("../app/admin/AutomationToggles.tsx", import.meta.url), "utf8");
  for (const k of FLAG_KEYS) assert.match(ui, new RegExp(`\\b${k}:\\s*\\{`), `AutomationToggles has no row for ${k}`);
  assert.match(ui, /Draft, not submitted to Meta/);
  assert.match(ui, /Coming later/);
  assert.doesNotMatch(ui, /import\s+\{[^}]*\}\s+from\s+"@\/lib\/automation-flags"/, "the client may import types only");
  const route = readFileSync(new URL("../app/api/admin/automation/route.ts", import.meta.url), "utf8");
  assert.match(route, /COMING_LATER\.has\(key\) && body\.on/);
});
