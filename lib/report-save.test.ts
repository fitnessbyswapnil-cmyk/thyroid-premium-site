import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  saveReportFromWhatsApp, savedReportsFor, savedReportsForPhones, newestReportFor, reportFileName, leadsFromColumns,
  planBackfill, backfillReports, BACKFILL_BATCH, BACKFILL_BUDGET_MS,
  type ReportSaveDeps, type BackfillMessage,
} from "./report-save.ts";
import { downloadMedia } from "./wa-media.ts";
import { hashKey } from "./journey-store.ts";
import { MAX_FILE_BYTES, type ResolvedBridgeConfig } from "./drive.ts";
import type { D1Database, D1PreparedStatement } from "./ledger.ts";

const NOW = Date.parse("2026-11-10T06:00:00Z");
const DAY = 86_400_000;
const TOKEN = "EAA-test-token";
const MEDIA_ID = "880011223344";
const MEDIA_BASE = "https://lookaside.fbsbx.example/whatsapp_business/attachments/?mid=";
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6]);
const CFG: ResolvedBridgeConfig = { url: "https://script.example/exec", secret: "s3cret", folderId: "FOLDER", missing: [], source: "env" };
const LEADS = new Map([["9876543210", "Meera Kulkarni"]]);

// ── fakes ───────────────────────────────────────────────────────────────────

type Call = { url: string; init: RequestInit };

/** Graph, the media download and the bridge, each replaceable; every call is recorded. */
function fakeFetch(o: {
  meta?: (id: string) => Response;
  file?: () => Response;
  bridge?: (body: Record<string, unknown>) => Response;
} = {}) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("https://graph.facebook.com/")) {
      const id = url.split("/").pop() ?? "";
      return o.meta ? o.meta(id) : Response.json({ url: MEDIA_BASE + id, mime_type: "image/jpeg", file_size: BYTES.byteLength, id });
    }
    if (url.startsWith(MEDIA_BASE)) return o.file ? o.file() : new Response(BYTES, { headers: { "content-type": "image/jpeg" } });
    if (url === CFG.url) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      if (o.bridge) return o.bridge(body);
      const id = `F_${String(body.dedupeKey).replace(/\W/g, "")}`;
      return Response.json({ ok: true, id, url: `https://drive.google.com/file/d/${id}/view`, created: true });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
  return { impl, calls, bridgeBody: () => JSON.parse(String(calls.find((c) => c.url === CFG.url)?.init.body ?? "{}")) };
}

const bearer = (c: Call) => new Headers(c.init.headers).get("authorization");

function deps(over: Partial<ReportSaveDeps> = {}): Partial<ReportSaveDeps> {
  return {
    config: async () => CFG,
    token: () => TOKEN,
    leads: async () => LEADS,
    db: async () => null,
    now: () => NOW,
    ...over,
  };
}

const input = (o: Record<string, unknown> = {}) => ({
  mediaId: MEDIA_ID, phone: "919876543210", name: "Meeru", messageId: "wamid.ABC",
  mime: "image/jpeg", filename: "", kind: "image", ts: "2026-11-09T20:00:00Z", requireLead: true, ...o,
});

// D1 is SQLite, so the real migration and the real SQL run here (node:sqlite).
// Imported through a variable because @types/node 20 has no node:sqlite types.
type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): { get(...a: unknown[]): unknown; all(...a: unknown[]): unknown[]; run(...a: unknown[]): { changes: number | bigint } };
};
const plain = (r: unknown) => (r ? { ...(r as object) } as Record<string, unknown> : null);

