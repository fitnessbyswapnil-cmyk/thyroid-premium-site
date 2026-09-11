import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BACKOFF_BASE_MS,
  BACKOFF_CAP_MS,
  MAX_ATTEMPTS,
  META_MAX_EVENT_AGE_S,
  backoffMs,
  claimRetry,
  containsPhoneNumber,
  getLedgerDb,
  getMetaEventState,
  isDuplicateSend,
  isLedgerable,
  isTooOldForMeta,
  ledgerSummary,
  listDueRetries,
  markDead,
  parseStoredEvent,
  payloadForStorage,
  planAfterFailure,
  recordMetaSend,
  recordPayment,
  recordRetry,
  redactSourceUrl,
  retryDecision,
  type D1Database,
  type D1PreparedStatement,
  type MetaEventRow,
} from "./ledger.ts";
import type { CAPIEvent } from "./server-tracking.ts";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const NOW = Date.parse("2026-09-12T06:00:00.000Z");
const NOW_S = Math.floor(NOW / 1000);
const HASH = "a".repeat(64);

function event(o: Partial<CAPIEvent> = {}): CAPIEvent {
  return {
    event_name: "Purchase",
    event_id: "Purchase_thyroid_quiz_1786000000000_ab12cd_1786000000123",
    event_time: NOW_S,
    action_source: "website",
    event_source_url: "https://www.swapnilumbarkarfitness.in/session-booked",
    user_data: { em: HASH, ph: HASH, client_ip_address: "203.0.113.7", client_user_agent: "UA", fbc: "fb.1.1.x" },
    custom_data: { value: 299, currency: "INR" },
    ...o,
  };
}

// ── backoff ──────────────────────────────────────────────────────────────────

test("backoff doubles from one cron tick: 15m, 30m, 1h, 2h", () => {
  assert.equal(backoffMs(1), 15 * MIN);
  assert.equal(backoffMs(2), 30 * MIN);
  assert.equal(backoffMs(3), HOUR);
  assert.equal(backoffMs(4), 2 * HOUR);
});

test("backoff is capped, and junk attempt counts read as the first attempt", () => {
  assert.equal(backoffMs(50), BACKOFF_CAP_MS);
  assert.equal(backoffMs(0), BACKOFF_BASE_MS);
  assert.equal(backoffMs(Number.NaN), BACKOFF_BASE_MS);
  assert.equal(backoffMs(-3), BACKOFF_BASE_MS);
});

// ── the 7-day window ─────────────────────────────────────────────────────────

test("an event is too old an hour before Meta's 7-day limit, not after it", () => {
  const sixDays = NOW_S - 6 * 24 * 3600;
  assert.equal(isTooOldForMeta(sixDays, NOW), false);
  assert.equal(isTooOldForMeta(NOW_S - META_MAX_EVENT_AGE_S + 2 * 3600, NOW), false);
  assert.equal(isTooOldForMeta(NOW_S - META_MAX_EVENT_AGE_S + 30 * 60, NOW), true);
  assert.equal(isTooOldForMeta(NOW_S - META_MAX_EVENT_AGE_S - 1, NOW), true);
});

test("a missing or garbage event_time can never be sent", () => {
  assert.equal(isTooOldForMeta(0, NOW), true);
  assert.equal(isTooOldForMeta(Number.NaN, NOW), true);
});

// ── what a failure becomes ───────────────────────────────────────────────────

test("a first failure is retried one cron tick later", () => {
  assert.deepEqual(planAfterFailure({ attempts: 1, nowMs: NOW, eventTimeS: NOW_S }), {
    status: "failed",
    nextRetryAt: NOW + 15 * MIN,
  });
});

test("the fifth failure is final", () => {
  const plan = planAfterFailure({ attempts: MAX_ATTEMPTS, nowMs: NOW, eventTimeS: NOW_S });
  assert.equal(plan.status, "dead");
  assert.equal(plan.nextRetryAt, null);
  assert.match(plan.reason ?? "", /5 attempts/);
});

test("a failure whose next retry would miss Meta's window goes dead now", () => {
  const nearlySevenDays = NOW_S - META_MAX_EVENT_AGE_S + 90 * 60; // 1.5h of window left
  const plan = planAfterFailure({ attempts: 3, nowMs: NOW, eventTimeS: nearlySevenDays }); // next wait is 1h
  assert.equal(plan.status, "dead");
  assert.match(plan.reason ?? "", /7-day/);
});

