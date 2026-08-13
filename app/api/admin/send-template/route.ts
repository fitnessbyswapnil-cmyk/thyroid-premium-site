/**
 * POST /api/admin/send-template — send one approved template to one person,
 * from the business API number.
 *
 * WHY THIS EXISTS
 * The dashboard's "WA · Nudge" buttons open wa.me links, which send from
 * whichever WhatsApp is installed on the phone — a personal number, not the
 * business one customers see on every automated message. Sending from the API
 * number instead requires either an open 24-hour window (she must message
 * first) or an approved template. This route is the template path, for the
 * common case of a lead who has never written to us.
 *
 * Body: { phone, template, params?: string[], language? }
 *   phone     any Indian format — normalised to E.164 by the sender
 *   params    ordered values for the template's {{1}}, {{2}}, … slots
 *
 * Sends are mirrored into the admin inbox by sendWhatsAppTemplate, so a
 * message sent this way appears in her thread rather than vanishing.
 *
 * Auth: x-admin-key.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { sendWhatsAppTemplate, toWhatsAppNumber } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { phone?: string; template?: string; params?: string[]; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const phone = toWhatsAppNumber(String(body.phone ?? ""));
  if (phone.length < 12) {
    return NextResponse.json({ error: "bad_phone", hint: "10-digit Indian number or +91…" }, { status: 400 });
  }

  const template = String(body.template ?? "").trim();
  if (!/^[a-z0-9_]{3,60}$/.test(template)) {
    return NextResponse.json({ error: "bad_template" }, { status: 400 });
  }

  // Template params are substituted into the approved body; anything longer
  // than a short value is a mistake worth catching before Meta rejects it.
  const params = Array.isArray(body.params)
    ? body.params.slice(0, 10).map((v) => String(v ?? "").slice(0, 200))
    : [];

  const language =
    typeof body.language === "string" && /^[a-z]{2}(_[A-Z]{2})?$/.test(body.language)
      ? body.language
      : undefined;

  const result = await sendWhatsAppTemplate(phone, template, params, language);

  if (!result.sent) {
    return NextResponse.json(
      { error: result.error || result.skipped || "send_failed", template, phone: `***${phone.slice(-4)}` },
      { status: 502 },
    );
  }

  console.log(`[send-template] ${template} → ***${phone.slice(-4)} id=${result.messageId ?? "(none)"}`);
  return NextResponse.json({
    ok: true,
    template,
    phone: `***${phone.slice(-4)}`,
    messageId: result.messageId,
  });
}
