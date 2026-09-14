/**
 * GET /api/cron/journey — the daily pipeline housekeeping (CRM brief Tasks 7-8).
 *
 * Runs at 02:30 UTC (08:00 IST), just before the morning digest, from the same
 * cron trigger ("30 2 * * *", custom-worker.js). For every woman:
 *   - stores her furthest stage and its marks (observed or inferred), so a
 *     stage once reached is never lost (lib/journey ratchet);
 *   - moves her to NURTURE when 30 days have passed with nothing from her —
 *     no sheet row, payment, booking or inbound WhatsApp — no call on the
 *     calendar, and she is not a client;
 *   - releases her from nurture the moment any of that changes.
 * Every run logs how many moved and how many came back (journey_runs).
 * NOTHING IS DELETED: nurture is a date on her row, and her history stays.
 *
 * Reads the sheets and Cal.com; writes only D1. Sends nothing to Meta, sends
 * no WhatsApp.
 *
 * ?dry=1 reports what it would change and writes nothing.
 *
 * AUTHORIZATION — one of:
 *   Authorization: Bearer <CRON_SECRET>   (the worker cron)
 *   x-admin-key: <admin key>              (by hand — the retroactive first run)
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../../admin/_lib";
import { loadJourneys } from "@/lib/journey-source";
import { nurtureMoves, pipelineCounts } from "@/lib/journey";
import { writeJourneys } from "@/lib/journey-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron && !checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  const { journeys, now, pipeline: before } = await loadJourneys({ force: true });
  const { move, release } = nurtureMoves(journeys);
  const moving = new Set(move.map((j) => j.id));
  const releasing = new Set(release.map((j) => j.id));

  const rows = journeys.map((j) => ({
    journey: moving.has(j.id) ? { ...j, state: "nurture" as const } : j,
    nurtureSince: moving.has(j.id) ? now : releasing.has(j.id) ? null : j.nurtureSince,
  }));
  const after = pipelineCounts(rows.map((r) => r.journey));

  const summary = {
    people: journeys.length,
    movedToNurture: move.length,
    released: release.length,
    inferredStages: journeys.reduce((n, j) => n + j.inferredStages.length, 0),
    dryRun: dry,
  };
  const stored = dry ? { ok: true, written: 0, skipped: "dry run" } : await writeJourneys(rows, summary, now);

  const report = {
    ...summary,
    inPipeline: { before: before.inPipeline, after: after.inPipeline },
    nurture: { before: before.nurture, after: after.nurture },
    furthest: journeys.reduce<Record<string, number>>((m, j) => ((m[j.furthest] = (m[j.furthest] ?? 0) + 1), m), {}),
    stored,
  };
  console.log(`[journey] ${JSON.stringify(report)}`);
  return NextResponse.json(report);
}
