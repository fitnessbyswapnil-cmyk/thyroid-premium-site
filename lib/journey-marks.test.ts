import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recordMark, readMarks, isMarkKind, MARK_KINDS, type MarkKind } from "./journey-marks.ts";
import { hashKey } from "./journey-store.ts";
import type { D1Database, D1PreparedStatement } from "./ledger.ts";

const NOW = Date.parse("2026-11-10T13:00:00Z");

// D1 is SQLite, so the real migration and the real SQL run here (node:sqlite),
// the way lib/report-save.test.ts does it. Imported through a variable because
// @types/node 20 has no node:sqlite types.
type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): { get(...a: unknown[]): unknown; all(...a: unknown[]): unknown[]; run(...a: unknown[]): { changes: number | bigint } };
};
const plain = (r: unknown) => (r ? ({ ...(r as object) } as Record<string, unknown>) : null);

async function openDb(opts: { migrate?: boolean } = {}) {
  const specifier = "node:sqlite";
  const mod = (await import(specifier).catch(() => null)) as { DatabaseSync: new (path: string) => SqliteDb } | null;
  if (!mod) return null;
  const sqlite = new mod.DatabaseSync(":memory:");
  if (opts.migrate !== false) sqlite.exec(readFileSync(new URL("../migrations/0006_journey_marks.sql", import.meta.url), "utf8"));
  let queries = 0;
  let batches = 0;
  const prepare = (sql: string): D1PreparedStatement => {
    let args: unknown[] = [];
    const stmt: D1PreparedStatement = {
      bind(...values: unknown[]) {
        args = values;
        return stmt;
      },
      async first<T>() {
        queries++;
        return plain(sqlite.prepare(sql).get(...args)) as T | null;
      },
      async all<T>() {
        queries++;
        return { results: sqlite.prepare(sql).all(...args).map(plain) as T[] };
      },
      async run() {
        queries++;
        return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } };
      },
    };
    return stmt;
  };
  const db: D1Database = {
    prepare,
    async batch<T>(statements: D1PreparedStatement[]) {
      batches++;
      return Promise.all(statements.map((s) => s.all<T>()));
    },
  };
  return { db, sqlite, counts: () => ({ queries, batches }) };
}

const rows = (s: SqliteDb) => s.prepare("SELECT * FROM journey_marks ORDER BY kind").all().map(plain);
const deps = (db: D1Database, now = NOW) => ({ db: async () => db, now: () => now });

test("a mark is stored under the hash of her digits, never the number", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  await recordMark("+91 98765 43210", "notes_made", "https://docs.google.com/document/d/DOC/edit", deps(o.db));
  const [r] = rows(o.sqlite);
  assert.equal(r?.phone_key, await hashKey("p:9876543210"));
  assert.equal(r?.kind, "notes_made");
  assert.equal(r?.at, NOW);
  assert.equal(r?.url, "https://docs.google.com/document/d/DOC/edit");
  assert.ok(!JSON.stringify(rows(o.sqlite)).includes("9876543210"));
});

test("readMarks answers by the last 10 digits, whatever format the number came in", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  await recordMark("9876543210", "summary_made", "https://drive.google.com/file/d/PDF/view", deps(o.db));
  await recordMark("919876543210", "summary_sent", "", deps(o.db, NOW + 60_000));
  const marks = await readMarks(["+91-98765-43210", "0000000000"], deps(o.db));
  assert.deepEqual([...marks.keys()], ["9876543210"]);
  assert.deepEqual(marks.get("9876543210"), {
    summary_made: { at: NOW, url: "https://drive.google.com/file/d/PDF/view" },
    summary_sent: { at: NOW + 60_000, url: "" },
  });
});

