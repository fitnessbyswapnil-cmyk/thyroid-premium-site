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

async function page(apiKey: string, query: string): Promise<RawBooking[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.cal.com/v2/bookings?${query}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "cal-api-version": "2024-08-13" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: RawBooking[] | { bookings?: RawBooking[] } };
    return Array.isArray(json.data) ? json.data : (json.data?.bookings ?? []);
  } catch {
    return [];
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
export async function fetchBookings(take = 100): Promise<CalBookingRecord[]> {
  const apiKey = process.env.CAL_API_KEY;
  if (!apiKey) return [];

  const raw = await page(apiKey, `take=${Math.min(take, 100)}&sortCreated=desc`);
  const seen = new Set<string>();
  const out: CalBookingRecord[] = [];
  for (const b of raw) {
    const rec = normaliseBooking(b);
    if (!rec || seen.has(rec.uid)) continue;
    seen.add(rec.uid);
    out.push(rec);
  }
  return out;
}