test("a Test Events failure is recorded but never scheduled for retry", () => {
  assert.deepEqual(planAfterFailure({ attempts: 1, nowMs: NOW, eventTimeS: NOW_S, testCode: "TEST123" }), {
    status: "failed",
    nextRetryAt: null,
  });
});

// ── retry eligibility ────────────────────────────────────────────────────────

const failedRow = { status: "failed" as const, attempts: 2, test_code: null, next_retry_at: NOW - 1 };

test("a real failed row whose time has come is retried", () => {
  assert.equal(retryDecision(failedRow, NOW_S - 3600, NOW), "retry");
  assert.equal(retryDecision({ ...failedRow, next_retry_at: NOW }, NOW_S, NOW), "retry");
});

test("a row not yet due waits", () => {
  assert.equal(retryDecision({ ...failedRow, next_retry_at: NOW + MIN }, NOW_S, NOW), "wait");
});

test("test rows, sent rows and dead rows are never retried", () => {
  assert.equal(retryDecision({ ...failedRow, test_code: "TEST123" }, NOW_S, NOW), "ineligible");
  assert.equal(retryDecision({ ...failedRow, status: "sent" }, NOW_S, NOW), "ineligible");
  assert.equal(retryDecision({ ...failedRow, status: "dead" }, NOW_S, NOW), "ineligible");
  assert.equal(retryDecision({ ...failedRow, next_retry_at: null }, NOW_S, NOW), "ineligible");
});

test("a row out of attempts, or too old for Meta, is retired", () => {
  assert.equal(retryDecision({ ...failedRow, attempts: MAX_ATTEMPTS }, NOW_S, NOW), "expire");
  assert.equal(retryDecision(failedRow, NOW_S - META_MAX_EVENT_AGE_S, NOW), "expire");
});

// ── the duplicate decision ───────────────────────────────────────────────────

test("nothing recorded, or a failed/dead record, never blocks a send", () => {
  assert.equal(isDuplicateSend(null), false);
  assert.equal(isDuplicateSend(undefined, "TEST123"), false);
  assert.equal(isDuplicateSend({ status: "failed", test_code: null }), false);
  assert.equal(isDuplicateSend({ status: "dead", test_code: null }), false);
});

test("a real event that reached Meta blocks every later send of its id", () => {
  assert.equal(isDuplicateSend({ status: "sent", test_code: null }), true);
  assert.equal(isDuplicateSend({ status: "sent", test_code: null }, "TEST123"), true);
});

test("a test event that reached Meta never blocks the real one", () => {
  assert.equal(isDuplicateSend({ status: "sent", test_code: "TEST123" }), false);
  assert.equal(isDuplicateSend({ status: "sent", test_code: "TEST123" }, "TEST123"), true);
});

// ── privacy ──────────────────────────────────────────────────────────────────

test("an event_id carrying a phone number is kept out of the ledger", () => {
  assert.equal(containsPhoneNumber("report_9876543210_2026-09-12"), true);
  assert.equal(containsPhoneNumber("report_919876543210_20260912"), true);
  assert.equal(containsPhoneNumber("x_09876543210"), true);
  assert.equal(isLedgerable("report_9876543210_2026-09-12"), false);
});

test("the ids the funnel actually mints are ledgerable", () => {
  for (const id of [
    "quiz_quiz_1786000000000_ab12cd",
    "Purchase_thyroid_quiz_1786000000000_ab12cd_1786000000123",
    "schedule_8JrTWCYqr5ZT7Fs4bNkW3a",
    "qsched_8JrTWCYqr5ZT7Fs4bNkW3a",
    "program_quiz_1786000000000_ab12cd",
    "lead_1786000000000",
  ]) {
    assert.equal(isLedgerable(id), true, id);
  }
  assert.equal(isLedgerable(""), false);
});

test("event_source_url keeps fbclid and utm_* only, and no fragment", () => {
  assert.equal(
    redactSourceUrl("https://www.swapnilumbarkarfitness.in/book?name=Priya&email=p%40x.in&fbclid=AbC&utm_source=fb#top"),
    "https://www.swapnilumbarkarfitness.in/book?fbclid=AbC&utm_source=fb",
  );
  assert.equal(redactSourceUrl("https://www.swapnilumbarkarfitness.in/decode"), "https://www.swapnilumbarkarfitness.in/decode");
  assert.equal(redactSourceUrl("/relative?phone=9876543210"), "/relative");
});

