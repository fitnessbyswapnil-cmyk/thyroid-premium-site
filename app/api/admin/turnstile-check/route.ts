/**
 * GET /api/admin/turnstile-check
 *
 * Is TURNSTILE_SECRET_KEY the widget's real SECRET key? Pasting the public site
 * key into that secret is an easy mistake, and it would make Cloudflare reject
 * every visitor's token once Turnstile is switched on.
 *
 * Asks siteverify with a deliberately fake token: a valid secret answers
 * "invalid-input-response" (the token is bad, the secret is fine); a wrong
 * secret answers "invalid-input-secret". Reports only that verdict and the
 * secret's shape — never the secret. Admin-key protected.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";

export const dynamic = "force-dynamic";

// Public by design: it is embedded in every page that shows the widget.
const PUBLIC_SITE_KEY = "0x4AAAAAAEwm_7LAGnlNtTS0";

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const secret = process.env.TURNSTILE_SECRET_KEY || "";
  const shape = {
    present: secret.length > 0,
    length: secret.length,
    equalsPublicSiteKey: secret.trim() === PUBLIC_SITE_KEY,
    startsWith0x: secret.startsWith("0x"),
    hasSpacesOrQuotes: secret !== secret.trim() || /^["']|["']$/.test(secret.trim()),
  };
  if (!shape.present) return NextResponse.json({ verdict: "missing", shape });

  const body = new URLSearchParams({ secret: secret.trim(), response: "deliberately-invalid-token" });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const out = (await res.json().catch(() => ({}))) as { success?: boolean; "error-codes"?: string[] };
  const codes = out["error-codes"] ?? [];

  const verdict = codes.includes("invalid-input-secret")
    ? "wrong_secret"
    : codes.includes("invalid-input-response")
      ? "secret_ok"
      : "unexpected";
  return NextResponse.json({ verdict, shape, cloudflare: codes });
}
