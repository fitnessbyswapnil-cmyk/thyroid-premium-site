/**
 * Shared helpers for the /api/admin/* routes (not a route itself).
 * Auth is a single shared key: ADMIN_DASH_KEY env var, with a baked-in
 * fallback so the dashboard works before the env var is set. Override it
 * in Vercel → Settings → Environment Variables for a private passcode.
 */
import { NextRequest } from "next/server";
import { google } from "googleapis";

export const SHEET_NAME = "Leads";
const FALLBACK_KEY = "SWAP-THYROID-2026";

export function checkAdminKey(req: NextRequest): boolean {
  const expected = process.env.ADMIN_DASH_KEY || FALLBACK_KEY;
  const got = req.headers.get("x-admin-key") || "";
  return got.length > 0 && got === expected;
}

export async function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!email || !key || !sheetId) throw new Error("Missing Google Sheets env vars");
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { sheets: google.sheets({ version: "v4", auth }), sheetId };
}

export type LeadRow = {
  row: number; // 1-based sheet row, used by /api/admin/mark
  ts: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  adId: string;
  // `booked` means "has a LIVE booking right now". A lead whose Cal.com booking
  // was cancelled reads booked:false / cancelled:true, so every booking metric
  // (booked %, cost-per-booking, pipeline forecast) counts only calls that will
  // actually happen. Cancelling in Cal.com is therefore reflected everywhere
  // without each call site having to know about cancellations.
  booked: boolean;
  cancelled: boolean;
  sessionDate: string;
  tier: string;
  city: string;
  commitment: number | null;
  amountSpent: string;
  triedBefore: string;
  challenge: string;
  budget: string;
  paid: boolean;
  paidAmount: number | null;
  score: number | null;
  showed: string; // "Y" | "N" | ""
  closedAmt: number | null;
  meetLink: string;
  /**
   * First follow-up message, composed from her own quiz answers. Present only
   * for women who have not paid — a paid lead needs a booking nudge, not a
   * first touch. Deliberately carries no price and no link: see
   * lib/draft-message.ts.
   */
  draftMessage: string;
  /** wa.me link that opens the draft, prefilled, in WhatsApp. */
  draftWa: string;
  msg1: string; // "Y" | ""
  msg2: string; // "Y" | ""
  msg3: string; // "Y" | ""
};

// ── Cal.com live booking sync ────────────────────────────────────────────────
// Shared by /api/admin/dashboard and /api/admin/digest so both agree on which
// calls are actually still happening. v2 API first (dedicated meetingUrl field
// and a status filter), v1 as fallback. Every outcome is summarized in a
// CalStatus the dashboard header displays, so a failed sync is visible and
// diagnosable from a screenshot instead of being a silent empty link.

export type CalStatus = {
  keySet: boolean;
  source: "v2" | "v1" | "none";
  fetched: number; // bookings seen
  matched: number; // email→link pairs extracted
  cancelled: number; // emails whose booking is cancelled and not rebooked
  error: string; // "" when healthy
  sample: string[]; // top-level keys of the first booking (shape debugging, no values)
};

type CalBooking = {
  // shared / v1
  startTime?: string;
  status?: string;
  location?: string;
  metadata?: { videoCallUrl?: string };
  references?: { meetingUrl?: string }[];
  attendees?: { email?: string }[];
  responses?: { email?: unknown };
  // v2 (cal-api-version 2024-08-13)
  start?: string;
  meetingUrl?: string;
  bookingFieldsResponses?: { email?: unknown };
};

const isHttp = (v?: string) => !!v && /^https?:\/\//.test(v);

function extractMeetingUrl(b: CalBooking): string {
  if (isHttp(b.location)) return b.location as string;
  if (isHttp(b.meetingUrl)) return b.meetingUrl as string;
  if (isHttp(b.metadata?.videoCallUrl)) return b.metadata!.videoCallUrl as string;
  for (const ref of b.references ?? []) {
    if (isHttp(ref.meetingUrl)) return ref.meetingUrl as string;
  }
  return "";
}

function extractEmails(b: CalBooking): string[] {
  const out: string[] = [];
  for (const a of b.attendees ?? []) {
    if (typeof a.email === "string" && a.email.includes("@")) out.push(a.email);
  }
  const fieldEmail = b.bookingFieldsResponses?.email ?? b.responses?.email;
  if (typeof fieldEmail === "string" && fieldEmail.includes("@")) out.push(fieldEmail);
  return out.map((e) => e.trim().toLowerCase());
}

// Cal.com spells it both ways across API versions; "rejected" is a host-side
// decline, which for the coach's purposes is the same thing as a cancellation.
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "rejected"]);
const ACTIVE_STATUSES = new Set(["accepted", "upcoming", "confirmed", "pending"]);

// Every lead created without a real email shares this address, so matching on it
// would tar unrelated leads with one person's cancellation.
const PLACEHOLDER_EMAIL = "noreply@swapnilumbarkarfitness.in";

export type CalState = {
  meetLinks: Map<string, string>;
  active: Set<string>; // emails with a booking that is still going to happen
  cancelled: Set<string>; // emails whose booking was cancelled (minus rebookings)
};

/**
 * Fold one page of Cal.com bookings into the shared state.
 * Cancelled and active bookings are both recorded; the caller subtracts
 * `active` from `cancelled` afterwards so a lead who cancelled and then
 * rebooked counts as booked, not cancelled.
 */
