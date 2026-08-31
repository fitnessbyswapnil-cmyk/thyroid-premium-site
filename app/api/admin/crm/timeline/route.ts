/**
 * /api/admin/crm/timeline?uid=<cal booking uid>  (or ?phone=)
 *
 * One lead, one story. Merges four stores into a single chronological list:
 *
 *   Cal.com  → she booked, what she answered, whether she cancelled
 *   WhatsApp → every message in and out (Messages tab)
 *   Fathom   → the call, what was pitched, what blocked it (Calls tab)
 *   Cashfree → the payment (Leads tab)
 *
 * Loaded per-lead rather than folded into the main feed, because the message
 * history is by far the largest thing here and almost never needed for the
 * hundred cards you are NOT looking at.
 *
 * Auth: x-admin-key.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../../_lib";
import { fetchBookings } from "@/lib/cal-bookings";
import { readCalls } from "@/lib/crm-calls";
import { readMessages } from "@/lib/wa-messages";

export const dynamic = "force-dynamic";

const digits = (s: string) => String(s ?? "").replace(/\D/g, "");
/** Indian numbers arrive with and without the 91 prefix. Compare on the last 10. */
const tail10 = (s: string) => digits(s).slice(-10);
const norm = (s: string) => String(s ?? "").trim().toLowerCase();

export type TimelineEvent = {
  at: string;
  kind: "booked" | "cancelled" | "message_in" | "message_out" | "call" | "payment" | "quiz";
  title: string;
  body?: string;
  meta?: Record<string, string>;
};

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const uid = (req.nextUrl.searchParams.get("uid") ?? "").trim();
  const phoneParam = (req.nextUrl.searchParams.get("phone") ?? "").trim();
  if (!uid && !phoneParam) return NextResponse.json({ error: "uid or phone required" }, { status: 400 });

  const [bookingsR, callsR, messagesR, leadsR] = await Promise.allSettled([
    fetchBookings(100),
    readCalls(),
    readMessages(),
    (async () => {
      const { sheets, sheetId } = await getSheetsClient();
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!A1:BC` });
      return (r.data.values as string[][]) ?? [];
    })(),
  ]);

  const bookings = bookingsR.status === "fulfilled" ? bookingsR.value.bookings : [];
  const calls = callsR.status === "fulfilled" ? callsR.value : [];
  const messages = messagesR.status === "fulfilled" ? messagesR.value : [];
  const leadRows = leadsR.status === "fulfilled" ? leadsR.value : [];

  const booking = uid ? bookings.find((b) => b.uid === uid) : undefined;
  const phone = phoneParam || booking?.phone || "";
  const email = norm(booking?.email ?? "");
  const key = tail10(phone);

  const events: TimelineEvent[] = [];

  // ── Booking + her qualifying answers ──────────────────────────────────────
  if (booking) {
    events.push({
      at: booking.startIso,
      kind: booking.cancelled ? "cancelled" : "booked",
      title: booking.cancelled ? "Booking cancelled" : "Call booked",
      meta: { status: booking.status },
    });

    // Her answers are a single moment in the story, not twelve separate ones.
    const answers = Object.entries(booking.answers)
      .filter(([k]) => !["email", "name", "guests", "location", "attendeephonenumber", "displayemail", "displayguests", "smsremindernumber"].includes(norm(k)))
      .map(([k, v]) => {
        const val = typeof v === "string" ? v : v && typeof v === "object" && "value" in (v as Record<string, unknown>) ? String((v as { value?: unknown }).value ?? "") : "";
        return val ? `${k.replace(/[-_]/g, " ")}: ${val}` : "";
      })
      .filter(Boolean);

    if (answers.length) {
      events.push({
        at: booking.startIso,
        kind: "quiz",
        title: "What she told us before the call",
        body: answers.join("\n"),
      });
    }
  }

  // ── WhatsApp, both directions ─────────────────────────────────────────────
  if (key) {
    for (const m of messages) {
      if (tail10(m.phone) !== key) continue;
      events.push({
        at: m.ts,
        kind: m.direction === "in" ? "message_in" : "message_out",
        title: m.direction === "in" ? "She wrote" : "You sent",
        body: m.text || (m.mediaType ? `[${m.mediaType}]` : ""),
      });
    }
  }

  // ── The call ──────────────────────────────────────────────────────────────
  const call = uid ? calls.find((c) => c.bookingUid === uid) : undefined;
  if (call) {
    const meta: Record<string, string> = {};
    if (call.pricePitched) meta.pitched = call.pricePitched;
    if (call.lowestPriceSaid && call.lowestPriceSaid !== call.pricePitched) meta.droppedTo = call.lowestPriceSaid;
    if (call.discountAt) meta.discountAt = call.discountAt;
    if (call.objection) meta.blocker = call.objection;
    if (call.excuse) meta.sheSaid = call.excuse;
    if (call.scorecardFailed) meta.missed = `${call.scorecardFailed}/10`;
    if (call.coachTalkPct) meta.youTalked = `${call.coachTalkPct}%`;
    if (call.agreedCallbackAt) meta.agreedBy = call.agreedCallbackAt;

    events.push({
      at: call.occurredAt || booking?.startIso || "",
      kind: "call",
      title: /^n$/i.test(call.attended) ? "She did not join" : "Call happened",
      body: call.summary,
      meta,
    });
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  if (leadRows.length > 1 && (email || key)) {
    const header = leadRows[0].map(norm);
    const at = (...names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(norm(n));
        if (i >= 0) return i;
      }
      return -1;
    };
    const iEmail = at("Email");
    const iPhone = at("Phone");
    const iPaid = at("Paid");
    const iAmt = at("Paid Amount");
    const iAt = at("Paid At");

    for (let r = 1; r < leadRows.length; r++) {
      const row = leadRows[r] ?? [];
      const get = (i: number) => (i >= 0 ? String(row[i] ?? "").trim() : "");
      const matches = (email && norm(get(iEmail)) === email) || (key && tail10(get(iPhone)) === key);
      if (!matches) continue;
      const amt = get(iAmt);
      const paid = /^y(es)?$/i.test(get(iPaid)) || parseFloat(amt.replace(/[^\d.]/g, "")) > 0;
      if (!paid) continue;
      events.push({
        at: get(iAt) || "",
        kind: "payment",
        title: amt ? `Paid ₹${amt}` : "Paid",
        meta: { amount: amt },
      });
      break;
    }
  }

  // Chronological. Events with no timestamp sink to the bottom rather than
  // pretending to be from 1970 and sitting at the top of her story.
  const t = (e: TimelineEvent) => {
    const n = new Date(e.at).getTime();
    return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
  };
  events.sort((a, b) => t(a) - t(b));

  return NextResponse.json({ uid, phone, events });
}
