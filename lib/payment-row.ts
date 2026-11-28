/**
 * lib/payment-row.ts — PURE. What one Cashfree payment does to the Leads row
 * that may already hold an earlier one.
 *
 * Her row has one set of payment cells (Paid, Paid Amount, Paid At, Payment
 * Ref), and since D6 (28-Nov-2026) every Cashfree payment is programme money.
 * A programme fee is often paid in parts: on 23-Nov one client paid ₹15,000
 * and then ₹5,000, four minutes apart, through two hosted forms (C8). The
 * webhook used to overwrite Paid Amount with the later payment, so her row
 * read ₹5,000: "other payments" on the dashboard, no win, no revenue. The
 * ₹15,000 survived only in the D1 ledger, which no dashboard reads.
 *
 * So a new payment on an already-paid row ADDS to Paid Amount. The row holds
 * her running total; Paid At and Status describe the latest payment. lib/metrics
 * then reads ₹15,000 + ₹5,000 as ₹20,000 of programme revenue and one win, in
 * either order. (Dated by the latest payment: the whole total sits on the day
 * of her last instalment.)
 *
 * Payment Ref lists EVERY reference recorded on the row, oldest first,
 * comma-separated. With only the latest kept, a late replay of an earlier part
 * would look new and be added a second time. Nothing but this webhook reads
 * the column.
 *
 * Not added:
 *  - The same payment again. A reference already in Payment Ref: a replay. A
 *    paid row with no stored reference predates the Payment Ref column, and
 *    is treated as already holding this payment, as before.
 *  - The same payment on a second channel. The Payment Gateway, Payment Link
 *    and Payment Form webhooks are registered separately, so one payment can
 *    reach the route twice under two references (order_id, link_id), seconds
 *    apart. Another reference for the same amount within
 *    SECOND_CHANNEL_WINDOW_MS of the stored payment is taken as that copy.
 *    Two real payments take minutes: 23-Nov's were four apart.
 *  - A consultation fee. A stored amount of ₹299 or less (CONSULT_MAX_AMOUNT)
 *    is a fee from before D6, or a ₹1 test. Owner decision 1 keeps fees out of
 *    revenue, so it is replaced, not added to. So is an unreadable amount.
 *
 * The D1 ledger keeps one row per reference whatever happens here.
 */
import { CONSULT_MAX_AMOUNT } from "./metrics.ts";

/** A second-channel copy of one payment arrives within seconds of the first. */
export const SECOND_CHANNEL_WINDOW_MS = 2 * 60_000;

/** The row's payment cells as read back from the sheet (formatted strings). */
export type StoredPayment = {
  paid: string;
  ref: string;
  amount: string;
  at: string;
  /** Column Q: `payment_received|<amount><currency>` of the latest payment. */
  status: string;
};

export type IncomingPayment = { refId: string; amount: number };

export type PaidRowPlan =
  | { action: "duplicate"; reason: "same_ref" | "no_stored_ref" | "second_channel" }
  | {
      action: "write";
      paidAmount: number;
      /** The new Payment Ref cell. */
      paymentRef: string;
      reason: "first" | "added" | "replaces_fee" | "replaces_unreadable";
    };

/** Most references one row keeps. A programme is paid in two or three parts. */
export const MAX_REFS_PER_ROW = 20;

/** The references in a Payment Ref cell ("a, b" or a lone "a"). A leading
 *  apostrophe is the text marker refCellValue adds, never part of a ref. */
export function refsIn(cell: string): string[] {
  return String(cell ?? "").replace(/^'/, "").split(/[\s,]+/).filter(Boolean);
}

/**
 * The Payment Ref cell as written with USER_ENTERED. A reference that is all
 * digits (a Payment Form cf_payment_id) would be stored as a NUMBER and read
 * back formatted, so a replay of it would no longer match. The apostrophe
 * keeps it text, as it does when typed in the sheet.
 */
export function refCellValue(refs: string): string {
  return /^\d+$/.test(refs) ? `'${refs}` : refs;
}

/** "₹15,000.00", "15,000", "15000" → 15000; blank or junk → null. Read the
 *  way lib/metrics-source reads Paid Amount. */
export function parseAmountCell(v: string): number | null {
  const cleaned = String(v ?? "").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** The single amount the route wrote into Status for the latest payment. */
function latestAmount(status: string): number | null {
  const m = /^payment_received\|(\d+(?:\.\d+)?)/.exec(String(status ?? "").trim());
  return m ? Number(m[1]) : null;
}

const money = (n: number) => Math.round(n * 100) / 100;

export function planPaidRow(stored: StoredPayment, incoming: IncomingPayment, nowMs: number): PaidRowPlan {
  if (String(stored.paid ?? "").trim().toUpperCase() !== "Y") {
    return { action: "write", paidAmount: incoming.amount, paymentRef: incoming.refId, reason: "first" };
  }

  const refs = refsIn(stored.ref);
  if (refs.length === 0) return { action: "duplicate", reason: "no_stored_ref" };
  if (refs.includes(incoming.refId)) return { action: "duplicate", reason: "same_ref" };

  const at = Date.parse(String(stored.at ?? "").trim());
  if (
    Number.isFinite(at)
    && Math.abs(nowMs - at) <= SECOND_CHANNEL_WINDOW_MS
    && latestAmount(stored.status) === incoming.amount
  ) {
    return { action: "duplicate", reason: "second_channel" };
  }

  // Every reference stays listed, even one whose amount is replaced, so a
  // replay of it is still recognised.
  const paymentRef = [...refs, incoming.refId].slice(-MAX_REFS_PER_ROW).join(", ");
  const prior = parseAmountCell(stored.amount);
  if (prior === null || prior <= 0) {
    return { action: "write", paidAmount: incoming.amount, paymentRef, reason: "replaces_unreadable" };
  }
  if (prior <= CONSULT_MAX_AMOUNT) {
    return { action: "write", paidAmount: incoming.amount, paymentRef, reason: "replaces_fee" };
  }
  return { action: "write", paidAmount: money(prior + incoming.amount), paymentRef, reason: "added" };
}