function collect(bookings: CalBooking[], state: CalState): number {
  const now = Date.now();
  let fetched = 0;
  for (const b of bookings) {
    fetched++;
    const status = (b.status ?? "").toLowerCase();
    const emails = extractEmails(b).filter((e) => e && e !== PLACEHOLDER_EMAIL);
    if (!emails.length) continue;

    if (CANCELLED_STATUSES.has(status)) {
      for (const email of emails) state.cancelled.add(email);
      continue;
    }
    if (status && !ACTIVE_STATUSES.has(status)) continue;

    const startRaw = b.startTime ?? b.start ?? "";
    const start = startRaw ? new Date(startRaw).getTime() : 0;
    if (start && start < now - 3600000) continue; // skip bookings well in the past

    for (const email of emails) state.active.add(email);
    const url = extractMeetingUrl(b);
    if (url) {
      for (const email of emails) if (!state.meetLinks.has(email)) state.meetLinks.set(email, url);
    }
  }
  return fetched;
}

async function timedFetch(url: string, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store", headers });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchV2Page(apiKey: string, calStatus: "upcoming" | "cancelled"): Promise<CalBooking[] | null> {
  const res = await timedFetch(`https://api.cal.com/v2/bookings?status=${calStatus}&take=100`, {
    Authorization: `Bearer ${apiKey}`,
    "cal-api-version": "2024-08-13",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: CalBooking[] | { bookings?: CalBooking[] } };
  return Array.isArray(json.data) ? json.data : (json.data?.bookings ?? []);
}

/**
 * Read live booking state from Cal.com: which leads still have a call coming,
 * which had theirs cancelled, and the meet link for the live ones.
 *
 * This is a pull, not a webhook, so cancelling in Cal.com shows up on the very
 * next dashboard refresh with no Cal.com-side configuration, it works
 * retroactively for bookings cancelled before this code shipped, and a missed
 * webhook can never leave the dashboard permanently out of sync.
 *
 * Never throws — any failure resolves to empty state + a status the UI shows,
 * in which case the dashboard falls back to the sheet's Booking Status.
 */
export async function fetchCalBookingState(): Promise<{ state: CalState; status: CalStatus }> {
  const apiKey = process.env.CAL_API_KEY;
  const state: CalState = { meetLinks: new Map(), active: new Set(), cancelled: new Set() };
  const status: CalStatus = { keySet: !!apiKey, source: "none", fetched: 0, matched: 0, cancelled: 0, error: "", sample: [] };
  if (!apiKey) {
    status.error = "CAL_API_KEY not set (add it in Vercel, then redeploy)";
    return { state, status };
  }

  // ── v2 first: dedicated meetingUrl/location fields ──
  try {
    const [upcoming, cancelled] = await Promise.all([
      fetchV2Page(apiKey, "upcoming"),
      // A cancelled-page failure must not sink the whole sync — worst case we
      // simply don't know about cancellations this refresh.
      fetchV2Page(apiKey, "cancelled").catch(() => null),
    ]);
    if (upcoming) {
      const list = [...upcoming, ...(cancelled ?? [])];
      if (list.length > 0) status.sample = Object.keys(list[0]).slice(0, 20);
      status.fetched = collect(list, state);
      for (const email of state.active) state.cancelled.delete(email); // rebooked wins
      status.matched = state.meetLinks.size;
      status.cancelled = state.cancelled.size;
      status.source = "v2";
      if (status.fetched > 0 && status.matched === 0 && state.active.size === 0 && status.cancelled === 0) {
        status.error = "bookings found but no meeting URL/email extracted";
      }
      return { state, status };
    }
    console.warn("[admin/cal] Cal.com v2 API rejected the request — trying v1");
  } catch (err) {
    console.warn("[admin/cal] Cal.com v2 lookup failed — trying v1", err);
  }

  // ── v1 fallback: returns every booking with its status, so one call covers both ──
  try {
    const res = await timedFetch(`https://api.cal.com/v1/bookings?apiKey=${encodeURIComponent(apiKey)}`, {});
    if (!res.ok) {
      // Cal.com decommissioned API v1 — it answers 410 to every request now, so
      // this fallback can never succeed. Reporting "check CAL_API_KEY" for that
      // sends you chasing a key that was never the problem.
      status.error =
        res.status === 410
          ? "Cal.com v1 is decommissioned (HTTP 410) and the v2 lookup above failed — check the v2 error, not the key"
          : `Cal.com API rejected the key (HTTP ${res.status}) — check CAL_API_KEY`;
      return { state, status };
    }
    const json = (await res.json()) as { bookings?: CalBooking[] };
    const list = json.bookings ?? [];
    if (list.length > 0) status.sample = Object.keys(list[0]).slice(0, 20);
    status.fetched = collect(list, state);
    for (const email of state.active) state.cancelled.delete(email);
    status.matched = state.meetLinks.size;
    status.cancelled = state.cancelled.size;
    status.source = "v1";
    if (status.fetched > 0 && status.matched === 0 && state.active.size === 0 && status.cancelled === 0) {
      status.error = "bookings found but no meeting URL/email extracted";
    }
  } catch (err) {
    status.error = "Cal.com unreachable this refresh";
    console.warn("[admin/cal] Cal.com v1 lookup failed", err);
  }
  return { state, status };
}