async function openDb(opts: { migrate?: boolean } = {}): Promise<{ db: D1Database; sqlite: SqliteDb } | null> {
  const specifier = "node:sqlite";
  const mod = (await import(specifier).catch(() => null)) as { DatabaseSync: new (path: string) => SqliteDb } | null;
  if (!mod) return null;
  const sqlite = new mod.DatabaseSync(":memory:");
  if (opts.migrate !== false) sqlite.exec(readFileSync(new URL("../migrations/0005_drive_files.sql", import.meta.url), "utf8"));
  const prepare = (sql: string): D1PreparedStatement => {
    let args: unknown[] = [];
    const stmt: D1PreparedStatement = {
      bind(...values: unknown[]) {
        args = values;
        return stmt;
      },
      async first<T>() {
        return plain(sqlite.prepare(sql).get(...args)) as T | null;
      },
      async all<T>() {
        return { results: sqlite.prepare(sql).all(...args).map(plain) as T[] };
      },
      async run() {
        return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } };
      },
    };
    return stmt;
  };
  const db: D1Database = {
    prepare,
    async batch<T>(statements: D1PreparedStatement[]) {
      return Promise.all(statements.map((s) => s.all<T>()));
    },
  };
  return { db, sqlite };
}

const rows = (s: SqliteDb) => s.prepare("SELECT * FROM drive_files ORDER BY saved_at, media_id").all().map(plain);

function insert(s: SqliteDb, r: { mediaId: string; phoneKey: string; url: string; at: number; kind?: string }) {
  s.prepare("INSERT INTO drive_files (media_id, phone_key, kind, file_id, url, saved_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(r.mediaId, r.phoneKey, r.kind ?? "image", r.url ? `F${r.mediaId}` : "", r.url, r.at);
}

// ── who gets saved ──────────────────────────────────────────────────────────

test("on the webhook path a stranger's photo is not saved, and nothing is downloaded", async () => {
  const f = fakeFetch();
  const r = await saveReportFromWhatsApp(input(), deps({ fetchImpl: f.impl, leads: async () => new Map() }));
  assert.equal(r.saved, false);
  assert.equal(!r.saved && r.reason, "not_a_lead");
  assert.equal(f.calls.length, 0, "no Graph lookup, no download, no bridge call");
});

test("the Save to Drive button saves a report from a number that is not a lead", async () => {
  // He pressed it: a woman who messaged before filling the quiz is still his client-to-be.
  const f = fakeFetch();
  let asked = false;
  const r = await saveReportFromWhatsApp(
    input({ requireLead: false }),
    deps({ fetchImpl: f.impl, leads: async () => { asked = true; return new Map(); } }),
  );
  assert.equal(r.saved, true);
  assert.equal(asked, false, "the manual path never reads the Leads sheet");
  assert.equal(f.calls.length, 3);
});

test("an unreadable Leads sheet saves nothing on the webhook path", async () => {
  // Unconfirmed is not a lead; the backfill picks it up once the sheet answers.
  const f = fakeFetch();
  const r = await saveReportFromWhatsApp(input(), deps({ fetchImpl: f.impl, leads: async () => { throw new Error("quota"); } }));
  assert.equal(!r.saved && r.reason, "lead_check_failed");
  assert.equal(f.calls.length, 0);
});

test("leadsFromColumns: every number format, the newest non-empty name, the header skipped", () => {
  const names = ["Name", "Meera K.", "Asha", "", "Meera Kulkarni", "", "Short"];
  const phones = ["Phone", "9876543210.0", "+91 91234 56789", "09876543210", "919876543210", "919876543210", "12345"];
  const m = leadsFromColumns(names, phones);
  assert.deepEqual([...m.keys()].sort(), ["9123456789", "9876543210"]);
  // A later row with no name never erases the one she gave.
  assert.equal(m.get("9876543210"), "Meera Kulkarni");
  assert.equal(m.get("9123456789"), "Asha");
});

// ── once ────────────────────────────────────────────────────────────────────

test("a report already in drive_files comes back as it is, with no download and no sheet read", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  insert(o.sqlite, { mediaId: MEDIA_ID, phoneKey: await hashKey("p:9876543210"), url: "https://drive.google.com/file/d/OLD/view", at: NOW - DAY });
  const f = fakeFetch();
  let asked = false;
  const r = await saveReportFromWhatsApp(
    input(),
    deps({ fetchImpl: f.impl, db: async () => o.db, leads: async () => { asked = true; return LEADS; } }),
  );
  assert.deepEqual(r, { saved: true, url: "https://drive.google.com/file/d/OLD/view", fileId: `F${MEDIA_ID}`, created: false });
  assert.equal(f.calls.length, 0);
  assert.equal(asked, false);
});

