/**
 * POST /api/admin/media-pass → { exp, sig, ttl }
 *
 * Auth: x-admin-key. Mints the short-lived pass that attachment URLs carry
 * instead of the admin key itself; see lib/media-pass.ts for why. Without
 * MEDIA_URL_SECRET on the worker it refuses (503) rather than fall back to
 * putting the key in a URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { mintMediaPass } from "@/lib/media-pass";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const secret = process.env.MEDIA_URL_SECRET;
  if (!secret) return NextResponse.json({ error: "media_signing_not_configured" }, { status: 503 });
  return NextResponse.json(mintMediaPass(secret), { headers: { "cache-control": "no-store" } });
}
