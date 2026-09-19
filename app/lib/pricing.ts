/**
 * Single source of truth for the consultation session price.
 *
 * Used by BOTH the actual charge (create-cashfree-order) and the reported Meta
 * value, so the charged amount and the value sent to Meta can never drift
 * apart. Change it here only.
 *
 * NOTE: the paid event is `MicroPurchase`, not `Purchase` — since 12-Sep-2026
 * `Purchase` means the real programme sale (lib/meta-conversion.ts), and this
 * Rs 299 fee is its own event so it cannot drown the revenue number. The
 * cashfree-webhook leg reports the real `payment.amount` (dynamic, itself
 * driven by this constant), so both legs stay in agreement.
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

/**
 * The only currency this business charges or reports in.
 *
 * It was a bare "INR" literal in a dozen call sites. Meta rejects a `value`
 * with no `currency` and warns on every event missing the pair, so the two now
 * travel together from one place.
 */
export const CURRENCY = "INR";

/**
 * What a Lead is worth in REPORTED revenue: nothing, because nothing has been
 * paid at that point.
 *
 * Meta's data-quality check wants a value/currency pair on every Lead and
 * QuizComplete, and the tempting answer was the computed expected value
 * (Rs 55,495 of real revenue over 353 leads is about Rs 157 each). That number
 * is a forecast, not money received, and this codebase reports money received —
 * FREE_CALL_VALUE is 0 and WEBINAR_REGISTRATION_VALUE_INR is 0 for the same
 * reason. Reporting 157 would tell Meta every quiz completion earned cash that
 * does not exist, which is the exact mistake FREE_CALL_VALUE exists to undo.
 *
 * QuizComplete shares this: it is a lead-stage event on the same unpaid visitor.
 * When the Rs 299 is actually taken, MicroPurchase reports the real amount.
 */
export const LEAD_VALUE = 0;
