/**
 * lib/wa-migrate.ts — pure helpers for moving a phone number between WABAs.
 *
 * WHY THIS EXISTS
 * WABA 864737596644382 can never hold its own payment method: a BSP credit line
 * billed to AiSensy is allocated to it, and Meta's own tooltip says so outright
 * ("You can't add a payment method because you're using a shared credit line").
 * Deleting the BSP's onboarded number did not release it. The remaining path
 * under our control is to move +91 79784 60386 onto a WABA that already has a
 * working card, which turns template sending back on.
 *
 * Everything here is pure so the parts that are easy to get wrong — and
 * expensive to get wrong, since the number carries a GREEN quality rating and
 * an approved display name — are unit-tested rather than discovered in
 * production against a live asset.
 */

/** Meta needs the country code and the national part as SEPARATE fields; it
 *  rejects a single E.164 string. Splitting one the user pasted is therefore
 *  unavoidable, and getting it wrong targets the wrong number. */
export type Split = { cc: string; national: string };

/**
 * Split a pasted number into Meta's { cc, national } pair.
 *
 * THE TRAP: an Indian mobile can itself begin "91" (9178460386 is a real,
 * valid 10-digit number). Blindly stripping a leading country code would turn
 * it into "78460386" and migrate something that does not exist — or worse,
 * something that does. So a 10-digit input is always treated as already
 * national and is never stripped; only a longer string can carry a country
 * code. Anything ambiguous is rejected rather than guessed.
 */
export function splitPhone(raw: string, cc: string): Split | { error: string } {
  // "00" is the international dialling prefix people paste instead of "+".
  // No national number begins with it, so removing it is unambiguous — and
  // without this, "0091 79784 60386" fails the country-code test and is
  // rejected outright.
  const digits = String(raw ?? "").replace(/\D/g, "").replace(/^00/, "");
  const ccDigits = String(cc ?? "").replace(/\D/g, "");
  if (!ccDigits) return { error: "country code missing" };
  if (!digits) return { error: "phone number missing" };

  // 10 digits is a complete national number in India and most of the world we
  // sell into — never strip from it, however it happens to start.
  const national =
    digits.length > 10 && digits.startsWith(ccDigits) ? digits.slice(ccDigits.length) : digits;

  if (national.length < 6 || national.length > 12) {
    return { error: `phone number has ${national.length} digits after removing the country code` };
  }
  return { cc: ccDigits, national };
}

/** Meta's two-step verification PIN is exactly six digits. Sending a wrong
 *  shape wastes an attempt against a rate limit that locks the number for
 *  hours, so it is checked before the call is made. */
export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(String(pin ?? ""));
}

/** Whatever happens, this number must never be the thing we delete, deregister
 *  or migrate away by accident. Used to make the destination check explicit. */
export function sameWaba(a: string, b: string): boolean {
  return String(a ?? "").replace(/\D/g, "") === String(b ?? "").replace(/\D/g, "");
}
