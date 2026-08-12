/**
 * Which redirectTarget the Cashfree JS SDK checkout should use.
 *
 * "_modal" (iframe on our page) suppresses UPI *app intent* on phones —
 * deep links (gpay://, phonepe://, paytm://) can't launch reliably from an
 * embedded frame, so Cashfree falls back to QR + manual UPI-ID entry. Buyers
 * told us typing a UPI ID loses them.
 *
 * "_self" (full-page redirect to the Cashfree hosted checkout) lets Cashfree
 * render its native "Pay with GPay / PhonePe / Paytm" buttons on mobile,
 * which open the UPI app directly. Return journey: Cashfree → return_url
 * (/payment-success) → /session-booked, with leadId carried through the
 * NATIVE_BOOKING_KEY localStorage bridge written before checkout opens.
 *
 * Desktop keeps the modal: QR scan is the correct UX there, and staying on
 * the page preserves funnel state.
 */
export function checkoutRedirectTarget(): "_self" | "_modal" {
  if (typeof window === "undefined") return "_modal";
  const ua = navigator.userAgent || "";
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  // iPadOS Safari masquerades as Macintosh — coarse pointer catches it.
  let coarse = false;
  try {
    coarse = window.matchMedia("(pointer: coarse)").matches;
  } catch {
    /* very old browsers — UA check alone decides */
  }
  return mobileUA || coarse ? "_self" : "_modal";
}