test("the stored payload keeps the IP only while the row can be retried", () => {
  const retryable = JSON.parse(payloadForStorage(event(), true));
  const terminal = JSON.parse(payloadForStorage(event(), false));
  assert.equal(retryable.user_data.client_ip_address, "203.0.113.7");
  assert.equal(terminal.user_data.client_ip_address, undefined);
  assert.equal(terminal.user_data.client_user_agent, "UA");
});

test("the stored payload is the event Meta got: original time, source, custom_data, hashes", () => {
  const e = event({ event_time: NOW_S - 86400, action_source: "phone_call" });
  const stored = JSON.parse(payloadForStorage(e, true));
  assert.equal(stored.event_time, NOW_S - 86400);
  assert.equal(stored.action_source, "phone_call");
  assert.deepEqual(stored.custom_data, { value: 299, currency: "INR" });
  assert.equal(stored.user_data.em, HASH);
});

test("a personal field that is somehow not hashed is never stored", () => {
  // Arrays are legal in Meta's API, though UserData types these as strings.
  const userData = { em: "priya@example.com", ph: HASH, fn: ["priya"], ln: [HASH] } as unknown as CAPIEvent["user_data"];
  const e = event({ user_data: userData });
  const stored = JSON.parse(payloadForStorage(e, true));
  assert.equal(stored.user_data.em, undefined);
  assert.equal(stored.user_data.fn, undefined);
  assert.equal(stored.user_data.ph, HASH);
  assert.deepEqual(stored.user_data.ln, [HASH]);
});

test("a stored payload round-trips for a retry, and a mismatched or broken one does not", () => {
  const e = event();
  assert.deepEqual(parseStoredEvent(payloadForStorage(e, true), e.event_id)?.event_time, e.event_time);
  assert.equal(parseStoredEvent(payloadForStorage(e, true), "some_other_id"), null);
  assert.equal(parseStoredEvent("{not json", e.event_id), null);
  assert.equal(parseStoredEvent(JSON.stringify({ event_id: e.event_id }), e.event_id), null);
});

// ── no binding ───────────────────────────────────────────────────────────────

test("outside the Cloudflare worker there is no ledger, and asking does not throw", async () => {
  assert.equal(await getLedgerDb(), null);
});

// ── the SQL, against the real migration (node:sqlite) ────────────────────────
// D1 is SQLite, so the upsert rules can be checked for real. Imported through a
// variable because @types/node 20 has no node:sqlite types.

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...args: unknown[]): unknown;
    all(...args: unknown[]): unknown[];
    run(...args: unknown[]): { changes: number | bigint };
  };
};

async function openTestLedger(): Promise<D1Database | null> {
  const specifier = "node:sqlite";
  const mod = (await import(specifier).catch(() => null)) as { DatabaseSync: new (path: string) => SqliteDb } | null;
  if (!mod) return null;
  const sqlite = new mod.DatabaseSync(":memory:");
  const migration = readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");
  sqlite.exec(migration);
  sqlite.exec(migration); // IF NOT EXISTS: re-applying is harmless

  // Rows come back with a null prototype; spread them into plain objects.
  const plain = (r: unknown) => (r ? { ...(r as object) } : null);
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
  return {
    prepare,
    async batch<T>(statements: D1PreparedStatement[]) {
      return Promise.all(statements.map((s) => s.all<T>()));
    },
  };
}

async function row(db: D1Database, id: string): Promise<MetaEventRow | null> {
  return db.prepare("SELECT * FROM meta_events WHERE event_id = ?1").bind(id).first<MetaEventRow>();
}

const ok = { success: true, events_received: 1 };
const fail = { success: false, error: "Meta 500" };

