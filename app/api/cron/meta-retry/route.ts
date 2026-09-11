/**
 * GET /api/cron/meta-retry
 *
 * Resends Meta Conversions API events whose live send failed, reading them
 * from the D1 ledger (lib/ledger.ts). The worker cron runs it every 15 minutes:
 * "*\/15 * * * *" in wrangler.jsonc, routed by CRON_ROUTES in custom-worker.js.
 *
 * WHAT IT SENDS
 * The stored event object, unchanged. The ORIGINAL event_id, so Meta still
 * dedupes it against the browser Pixel leg. The ORIGINAL event_time, so the
 * conversion is reported for when it happened, not when the retry ran. Never a
 * Test Events send: rows carrying a test code are never selected, because a
 * resend without the code would land in production as a real conversion.
 *
 * WHEN IT GIVES UP (status 'dead')
 *   - after 5 attempts in all, the live one included (waits: 15m, 30m, 1h, 2h);
 *   - when event_time is within an hour of Meta's 7-day limit. Meta rejects
 *     the whole request for an event older than 7 days, so it cannot land.
 *
 * AUTHORIZATION — one of (same as /api/cron/payment-reminder):
 *   Authorization: Bearer <CRON_SECRET>   (the worker cron)
 *   x-admin-key: <admin key>              (you, by hand)
 *
 * ?dryRun=1  reports what would be resent or retired and changes nothing.
 *
 * Off Cloudflare (the Vercel rollback copy) there is no ledger: 200, skipped.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../../admin/_lib";
import { sendToCAPI } from "@/lib/server-tracking";
import {
  getLedgerDb,
  listDueRetries,
  claimRetry,
  recordRetry,
  markDead,
  parseStoredEvent,
  retryDecision,
  MAX_ATTEMPTS,
  RETRY_BATCH_SIZE,
} from "@/lib/ledger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Outcome = { event_name: string; event_id: string; attempts: number; outcome: string };

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron && !checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams;
  const dryRun = q.get("dryRun") === "1" || q.get("dryRun") === "true";

  const db = await getLedgerDb();
  if (!db) {
    return NextResponse.json({
      ok: true,
      skipped: "no_ledger",
      note: "No LEDGER binding on this host. The ledger exists only on the Cloudflare worker.",
    });
  }

  const rows = await listDueRetries(db, Date.now(), RETRY_BATCH_SIZE);
  const tally = { sent: 0, failed: 0, dead: 0, skipped: 0, wouldRetry: 0 };
  const results: Outcome[] = [];

  for (const row of rows) {
    const base = { event_name: row.event_name, event_id: row.event_id, attempts: row.attempts };
    const event = parseStoredEvent(row.payload_json, row.event_id);
    const decision = event ? retryDecision(row, event.event_time, Date.now()) : "expire";

    if (!event || decision === "expire") {
      const reason = !event
        ? "stored payload unreadable"
        : row.attempts >= MAX_ATTEMPTS
          ? `out of attempts (${row.attempts})`
          : "past Meta's 7-day event_time window";
      if (!dryRun) await markDead(db, row, reason);
      tally.dead++;
      results.push({ ...base, outcome: `${dryRun ? "would_retire" : "dead"}: ${reason}` });
      continue;
    }
    if (decision !== "retry") {
      tally.skipped++;
      results.push({ ...base, outcome: decision });
      continue;
    }
    if (dryRun) {
      tally.wouldRetry++;
      results.push({ ...base, outcome: "would_retry" });
      continue;
    }
    // Hold the row for this run, so an overlapping run (the cron plus a manual
    // call) cannot send it twice.
    if (!(await claimRetry(db, row, Date.now()))) {
      tally.skipped++;
      results.push({ ...base, outcome: "claimed_by_another_run" });
      continue;
    }

    // No test code, deliberately: test rows are never selected (see header).
    const result = await sendToCAPI([event]);
    const status = await recordRetry(db, { row, event, result });
    if (result.success) tally.sent++;
    else if (status === "dead") tally.dead++;
    else tally.failed++;
    results.push({
      ...base,
      attempts: row.attempts + 1,
      outcome: result.success ? "sent" : `${status ?? "failed"}: ${(result.error || "unknown error").slice(0, 200)}`,
    });
  }

  console.log(
    `[meta-retry] due=${rows.length} sent=${tally.sent} failed=${tally.failed} dead=${tally.dead} skipped=${tally.skipped}` +
      (dryRun ? ` dryRun wouldRetry=${tally.wouldRetry}` : ""),
  );
  return NextResponse.json({ ok: true, dryRun, due: rows.length, ...tally, results });
}