test("a second write moves the time on and keeps the link when it brings none", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  await recordMark("9876543210", "summary_sent", "https://drive.google.com/file/d/PDF/view", deps(o.db));
  // "Send from your phone" records the send with no file of its own.
  await recordMark("9876543210", "summary_sent", undefined, deps(o.db, NOW + 5_000));
  const m = (await readMarks(["9876543210"], deps(o.db))).get("9876543210");
  assert.deepEqual(m?.summary_sent, { at: NOW + 5_000, url: "https://drive.google.com/file/d/PDF/view" });
  assert.equal(rows(o.sqlite).length, 1);
  // A new link does replace the old one.
  await recordMark("9876543210", "summary_sent", "https://drive.google.com/file/d/NEW/view", deps(o.db, NOW + 9_000));
  const m2 = (await readMarks(["9876543210"], deps(o.db))).get("9876543210");
  assert.equal(m2?.summary_sent?.url, "https://drive.google.com/file/d/NEW/view");
});

test("one woman's marks never leak onto another's card", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  await recordMark("9876543210", "followup_1", "", deps(o.db));
  await recordMark("9123456780", "onboarded", "", deps(o.db));
  const marks = await readMarks(["9876543210", "9123456780", "9000000001"], deps(o.db));
  assert.deepEqual(Object.keys(marks.get("9876543210") ?? {}), ["followup_1"]);
  assert.deepEqual(Object.keys(marks.get("9123456780") ?? {}), ["onboarded"]);
  assert.equal(marks.has("9000000001"), false);
});

test("a whole screen is one batch: 120 numbers, three chunks of at most 50, one round trip", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  const phones = Array.from({ length: 120 }, (_, i) => `9${String(100000000 + i).padStart(9, "0")}`);
  for (const p of phones.slice(0, 3)) await recordMark(p, "notes_made", "", deps(o.db));
  const before = o.counts();
  const marks = await readMarks(phones, deps(o.db));
  const after = o.counts();
  assert.equal(marks.size, 3);
  assert.equal(after.batches - before.batches, 1);
  assert.equal(after.queries - before.queries, 3);
});

test("a number that is not 10 digits, or a kind that is not a mark, is never stored", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  await recordMark("12345", "notes_made", "", deps(o.db));
  await recordMark("9876543210", "deleted_everything" as MarkKind, "", deps(o.db));
  assert.equal(rows(o.sqlite).length, 0);
  assert.equal(isMarkKind("followup_3"), true);
  assert.equal(isMarkKind("followup_4"), false);
  assert.equal(MARK_KINDS.length, 10);
});

test("never throws: a broken database costs the mark, not the button", async () => {
  const broken: D1Database = {
    prepare() {
      throw new Error("D1 is down");
    },
    async batch() {
      throw new Error("D1 is down");
    },
  };
  await recordMark("9876543210", "notes_made", "", { db: async () => broken });
  const marks = await readMarks(["9876543210"], { db: async () => broken });
  assert.equal(marks.size, 0);
  // And off Cloudflare there is no database at all.
  await recordMark("9876543210", "notes_made", "", { db: async () => null });
  assert.equal((await readMarks(["9876543210"], { db: async () => null })).size, 0);
});

test("the migration and the code's own CREATE TABLE build the same table", async (t) => {
  const migrated = await openDb({ migrate: true });
  const lazy = await openDb({ migrate: false });
  if (!migrated || !lazy) return t.skip("node:sqlite unavailable");
  // Before the migration is applied, the first write creates the table itself.
  await recordMark("9876543210", "notes_made", "", deps(lazy.db));
  await recordMark("9876543210", "notes_made", "", deps(migrated.db));
  const shape = (s: SqliteDb) => ({
    columns: s.prepare("PRAGMA table_info(journey_marks)").all().map(plain),
    indexes: s.prepare("PRAGMA index_list(journey_marks)").all().map(plain).map((r) => ({ unique: r?.unique, origin: r?.origin })),
  });
  assert.deepEqual(shape(lazy.sqlite), shape(migrated.sqlite));
  assert.deepEqual(
    shape(lazy.sqlite).columns.map((c) => c?.name),
    ["phone_key", "kind", "at", "url"],
  );
});
