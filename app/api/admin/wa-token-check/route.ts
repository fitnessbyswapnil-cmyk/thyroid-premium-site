/**
 * GET /api/admin/wa-token-check
 *
 * Does Meta actually ACCEPT the WhatsApp token this host has? whatsapp-status
 * only checks that one is set, which is how a rejected token (error 190) went
 * unnoticed after the move to Cloudflare while every message failed.
 *
 * Read-only: asks Graph for the phone number's display name — no message is
 * sent. Reports the token's SHAPE (length, prefix, stray whitespace/quotes) and
 * Meta's verdict, never the token itself. When the raw value fails but a
 * trimmed/unquoted copy works, the secret was pasted with extra characters.
 * Admin-key protected.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";

export const dynamic = "force-dynamic";

const GRAPH_VERSION = "v21.0"; // same as lib/whatsapp.ts

async function ask(token: string, phoneNumberId: string) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  const body = (await res.json().catch(() => ({}))) as {
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    error?: { code?: number; error_subcode?: number; type?: string; message?: string };
  };
  return res.ok
    ? { ok: true, number: body.display_phone_number, name: body.verified_name, quality: body.quality_rating }
    : { ok: false, status: res.status, code: body.error?.code, subcode: body.error?.error_subcode, type: body.error?.type, message: body.error?.message };
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const cleaned = raw.trim().replace(/^["']+|["']+$/g, "").trim();

  const shape = {
    present: raw.length > 0,
    source: process.env.WHATSAPP_TOKEN ? "WHATSAPP_TOKEN" : process.env.WHATSAPP_ACCESS_TOKEN ? "WHATSAPP_ACCESS_TOKEN" : "none",
    length: raw.length,
    startsWithEAA: raw.startsWith("EAA"),
    hasLeadingOrTrailingSpace: raw !== raw.trim(),
    hasQuotes: /^["']|["']$/.test(raw.trim()),
    hasInnerWhitespace: /\s/.test(raw.trim()),
    phoneNumberIdSet: phoneNumberId.length > 0,
  };
  if (!shape.present || !phoneNumberId) return NextResponse.json({ shape, verdict: "missing" });

  const asIs = await ask(raw, phoneNumberId);
  const asCleaned = cleaned !== raw ? await ask(cleaned, phoneNumberId) : null;

  const verdict = asIs.ok
    ? "accepted"
    : asCleaned?.ok
      ? "pasted_with_extra_characters"
      : "rejected_by_meta";
  return NextResponse.json({ verdict, shape, asIs, asCleaned });
}
