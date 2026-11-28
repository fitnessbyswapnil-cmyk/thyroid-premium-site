/**
 * /api/cashfree-webhook after D6 (owner decision, 28-Nov-2026): the
 * consultation is free, so every Cashfree payment is a programme payment. The
 * route records it (her Leads row + the D1 payments ledger) and stops: nothing
 * to Meta, nothing on WhatsApp.
 *
 * The route itself needs Sheets and D1 to run, so its contract is pinned by
 * source-shape assertions, as lib/free-call-tracking.test.ts does for the
 * cold /decode path. The failure they guard against is a later edit quietly
 * reconnecting a Meta send or a WhatsApp send to a payment. The header writer
 * and the dashboard's reading of what the route writes are tested as
 * behaviour.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { headerCellWrites } from "./header-cells.ts";
import { planPaymentColumns } from "./lead-sheet.ts";
import { summarize, windowFor, type Dataset, type LeadRecord } from "./metrics.ts";

const SOURCE = readFileSync(new URL("../app/api/cashfree-webhook/route.ts", import.meta.url), "utf8");
// Comments explain what the route used to send; only code counts here.
const CODE = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");
const IMPORTS = (CODE.match(/^import[\s\S]*?from\s+['"][^'"]+['"]/gm) ?? []).join("\n");

const PAID_COLS = ["Paid", "Paid Amount", "Paid At", "Payment Ref"];

// ── Nothing leaves for Meta or WhatsApp ──────────────────────────────────────

test("no Meta event is sent from the webhook, under any name", () => {
  assert.doesNotMatch(IMPORTS, /sendCAPIEvent|buildUserData|getClientIp|getUserAgent/, "no CAPI helpers imported");
  assert.doesNotMatch(IMPORTS, /meta-conversion|lib\/events|fee-flow/);
  assert.match(IMPORTS, /import \{ PLACEHOLDER_EMAIL \} from '@\/lib\/server-tracking'/, "only the placeholder email constant, for row matching");
  assert.doesNotMatch(CODE, /sendCAPIEvent|MicroPurchase|['"]Purchase['"]|Purchase_|thyroid_session_fee/);
});

test("no WhatsApp goes to her from the webhook", () => {
  assert.doesNotMatch(IMPORTS, /lib\/whatsapp/);
  assert.doesNotMatch(CODE, /sendBookingConfirmation|sendWhatsApp|payment_receipt|payment_confirmed|booking_confirmation/);
});

test("there is no amount test: a ₹1, ₹299, ₹5,000 or ₹20,000 payment takes the same path", () => {
  assert.doesNotMatch(CODE, /isConsultFee|paymentKind|CONSULT_MAX_AMOUNT|PROGRAMME_MIN_AMOUNT|SESSION_PRICE/);
  assert.doesNotMatch(CODE, /payment\.amount\s*[<>]=?|[<>]=?\s*payment\.amount/, "no branch on the amount");
});

// ── What stays ────────────────────────────────────────────────────────────────

test("signature verification still rejects a bad signature with 401", () => {
  assert.match(CODE, /if \(!verifyCashfreeSignature\(rawBody, timestamp, signature\)\) \{/);
  assert.match(CODE, /\{ error: 'Invalid signature' \}, \{ status: 401 \}/);
});

test("a replayed payment is still caught: in memory, then by the sheet's Paid + Payment Ref", () => {
  assert.match(CODE, /processedOrders\.has\(payment\.refId\)/);
  assert.match(CODE, /return 'already_paid'/);
  assert.match(CODE, /if \(sheetResult === 'already_paid'\) \{[\s\S]*?duplicate: true/);
  // Two genuine payments on one lead are two references: the second is still recorded.
  assert.match(CODE, /\(!storedRef \|\| storedRef === data\.refId\)/);
});

test("the ledger write still happens, after the response, for duplicates too", () => {
  const ledger = CODE.indexOf("await recordPayment(ledgerDb, ledgerRow)");
  const afterCall = CODE.lastIndexOf("after(async () => {", ledger);
  const duplicateReturn = CODE.indexOf("if (sheetResult === 'already_paid')");
  assert.ok(ledger > 0 && afterCall > 0 && ledger - afterCall < 200, "recordPayment runs inside after()");
  assert.ok(afterCall < duplicateReturn, "scheduled before the duplicate early return");
  assert.match(CODE, /status: sheetResult === 'already_paid' \? \('duplicate' as const\) : \('paid' as const\)/);
});

// ── Row 1 is never rewritten wholesale ───────────────────────────────────────

test("the webhook writes no header row wholesale: 1:1 is only ever read", () => {
  assert.doesNotMatch(CODE, /values\.update\(/, "every write is a batchUpdate of single cells or an append");
  const wholeRow = CODE.match(/!1:1/g) ?? [];
  assert.equal(wholeRow.length, 1);
  assert.match(CODE, /values\.get\(\{ spreadsheetId: sheetId, range: `\$\{LEADS_SHEET_NAME\}!1:1` \}\)/);
  assert.match(CODE, /ensureGridColumns\(sheets, sheetId, LEADS_SHEET_NAME, widest\)[\s\S]{0,200}headerCellWrites\(LEADS_SHEET_NAME, plan\.newHeaders\)/,
    "the grid is widened before the header cells are written");
});

test("a missing payment header is appended as its own cell past the last column", () => {
  // The live Leads tab is 93 wide (A..CO): a new header lands at CP1 and nowhere else.
  const header = Array.from({ length: 93 }, (_, i) => `Col ${i}`);
  header[59] = "Paid At";
  header[60] = "Paid";
  header[61] = "Paid Amount";
  const plan = planPaymentColumns(header, PAID_COLS);
  assert.deepEqual(plan.newHeaders, [{ index: 93, title: "Payment Ref" }]);
  assert.deepEqual(headerCellWrites("Leads", plan.newHeaders), [{ range: "Leads!CP1", values: [["Payment Ref"]] }]);
});

test("every header present: nothing is written to row 1 at all", () => {
  const header = Array.from({ length: 93 }, (_, i) => `Col ${i}`);
  PAID_COLS.forEach((t, k) => { header[59 + k] = t; });
  const plan = planPaymentColumns(header, PAID_COLS);
  assert.deepEqual(plan.newHeaders, []);
  assert.deepEqual(headerCellWrites("Leads", plan.newHeaders), []);
});

test("several missing headers are several single cells, each at its own column", () => {
  const header = Array.from({ length: 25 }, (_, i) => `Col ${i}`); // A..Y
  const plan = planPaymentColumns(header, PAID_COLS);
  const writes = headerCellWrites("Leads", plan.newHeaders);
  assert.deepEqual(writes.map((w) => w.range), ["Leads!Z1", "Leads!AA1", "Leads!AB1", "Leads!AC1"]);
  assert.deepEqual(writes.map((w) => w.values), PAID_COLS.map((t) => [[t]]));
  for (const w of writes) assert.match(w.range, /^Leads![A-Z]+1$/, "one cell, never a row range");
});

// ── How the dashboard reads what the webhook writes ──────────────────────────
// The webhook writes Paid = Y and Paid Amount for every payment alike.
// lib/metrics (owner's definitions, 14-Sep-2026) classifies by amount, and
// this PR does not change it.

const NOW = Date.parse("2026-12-01T12:00:00Z");
const DAY = 86_400_000;
let rowN = 2;
const paidRow = (phone: string, amount: number): LeadRecord => ({
  row: rowN++, createdAt: new Date(NOW - 3 * DAY).toISOString(), name: "Client", phone, email: "",
  paid: true, paidAmount: amount, paidAt: new Date(NOW - DAY).toISOString(),
  closedAmt: null, closedAt: "", programmeValue: null, programmeCollected: null,
});

test("dashboard: ₹15,000+ is programme revenue; ₹300–14,999 is other; ₹299 and under is the fee line, never revenue", () => {
  const data: Dataset = {
    leads: [
      paidRow("9999900001", 20000),
      paidRow("9999900002", 15000),
      paidRow("9999900003", 5000),
      paidRow("9999900004", 299),
      paidRow("9999900005", 1),
    ],
    bookings: [],
    calls: [],
  };
  const s = summarize(data, windowFor(14, NOW), NOW);
  assert.equal(s.won, 2);
  assert.equal(s.revenue, 35000, "programme payments only");
  assert.deepEqual(s.otherPayments, { count: 1, amount: 5000 }, "a ₹5,000 form payment waits for the sale to be marked in Today");
  assert.deepEqual(s.consultFees, { count: 2, amount: 300 }, "a tiny payment stays off revenue and off won");
});
