/**
 * GET /api/admin/dashboard
 *
 * Read-only feed for the private /admin dashboard. Reads the Leads tab of the
 * intake spreadsheet (same service account as /api/leads) and returns
 * normalized lead rows; all aggregation happens client-side so the range
 * filter is instant. Auth: x-admin-key header must match ADMIN_DASH_KEY.
 *
 * This route only READS the sheet — the funnel write path (/api/leads, Make
 * scenarios) is untouched.
 *
 * Meet links: if CAL_API_KEY is set (Cal.com → Settings → Developer → API
 * Keys), booked leads' meeting links are fetched live from Cal.com and used
 * to fill in any lead that doesn't already have one manually pasted in the
 * sheet. A manually pasted link always wins — this only fills gaps, never
 * overwrites what the coach entered by hand. If the key is unset or the
 * Cal.com call fails for any reason, this is skipped silently and the
 * dashboard falls back to the sheet value / manual "+ meet link" button —
 * it can never break the dashboard.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME, type LeadRow } from "../_lib";

export const dynamic = "force-dynamic";

const num = (v: string): number | null => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// ── Cal.com meet-link lookup ─────────────────────────────────────────────────
// v2 API first (returns the video-call URL in a dedicated field), v1 as
// fallback. Every outcome is summarized in a CalStatus the dashboard header
// displays, so a failed sync is visible and diagnosable from a screenshot
// instead of being a silent empty link.

export type CalStatus = {
  keySet: boolean;
  source: "v2" | "v1" | "none";
  fetched: number; // bookings seen
  matched: number; // email→link pairs extracted
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

function collect(bookings: CalBooking[], map: Map<string, string>): number {
  const now = Date.now();
  let fetched = 0;
  for (const b of bookings) {
    fetched++;
    const status = (b.status ?? "").toLowerCase();
    if (status && !["accepted", "upcoming", "confirmed"].includes(status)) continue;
    const startRaw = b.startTime ?? b.start ?? "";
    const start = startRaw ? new Date(startRaw).getTime() : 0;
    if (start && start < now - 3600000) continue; // skip bookings well in the past
    const url = extractMeetingUrl(b);
    if (!url) continue;
    for (const email of extractEmails(b)) {
      if (!map.has(email)) map.set(email, url);
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

// Never throws — any failure resolves to an empty map + a status the UI shows.
async function fetchCalMeetLinks(): Promise<{ map: Map<string, string>; status: CalStatus }> {
  const apiKey = process.env.CAL_API_KEY;
  const map = new Map<string, string>();
  const status: CalStatus = { keySet: !!apiKey, source: "none", fetched: 0, matched: 0, error: "", sample: [] };
  if (!apiKey) {
    status.error = "CAL_API_KEY not set (add it in Vercel, then redeploy)";
    return { map, status };
  }

  // ── v2 first: dedicated meetingUrl/location fields ──
  try {
    const res = await timedFetch("https://api.cal.com/v2/bookings?status=upcoming&take=100", {
      Authorization: `Bearer ${apiKey}`,
      "cal-api-version": "2024-08-13",
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: CalBooking[] | { bookings?: CalBooking[] } };
      const list = Array.isArray(json.data) ? json.data : (json.data?.bookings ?? []);
      if (list.length > 0) status.sample = Object.keys(list[0]).slice(0, 20);
      status.fetched = collect(list, map);
      status.matched = map.size;
      status.source = "v2";
      if (status.fetched > 0 && status.matched === 0) status.error = "bookings found but no meeting URL/email extracted";
      return { map, status };
    }
    console.warn(`[admin/dashboard] Cal.com v2 API ${res.status} — trying v1`);
  } catch (err) {
    console.warn("[admin/dashboard] Cal.com v2 lookup failed — trying v1", err);
  }

  // ── v1 fallback ──
  try {
    const res = await timedFetch(`https://api.cal.com/v1/bookings?apiKey=${encodeURIComponent(apiKey)}`, {});
    if (!res.ok) {
      status.error = `Cal.com API rejected the key (HTTP ${res.status}) — check CAL_API_KEY`;
      return { map, status };
    }
    const json = (await res.json()) as { bookings?: CalBooking[] };
    const list = json.bookings ?? [];
    if (list.length > 0) status.sample = Object.keys(list[0]).slice(0, 20);
    status.fetched = collect(list, map);
    status.matched = map.size;
    status.source = "v1";
    if (status.fetched > 0 && status.matched === 0) status.error = "bookings found but no meeting URL/email extracted";
  } catch (err) {
    status.error = "Cal.com unreachable this refresh";
    console.warn("[admin/dashboard] Cal.com v1 lookup failed", err);
  }
  return { map, status };
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { sheets, sheetId } = await getSheetsClient();
    const [sheetRes, cal] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!A1:BC`,
      }),
      fetchCalMeetLinks(),
    ]);
    const calMeetLinks = cal.map;
    const rows: string[][] = (sheetRes.data.values as string[][]) ?? [];
    if (rows.length < 2) return NextResponse.json({ leads: [], calStatus: cal.status });

    const hdr = rows[0].map((h) => (h ?? "").trim());
    // lastIndexOf: the sheet has both "Lead Score (/100)" (legacy) and
    // "Lead Score" (current) — always prefer the rightmost occurrence.
    const col = (name: string, fallback: number) => {
      const i = hdr.lastIndexOf(name);
      return i >= 0 ? i : fallback;
    };
    const C = {
      ts: 0,
      name: col("Name", 2),
      phone: col("Phone", 3),
      email: col("Email", 4),
      source: col("UTM Source", 11),
      adId: col("UTM Content", 50),
      bookingStatus: col("Booking Status", 18),
      sessionDate: col("Session Date", 19),
      tier: col("Lead Tier", 36),
      city: col("City", 37),
      challenge: col("Biggest Challenge", 39),
      triedBefore: col("Tried Before", 44),
      amountSpent: col("Amount Spent", 45),
      commitment: col("Commitment (1-10)", 46),
      score: col("Lead Score", 52),
      showed: col("Showed", 53),
      closedAmt: col("Closed ₹", 54),
      meetLink: col("Meet Link", 55),
      msg1: col("Msg1 Sent", 56),
      msg2: col("Msg2 Sent", 57),
      msg3: col("Msg3 Sent", 58),
    };

    const cell = (r: string[], i: number) => (r[i] ?? "").toString().trim();
    // Phones arrive as "9987199173.0" from sheet number formatting.
    const cleanPhone = (v: string) => {
      const digits = v.replace(/\.0$/, "").replace(/\D/g, "");
      return digits.length >= 10 ? digits : "";
    };

    const leads: LeadRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const ts = cell(r, C.ts);
      // Only ISO-timestamped rows are real funnel leads (skips blank/legacy rows)
      if (!/^\d{4}-\d{2}-\d{2}T/.test(ts)) continue;
      const email = cell(r, C.email);
      const sheetMeetLink = cell(r, C.meetLink);
      leads.push({
        row: i + 1,
        ts,
        name: cell(r, C.name),
        phone: cleanPhone(cell(r, C.phone)),
        email,
        source: cell(r, C.source).toLowerCase(),
        adId: cell(r, C.adId),
        booked: cell(r, C.bookingStatus) === "Booked",
        sessionDate: cell(r, C.sessionDate),
        tier: cell(r, C.tier),
        city: cell(r, C.city),
        commitment: num(cell(r, C.commitment)),
        amountSpent: cell(r, C.amountSpent),
        triedBefore: cell(r, C.triedBefore),
        challenge: cell(r, C.challenge),
        score: num(cell(r, C.score)),
        showed: cell(r, C.showed).toUpperCase(),
        closedAmt: num(cell(r, C.closedAmt)),
        // Manual sheet value always wins; Cal.com only fills an empty slot.
        meetLink: sheetMeetLink || calMeetLinks.get(email.trim().toLowerCase()) || "",
        msg1: cell(r, C.msg1).toUpperCase(),
        msg2: cell(r, C.msg2).toUpperCase(),
        msg3: cell(r, C.msg3).toUpperCase(),
      });
    }
    // Newest first; cap the payload — charts only need recent history.
    leads.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return NextResponse.json({ leads: leads.slice(0, 600), calStatus: cal.status });
  } catch (err) {
    console.error("[admin/dashboard]", err);
    return NextResponse.json({ error: "sheet_read_failed" }, { status: 500 });
  }
}
