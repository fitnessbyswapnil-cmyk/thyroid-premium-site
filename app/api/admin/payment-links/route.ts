/**
 * /api/admin/payment-links — his Cashfree link for each programme price
 * (lib/payment-links).
 *
 *   GET                  -> 200 { links, tiers, stored }   stored:false = no D1 here
 *   POST { amount, url } -> 200 { links, tiers, stored: true }   url "" removes the link
 *
 *   400 { error: "bad_json" | "unknown_price" | "invalid_link", hint }   hint says what to fix
 *   503 { error: "no_database" | "read_failed", hint, links: {}, tiers }
 *   502 { error: "save_failed", hint }
 *
 * `tiers` is lib/payment-links PRICE_TIERS, so the card draws its rows from
 * the same list the server checks against.
 *
 * Touches nothing that charges anyone: no Cashfree call, no order, no pricing
 * file. Auth: x-admin-key, like the rest of /api/admin/*.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { NO_DATABASE_HINT, PRICE_TIERS, PaymentLinkError, loadPaymentLinks, setPaymentLink } from "@/lib/payment-links";

export const dynamic = "force-dynamic";

const fail = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));
const tiers = [...PRICE_TIERS];

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return fail(401, { error: "unauthorized", hint: "The admin key is missing or wrong." });
  try {
    const { links, stored } = await loadPaymentLinks();
    return NextResponse.json(stored ? { links, tiers, stored } : { links, tiers, stored, hint: NO_DATABASE_HINT });
  } catch (err) {
    console.error("[admin/payment-links] read failed:", errText(err));
    return fail(503, { error: "read_failed", links: {}, tiers, hint: "The saved links could not be read just now. Reload in a moment." });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return fail(401, { error: "unauthorized", hint: "The admin key is missing or wrong." });
  let body: { amount?: unknown; url?: unknown };
  try {
    body = (await req.json()) as { amount?: unknown; url?: unknown };
  } catch {
    return fail(400, { error: "bad_json", hint: "The request was not JSON." });
  }
  // "20000" and 20000 are the same price; "20,000" or 20000.5 are not a tier.
  const amount = typeof body?.amount === "string" ? Number(body.amount.trim()) : body?.amount;
  const url = typeof body?.url === "string" ? body.url : "";

  try {
    await setPaymentLink(amount as (typeof PRICE_TIERS)[number], url);
  } catch (err) {
    if (err instanceof PaymentLinkError) {
      const status = err.code === "no_database" ? 503 : 400;
      return fail(status, { error: err.code, hint: err.message, ...(status === 503 ? { links: {}, tiers } : {}) });
    }
    console.error("[admin/payment-links] save failed:", errText(err));
    return fail(502, { error: "save_failed", hint: "The link did not save. Press Save again." });
  }
  try {
    const { links, stored } = await loadPaymentLinks();
    console.log(`[admin/payment-links] ${String(amount)} ${url.trim() ? "saved" : "removed"}`);
    return NextResponse.json({ links, tiers, stored });
  } catch (err) {
    console.error("[admin/payment-links] saved, but the read-back failed:", errText(err));
    return fail(503, { error: "read_failed", links: {}, tiers, hint: "Saved, but the links could not be read back. Reload to see them." });
  }
}
