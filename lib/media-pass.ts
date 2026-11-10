/**
 * lib/media-pass.ts — short-lived passes for /api/admin/media.
 *
 * WHY THIS EXISTS
 * An <img src> and a target=_blank link cannot send the x-admin-key header, so
 * the inbox used to put ADMIN_DASH_KEY itself into every attachment URL
 * (`?k=`). Each image request then wrote the master key into Cloudflare's
 * request logs, the dev server's log and the browser's history.
 *
 * A pass is minted by an authenticated call (POST /api/admin/media-pass, which
 * does take the header) and carries only an expiry and an HMAC over it, signed
 * with MEDIA_URL_SECRET, a random secret that lives only on the worker. A pass
 * found in a log opens attachments until it expires and does nothing else: it
 * is not the key, it opens no other admin route, and it cannot be stretched,
 * because no pass is accepted for longer than MEDIA_PASS_TTL_S.
 *
 * Imports only node:crypto (nodejs_compat is on), like lib/turnstile.ts, so the
 * tests can load it under `node --test`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** How long a pass opens attachments. The client refreshes ten minutes early. */
export const MEDIA_PASS_TTL_S = 60 * 60;
/** Clock skew tolerated between the isolate that minted and the one checking. */
const SKEW_S = 120;

const payload = (exp: number) => `media-pass|v1|${exp}`;

export function signMediaPass(secret: string, exp: number): string {
  return createHmac("sha256", secret).update(payload(exp)).digest("base64url");
}

export function mintMediaPass(
  secret: string,
  nowS: number = Math.floor(Date.now() / 1000),
): { exp: number; sig: string; ttl: number } {
  const exp = nowS + MEDIA_PASS_TTL_S;
  return { exp, sig: signMediaPass(secret, exp), ttl: MEDIA_PASS_TTL_S };
}

/** Fails closed: no secret, junk input, an expired or over-long pass, or a bad signature. */
export function verifyMediaPass(
  secret: string | undefined,
  exp: unknown,
  sig: unknown,
  nowS: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || typeof sig !== "string" || sig.length === 0) return false;
  const e = typeof exp === "string" && /^\d+$/.test(exp) ? Number(exp) : exp;
  if (typeof e !== "number" || !Number.isInteger(e)) return false;
  if (e <= nowS) return false;
  if (e > nowS + MEDIA_PASS_TTL_S + SKEW_S) return false;
  const want = Buffer.from(signMediaPass(secret, e));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
