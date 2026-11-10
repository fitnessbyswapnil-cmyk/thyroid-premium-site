/**
 * POST /api/admin/thank-you — his one tap: thank her on WhatsApp for her
 * consultation call.
 *
 * Body: { name, phone, bookingUid?, when?, email? } — straight off the Today
 * row. `when` is the call's start (ISO). Pass it: with it, a thank-you sent
 * for an EARLIER call does not block this one; without it, any earlier
 * thank-you counts as this call's, because "never twice" is the rule that
 * cannot break.
 *
 *   200 { sent: true, via: "session" | "template", messageId? }
 *   409 { error: "window_closed", waText, hint }   her 24h window is shut (or her
 *                                                  thread could not be read) and the
 *                                                  template is not approved: he
 *                                                  sends waText from his phone (wa.me)
 *   409 { error: "already_sent", sentAt, hint }    thanked for this call already
 *   409 { error: "in_progress", hint }             a double tap
 *   422 { error: "test_identity", hint }           test data; his own number passes
 *   400 { error: "bad_json" | "need_phone", hint }
 *   503 { error: "marks_unavailable", hint }       could not check, so nothing sent
 *   502 { error: "whatsapp_not_configured" | "send_failed", waText, hint }
 *
 * All the rules live in lib/thank-you (sendThankYou, thankYouReply) and are
 * tested there. The outbound message is logged after the reply (after()).
 *
 * Sends NOTHING to Meta's tracking. Auth: x-admin-key, like the rest of /api/admin/*.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { checkAdminKey } from "../_lib";
import { sendThankYou, thankYouReply } from "@/lib/thank-you";

export const dynamic = "force-dynamic";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized", hint: "The admin key is missing or wrong." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_json", hint: "The request was not JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_json", hint: "The request was not a JSON object." }, { status: 400 });
  }

  const outcome = await sendThankYou(
    {
      name: str(body.name),
      phone: str(body.phone),
      email: str(body.email),
      bookingUid: str(body.bookingUid),
      when: str(body.when),
    },
    { defer: (work) => after(work) },
  );
  const reply = thankYouReply(outcome);
  return NextResponse.json(reply.body, { status: reply.status });
}
