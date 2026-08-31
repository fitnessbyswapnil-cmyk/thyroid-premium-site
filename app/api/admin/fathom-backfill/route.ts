/**
 * /api/admin/fathom-backfill — pull existing Fathom recordings into Calls.
 *
 *   POST { limit?, force? }            (x-admin-key header)
 *   GET  ?k=<ADMIN_DASH_KEY>&limit=3   (phone-friendly)
 *
 * The webhook only fires for calls recorded from now on. This is how the
 * history gets in — and the history is the whole point, because a close rate
 * needs past calls to be a rate at all.
 *
 * Deliberately batched and small by default. Each call runs a full transcript
 * through the extractor, which costs real money and real seconds, so this
 * processes a handful per invocation and reports what is left. Run it a few
 * times rather than once with limit=85: a serverless timeout halfway through a
 * big batch loses the work with nothing written.
 *
 * Rows already present are skipped unless force=1, and a row the coach has
 * marked Reviewed is never overwritten (enforced in lib/crm-calls).
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { listMeetings, fetchTranscript, matchBooking, type BookingCandidate } from "@/lib/fathom";
import { fetchBookings } from "@/lib/cal-bookings";
import { extractCall, failedCount, EXTRACT_MODEL } from "@/lib/call-extract";
import { readCalls, writeCall, type CallFields } from "@/lib/crm-calls";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const yn = (b: boolean) => (b ? "Y" : "N");

function authorized(req: NextRequest): boolean {
  if (checkAdminKey(req)) return true;
  const expected = process.env.ADMIN_DASH_KEY;
  const given = req.nextUrl.searchParams.get("k");
  return !!expected && !!given && given === expected;
}

type Result = {
  recordingId: string;
  title: string;
  status: "written" | "skipped" | "no_match" | "no_transcript" | "error";
  uid?: string;
  detail?: string;
};

async function backfill(limit: number, force: boolean) {
  const [meetings, bookingsRes, existing] = await Promise.all([listMeetings(), fetchBookings(50), readCalls()]);
  const bookings = bookingsRes.bookings;
  if (bookingsRes.error) console.warn(`[fathom-backfill] ${bookingsRes.error}`);

  const done = new Set(existing.map((c) => c.bookingUid));
  const candidates: BookingCandidate[] = bookings.map((b) => ({
    uid: b.uid,
    email: b.email,
    name: b.name,
    startIso: b.startIso,
  }));

  const results: Result[] = [];
  let processed = 0;
  let remaining = 0;

  for (const m of meetings) {
    const match = matchBooking(m, candidates);

    if (!match) {
      results.push({ recordingId: m.recordingId, title: m.title, status: "no_match" });
      continue;
    }
    if (done.has(match.uid) && !force) {
      results.push({ recordingId: m.recordingId, title: m.title, status: "skipped", uid: match.uid, detail: "already in Calls" });
      continue;
    }
    if (processed >= limit) {
      remaining++;
      continue;
    }

    processed++;
    try {
      const transcript = m.transcript || (await fetchTranscript(m.recordingId));
      if (!transcript) {
        results.push({ recordingId: m.recordingId, title: m.title, status: "no_transcript", uid: match.uid });
        continue;
      }

      const x = await extractCall({ transcript, meetingTitle: m.title, occurredAt: m.startedAt });
      const booking = bookings.find((b) => b.uid === match.uid);
      const failed = failedCount(x.scorecard);

      const fields: CallFields = {
        bookingUid: match.uid,
        writtenAt: new Date().toISOString(),
        occurredAt: m.startedAt || booking?.startIso || "",
        name: booking?.name ?? match.name ?? "",
        email: booking?.email ?? match.email ?? "",
        phone: booking?.phone ?? "",
        attended: yn(x.attended),
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
        fathomUrl: m.url,
        extractedBy: EXTRACT_MODEL,
      };

      const plan = await writeCall(fields, { force });
      results.push({
        recordingId: m.recordingId,
        title: m.title,
        uid: match.uid,
        status: plan.action === "skip" ? "skipped" : "written",
        detail: plan.skipReason ?? `${failed}/10 scorecard failures`,
      });
      done.add(match.uid);
    } catch (err) {
      console.error(`[fathom-backfill] ${m.recordingId} failed`, err);
      results.push({ recordingId: m.recordingId, title: m.title, uid: match.uid, status: "error", detail: String(err).slice(0, 200) });
    }
  }

  const summary = {
    meetingsSeen: meetings.length,
    processed,
    remaining,
    written: results.filter((r) => r.status === "written").length,
    noMatch: results.filter((r) => r.status === "no_match").length,
    errors: results.filter((r) => r.status === "error").length,
  };
  console.log(`[fathom-backfill] ${JSON.stringify(summary)}`);
  return { summary, results };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { limit?: number; force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const limit = Math.max(1, Math.min(20, Number(body.limit) || 3));
  try {
    return NextResponse.json(await backfill(limit, !!body.force));
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = Math.max(1, Math.min(20, Number(req.nextUrl.searchParams.get("limit")) || 3));
  const force = req.nextUrl.searchParams.get("force") === "1";
  try {
    return NextResponse.json(await backfill(limit, force));
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 502 });
  }
}
