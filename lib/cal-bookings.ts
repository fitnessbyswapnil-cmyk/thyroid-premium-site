import { isOwnerTest } from "./owner-filter";

/**
 * lib/cal-bookings.ts — booking records keyed by uid.
 *
 * The existing helper in app/api/admin/_lib.ts folds Cal.com into email-keyed
 * SETS, which is exactly right for the lead dashboard but loses the two things
 * the CRM needs: the booking uid (the id every other system agrees on — the Meta
 * Schedule event_id, the Calls row key, the replay endpoint) and the slot time
 * (needed to decide no-show and to match a Fathom recording to a booking).
 *
 * So this is a second, narrower read of the same API rather than a change to
 * that one: the lead dashboard's behaviour is load-bearing and well-tested, and
 * nothing here should be able to disturb it.
 *
 * Never throws. A Cal.com outage degrades the CRM to "no booking data", it does
 * not take the page down.
 */

export type CalBookingRecord = {
  uid: string;
  email: string;
  name: string;
  phone: string;
  startIso: string;
  /** Raw Cal.com status, lowercased. */
  status: string;
  cancelled: boolean;
  /** Her qualifying answers — these exist ONLY in Cal.com. */
  answers: Record<string, unknown>;
};

const CANCELLED = new Set(["cancelled", "canceled", "rejected"]);

type RawBooking = {
  uid?: string;
  status?: string;
  startTime?: string;
  start?: string;
  attendees?: { name?: string; email?: string; phoneNumber?: string }[];
  responses?: Record<string, unknown>;
  bookingFieldsResponses?: Record<string, unknown>;
};

const str = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    const inner = (v as { value?: unknown }).value;
    return typeof inner === "string" ? inner.trim() : "";
  }
  return "";
};

export function normaliseBooking(b: RawBooking): CalBookingRecord | null {
  const uid = (b.uid ?? "").trim();
  if (!uid) return null;

  const merged: Record<string, unknown> = { ...(b.responses ?? {}), ...(b.bookingFieldsResponses ?? {}) };
  const a = b.attendees?.[0] ?? {};
  const status = (b.status ?? "").toLowerCase();

  return {
    uid,
    email: (a.email || str(merged.email)).toLowerCase(),
    name: a.name || str(merged.name),
    phone: a.phoneNumber || str(merged.attendeePhoneNumber) || str(merged.phone),
    startIso: b.startTime ?? b.start ?? "",
    status,
    cancelled: CANCELLED.has(status),
    answers: merged,
  };
}

type PageResult = { rows: RawBooking[]; error: string };

/**
 * One page. NEVER throws — but it does report why it came back empty.
 *
 * The first version swallowed every failure into `[]`, which made a wrong API
 * key, an expired token and a slow response all look identical to "this coach
 * has no bookings" — and the pipeline duly showed 199 leads and 0 booked with
 * no warning anywhere. A silent zero is the worst possible failure mode for a
 * dashboard, because it is indistinguishable from a true zero.
 *
 * The timeout has been raised twice and is now 25s, because the measurement that
 * set it was taken from the wrong machine: 100 bookings came back in 2.4s from a
 * warm laptop and still timed out from Vercel, which silently emptied the whole
 * pipeline. The page size is also halved — 50 bookings is 77KB against 146KB and
 * returns in a fifth of the time, and this account has around 30 real ones.
 */
async function page(apiKey: string, query: string): Promise<PageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`https://api.cal.com/v2/bookings?${query}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "cal-api-version": "2024-08-13" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { rows: [], error: `cal.com returned ${res.status} ${body.slice(0, 120)}` };
    }
    const json = (await res.json()) as { data?: RawBooking[] | { bookings?: RawBooking[] } };
    const rows = Array.isArray(json.data) ? json.data : (json.data?.bookings ?? []);
    return { rows, error: "" };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { rows: [], error: aborted ? "cal.com timed out after 25s" : `cal.com request failed: ${String(err).slice(0, 120)}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Recent bookings, newest first, deduped by uid.
 *
 * Pulls the created-desc list rather than status-filtered pages: `status=upcoming`
 * returns nothing once a call has happened, and every call this CRM cares about
 * is by definition in the past.
 */
export type BookingsResult = { bookings: CalBookingRecord[]; error: string; ownerTestsRemoved: number };

export async function fetchBookings(take = 50): Promise<BookingsResult> {
  const apiKey = process.env.CAL_API_KEY;
  if (!apiKey) return { bookings: [], error: "CAL_API_KEY is not set on this deployment", ownerTestsRemoved: 0 };

  const { rows, error } = await page(apiKey, `take=${Math.min(take, 100)}&sortCreated=desc`);
  if (error) return { bookings: [], error, ownerTestsRemoved: 0 };

  const seen = new Set<string>();
  const out: CalBookingRecord[] = [];
  let ownerTests = 0;
  for (const b of rows) {
    const rec = normaliseBooking(b);
    if (!rec) continue;
    if (seen.has(rec.uid)) continue;
    seen.add(rec.uid);
    // His own test bookings were 62 of 100 here and produced every "cancelled"
    // row in the pipeline. Dropped at the source so nothing downstream — not the
    // stage counts, not the funnel, and not the Fathom recording matcher — can
    // ever treat one as a prospect.
    if (isOwnerTest({ name: rec.name, email: rec.email })) {
      ownerTests++;
      continue;
    }
    out.push(rec);
  }
  return {
    bookings: out,
    ownerTestsRemoved: ownerTests,
    // Rows arriving but none surviving is its own distinct bug and should not
    // look like "no bookings". Owner tests are excluded from that judgement —
    // an account of nothing but tests is not a fault.
    error:
      rows.length > 0 && out.length === 0 && ownerTests < rows.length
        ? `cal.com returned ${rows.length} bookings but none had a uid`
        : "",
  };
}