// ── refusals ────────────────────────────────────────────────────────────────

test("not connected: the hint says how to connect, and nothing is fetched or written", async () => {
  const f = fakeFetch();
  let touched = false;
  const r = await saveReportFromWhatsApp(
    input(),
    deps({
      fetchImpl: f.impl,
      config: async () => ({ url: "", secret: "", folderId: "FOLDER", missing: ["DRIVE_BRIDGE_URL", "DRIVE_BRIDGE_SECRET"], source: "none" }),
      db: async () => { touched = true; return null; },
    }),
  );
  assert.equal(!r.saved && r.reason, "not_configured");
  assert.match((!r.saved && r.hint) || "", /Connect Google Drive/);
  assert.equal(f.calls.length, 0);
  assert.equal(touched, false);
});

test("too large: refused from Graph's reported size before a byte is downloaded, and never retried", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  const f = fakeFetch({ meta: (id) => Response.json({ url: MEDIA_BASE + id, mime_type: "application/pdf", file_size: MAX_FILE_BYTES + 1 }) });
  const r = await saveReportFromWhatsApp(input(), deps({ fetchImpl: f.impl, db: async () => o.db }));
  assert.equal(!r.saved && r.reason, "too_large");
  assert.match((!r.saved && r.hint) || "", /20 MB/);
  assert.equal(f.calls.length, 1, "only the lookup");
  const [row] = rows(o.sqlite);
  assert.equal(row?.kind, "skip:too_large");
  assert.equal(row?.url, "");
  // A skip is not a saved report: nothing links to it.
  assert.equal((await savedReportsFor([MEDIA_ID], { db: async () => o.db })).size, 0);
});

test("downloadMedia refuses an oversized file from its Content-Length, or by counting when it has none", async () => {
  const meta = (id: string) => Response.json({ url: MEDIA_BASE + id, mime_type: "image/jpeg" });
  let pulled = false;
  const declared = fakeFetch({
    meta,
    // highWaterMark 0: pull() runs only when someone actually reads.
    file: () => new Response(new ReadableStream({ pull() { pulled = true; } }, { highWaterMark: 0 }), { headers: { "content-length": "11" } }),
  });
  assert.deepEqual(await downloadMedia(MEDIA_ID, TOKEN, { maxBytes: 10, fetchImpl: declared.impl }), { ok: false, reason: "too_large" });
  assert.equal(pulled, false, "not read at all");

  const undeclared = fakeFetch({ meta, file: () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(6)); c.enqueue(new Uint8Array(6)); c.close(); } })) });
  assert.deepEqual(await downloadMedia(MEDIA_ID, TOKEN, { maxBytes: 10, fetchImpl: undeclared.impl }), { ok: false, reason: "too_large" });

  const fits = fakeFetch({ meta });
  const got = await downloadMedia(MEDIA_ID, TOKEN, { maxBytes: 10, fetchImpl: fits.impl });
  assert.equal(got.ok && got.bytes.byteLength, BYTES.byteLength);
});

test("an id WhatsApp no longer has is final, and a refused token is told apart from it", async () => {
  const gone = fakeFetch({ meta: () => new Response("{}", { status: 404 }) });
  assert.equal((await downloadMedia(MEDIA_ID, TOKEN, { maxBytes: 10, fetchImpl: gone.impl })).ok === false && "media_expired", "media_expired");
  const refused = fakeFetch({ meta: () => new Response("{}", { status: 401 }) });
  const r = await downloadMedia(MEDIA_ID, TOKEN, { maxBytes: 10, fetchImpl: refused.impl });
  assert.equal(!r.ok && r.reason, "token_rejected");
});

