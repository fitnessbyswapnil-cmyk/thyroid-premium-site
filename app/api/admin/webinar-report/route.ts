/**
 * GET /api/admin/webinar-report?cohort=mc-20260924T143000Z
 *
 * One class, end to end, from the Leads tab: how many registered, where they
 * came from, how many turned up, how many stayed to the pitch.
 *
 * WHY "paid" EXCLUDES SOME ROWS: the /decode quiz gate sends women who do not
 * qualify to /webinar (src=decode_nurture), and registrants share the page with
 * friends (utm_medium=whatsapp_share). Neither was bought by the webinar's ads,
 * so neither may sit in its cost per registration.
 *
 * Auth: x-admin-key, or Bearer CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";
import { WEBINAR_START_ISO } from "@/lib/webinar";
import { cohortKey, REGISTERED_STATUS, SOURCE_PATH_HEADER, WEBINAR_DATE_HEADER } from "@/lib/webinar-reminders";
import { PITCH_MINUTES } from "@/lib/webinar-attendance";

export const dynamic = "force-dynamic";

const findCol = (header: string[], title: string) =>
  header.findIndex((h) => String(h ?? "").trim().toLowerCase() === title.toLowerCase());

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron && !checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cohort = new URL(req.url).searchParams.get("cohort")?.trim() || cohortKey(WEBINAR_START_ISO);

  try {
    const { sheets, sheetId } = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: SHEET_NAME });
    const all: string[][] = (res.data.values as string[][]) ?? [];
    const header = (all[0] ?? []).map((h) => String(h ?? ""));
    const cell = (r: string[], i: number) => (i >= 0 ? String(r?.[i] ?? "").trim() : "");

    const col = {
      status: findCol(header, "Status"),
      date: findCol(header, WEBINAR_DATE_HEADER),
      src: findCol(header, SOURCE_PATH_HEADER),
      medium: findCol(header, "UTM Medium"),
      content: findCol(header, "UTM Content"),
      bot: findCol(header, "Bot Check"),
      attended: findCol(header, "Attended Min"),
    };
    if (col.status < 0 || col.date < 0) {
      return NextResponse.json({ error: "missing_columns", ...col }, { status: 500 });
    }

    const rows = all.slice(1).filter((r) => cell(r, col.status) === REGISTERED_STATUS && cell(r, col.date) === cohort);

    const byAd = new Map<string, number>();
    let nurture = 0, share = 0, unverified = 0, attended = 0, stayed = 0, minutes = 0;
    for (const r of rows) {
      const src = cell(r, col.src);
      const medium = cell(r, col.medium);
      if (src === "decode_nurture") nurture++;
      else if (medium === "whatsapp_share") share++;
      else {
        const ad = cell(r, col.content) || "(no utm_content)";
        byAd.set(ad, (byAd.get(ad) ?? 0) + 1);
      }
      if (cell(r, col.bot).toLowerCase() === "unverified") unverified++;
      const min = Number(cell(r, col.attended) || 0);
      if (min > 0) {
        attended++;
        minutes += min;
        if (min >= PITCH_MINUTES) stayed++;
      }
    }

    const paid = rows.length - nurture - share;
    const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : null);

    return NextResponse.json({
      cohort,
      classStart: WEBINAR_START_ISO,
      registrations: { total: rows.length, paid, nurture, share, unverified },
      attendance: {
        attended,
        stayedToPitch: stayed,
        showUpPct: pct(attended, rows.length),
        stayedPct: pct(stayed, attended),
        averageMinutes: attended > 0 ? Math.round(minutes / attended) : null,
        imported: col.attended >= 0,
      },
      byAd: Object.fromEntries([...byAd].sort((a, b) => b[1] - a[1])),
      note: "Cost per registration should use `paid` only. Sales come from the CRM, not this route.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webinar-report] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
