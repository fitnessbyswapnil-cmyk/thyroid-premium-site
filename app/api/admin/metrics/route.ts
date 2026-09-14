/**
 * GET /api/admin/metrics?days=14   (days=0 → all time)
 *
 * The ONE source of business numbers for Today, Pipeline, Analytics and the
 * digest. Every figure is computed by lib/metrics from the dataset
 * lib/metrics-source loads; this route only chooses the window.
 *
 * Read-only. Sends nothing to Meta, writes nothing to the sheet.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { summarize, checklistSummary, windowFor } from "@/lib/metrics";
import { loadMetricsDataset } from "@/lib/metrics-source";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = Number(req.nextUrl.searchParams.get("days") ?? 14);
  const days = Number.isFinite(raw) ? Math.max(0, Math.min(3650, Math.floor(raw))) : 14;
  try {
    const { data, sources } = await loadMetricsDataset(req.nextUrl.searchParams.get("fresh") === "1");
    const now = Date.now();
    const summary = summarize(data, windowFor(days, now), now);
    // Month-to-date and all-time, for the few figures that are about the month
    // or the whole history rather than the chosen range (on-pace, close rate).
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const month = summarize(data, { from: monthStart.getTime(), to: now + 1 }, now);
    const allTime = summarize(data, windowFor(0, now), now);
    return NextResponse.json({
      days,
      summary: {
        ...summary,
        excludedTestRows: {
          leads: summary.excludedTestRows.leads,
          bookings: summary.excludedTestRows.bookings + sources.ownerTestBookingsDroppedAtSource,
        },
      },
      month: { revenue: month.revenue, won: month.won },
      allTime: { won: allTime.won, attended: allTime.attended, revenue: allTime.revenue },
      checklist: checklistSummary(data.calls),
      sources,
      generatedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