test("it never throws: a network failure comes back as a result", async () => {
  const boom = (async () => { throw new TypeError("network down"); }) as typeof fetch;
  const r = await saveReportFromWhatsApp(input(), deps({ fetchImpl: boom }));
  assert.equal(!r.saved && r.reason, "error");
  assert.match((!r.saved && r.hint) || "", /network down/);
});

// ── the save itself ─────────────────────────────────────────────────────────

test("the file comes from two Graph hops, and both carry the bearer token", async () => {
  const f = fakeFetch();
  const r = await saveReportFromWhatsApp(input(), deps({ fetchImpl: f.impl }));
  assert.equal(r.saved, true);
  const [lookup, download, bridge] = f.calls;
  assert.equal(lookup.url, `https://graph.facebook.com/v21.0/${MEDIA_ID}`);
  assert.equal(bearer(lookup), `Bearer ${TOKEN}`);
  assert.equal(download.url, MEDIA_BASE + MEDIA_ID, "the URL the lookup returned");
  assert.equal(bearer(download), `Bearer ${TOKEN}`, "the download 401s without it");
  assert.equal(bridge.url, CFG.url);
  assert.equal(bearer(bridge), null, "the token never leaves for Google");
});

test("the Drive file is named by her IST date and keyed to the media id", async () => {
  const f = fakeFetch();
  await saveReportFromWhatsApp(input(), deps({ fetchImpl: f.impl }));
  const sent = f.bridgeBody();
  assert.equal(sent.action, "saveFile");
  // 20:00 UTC on the 9th is the 10th in Kolkata.
  assert.equal(sent.fileName, "Report · 2026-11-10 · photo.jpg");
  assert.equal(sent.dedupeKey, `wa:${MEDIA_ID}`);
  assert.equal(sent.mimeType, "image/jpeg");
  assert.equal(sent.base64, Buffer.from(BYTES).toString("base64"));
  assert.equal(sent.phone, "9876543210");
  // The name she gave the funnel, not her WhatsApp profile name, names a new folder.
  assert.equal(sent.name, "Meera Kulkarni");
});

test("a document keeps its own name, with the extension its real type has", () => {
  assert.equal(reportFileName({ ts: "2026-11-10T04:00:00Z", filename: "TSH report.pdf", mime: "application/pdf" }), "Report · 2026-11-10 · TSH report.pdf");
  assert.equal(reportFileName({ ts: "2026-11-10T04:00:00Z", filename: "TSH", mime: "application/pdf" }), "Report · 2026-11-10 · TSH.pdf");
  assert.equal(reportFileName({ ts: "2026-11-10T04:00:00Z", filename: "scan.JPEG", mime: "image/jpeg" }), "Report · 2026-11-10 · scan.jpg");
  assert.equal(reportFileName({ ts: "2026-11-10T04:00:00Z", filename: "labs.odt", mime: "application/x-unknown" }), "Report · 2026-11-10 · labs.odt");
  assert.equal(reportFileName({ ts: "2026-11-10T04:00:00Z", filename: "Dr. Shah", mime: "application/pdf" }), "Report · 2026-11-10 · Dr. Shah.pdf");
  // Never filed under a day she did not send it.
  assert.equal(reportFileName({ ts: "", filename: "", mime: "image/png" }), "Report · undated · photo.png");
  // The extension survives the bridge's 120-character cut.
  const long = reportFileName({ ts: "2026-11-10T04:00:00Z", filename: `${"x".repeat(300)}.pdf`, mime: "application/pdf" });
  assert.ok(long.length <= 120 && long.endsWith(".pdf"), long);
});

