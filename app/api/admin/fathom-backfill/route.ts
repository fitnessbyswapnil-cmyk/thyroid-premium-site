/**
 * /api/admin/fathom-backfill — pull existing Fathom recordings into Calls.
 *
 *   POST { limit?, force?, dry? }            (x-admin-key header)
 *   GET  ?k=<ADMIN_DASH_KEY>&limit=3&dry=1   (phone-friendly)
 *
 * The webhook only fires for calls recorded from now on. This is how the
 * history gets in — and the history is the whole point, because a close rate
 * needs past calls to be a rate at all.
 *
 * Deliberately batched and small by default, so a timeout halfway through a
 * big batch cannot lose the work: it processes a handful per invocation and
 * reports what is left. Run it a few times rather than once with limit=85.
 *
 * ATTENDANCE IS FREE (14-Sep-2026), exactly as in /api/fathom-webhook: it is
 * read from the transcript by lib/call-attendance, and the paid AI analysis
 * runs only when ANTHROPIC_API_KEY is set. Before this the backfill called the
 * AI unconditionally, so with no key every call errored and nothing was
 * written — which is why only three calls had ever reached the Calls sheet.
 *
 * CallHeld is unchanged in shape and event id (call_<booking uid>, so a re-run
 * or the webhook cannot double count). One guard added: a call more than
 * seven days old is written to the sheet but NOT sent, because Meta rejects
 * events older than seven days — sending them only fills the logs with errors.
 *
 * ?dry=1 reports what would be written, and whether CallHeld would go, with
 * nothing written and nothing sent.
 *
 * Rows already present are skipped unless force=1, and a row the coach has
 * marked Reviewed is never overwritten (enforced in lib/crm-calls).
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { listAllMeetings, fetchTranscript, matchBooking, type BookingCandidate } from "@/lib/fathom";
import { fetchAllBookings } from "@/lib/cal-bookings";
import { sendCAPIEvent, buildUserData } from "@/lib/server-tracking";
import { isOwnerTest } from "@/lib/owner-filter";
import { extractCall, failedCount, EXTRACT_MODEL } from "@/lib/call-extract";
import { inferAttendance } from "@/lib/call-attendance";
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
  status: "written" | "would_write" | "skipped" | "no_match" | "no_transcript" | "error";
  uid?: string;
  detail?: string;
  attended?: boolean;
  callHeld?: "sent" | "would_send" | "not_attended" | "too_old";
};

/**
 * Per run. Workers on the free plan allow 50 outbound requests per invocation:
 * up to 17 go on listing meetings, bookings and existing calls, and each call
 * then costs a transcript fetch, the sheet write and the Meta send.
 */
const MAX_BATCH = 5;

/** Meta rejects server events older than this. */
const META_MAX_EVENT_AGE_MS = 7 * 86_400_000;


/**
 * CallHeld → Meta. The call is the richest signal in the business and Meta
 * never saw it. Fired only when the extractor says she attended, keyed to the
 * booking uid so a re-run cannot double count. `partner_present` is whether a
 * second non-owner attendee was on the recording — the number that will settle
 * whether the absent decision-maker is the leak it looks like.
 */
async function fireCallHeld(args: { uid: string; name: string; email: string; phone: string; attended: boolean; emails: string[]; startedAt: string; partnerBySpeakers?: boolean }) {
  if (!args.attended) return;
  try {
    const others = args.emails.filter((e) => e && e.toLowerCase() !== args.email.toLowerCase() && !isOwnerTest({ email: e }));
    // Same rule as the webhook: a second invitee, or a second voice on the call.
    const partnerPresent = others.length > 0 || !!args.partnerBySpeakers;
    const r = await sendCAPIEvent("CallHeld", {
      eventId: `call_${args.uid}`,
      userData: buildUserData({ email: args.email, phone: args.phone, firstName: args.name.split(" ")[0] || "", country: "in" }),
      customData: { partner_present: partnerPresent ? 1 : 0 },
      actionSource: "phone_call",
      ...(args.startedAt ? { eventTime: Math.floor(new Date(args.startedAt).getTime() / 1000) } : {}),
    });
    console.log(`[fathom] CallHeld uid=${args.uid} partner_present=${partnerPresent ? 1 : 0} result=${JSON.stringify(r).slice(0, 160)}`);
  } catch (e) {
    console.error("[fathom] CallHeld failed (swallowed):", e instanceof Error ? e.message : String(e));
  }
}

