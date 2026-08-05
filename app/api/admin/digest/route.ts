/**
 * GET /api/admin/digest
 *
 * Composes the daily Morning Brief (plain text): yesterday's numbers, today's
 * sessions with risk flags, and the action-queue counts. Two callers:
 *
 *  1. The dashboard / owner (x-admin-key header) — returns { text }.
 *  2. Vercel Cron at 8:00 AM IST (02:30 UTC, vercel.json) — authorized via
 *     the standard CRON_SECRET Bearer header. If MAKE_DIGEST_WEBHOOK is set,
 *     the brief is POSTed there as { text } so a 3-module Make scenario
 *     (Webhook → Gmail) can email/WhatsApp it to the owner. If the webhook
 *     env is unset the cron is a harmless no-op that still returns the text.
 *
 * Read-only on the sheet; sends nothing to leads — the brief goes to the
 * OWNER only.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";

export const dynamic = "force-dynamic";

const IST_OFFSET_MS = 5.5 * 3600000;

function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}
function istDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseSession(sessionDate: string): Date | null {
  const m = sessionDate.match(/^(\d{1,2}) (\w{3}) (\d{4}) (\d{1,2}):(\d{2}) ([AP]M)/);
  if (!m) return null;
  const [, d, mon, y, h, min, ap] = m;
  let hour = parseInt(h, 10) % 12;
  if (ap === "PM") hour += 12;
  const dt = new Date(`${mon} ${d}, ${y} ${String(hour).padStart(2, "0")}:${min}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron && !checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { sheets, sheetId } = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A1:BG`,
    });
    const rows: string[][] = (res.data.values as string[][]) ?? [];
    const hdr = (rows[0] ?? []).map((h) => (h ?? "").trim());
    const col = (name: string, fallback: number) => {
      const i = hdr.lastIndexOf(name);
      return i >= 0 ? i : fallback;
    };
    const C = {
      ts: 0,
      name: col("Name", 2),
      bookingStatus: col("Booking Status", 18),
      sessionDate: col("Session Date", 19),
      commitment: col("Commitment (1-10)", 46),
      phone: col("Phone", 3),
      score: col("Lead Score", 52),
      showed: col("Showed", 53),
      msg1: col("Msg1 Sent", 56),
    };
    const cell = (r: string[], i: number) => (r[i] ?? "").toString().trim();

    const nowIst = istNow();
    const today = istDayString(nowIst);
    const yesterday = istDayString(new Date(nowIst.getTime() - 86400000));

    let yLeads = 0, yBooked = 0, unconfirmed = 0;
    const todaySessions: { time: string; name: string; risk: string }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const ts = cell(r, C.ts);
      if (!/^\d{4}-\d{2}-\d{2}T/.test(ts)) continue;
      const leadDayIst = istDayString(new Date(new Date(ts).getTime() + IST_OFFSET_MS));
      const booked = cell(r, C.bookingStatus) === "Booked";
      if (leadDayIst === yesterday) {
        yLeads++;
        if (booked) yBooked++;
      }
      // unconfirmed = recent lead (last 3 days) with no sequence msg yet
      const ageMs = Date.now() - new Date(ts).getTime();
      if (ageMs < 3 * 86400000 && !cell(r, C.msg1) && cell(r, C.showed) === "") unconfirmed++;

      const sd = cell(r, C.sessionDate);
      const sess = sd ? parseSession(sd) : null;
      if (booked && sess && istDayString(new Date(sess.getTime() + IST_OFFSET_MS - IST_OFFSET_MS)) === today) {
        // session date string is already in IST wall-clock terms
        const commitment = parseFloat(cell(r, C.commitment));
        const phone = cell(r, C.phone);
        const risk =
          !phone || (Number.isFinite(commitment) && commitment <= 3)
            ? "HIGH no-show risk"
            : Number.isFinite(commitment) && commitment <= 6
            ? "medium risk"
            : "likely to show";
        todaySessions.push({
          time: sd.match(/\d{1,2}:\d{2} [AP]M/)?.[0] ?? sd,
          name: cell(r, C.name) || "(no name)",
          risk,
        });
      }
    }
    todaySessions.sort((a, b) => (parseSession(`05 Aug 2026 ${a.time}`)?.getTime() ?? 0) - (parseSession(`05 Aug 2026 ${b.time}`)?.getTime() ?? 0));

    const lines = [
      `MORNING BRIEF — ${nowIst.toISOString().slice(0, 10)}`,
      ``,
      `Yesterday: ${yLeads} leads, ${yBooked} booked.`,
      ``,
      todaySessions.length
        ? `Today's sessions (${todaySessions.length}):\n${todaySessions.map((s) => `  ${s.time} — ${s.name} (${s.risk})`).join("\n")}`
        : `No sessions booked for today.`,
      ``,
      unconfirmed > 0 ? `ACTION: ${unconfirmed} recent lead(s) still waiting for their first WhatsApp.` : `All recent leads contacted.`,
      ``,
      `Dashboard: https://www.swapnilumbarkarfitness.in/admin`,
    ];
    const text = lines.join("\n");

    // Cron leg: forward to Make (Webhook → Gmail) when configured.
    const webhook = process.env.MAKE_DIGEST_WEBHOOK;
    let forwarded = false;
    if (isCron && webhook) {
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        forwarded = true;
      } catch (err) {
        console.error("[admin/digest] webhook forward failed", err);
      }
    }
    return NextResponse.json({ text, forwarded });
  } catch (err) {
    console.error("[admin/digest]", err);
    return NextResponse.json({ error: "digest_failed" }, { status: 500 });
  }
}