test("the D1 row holds her hashed number, never the digits or her name", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  const f = fakeFetch();
  const r = await saveReportFromWhatsApp(input({ phone: "+91 98765 43210" }), deps({ fetchImpl: f.impl, db: async () => o.db }));
  assert.equal(r.saved, true);
  const all = rows(o.sqlite);
  assert.equal(all.length, 1);
  const row = all[0]!;
  assert.equal(row.phone_key, await hashKey("p:9876543210"));
  assert.equal(row.media_id, MEDIA_ID);
  assert.equal(row.kind, "image");
  assert.equal(row.saved_at, NOW);
  assert.equal(row.url, r.saved ? r.url : "");
  const stored = JSON.stringify(row);
  for (const raw of ["9876543210", "98765", "43210", "Meera", "Meeru"]) assert.ok(!stored.includes(raw), `row contains ${raw}`);
});

test("savedReportsFor and savedReportsForPhones: saved files only, by media id and by last 10 digits", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  const meera = await hashKey("p:9876543210");
  const asha = await hashKey("p:9123456789");
  insert(o.sqlite, { mediaId: "100000000001", phoneKey: meera, url: "https://d/1", at: NOW - 3 * DAY });
  insert(o.sqlite, { mediaId: "100000000002", phoneKey: meera, url: "https://d/2", at: NOW - 1 * DAY });
  insert(o.sqlite, { mediaId: "100000000003", phoneKey: meera, url: "https://d/3", at: NOW - 2 * DAY });
  insert(o.sqlite, { mediaId: "100000000004", phoneKey: meera, url: "", at: NOW, kind: "skip:media_expired" });
  insert(o.sqlite, { mediaId: "100000000005", phoneKey: asha, url: "https://d/5", at: NOW - DAY });
  const db = async () => o.db;

  const byPhone = await savedReportsForPhones(["+91 98765 43210", "919876543210", "09876543210", "9123456789", "7000000000", "123"], { db });
  assert.deepEqual([...byPhone.keys()].sort(), ["9123456789", "9876543210"]);
  // Three formats of one number are one woman; the chip opens her newest report.
  assert.deepEqual(byPhone.get("9876543210"), { url: "https://d/2", savedAt: NOW - DAY, count: 3 });
  assert.deepEqual(byPhone.get("9123456789"), { url: "https://d/5", savedAt: NOW - DAY, count: 1 });

  const byMedia = await savedReportsFor(["100000000001", "100000000004", "999999999999", ""], { db });
  assert.deepEqual([...byMedia.entries()], [["100000000001", { url: "https://d/1", savedAt: NOW - 3 * DAY }]]);

  assert.equal((await savedReportsForPhones(["9876543210"], { db: async () => null })).size, 0, "off Cloudflare: nothing, no throw");
});

test("the migration and the code's own CREATE TABLE build the same table", async (t) => {
  const migrated = await openDb({ migrate: true });
  const lazy = await openDb({ migrate: false });
  if (!migrated || !lazy) return t.skip("node:sqlite unavailable");
  // Before the migration is applied, the first read creates the table itself.
  await savedReportsFor([MEDIA_ID], { db: async () => lazy.db });
  // And on a migrated database the lazy DDL is harmless.
  await savedReportsFor([MEDIA_ID], { db: async () => migrated.db });
  const shape = (s: SqliteDb) => ({
    columns: s.prepare("PRAGMA table_info(drive_files)").all().map(plain),
    indexes: s.prepare("PRAGMA index_list(drive_files)").all().map(plain).map((r) => ({ name: r?.name, unique: r?.unique, origin: r?.origin })),
    phoneIndex: s.prepare("PRAGMA index_info(idx_drive_files_phone)").all().map((r) => plain(r)?.name),
  });
  assert.deepEqual(shape(lazy.sqlite), shape(migrated.sqlite));
  assert.deepEqual(shape(lazy.sqlite).phoneIndex, ["phone_key"]);
});

// ── backfill ────────────────────────────────────────────────────────────────

