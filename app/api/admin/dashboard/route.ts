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

type CalBooking = {
  startTime?: string;
  status?: string;
  location?: string;
  metadata?: { videoCallUrl?: string };
  references?: { meetingUrl?: string }[];
  attendees?: { email?: string }[];
};

function extractMeetingUrl(b: CalBooking): string {
  const isHttp = (v?: string) => !!v && /^https?:\/\//.test(v);
  if (isHttp(b.location)) return b.location as string;
  if (isHttp(b.metadata?.videoCallUrl)) return b.metadata!.videoCallUrl as string;
  for (const ref of b.references ?? []) {
    if (isHttp(ref.meetingUrl)) return ref.meetingUrl as string;
  }
  return "";
}

// Returns a map of lowercased attendee email -> meeting URL, for upcoming
// bookings only. Never throws — any failure resolves to an empty map so the
// dashboard degrades to sheet-only meet links.
async function fetchCalMeetLinks(): Promise<Map<string, string>> {
  const apiKey = process.env.CAL_API_KEY;
  const map = new Map<string, string>();
  if (!apiKey) return map;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://api.cal.com/v1/bookings?apiKey=${encodeURIComponent(apiKey)}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[admin/dashboard] Cal.com API ${res.status} — meet links skipped this refresh`);
      return map;
    }
    const json = (await res.json()) as { bookings?: CalBooking[] };
    const now = Date.now();
    for (const b of json.bookings ?? []) {
      if (b.status && !["accepted", "ACCEPTED"].includes(b.status)) continue;
      const start = b.startTime ? new Date(b.startTime).getTime() : 0;
      if (start && start < now - 3600000) continue; // skip bookings well in the past
      const url = extractMeetingUrl(b);
      if (!url) continue;
      for (const a of b.attendees ?? []) {
        const email = (a.email ?? "").trim().toLowerCase();
        if (email && !map.has(email)) map.set(email, url);
      }
    }
  } catch (err) {
    console.warn("[admin/dashboard] Cal.com lookup failed — meet links skipped this refresh", err);
  } finally {
    clearTimeout(timeout);
  }
  return map;
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { sheets, sheetId } = await getSheetsClient();
    const [sheetRes, calMeetLinks] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!A1:BC`,
      }),
      fetchCalMeetLinks(),
    ]);
    const rows: string[][] = (sheetRes.data.values as string[][]) ?? [];
    if (rows.length < 2) return NextResponse.json({ leads: [] });

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
    return NextResponse.json({ leads: leads.slice(0, 600) });
  } catch (err) {
    console.error("[admin/dashboard]", err);
    return NextResponse.json({ error: "sheet_read_failed" }, { status: 500 });
  }
}
