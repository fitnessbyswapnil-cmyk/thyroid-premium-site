/**
 * Single source of truth for the consultation session price.
 *
 * Used by BOTH the actual charge (create-cashfree-order) and the reported Meta
 * value (analytics PRODUCT + the /api/events Purchase leg), so the charged
 * amount and the value sent to Meta can never drift apart. Change it here only.
 *
 * NOTE: the webhook Purchase reports the real `payment.payment_amount` from
 * Cashfree (dynamic) — which is itself driven by this constant — so all Purchase
 * legs stay in agreement.
 */
export const SESSION_PRICE = 299;

/**
 * What a booked consultation is worth in REPORTED revenue.
 *
 * The 1-1 thyroid fat loss call is free, so every Schedule must report zero.
 * It previously reported SESSION_PRICE, which told Meta each free booking had
 * earned Rs 299 that never existed — inflating ROAS on the single event the
 * ads optimise for, and poisoning any value-based bidding.
 *
 * SESSION_PRICE stays as-is for the paid Cashfree path: its page copy and the
 * real charged amount. That path is currently dormant behind the middleware
 * redirect, but its numbers must stay honest if it is ever switched back on.
 */
export const FREE_CALL_VALUE = 0;
