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
import { headerAppendRefusal, headerCellWrites, LEADS_MIN_WIDTH } from "./header-cells.ts";
import { planPaymentColumns } from "./lead-sheet.ts";
import { summarize, windowFor, type Dataset, type LeadRecord } from "./metrics.ts";
import { parseAmountCell, planPaidRow, type StoredPayment } from "./payment-row.ts";

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
  assert.match(CODE, /if \(sheetResult === 'already_paid'\) \{[\s\S]*?duplicate: true/);
  // The row decision is lib/payment-row's (behaviour in payment-row.test.ts):
  // a duplicate returns before any write, a new payment writes her total.
  assert.match(CODE, /const rowPlan = planPaidRow\(/);
  assert.match(CODE, /if \(rowPlan\.action === 'duplicate'\) \{[\s\S]{0,300}?return 'already_paid'/);
  assert.match(CODE, /paidCells\['Paid Amount'\] = String\(rowPlan\.paidAmount\)/);
  assert.match(CODE, /paidCells\['Payment Ref'\] = refCellValue\(rowPlan\.paymentRef\)/);
  assert.match(CODE, /'Payment Ref': refCellValue\(data\.refId\)/, "a fresh or orphan row keeps a numeric ref as text too");
  const decide = CODE.indexOf("const rowPlan = planPaidRow(");
  const write = CODE.indexOf("valueInputOption: 'USER_ENTERED'", decide);
  assert.ok(decide > 0 && write > decide, "the decision is made before the row is written");
  for (const title of PAID_COLS) {
    assert.ok(CODE.includes(`stored('${title}')`), `planPaidRow reads ${title} from her row`);
  }
  assert.match(CODE, /status: existingRow\[STATUS_COLUMN\]/, "and Status, which holds the latest single amount");
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
  const narrow = CODE.indexOf("headerAppendRefusal({ headerLength: header.length, minWidth: LEADS_MIN_WIDTH, newHeaders: plan.newHeaders })");
  const widen = CODE.indexOf("ensureGridColumns(sheets, sheetId, LEADS_SHEET_NAME, widest)");
  const occupied = CODE.indexOf("targetColumns: plan.newHeaders.map(", widen);
  const write = CODE.indexOf("headerCellWrites(LEADS_SHEET_NAME, plan.newHeaders)");
  assert.ok(narrow > 0 && widen > narrow, "a too-narrow header read is refused before anything is touched");
  assert.ok(occupied > widen && write > occupied, "the grid is widened, the target columns checked, then the header cells written");
  assert.match(CODE, /if \(tooNarrow\) return refuse\(tooNarrow\)/);
  assert.match(CODE, /if \(occupied\) return refuse\(occupied\)/);
  assert.match(CODE, /const refuse = \(why: string\): PaymentRecordResult => \{[\s\S]*?return 'failed'/);
});

// ── A short header read is refused, not trusted ─────────────────────────────

const live97 = () => {
  // The Leads tab on 28-Nov: 97 wide (A..CS), payment columns at BB, BC, BH, BI.
  const h = Array.from({ length: 97 }, (_, i) => `Col ${i}`);
  h[53] = "Paid"; h[54] = "Paid Amount"; h[59] = "Paid At"; h[60] = "Payment Ref";
  return h;
};

test("an empty header read never puts payment headers on A1..D1", () => {
  const plan = planPaymentColumns([], PAID_COLS);
  assert.deepEqual(plan.newHeaders.map((h) => h.index), [0, 1, 2, 3], "what an empty read would plan");
  const why = headerAppendRefusal({ headerLength: 0, minWidth: LEADS_MIN_WIDTH, newHeaders: plan.newHeaders });
  assert.ok(why && /0 columns wide/.test(why), "refused before any IO");
});

test("a read cut short anywhere below the tab's width is refused", () => {
  // Cut before the payment headers: they look missing and would be appended mid-sheet.
  for (const length of [1, 19, 54, 55, 60]) {
    const plan = planPaymentColumns(live97().slice(0, length), PAID_COLS);
    assert.ok(plan.newHeaders.length > 0, `a ${length}-column read loses a payment header`);
    assert.equal(plan.newHeaders[0].index, length, "it would land on a live column");
    assert.ok(headerAppendRefusal({ headerLength: length, minWidth: LEADS_MIN_WIDTH, newHeaders: plan.newHeaders }), `${length} columns: refused`);
  }
  // With a header genuinely missing, any read narrower than the tab is refused too.
  const renamed = live97();
  renamed[60] = "Old Ref";
  for (const length of [61, 80, LEADS_MIN_WIDTH - 1]) {
    const plan = planPaymentColumns(renamed.slice(0, length), PAID_COLS);
    assert.ok(headerAppendRefusal({ headerLength: length, minWidth: LEADS_MIN_WIDTH, newHeaders: plan.newHeaders }), `${length} columns: refused`);
  }
});

test("a full read with every payment header present needs no append and is never refused", () => {
  const plan = planPaymentColumns(live97(), PAID_COLS);
  assert.deepEqual(plan.newHeaders, []);
  assert.equal(headerAppendRefusal({ headerLength: 0, minWidth: LEADS_MIN_WIDTH, newHeaders: plan.newHeaders }), null);
});

test("a genuinely missing header past a full-width read is allowed only onto an empty column", () => {
  const h = live97();
  h[60] = "Old Ref"; // Payment Ref renamed away
  const plan = planPaymentColumns(h, PAID_COLS);
  assert.deepEqual(plan.newHeaders, [{ index: 97, title: "Payment Ref" }]);
  assert.equal(headerAppendRefusal({ headerLength: 97, minWidth: LEADS_MIN_WIDTH, newHeaders: plan.newHeaders }), null);
  assert.equal(
    headerAppendRefusal({ headerLength: 97, minWidth: LEADS_MIN_WIDTH, newHeaders: plan.newHeaders, targetColumns: [[]] }),
    null, "CT is empty: write CT1",
  );
  const why = headerAppendRefusal({
    headerLength: 97, minWidth: LEADS_MIN_WIDTH, newHeaders: plan.newHeaders,
    targetColumns: [["", "", "kept by someone"]],
  });
  assert.ok(why && /CT already holds data/.test(why), "a blank-titled column with data is not taken over");
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

// ── Nothing personal in a log line ───────────────────────────────────────────

test("every reference in a log line goes through refForLog", () => {
  const interpolations = CODE.match(/\$\{[^}]*\}/g) ?? [];
  // A payment's reference or lead id, or the stored Payment Ref list (not
  // MATCH_COLUMNS.leadId, which is a column index).
  const refs = interpolations.filter((s) =>
    /\b(data|payment|ledgerRow)\.(refId|leadId|orderRef)\b|stored\('Payment Ref'\)|\$\{(refId|leadId|storedRef)\b/.test(s));
  assert.ok(refs.length >= 8, `the route logs references on several lines (${refs.length})`);
  for (const s of refs) assert.match(s, /^\$\{refForLog\(/, `${s} is logged raw`);
});

test("a logged payload is redacted, and the raw body only ever masked", () => {
  assert.doesNotMatch(CODE, /JSON\.stringify\(body\)/, "no raw payload in a log");
  assert.equal((CODE.match(/JSON\.stringify\(redactForLog\(body\)\)/g) ?? []).length, 2);
  for (const use of CODE.match(/rawBody[.\w]*\([^)]*\)|rawBody\.\w+/g) ?? []) {
    assert.ok(/^rawBody\.(length|slice)/.test(use), `rawBody used as ${use}`);
  }
  assert.match(CODE, /maskText\(rawBody\.slice\(0, 1000\)\)/);
});

// ── How the dashboard reads what the webhook writes ──────────────────────────
// The webhook writes Paid = Y and her running total in Paid Amount
// (lib/payment-row). lib/metrics (owner's definitions, 14-Sep-2026) classifies
// that total by amount, and this PR does not change the classification.

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
  assert.deepEqual(s.otherPayments, { count: 1, amount: 5000 }, "a lone ₹5,000 form payment waits for her total or a marked sale (open for the owner)");
  assert.deepEqual(s.consultFees, { count: 2, amount: 300 }, "a tiny payment stays off revenue and off won");
});

// One woman's row, run through the webhook's decision payment by payment, the
// way recordPaymentInSheet writes it back. Returns what lib/metrics reads.
const MIN = 60_000;
function rowAfter(payments: { ref: string; amount: number; atMs: number }[], start?: StoredPayment): LeadRecord {
  let stored: StoredPayment = start ?? { paid: "", ref: "", amount: "", at: "", status: "" };
  for (const p of payments) {
    const plan = planPaidRow(stored, { refId: p.ref, amount: p.amount }, p.atMs);
    if (plan.action === "duplicate") continue;
    stored = {
      paid: "Y", ref: plan.paymentRef, amount: String(plan.paidAmount),
      at: new Date(p.atMs).toISOString(), status: `payment_received|${p.amount}INR`,
    };
  }
  return {
    row: 2, createdAt: new Date(NOW - 3 * DAY).toISOString(), name: "Client", phone: "9999900001", email: "",
    paid: stored.paid === "Y", paidAmount: parseAmountCell(stored.amount), paidAt: stored.at,
    closedAmt: null, closedAt: "", programmeValue: null, programmeCollected: null,
  };
}
const money = (r: LeadRecord) => {
  const s = summarize({ leads: [r], bookings: [], calls: [] }, windowFor(14, NOW), NOW);
  return { won: s.won, revenue: s.revenue, other: s.otherPayments.amount, fees: s.consultFees.amount };
};
const T0 = NOW - DAY;

test("C8: ₹15,000 then ₹5,000 is one ₹20,000 programme payment and one win", () => {
  const r = rowAfter([
    { ref: "CFPay_PersonalizThyroid_Fat_Lo_test1", amount: 15000, atMs: T0 },
    { ref: "CFPay_thyroid_test2", amount: 5000, atMs: T0 + 4 * MIN },
  ]);
  assert.equal(r.paidAmount, 20000);
  assert.deepEqual(money(r), { won: 1, revenue: 20000, other: 0, fees: 0 }, "the ₹15,000 no longer vanishes");
});

test("C8 the other way round: ₹5,000 then ₹15,000 is ₹20,000, not ₹15,000", () => {
  const first = rowAfter([{ ref: "CFPay_thyroid_test2", amount: 5000, atMs: T0 }]);
  assert.deepEqual(money(first), { won: 0, revenue: 0, other: 5000, fees: 0 }, "the part-payment alone (open for the owner)");
  const r = rowAfter([
    { ref: "CFPay_thyroid_test2", amount: 5000, atMs: T0 },
    { ref: "CFPay_PersonalizThyroid_Fat_Lo_test1", amount: 15000, atMs: T0 + DAY / 2 },
  ]);
  assert.deepEqual(money(r), { won: 1, revenue: 20000, other: 0, fees: 0 });
});

test("a replayed webhook, or the same payment on a second channel, is not counted twice", () => {
  const p1 = { ref: "CFPay_PersonalizThyroid_Fat_Lo_test1", amount: 15000, atMs: T0 };
  const p2 = { ref: "CFPay_thyroid_test2", amount: 5000, atMs: T0 + 4 * MIN };
  const replays = rowAfter([p1, p2, { ...p1, atMs: T0 + 9 * MIN }, { ...p2, atMs: T0 + DAY / 2 }]);
  assert.equal(replays.paidAmount, 20000, "same refs again: still ₹20,000");
  const twoChannels = rowAfter([p1, p2, { ref: "link_test2", amount: 5000, atMs: p2.atMs + 20_000 }]);
  assert.equal(twoChannels.paidAmount, 20000, "the ₹5,000 again under its link id, 20 s later: still ₹20,000");
});

test("two real ₹15,000 payments minutes apart are ₹30,000", () => {
  const r = rowAfter([
    { ref: "CFPay_PersonalizThyroid_Fat_Lo_test1", amount: 15000, atMs: T0 },
    { ref: "CFPay_PersonalizThyroid_Fat_Lo_test3", amount: 15000, atMs: T0 + 5 * MIN },
  ]);
  assert.deepEqual(money(r), { won: 1, revenue: 30000, other: 0, fees: 0 });
});

test("an old ₹299 consultation fee on her row is replaced by her programme payment, never added into revenue", () => {
  const feeRow: StoredPayment = { paid: "Y", ref: "thyroid_quiz_1786000000000_ab12cd_1786000000001", amount: "299", at: "2026-10-01T10:00:00.000Z", status: "payment_received|299INR" };
  const r = rowAfter([{ ref: "CFPay_PersonalizThyroid_Fat_Lo_test1", amount: 15000, atMs: T0 }], feeRow);
  assert.deepEqual(money(r), { won: 1, revenue: 15000, other: 0, fees: 0 });
});
