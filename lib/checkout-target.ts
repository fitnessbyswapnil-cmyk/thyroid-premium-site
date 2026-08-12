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
 * FAIL TOWARDS "_self". The two mistakes are not equal: sending a desktop
 * buyer to a full page instead of a modal costs a little polish, while
 * trapping a phone buyer in the modal costs the sale — she gets a QR she
 * cannot scan (the code is ON the phone she'd scan with) and a UPI-ID field
 * she has to type by hand. So "_modal" is used ONLY when every signal agrees
 * this is a real desktop.
 *
 * This also covers a phone with "Desktop site" enabled, which reports a
 * desktop user-agent and a ~980px viewport: the pointer is still coarse, so
 * she correctly keeps the app-intent path.
 */

export type PointerEnv = {
  userAgent: string;
  coarsePointer: boolean;
  viewportWidth: number;
};

/** Pure decision — unit-tested in checkout-target.test.ts. */
export function pickRedirectTarget(env: PointerEnv): "_self" | "_modal" {
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(env.userAgent || "");
  const looksDesktop =
    !mobileUA &&
    !env.coarsePointer &&
    // A phone in desktop mode lays out at roughly 980 CSS px; real desktops
    // are wider. Touch laptops fall to "_self", which still works fine there.
    env.viewportWidth >= 1024;
  return looksDesktop ? "_modal" : "_self";
}

export function checkoutRedirectTarget(): "_self" | "_modal" {
  // SSR has no device signals; "_self" is the safe default under this policy.
  if (typeof window === "undefined") return "_self";
  let coarsePointer = false;
  try {
    coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  } catch {
    /* very old browsers — UA + width decide */
  }
  return pickRedirectTarget({
    userAgent: navigator.userAgent || "",
    coarsePointer,
    viewportWidth: window.innerWidth || 0,
  });
}
