/**
 * POST /api/admin/journey-mark — record a step of her journey that his own
 * click stands for, so her card moves on (lib/journey-marks).
 *
 * Body: { phone, kind, url? }   Reply: { ok: true, kind }
 *
 * WHY A ROUTE FOR THIS
 * Some steps happen off the system. "Send from your phone" opens WhatsApp on
 * his phone, and nothing the business number sees says the message went; the
 * owner decided (10-Nov-2026) that the click is the record: "Clicking records
 * followup_1, followup_2 or followup_3". "Mark onboarded" is nothing but the
 * record. Without one, the card would offer the same follow-up again on every
 * reload.
 *
 * ONLY THE KINDS A CLICK STANDS FOR
 * notes_made and summary_made are written by the routes that make the Doc and
 * the PDF; precall_* by the pre-call route. Accepting those here would let a
 * stray request tick a step whose file does not exist. thank_you_sent and
 * summary_sent are here for their phone fallbacks only: the business-number
 * sends record them on the server.
 *
 * Sends nothing to anyone, and nothing to Meta. Auth: x-admin-key.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { recordMark, type MarkKind } from "@/lib/journey-marks";

export const dynamic = "force-dynamic";

const BY_HIS_CLICK: ReadonlySet<string> = new Set<MarkKind>([
  "onboarded",
  "followup_1",
  "followup_2",
  "followup_3",
  "thank_you_sent",
  "summary_sent",
]);

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { phone?: string; kind?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) return NextResponse.json({ error: "need_phone", hint: "Her 10-digit number is how the step is kept." }, { status: 400 });
  const kind = String(body.kind ?? "");
  if (!BY_HIS_CLICK.has(kind)) return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  // A link travels with the mark only when it is one of his Drive files.
  const raw = String(body.url ?? "").trim();
  const url = /^https:\/\/(docs|drive)\.google\.com\//.test(raw) ? raw.slice(0, 500) : "";

  // Awaited, not after(): the card reloads straight after this answers, and
  // the step should be there when it does. recordMark never throws.
  await recordMark(phone, kind as MarkKind, url);
  return NextResponse.json({ ok: true, kind });
}
