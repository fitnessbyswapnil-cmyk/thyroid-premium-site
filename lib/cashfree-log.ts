/**
 * lib/cashfree-log.ts — PURE. What /api/cashfree-webhook may put in a log line.
 *
 * Worker logs are not a place for her phone number, and a Cashfree reference
 * can carry it: when a Payment Form payload has no payment id, the reference
 * is minted as `CFForm_<formId>_<customer_phone>` (lib/cashfree-payload). The
 * route also logs whole payloads whose shape it does not recognise, because
 * the Payment Form shape is still unobserved in production, and those carry
 * customer_name, customer_email and customer_phone.
 *
 *  - refForLog: a reference with no phone number in it is logged as it is, so
 *    it can still be looked up in Cashfree and in the D1 ledger. One that
 *    carries a number becomes `ref#<10 hex>`, a stable hash, so the lines for
 *    one payment can still be matched to each other.
 *  - redactForLog: the payload with its SHAPE kept (every key, nesting, ids,
 *    statuses, amounts) and personal values replaced by `[redacted]`.
 *  - maskText: phone numbers and email addresses in free text.
 */
import { createHash } from "node:crypto";
import { containsPhoneNumber } from "./ledger.ts";

// lib/ledger's PHONE_IN_TEXT, global, so every occurrence is replaced.
const PHONE_ANYWHERE = /(^|\D)(?:91|0)?[6-9]\d{9}(?!\d)/g;
const EMAIL_ANYWHERE = /[^\s@"'<>(){}[\],;:]+@[^\s@"'<>(){}[\],;:]+\.[a-z]{2,}/gi;

export function refForLog(ref: string): string {
  const s = String(ref ?? "");
  if (!containsPhoneNumber(s)) return s;
  return `ref#${createHash("sha256").update(s).digest("hex").slice(0, 10)}`;
}

export function maskText(s: string): string {
  return String(s ?? "")
    .replace(PHONE_ANYWHERE, "$1[phone]")
    .replace(EMAIL_ANYWHERE, "[email]");
}

/** Key words whose values are hers, whatever they hold. */
const PERSONAL_WORDS = new Set([
  "phone", "mobile", "email", "name", "address", "vpa", "upi", "card",
  "account", "ifsc", "bank", "ip", "pan", "dob",
]);

function isPersonalKey(key: string): boolean {
  return String(key ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((w) => PERSONAL_WORDS.has(w));
}

export function redactForLog(value: unknown, key = "", depth = 0): unknown {
  if (depth > 8) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redactForLog(v, key, depth + 1));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, redactForLog(v, k, depth + 1)]),
    );
  }
  if (typeof value === "string") {
    if (!value) return value;
    if (isPersonalKey(key)) return "[redacted]";
    const masked = maskText(value);
    return masked.length > 120 ? `${masked.slice(0, 120)}…` : masked;
  }
  if (typeof value === "number" && (isPersonalKey(key) || containsPhoneNumber(String(value)))) {
    return "[redacted]";
  }
  return value;
}