async function backfill(limit: number, force: boolean, dry: boolean) {
  // Every page of meetings and every booking: a call from three weeks ago can
  // only be matched against a booking list that still reaches back that far.
  const [meetings, bookingsRes, existing] = await Promise.all([listAllMeetings(), fetchAllBookings(), readCalls()]);
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

      const booking = bookings.find((b) => b.uid === match.uid);
      const occurredAt = m.startedAt || booking?.startIso || "";

      // Attendance from the transcript — free, always run (lib/call-attendance).
      const heard = inferAttendance(transcript);
      let attended = heard.attended;
      let fields: CallFields = {
        bookingUid: match.uid,
        writtenAt: new Date().toISOString(),
        occurredAt,
        name: booking?.name ?? match.name ?? "",
        email: booking?.email ?? match.email ?? "",
        phone: booking?.phone ?? "",
        attended: yn(heard.attended),
        durationMin: heard.durationMin == null ? "" : String(heard.durationMin),
        coachTalkPct: heard.coachTalkPct == null ? "" : String(heard.coachTalkPct),
        fathomUrl: m.url,
        extractedBy: `transcript (no AI) · ${heard.basis}`,
      };
      let detail = `attendance from transcript (${heard.basis})`;

      // The paid analysis, only with a key — and never on a dry run, which
      // must cost nothing. If it fails the transcript record stands.
      if (!dry && (process.env.ANTHROPIC_API_KEY ?? "").trim()) {
        try {
          const x = await extractCall({ transcript, meetingTitle: m.title, occurredAt: m.startedAt });
          const failed = failedCount(x.scorecard);
          attended = x.attended;
          fields = {
            ...fields,
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
            extractedBy: EXTRACT_MODEL,
          };
          detail = `${failed}/10 scorecard failures`;
        } catch (aiErr) {
          console.error(`[fathom-backfill] AI analysis failed uid=${match.uid} — keeping the transcript record:`, aiErr instanceof Error ? aiErr.message : String(aiErr));
        }
      }

      const ageMs = Date.now() - Date.parse(occurredAt);
      const tooOld = Number.isFinite(ageMs) && ageMs > META_MAX_EVENT_AGE_MS;
      const callHeld: Result["callHeld"] = !attended ? "not_attended" : tooOld ? "too_old" : dry ? "would_send" : "sent";

      if (dry) {
        results.push({ recordingId: m.recordingId, title: m.title, uid: match.uid, status: "would_write", attended, callHeld, detail });
        done.add(match.uid);
        continue;
      }

      const plan = await writeCall(fields, { force });
      if (plan.action !== "skip" && callHeld === "sent") {
        await fireCallHeld({ uid: match.uid, name: fields.name ?? "", email: fields.email ?? "", phone: fields.phone ?? "", attended, emails: m.emails, startedAt: m.startedAt, partnerBySpeakers: heard.partnerPresent });
      }
      results.push({
        recordingId: m.recordingId,
        title: m.title,
        uid: match.uid,
        status: plan.action === "skip" ? "skipped" : "written",
        attended,
        callHeld: plan.action === "skip" ? undefined : callHeld,
        detail: plan.skipReason ?? detail,
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
    dry,
    written: results.filter((r) => r.status === "written" || r.status === "would_write").length,
    attended: results.filter((r) => r.attended === true).length,
    notAttended: results.filter((r) => r.attended === false).length,
    callHeldSent: results.filter((r) => r.callHeld === "sent" || r.callHeld === "would_send").length,
    callHeldTooOld: results.filter((r) => r.callHeld === "too_old").length,
    noMatch: results.filter((r) => r.status === "no_match").length,
    errors: results.filter((r) => r.status === "error").length,
  };
  console.log(`[fathom-backfill] ${JSON.stringify(summary)}`);
  return { summary, results };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { limit?: number; force?: boolean; dry?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const limit = Math.max(1, Math.min(MAX_BATCH, Number(body.limit) || 3));
  try {
    return NextResponse.json(await backfill(limit, !!body.force, !!body.dry));
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = Math.max(1, Math.min(MAX_BATCH, Number(req.nextUrl.searchParams.get("limit")) || 3));
  const force = req.nextUrl.searchParams.get("force") === "1";
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  try {
    return NextResponse.json(await backfill(limit, force, dry));
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 502 });
  }
}
