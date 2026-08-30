/**
 * app/api/fathom-webhook/route.ts — Fathom "new-meeting-content-ready" → Calls.
 *
 * SETUP IN FATHOM:
 *  1. Fathom → Settings → API Access → generate an API key  → FATHOM_API_KEY
 *  2. Add Webhook → destination:
 *       https://www.swapnilumbarkarfitness.in/api/fathom-webhook
 *     trigger: new meeting content ready
 *  3. Copy the signing secret → FATHOM_WEBHOOK_SECRET
 *  4. ANTHROPIC_API_KEY for the extraction step.
 *
 * DELIVERY CONTRACT — same shape as /api/cal-webhook, for the same reason:
 * the ONLY non-2xx this route returns is 401 on a genuine signature mismatch.
 * Once a request is accepted we always 200, even if Fathom's payload is
 * unrecognisable, the booking cannot be matched, or Claude fails. A provider
 * that sees a 5xx retries forever and eventually disables the webhook, and an
 * extraction problem must never cost us the delivery.
 *
 * WHY after(): a 75-minute transcript through the extractor takes far longer
 * than a webhook sender will wait. We verify, acknowledge in milliseconds, and
 * do the real work in after(). A bare un-awaited promise would be killed when
 * the serverless invocation freezes — silently, with nothing in the logs.
 */
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import {
  verifyFathomSignature,
  normaliseMeeting,
  fetchTranscript,
  matchBooking,
  type BookingCandidate,
} from "@/lib/fathom";
import { fetchBookings } from "@/lib/cal-bookings";
import { extractCall, failedCount, EXTRACT_MODEL } from "@/lib/call-extract";
import { writeCall, type CallFields } from "@/lib/crm-calls";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const yn = (b: boolean) => (b ? "Y" : "N");

export async function POST(req: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error("[fathom-webhook] 200 — unreadable body", err);
    return NextResponse.json({ ok: true, skipped: "unreadable body" });
  }

  const headers = {
    id: req.headers.get("webhook-id") ?? "",
    timestamp: req.headers.get("webhook-timestamp") ?? "",
    signature: req.headers.get("webhook-signature") ?? "",
  };

  const sig = verifyFathomSignature(rawBody, headers);
  if (sig === "mismatch") {
    console.warn("[fathom-webhook] 401 — signature mismatch (check FATHOM_WEBHOOK_SECRET)");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (sig === "unconfigured") {
    console.warn("[fathom-webhook] FATHOM_WEBHOOK_SECRET unset — accepting UNVERIFIED. Set it in Vercel.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn("[fathom-webhook] 200 — body was not JSON");
    return NextResponse.json({ ok: true, skipped: "invalid json" });
  }

  // Fathom does not publish the payload field names, so record the shape we
  // actually receive. One real delivery replaces guesswork with fact.
  const topKeys = payload && typeof payload === "object" ? Object.keys(payload as object) : [];
  const meeting = normaliseMeeting(payload);
  console.log(
    `[fathom-webhook] accepted keys=[${topKeys.join(",")}] recordingId=${meeting.recordingId || "(none)"} ` +
      `title="${meeting.title}" startedAt=${meeting.startedAt || "(none)"} emails=${meeting.emails.length} ` +
      `inlineTranscriptChars=${meeting.transcript.length}`,
  );

  after(async () => {
    try {
      await processMeeting(meeting);
    } catch (err) {
      console.error(`[fathom-webhook] processing failed recordingId=${meeting.recordingId}`, err);
    }
  });

  return NextResponse.json({ received: true, recordingId: meeting.recordingId });
}

async function processMeeting(meeting: ReturnType<typeof normaliseMeeting>) {
  // 1. Transcript — inline when Fathom was configured to send it, else fetched.
  let transcript = meeting.transcript;
  if (!transcript && meeting.recordingId) {
    transcript = await fetchTranscript(meeting.recordingId);
  }
  if (!transcript) {
    console.warn(`[fathom-webhook] no transcript for recordingId=${meeting.recordingId} — nothing to extract`);
    return;
  }

  // 2. Which booking is this? Email first, time second.
  const bookings = await fetchBookings(100);
  const candidates: BookingCandidate[] = bookings.map((b) => ({
    uid: b.uid,
    email: b.email,
    name: b.name,
    startIso: b.startIso,
  }));
  const match = matchBooking(meeting, candidates);

  if (!match) {
    console.warn(
      `[fathom-webhook] no booking matched recordingId=${meeting.recordingId} ` +
        `emails=[${meeting.emails.join(",")}] startedAt=${meeting.startedAt} — skipping write`,
    );
    return;
  }

  const booking = bookings.find((b) => b.uid === match.uid);

  // 3. Extract. This is the slow part and the reason for after().
  const started = Date.now();
  const x = await extractCall({
    transcript,
    meetingTitle: meeting.title,
    occurredAt: meeting.startedAt,
  });
  const failed = failedCount(x.scorecard);
  console.log(
    `[fathom-webhook] extracted uid=${match.uid} in ${Date.now() - started}ms ` +
      `attended=${x.attended} price=${x.price_pitched ?? "-"} lowest=${x.lowest_price_said ?? "-"} ` +
      `discount=${x.discount_offered} objection=${x.objection_category} scorecardFailed=${failed}/10`,
  );

  // 4. Write. Every column comes from a system; none is typed by a human.
  const fields: CallFields = {
    bookingUid: match.uid,
    writtenAt: new Date().toISOString(),
    occurredAt: meeting.startedAt || "",
    name: booking?.name ?? match.name ?? "",
    email: booking?.email ?? match.email ?? "",
    phone: booking?.phone ?? "",
    attended: yn(x.attended),
    durationMin: "",
    coachTalkPct: String(Math.round(x.coach_talk_pct)),
    pricePitched: x.price_pitched == null ? "" : String(x.price_pitched),
    lowestPriceSaid: x.lowest_price_said == null ? "" : String(x.lowest_price_said),
    discountOffered: yn(x.discount_offered),
    discountAt: x.discount_at,
    moneyMovedOnCall: yn(x.money_moved_on_call),
    amountAgreed: x.amount_agreed == null ? "" : String(x.amount_agreed),
    objection: `${x.objection_category}: ${x.objection_real}`.trim(),
    excuse: x.excuse_stated,
    agreedCallbackAt: x.agreed_callback_at,
    summary: x.summary,
    scorecardFailed: String(failed),
    scorecard: JSON.stringify(x.scorecard),
    fathomUrl: meeting.url,
    extractedBy: EXTRACT_MODEL,
  };

  const plan = await writeCall(fields);
  console.log(`[fathom-webhook] Calls row ${plan.action}${plan.skipReason ? ` (${plan.skipReason})` : ""} uid=${match.uid}`);
}
