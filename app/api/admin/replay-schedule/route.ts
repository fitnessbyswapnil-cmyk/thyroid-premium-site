/**
 * /api/admin/replay-schedule — re-send a booking's Schedule conversion to Meta.
 *
 *   POST { uid }            (x-admin-key header)
 *   GET  ?uid=...&k=<key>   (phone-friendly; same key as ?k= on /api/admin/media)
 *
 * Exists because a conversion can be LOST while the pipeline looks healthy:
 * on 28 Aug a real client's booking fired its Schedule from a deployment that
 * still had META_TEST_EVENT_CODE baked in, so Meta routed it to Test Events and
 * excluded it from ads reporting permanently. The event was received, never
 * counted, and the ad set optimising on Schedule saw nothing.
 *
 * The replay sends the SAME event_id (schedule_<uid>) with the booking's REAL
 * creation time (sendCAPIEvent supports a past event_time; Meta accepts up to
 * 7 days). Same-id is deliberate and safe in both directions: if the original
 * really was swallowed into Test Events, production has never seen this id and
 * the replay registers; if the original somehow did count, Meta deduplicates
 * on the id and the replay is a no-op. It can never double-count.
 *
 * NEVER attaches a test code, by construction — this endpoint exists to undo
 * exactly that mistake.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { buildUserData, sendCAPIEvent } from "@/lib/server-tracking";
import { FREE_CALL_VALUE } from "@/app/lib/pricing";

export const dynamic = "force-dynamic";

// Meta rejects conversions older than 7 days; refuse at 6.5 to stay clear of
// timezone arithmetic at the boundary.
const MAX_AGE_MS = 6.5 * 24 * 60 * 60 * 1000;

function authorized(req: NextRequest): boolean {
  if (checkAdminKey(req)) return true;
  const expected = process.env.ADMIN_DASH_KEY;
  const given = req.nextUrl.searchParams.get("k");
  return !!expected && !!given && given === expected;
}

async function replay(uid: string) {
  const calKey = process.env.CAL_API_KEY;
  if (!calKey) return { status: 503, body: { error: "CAL_API_KEY not configured" } };

  const res = await fetch(`https://api.cal.com/v2/bookings/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${calKey}`, "cal-api-version": "2024-08-13" },
    cache: "no-store",
  });
  if (!res.ok) return { status: 404, body: { error: `cal_lookup_failed_${res.status}` } };

  const json = (await res.json()) as {
    data?: {
      createdAt?: string;
      status?: string;
      attendees?: { name?: string; email?: string; phoneNumber?: string }[];
      bookingFieldsResponses?: Record<string, unknown>;
      responses?: Record<string, unknown>;
    };
  };
  const b = json.data;
  if (!b) return { status: 404, body: { error: "booking_not_found" } };

  const merged: Record<string, unknown> = { ...(b.responses ?? {}), ...(b.bookingFieldsResponses ?? {}) };
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const a = b.attendees?.[0] ?? {};

  const name = a.name || str(merged.name);
  const email = a.email || str(merged.email);
  const phone = a.phoneNumber || str(merged.attendeePhoneNumber) || str(merged.phone);
  const city = str(merged["which-city"]) || str(merged.city);

  const createdAt = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
  if (Number.isNaN(createdAt)) return { status: 422, body: { error: "no_createdAt_on_booking" } };
  const age = Date.now() - createdAt;
  if (age > MAX_AGE_MS) {
    return { status: 422, body: { error: "too_old_for_capi", createdAt: b.createdAt } };
  }

  // No clientIp / userAgent / fbc / fbp: none of hers exist server-side after
  // the fact, and fabricating them (or sending ours) would poison matching.
  // em + ph are the two heaviest match keys and both are present.
  const userData = buildUserData({
    email,
    phone,
    firstName: name.split(" ")[0] || "",
    lastName: name.split(" ").slice(1).join(" ") || "",
    city,
    externalId: uid,
    country: "in",
  });

  const result = await sendCAPIEvent("Schedule", {
    eventId: `schedule_${uid}`,
    eventTime: Math.floor(createdAt / 1000),
    sourceUrl: "https://www.swapnilumbarkarfitness.in/book-session",
    userData,
    customData: { content_name: "thyroid_strategy_call", value: FREE_CALL_VALUE, currency: "INR" },
  });

  console.log(
    `[replay-schedule] uid=${uid} event_time=${new Date(createdAt).toISOString()} ` +
      `keys=[${Object.keys(userData).join(",")}] success=${result.success} events_received=${result.events_received ?? 0}`,
  );

  return {
    status: result.success ? 200 : 502,
    body: {
      ok: result.success,
      uid,
      event_id: `schedule_${uid}`,
      event_time: new Date(createdAt).toISOString(),
      booking_status: b.status ?? "",
      match_keys: Object.keys(userData),
      capi: result,
    },
  };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { uid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const uid = String(body.uid ?? "").trim();
  if (!/^[A-Za-z0-9]{8,40}$/.test(uid)) return NextResponse.json({ error: "bad_uid" }, { status: 400 });
  const { status, body: out } = await replay(uid);
  return NextResponse.json(out, { status });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = (req.nextUrl.searchParams.get("uid") ?? "").trim();
  if (!/^[A-Za-z0-9]{8,40}$/.test(uid)) return NextResponse.json({ error: "bad_uid" }, { status: 400 });
  const { status, body: out } = await replay(uid);
  return NextResponse.json(out, { status });
}