const msg = (o: Partial<BackfillMessage>): BackfillMessage => ({
  ts: new Date(NOW - DAY).toISOString(), phone: "919876543210", direction: "in", messageId: "wamid.x", name: "Meeru",
  mediaId: "100000000001", mediaType: "image", mediaMime: "image/jpeg", mediaName: "", ...o,
});
const ago = (days: number, hours = 0) => new Date(NOW - days * DAY - hours * 3_600_000).toISOString();

test("planBackfill: leads' reports from the last 30 days, not yet in drive_files, oldest first, 8 at a time", () => {
  const due = Array.from({ length: 10 }, (_, i) => msg({ mediaId: `20000000000${i}`, ts: ago(29 - i * 3, i % 3) }));
  // Shuffled, as the sheet's order is not the order they matter in.
  const messages: BackfillMessage[] = [
    due[4], due[9], due[0], due[7], due[2],
    msg({ mediaId: "300000000001", ts: ago(31) }),                                 // past the window: gone at Meta
    msg({ mediaId: "", mediaType: "", ts: ago(2) }),                               // text
    msg({ mediaId: "300000000002", mediaType: "audio", ts: ago(2) }),              // a voice note is not a report
    msg({ mediaId: "300000000003", direction: "out", mediaType: "document", ts: ago(2) }), // ours
    msg({ mediaId: "300000000004", phone: "917000000000", ts: ago(2) }),           // not a lead
    msg({ mediaId: "300000000005", ts: ago(2) }),                                  // already finished
    due[3], due[8], due[1], due[6], due[5],
    { ...due[2] },                                                                 // redelivered by Meta
    msg({ mediaId: "300000000006", mediaType: "document", mediaMime: "application/pdf", ts: "not a date" }),
  ];
  const plan = planBackfill({ messages, leads: LEADS, finished: new Set(["300000000005"]), now: NOW });
  assert.equal(plan.eligible, 10);
  assert.equal(plan.batch.length, BACKFILL_BATCH);
  assert.deepEqual(plan.batch.map((b) => b.mediaId), due.slice(0, BACKFILL_BATCH).map((m) => m.mediaId), "oldest first, so the next to expire goes first");
  const first = plan.batch[0];
  assert.deepEqual(first, {
    mediaId: due[0].mediaId, phone: "919876543210", name: "Meeru", messageId: "wamid.x",
    mime: "image/jpeg", filename: "", kind: "image", ts: due[0].ts,
  });
  assert.equal(planBackfill({ messages, leads: LEADS, finished: new Set(), now: NOW, cap: 3 }).batch.length, 3);
});

test("the backfill records what WhatsApp no longer has, so `remaining` reaches 0 instead of looping", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  const messages = [
    msg({ mediaId: "400000000001", ts: ago(29) }),
    msg({ mediaId: "400000000002", ts: ago(5) }),
    msg({ mediaId: "400000000003", ts: ago(1), mediaType: "document", mediaMime: "application/pdf", mediaName: "TSH.pdf" }),
  ];
  const f = fakeFetch({
    meta: (id) => (id === "400000000001" ? new Response("{}", { status: 404 }) : Response.json({ url: MEDIA_BASE + id, mime_type: "image/jpeg" })),
  });
  const run = () => backfillReports({ ...deps({ fetchImpl: f.impl, db: async () => o.db }), messages: async () => messages });

  const first = await run();
  assert.equal(first.saved, 2);
  assert.equal(first.skipped, 1);
  assert.equal(first.remaining, 0);
  assert.match(first.hint ?? "", /no longer has this file/);
  assert.deepEqual(rows(o.sqlite).map((r) => [r?.media_id, r?.kind, r?.url === ""]), [
    ["400000000001", "skip:media_expired", true],
    ["400000000002", "image", false],
    ["400000000003", "document", false],
  ]);

  const callsBefore = f.calls.length;
  assert.deepEqual(await run(), { saved: 0, skipped: 0, remaining: 0 });
  assert.equal(f.calls.length, callsBefore, "the second press fetches nothing");
});

