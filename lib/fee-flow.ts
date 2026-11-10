/**
 * lib/fee-flow.ts — is this Cashfree payment the ₹299 consultation fee?
 *
 * The Cashfree webhook was built when the only thing anyone paid for was the
 * ₹299 consultation, so every payment it saw went down the fee flow: a
 * MicroPurchase to Meta for the paid amount, and her payment_receipt_v2, the
 * "book your slot" receipt. Since Nov 2026 the owner also takes programme
 * payments (₹15,000–₹30,000) through Cashfree payment links. Down that flow a
 * ₹20,000 programme payment would tell Meta it was a ₹20,000 consultation fee,
 * poisoning the fee event the ads learn from, and would send a paying client
 * the "book your slot" receipt.
 *
 * The line between the two is lib/metrics' own, so the webhook and every
 * number on the dashboard can never disagree about what a payment was:
 * at or under CONSULT_MAX_AMOUNT (₹299; the ₹1 test-mode charge too) is the
 * fee. Anything else — a programme payment or an instalment — is recorded
 * (sheet and ledger, which is how lib/metrics counts it) and goes no further.
 * The programme sale reaches Meta as Purchase when he marks it in Today
 * (lib/meta-conversion), exactly as before; nothing here adds an event.
 */
import { paymentKind } from "./metrics.ts";

export function isConsultFee(amount: number): boolean {
  return paymentKind(Number.isFinite(amount) ? amount : null) === "consult";
}
