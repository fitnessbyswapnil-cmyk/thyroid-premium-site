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