test("the backfill stops at a broken bridge instead of failing every report the same way", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  const messages = [msg({ mediaId: "500000000001", ts: ago(3) }), msg({ mediaId: "500000000002", ts: ago(2) }), msg({ mediaId: "500000000003", ts: ago(1) })];
  const f = fakeFetch({ bridge: () => Response.json({ ok: false, error: "unauthorized" }) });
  const r = await backfillReports({ ...deps({ fetchImpl: f.impl, db: async () => o.db }), messages: async () => messages });
  assert.deepEqual({ saved: r.saved, skipped: r.skipped, remaining: r.remaining }, { saved: 0, skipped: 1, remaining: 3 });
  assert.match(r.hint ?? "", /Connect Google Drive/);
  assert.equal(f.calls.length, 3, "one lookup, one download, one bridge call, then it stopped");
  assert.equal(rows(o.sqlite).length, 0, "a broken bridge is not the report's fault: nothing is marked finished");
});

test("the backfill stops starting saves when its time is up, and says what is left", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  const messages = [msg({ mediaId: "600000000001", ts: ago(3) }), msg({ mediaId: "600000000002", ts: ago(2) }), msg({ mediaId: "600000000003", ts: ago(1) })];
  let clock = NOW;
  const f = fakeFetch({
    bridge: (body) => {
      clock += BACKFILL_BUDGET_MS + 1; // a slow script
      return Response.json({ ok: true, id: `F${String(body.dedupeKey)}`, url: "https://d/x", created: true });
    },
  });
  const r = await backfillReports({ ...deps({ fetchImpl: f.impl, db: async () => o.db, now: () => clock }), messages: async () => messages });
  assert.deepEqual(r, { saved: 1, skipped: 0, remaining: 2 });
});

test("the backfill needs a connected Drive and the D1 ledger, and reads nothing without them", async () => {
  let read = false;
  const messages = async () => { read = true; return [msg({})]; };
  const unconfigured = await backfillReports({
    ...deps({ config: async () => ({ ...CFG, url: "", missing: ["DRIVE_BRIDGE_URL"], source: "none" }) }),
    messages,
  });
  assert.equal(unconfigured.error, "not_configured");
  const noLedger = await backfillReports({ ...deps({ db: async () => null }), messages });
  assert.equal(noLedger.error, "no_ledger");
  assert.equal(read, false);
});

test("newestReportFor: her newest saved report and its media id, for the pre-call reader; skips and other women never count", async (t) => {
  const o = await openDb();
  if (!o) return t.skip("node:sqlite unavailable");
  const meera = await hashKey("p:9876543210");
  const asha = await hashKey("p:9123456789");
  insert(o.sqlite, { mediaId: "100000000001", phoneKey: meera, url: "https://d/1", at: NOW - 3 * DAY });
  insert(o.sqlite, { mediaId: "100000000002", phoneKey: meera, url: "https://d/2", at: NOW - 1 * DAY, kind: "document" });
  insert(o.sqlite, { mediaId: "100000000003", phoneKey: meera, url: "", at: NOW, kind: "skip:media_expired" });
  insert(o.sqlite, { mediaId: "100000000005", phoneKey: asha, url: "https://d/5", at: NOW });
  const db = async () => o.db;

  assert.deepEqual(await newestReportFor("+91 98765 43210", { db }), { mediaId: "100000000002", url: "https://d/2", savedAt: NOW - DAY, count: 2 });
  assert.equal(await newestReportFor("9000000000", { db }), null, "none saved");
  assert.equal(await newestReportFor("123", { db }), null, "not a number");
  assert.equal(await newestReportFor("9876543210", { db: async () => null }), null, "off Cloudflare");
  // A broken lookup is not "she sent none": it throws for the caller to say so.
  const broken = { prepare() { throw new Error("D1 down"); }, batch: async () => { throw new Error("D1 down"); } } as unknown as D1Database;
  await assert.rejects(newestReportFor("9876543210", { db: async () => broken }));
});
