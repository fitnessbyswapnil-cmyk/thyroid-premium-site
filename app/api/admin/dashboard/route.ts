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
import { budgetAnswer, scoreBooking } from "@/lib/lead-score";
import { checkAdminKey, getSheetsClient, fetchCalBookingState, SHEET_NAME, type LeadRow } from "../_lib";
import { draftMessage, draftWaLink } from "@/lib/draft-message";

export type { CalStatus } from "../_lib";

export const dynamic = "force-dynamic";

const num = (v: string): number | null => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

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
      fetchCalBookingState(),
    ]);
    const calMeetLinks = cal.state.meetLinks;
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
      // Quiz answers the draft message is built from. -1 when the sheet
      // predates the column, which draftMessage degrades around.
      diagnosis: col("Diagnosis", -1),
      medication: col("On Medication", -1),
      duration: col("Struggle Duration", -1),
      amountSpent: col("Amount Spent", 45),
      commitment: col("Commitment (1-10)", 46),
      budget: col("Budget", -1),
      paid: col("Paid", -1),
      paidAmount: col("Paid Amount", -1),
      score: col("Lead Score", 52),
      showed: col("Showed", 53),
      closedAmt: col("Closed ₹", 54),
      meetLink: col("Meet Link", 55),
      msg1: col("Msg1 Sent", 56),
      msg2: col("Msg2 Sent", 57),
      msg3: col("Msg3 Sent", 58),
    };

    const cell = (r: string[], i: number) => (r[i] ?? "").toString().trim();

    /**
     * Compose her first follow-up, but only for women who have not paid.
     * Drafting one for a payer would put a "why hasn't anything worked" opener
     * in front of someone who already said yes.
     */
    const draftFor = (
      r: string[],
      cols: typeof C,
      phone: string,
    ): { draftMessage: string; draftWa: string } => {
      const alreadyPaid = cols.paid >= 0 && cell(r, cols.paid).toUpperCase() === "Y";
      if (alreadyPaid) return { draftMessage: "", draftWa: "" };
      const message = draftMessage({
        name: cell(r, cols.name),
        challenge: cell(r, cols.challenge),
        diagnosis: cols.diagnosis >= 0 ? cell(r, cols.diagnosis) : "",
        medication: cols.medication >= 0 ? cell(r, cols.medication) : "",
        duration: cols.duration >= 0 ? cell(r, cols.duration) : "",
        tried: cell(r, cols.triedBefore),
        budget: cols.budget >= 0 ? cell(r, cols.budget) : "",
      });
      return { draftMessage: message, draftWa: draftWaLink(phone, message) };
    };
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
      const emailKey = email.trim().toLowerCase();
      const sheetBooked = cell(r, C.bookingStatus) === "Booked";
      // Cal.com is the source of truth for whether the call still stands. The
      // sheet only ever records "Booked" at creation time and is never updated
      // when the coach cancels, so a cancellation there would otherwise be
      // invisible. Only downgrade a booking we can positively see was
      // cancelled — if Cal.com is unreachable both sets are empty and the sheet
      // value stands unchanged.
      const calCancelled = !!emailKey && cal.state.cancelled.has(emailKey);
      const calActive = !!emailKey && cal.state.active.has(emailKey);
      // Her Cal.com qualifying answers, when she booked through the live
      // funnel. The sheet never receives these, so before this every Cal.com
      // booking showed a blank score and a blank budget.
      const calAnswers = emailKey ? cal.state.answers.get(emailKey) : undefined;
      const intent = calAnswers ? scoreBooking(calAnswers) : null;
      const sheetScore = num(cell(r, C.score));
      leads.push({
        row: i + 1,
        ts,
        name: cell(r, C.name),
        phone: cleanPhone(cell(r, C.phone)),
        email,
        source: cell(r, C.source).toLowerCase(),
        adId: cell(r, C.adId),
        booked: calActive || (sheetBooked && !calCancelled),
        cancelled: calCancelled && !calActive,
        sessionDate: cell(r, C.sessionDate),
        tier: cell(r, C.tier),
        city: cell(r, C.city),
        commitment: num(cell(r, C.commitment)),
        amountSpent: cell(r, C.amountSpent),
        triedBefore: cell(r, C.triedBefore),
        challenge: cell(r, C.challenge),
        budget: (C.budget >= 0 ? cell(r, C.budget) : "") || (calAnswers ? budgetAnswer(calAnswers) : ""),
        paid: C.paid >= 0 && cell(r, C.paid).toUpperCase() === "Y",
        paidAmount: C.paidAmount >= 0 ? num(cell(r, C.paidAmount)) : null,
        // Intent beats severity: a woman who can pay Rs 50,000 and decides
        // alone is a better call than one with worse symptoms and no budget.
        score: intent?.score ?? sheetScore,
        scoreBasis: intent?.score != null ? "intent" : sheetScore != null ? "severity" : null,
        scoreAnswered: intent?.answered ?? 0,
        showed: cell(r, C.showed).toUpperCase(),
        closedAmt: num(cell(r, C.closedAmt)),
        // Manual sheet value always wins; Cal.com only fills an empty slot.
        // A cancelled call has no live room to join, so no link is offered.
        meetLink: calCancelled && !calActive ? "" : sheetMeetLink || calMeetLinks.get(emailKey) || "",
        ...draftFor(r, C, cleanPhone(cell(r, C.phone))),
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