test("ledger SQL: a send is recorded once, and a sent row is final", async (t) => {
  const db = await openTestLedger();
  if (!db) return t.skip("node:sqlite unavailable");
  const e = event();

  await recordMetaSend(db, { event: e, result: fail, previous: null, nowMs: NOW });
  let r = await row(db, e.event_id);
  assert.equal(r?.status, "failed");
  assert.equal(r?.attempts, 1);
  assert.equal(r?.next_retry_at, NOW + 15 * MIN);
  assert.equal(JSON.parse(r!.payload_json).user_data.client_ip_address, "203.0.113.7");

  const previous = await getMetaEventState(db, e.event_id);
  assert.equal(isDuplicateSend(previous), false);
  await recordMetaSend(db, { event: e, result: ok, previous, nowMs: NOW + MIN });
  r = await row(db, e.event_id);
  assert.equal(r?.status, "sent");
  assert.equal(r?.attempts, 2);
  assert.equal(r?.sent_at, NOW + MIN);
  assert.equal(r?.next_retry_at, null);
  assert.equal(r?.last_error, null);
  assert.equal(JSON.parse(r!.payload_json).user_data.client_ip_address, undefined);
  assert.equal(isDuplicateSend(await getMetaEventState(db, e.event_id)), true);

  // A racing send that failed must not downgrade it.
  await recordMetaSend(db, { event: e, result: fail, previous: null, nowMs: NOW + 2 * MIN });
  assert.equal((await row(db, e.event_id))?.status, "sent");
});

test("ledger SQL: a test send never overwrites a real row, and a real send replaces a test row", async (t) => {
  const db = await openTestLedger();
  if (!db) return t.skip("node:sqlite unavailable");

  const real = event({ event_id: "schedule_real" });
  await recordMetaSend(db, { event: real, result: fail, previous: null, nowMs: NOW });
  await recordMetaSend(db, { event: real, testCode: "TEST123", result: ok, previous: null, nowMs: NOW + MIN });
  let r = await row(db, "schedule_real");
  assert.equal(r?.status, "failed");
  assert.equal(r?.test_code, null);
  assert.equal(r?.attempts, 1);

  const probe = event({ event_id: "schedule_probe" });
  await recordMetaSend(db, { event: probe, testCode: "TEST123", result: fail, previous: null, nowMs: NOW });
  r = await row(db, "schedule_probe");
  assert.equal(r?.status, "failed");
  assert.equal(r?.next_retry_at, null); // test failures are never scheduled
  assert.equal(JSON.parse(r!.payload_json).user_data.client_ip_address, undefined);

  await recordMetaSend(db, { event: probe, testCode: "TEST123", result: ok, previous: null, nowMs: NOW + MIN });
  await recordMetaSend(db, { event: probe, result: ok, previous: null, nowMs: NOW + 2 * MIN });
  r = await row(db, "schedule_probe");
  assert.equal(r?.status, "sent");
  assert.equal(r?.test_code, null);
  assert.equal(r?.attempts, 1);
  assert.equal(r?.created_at, NOW + 2 * MIN);
});

test("ledger SQL: the cron picks due real failures only, claims each once, and retires the fifth failure", async (t) => {
  const db = await openTestLedger();
  if (!db) return t.skip("node:sqlite unavailable");

  await recordMetaSend(db, { event: event({ event_id: "due" }), result: fail, previous: null, nowMs: NOW - HOUR });
  await recordMetaSend(db, { event: event({ event_id: "later" }), result: fail, previous: null, nowMs: NOW });
  await recordMetaSend(db, { event: event({ event_id: "test" }), testCode: "T", result: fail, previous: null, nowMs: NOW - HOUR });

  const due = await listDueRetries(db, NOW);
  assert.deepEqual(due.map((r) => r.event_id), ["due"]);
  assert.equal(await claimRetry(db, due[0], NOW), true);
  assert.equal(await claimRetry(db, due[0], NOW), false);

  const e = parseStoredEvent(due[0].payload_json, "due")!;
  assert.equal(await recordRetry(db, { row: due[0], event: e, result: fail, nowMs: NOW }), "failed");
  let r = await row(db, "due");
  assert.equal(r?.attempts, 2);
  assert.equal(r?.next_retry_at, NOW + 30 * MIN);

  await db.prepare("UPDATE meta_events SET attempts = 4 WHERE event_id = 'due'").run();
  r = await row(db, "due");
  assert.equal(await recordRetry(db, { row: r!, event: e, result: fail, nowMs: NOW }), "dead");
  r = await row(db, "due");
  assert.equal(r?.status, "dead");
  assert.equal(r?.attempts, 5);
  assert.match(r?.last_error ?? "", /gave up after 5 attempts/);
  assert.equal(JSON.parse(r!.payload_json).user_data.client_ip_address, undefined);
});

