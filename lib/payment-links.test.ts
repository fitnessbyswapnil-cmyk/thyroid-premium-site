/**
 * His Cashfree link per programme price: what is accepted, what is refused
 * and why, exact-tier lookup, and the D1 store (real SQLite underneath, as in
 * bridge-settings.test.ts).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { D1Database } from "./ledger.ts";
import {
  PAYLINK_PREFIX, PRICE_TIERS, PaymentLinkError, isPriceTier, loadPaymentLinks, payLinkFor, paymentLinkProblem,
  readPaymentLinks, setPaymentLink, tierLabel, type PriceTier,
} from "./payment-links.ts";
import { readFlags, setFlag } from "./automation-flags.ts";

type SqliteStatement = { get(...p: unknown[]): unknown; run(...p: unknown[]): { changes: number | bigint }; all(...p: unknown[]): unknown[] };
type Sqlite = { prepare(sql: string): SqliteStatement; exec(sql: string): void };
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Sqlite };

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
  // Spread: node:sqlite rows have a null prototype, which deepEqual tells apart from {}.
  const rows = () =>
    (sql.prepare("SELECT key, value FROM settings ORDER BY key").all() as { key: string; value: string }[]).map((r) => ({ key: r.key, value: r.value }));
  return { db: db as unknown as D1Database, sql, rows };
}

const LINK_20 = "https://payments.cashfree.com/links/o1a2b3c4d5";
const SHORT_25 = "https://cfre.in/AbC123";

test("the four prices, and nothing else is a price", () => {
  assert.deepEqual([...PRICE_TIERS], [15000, 20000, 25000, 30000]);
  for (const n of PRICE_TIERS) assert.ok(isPriceTier(n));
  for (const bad of [0, 299, 19999, 20000.5, 35000, Number.NaN, "20000", null]) assert.equal(isPriceTier(bad), false, String(bad));
  assert.equal(tierLabel(20000), "₹20,000");
});

test("a Cashfree Payment Link is accepted, live or short", () => {
  for (const ok of [
    LINK_20,
    SHORT_25,
    "https://payments.cashfree.com/links?code=thyroid20k",
    "https://www.cashfree.com/links/abc",
    "  https://payments.cashfree.com/links/o1a2b3  ",
  ]) {
    assert.equal(paymentLinkProblem(ok), null, ok);
  }
});

test("everything else is refused, each with a reason he can act on", () => {
  const cases: [string, RegExp][] = [
    ["", /Paste the link/],
    ["http://payments.cashfree.com/links/x", /https:\/\//],
    ["payments.cashfree.com/links/x", /starts with https/],
    ["https://payments.cashfree.com/links/x extra", /no spaces/],
    ["https://evil.example/links/x", /not a Cashfree link/],
    ["https://cashfree.com.evil.in/links/x", /not a Cashfree link/],
    ["https://evilcashfree.com/links/x", /not a Cashfree link/],
    ["https://payments-test.cashfree.com/links/x", /TEST link/],
    ["https://sandbox.cashfree.com/links/x", /TEST link/],
    ["https://merchant.cashfree.com/merchants/pg/payment-links/x", /dashboard/],
    ["https://payments.cashfree.com/forms?code=thyroid-session", /payment FORM/],
    ["https://payments.cashfree.com/forms/thyroid-session", /payment FORM/],
    ["https://payments.cashfree.com/", /home page/],
    ["https://user:pw@payments.cashfree.com/links/x", /login or a port/],
    ["https://payments.cashfree.com:8443/links/x", /login or a port/],
    [`https://payments.cashfree.com/links/${"x".repeat(600)}`, /too long/],
  ];
  for (const [url, why] of cases) {
    const problem = paymentLinkProblem(url);
    assert.ok(problem, `accepted: ${url}`);
    assert.match(problem, why, url);
    assert.doesNotMatch(problem, /—/, "no em dashes in what he reads");
  }
});

test("payLinkFor gives the link for exactly her price, and never a neighbour's", () => {
  const links = { "20000": LINK_20, "25000": SHORT_25 };
  assert.equal(payLinkFor(20000, links), LINK_20);
  assert.equal(payLinkFor(25000, links), SHORT_25);
  for (const n of [15000, 30000, 19999, 20001, 20000.5, 22500, 0, Number.NaN, 299]) assert.equal(payLinkFor(n, links), null, String(n));
  assert.equal(payLinkFor(20000, null), null);
  assert.equal(payLinkFor(20000, undefined), null);
  // A bad value that somehow got stored never reaches a message.
  assert.equal(payLinkFor(20000, { "20000": "https://payments.cashfree.com/forms?code=x" }), null);
  assert.equal(payLinkFor(20000, { "20000": "javascript:alert(1)" }), null);
});

test("no database: nothing to read, and saving says why instead of pretending", async () => {
  assert.deepEqual(await readPaymentLinks(null), {});
  assert.deepEqual(await readPaymentLinks(), {});
  assert.deepEqual(await loadPaymentLinks(null), { links: {}, stored: false });
  await assert.rejects(setPaymentLink(20000, LINK_20, null), (e: unknown) => e instanceof PaymentLinkError && e.code === "no_database");
});

test("saved under paylink:<amount>, read back, replaced, and cleared by an empty value", async () => {
  const d = fakeD1();
  assert.deepEqual(await readPaymentLinks(d.db), {});
  await setPaymentLink(20000, `  ${LINK_20}  `, d.db);
  await setPaymentLink(25000, SHORT_25, d.db);
  assert.deepEqual(await readPaymentLinks(d.db), { "20000": LINK_20, "25000": SHORT_25 });
  assert.deepEqual(d.rows(), [
    { key: `${PAYLINK_PREFIX}20000`, value: LINK_20 },
    { key: `${PAYLINK_PREFIX}25000`, value: SHORT_25 },
  ]);
  const next = "https://payments.cashfree.com/links/o9z8y7";
  await setPaymentLink(20000, next, d.db);
  assert.equal((await readPaymentLinks(d.db))["20000"], next);
  await setPaymentLink(20000, "", d.db);
  await setPaymentLink(25000, "   ", d.db);
  assert.deepEqual(await readPaymentLinks(d.db), {});
  assert.deepEqual(d.rows(), []);
});

test("an unknown price or a bad link is refused before anything is written", async () => {
  const d = fakeD1();
  await assert.rejects(setPaymentLink(22500 as PriceTier, LINK_20, d.db), (e: unknown) => e instanceof PaymentLinkError && e.code === "unknown_price");
  await assert.rejects(
    setPaymentLink(20000, "https://payments.cashfree.com/forms?code=thyroid-session", d.db),
    (e: unknown) => e instanceof PaymentLinkError && e.code === "invalid_link" && /payment FORM/.test(e.message),
  );
  assert.deepEqual(await readPaymentLinks(d.db), {});
});

test("a stored row that fails the check, or a stray key, is never handed out", async () => {
  const d = fakeD1();
  await readPaymentLinks(d.db); // makes the table
  const put = d.sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, 1)");
  put.run("paylink:20000", "https://payments-test.cashfree.com/links/x");
  put.run("paylink:22500", LINK_20);
  put.run("paylink:15000", LINK_20);
  assert.deepEqual(await readPaymentLinks(d.db), { "15000": LINK_20 });
});

test("a read that fails is 'no links' for the drafts, and an error for the admin card", async () => {
  const broken = fakeD1({ failReads: true });
  await setPaymentLink(20000, LINK_20, broken.db);
  assert.deepEqual(await readPaymentLinks(broken.db), {});
  await assert.rejects(loadPaymentLinks(broken.db), /Network connection lost/);
});

test("links and switches live side by side in one settings table without touching each other", async () => {
  const d = fakeD1();
  await setPaymentLink(30000, LINK_20, d.db);
  await setFlag("thank_you_auto", true, d.db);
  assert.equal((await readFlags(d.db)).thank_you_auto, true);
  assert.deepEqual(await readPaymentLinks(d.db), { "30000": LINK_20 });
});

test("the card draws its rows from the server's list and imports types only", () => {
  const card = readFileSync(new URL("../app/admin/PaymentLinksCard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(card, /import\s+\{[^}]*\}\s+from\s+"@\/lib\/payment-links"/, "the client may import types only");
  assert.match(card, /tiers\.map\(/);
  assert.match(card, /fontSize: 16/, "16px input: iOS zooms into anything smaller");
  const route = readFileSync(new URL("../app/api/admin/payment-links/route.ts", import.meta.url), "utf8");
  assert.match(route, /tiers/);
  // Nothing here charges anyone or talks to Meta: no import of the guarded payment files or a Meta sender.
  const lib = readFileSync(new URL("./payment-links.ts", import.meta.url), "utf8");
  for (const src of [route, lib, card]) {
    const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
    assert.doesNotMatch(imports, /create-cashfree-order|lib\/pricing|server-tracking|cashfree-webhook/);
  }
});