test("ledger SQL: a successful retry is sent, and a retired row loses its IP", async (t) => {
  const db = await openTestLedger();
  if (!db) return t.skip("node:sqlite unavailable");

  await recordMetaSend(db, { event: event({ event_id: "a" }), result: fail, previous: null, nowMs: NOW - 2 * HOUR });
  await recordMetaSend(db, { event: event({ event_id: "b" }), result: fail, previous: null, nowMs: NOW - HOUR });
  const [a, b] = await listDueRetries(db, NOW);

  assert.equal(await recordRetry(db, { row: a, event: parseStoredEvent(a.payload_json, "a")!, result: ok, nowMs: NOW }), "sent");
  assert.equal((await row(db, "a"))?.status, "sent");

  assert.equal(await markDead(db, b, "past Meta's 7-day event_time window"), true);
  const dead = await row(db, "b");
  assert.equal(dead?.status, "dead");
  assert.match(dead?.last_error ?? "", /Meta 500 · dead: past Meta's 7-day/);
  assert.equal(JSON.parse(dead!.payload_json).user_data.client_ip_address, undefined);
});

test("ledger SQL: a payment is recorded once per reference, and never with a phone", async (t) => {
  const db = await openTestLedger();
  if (!db) return t.skip("node:sqlite unavailable");
  const p = {
    orderRef: "thyroid_quiz_1786000000000_ab12cd_1786000000123",
    leadId: "quiz_1786000000000_ab12cd",
    amount: 299,
    currency: "INR",
    status: "paid" as const,
    source: "ORDER",
    sheetResult: "updated",
    paidAtMs: NOW,
  };
  assert.equal(await recordPayment(db, p, NOW), "inserted");
  assert.equal(await recordPayment(db, { ...p, sheetResult: "already_paid" }, NOW), "exists");
  assert.equal(await recordPayment(db, { ...p, orderRef: "link_9876543210" }, NOW), "skipped");
  assert.equal(await recordPayment(db, { ...p, orderRef: "link_abc", leadId: "lead_9876543210" }, NOW), "inserted");
  const r = await db.prepare("SELECT lead_id, sheet_result FROM payments WHERE order_ref = 'link_abc'").first();
  assert.deepEqual(r, { lead_id: null, sheet_result: "updated" });
});

test("ledger SQL: the admin summary counts by name × status and lists failures without payloads", async (t) => {
  const db = await openTestLedger();
  if (!db) return t.skip("node:sqlite unavailable");

  await recordMetaSend(db, { event: event({ event_id: "p1" }), result: ok, previous: null, nowMs: NOW });
  await recordMetaSend(db, { event: event({ event_id: "p2" }), result: fail, previous: null, nowMs: NOW });
  await recordMetaSend(db, { event: event({ event_id: "s1", event_name: "Schedule" }), result: ok, previous: null, nowMs: NOW });
  await recordMetaSend(db, { event: event({ event_id: "t1" }), testCode: "T", result: ok, previous: null, nowMs: NOW });
  await recordMetaSend(db, { event: event({ event_id: "old" }), result: ok, previous: null, nowMs: NOW - 8 * 24 * HOUR });
  await recordPayment(db, { orderRef: "o1", leadId: "", amount: 299, currency: "INR", status: "paid", source: "ORDER", sheetResult: "updated", paidAtMs: NOW }, NOW);
  await recordPayment(db, { orderRef: "o2", leadId: "", amount: 299, currency: "INR", status: "duplicate", source: "LINK", sheetResult: "already_paid", paidAtMs: NOW }, NOW);

  const s = await ledgerSummary(db, NOW + MIN);
  assert.ok(s);
  assert.deepEqual(s.events, { Purchase: { sent: 1, failed: 1 }, Schedule: { sent: 1 } });
  assert.deepEqual(s.testEvents, { Purchase: { sent: 1 } });
  assert.equal(s.latestFailures.length, 1);
  assert.equal(s.latestFailures[0].event_id, "p2");
  assert.equal("payload_json" in s.latestFailures[0], false);
  assert.deepEqual(s.payments.window, [{ currency: "INR", count: 1, total: 299 }]);
  assert.equal(s.payments.allTime.length, 2);
});
