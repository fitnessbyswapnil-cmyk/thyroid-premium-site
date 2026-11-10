/**
 * GET /api/ai-runner/jobs/{id}   header x-job-token
 *   → { id, kind, report: { url, mime }, guide }
 *
 * The Claude routine's only way in (docs/ai-runner.md). Authorised by the
 * job token the fire carried, which opens this one job until it expires.
 * The report URL carries a short-lived media pass, never the admin key.
 * Marks the job running.
 */
import { NextRequest, NextResponse } from "next/server";
import { getLedgerDb } from "@/lib/ledger";
import { mintMediaPass } from "@/lib/media-pass";
import { PRODUCTION_HOST } from "@/lib/tracking-host";
import { ensureAiJobs, getJob, markRunning, verifyJobToken } from "@/lib/ai-jobs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const secret = process.env.MEDIA_URL_SECRET;
  if (!verifyJobToken(secret, id, req.headers.get("x-job-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getLedgerDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  await ensureAiJobs(db);
  const job = await getJob(db, id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (job.status === "done" || job.status === "failed") return NextResponse.json({ error: "job_closed", status: job.status }, { status: 409 });
  await markRunning(db, id, Date.now());
  const pass = mintMediaPass(secret as string);
  const url = `https://${PRODUCTION_HOST}/api/admin/media?id=${encodeURIComponent(job.media_id)}&exp=${pass.exp}&sig=${encodeURIComponent(pass.sig)}`;
  return NextResponse.json(
    { id: job.id, kind: job.kind, report: { url, mime: job.mime }, guide: "docs/ai-runner.md" },
    { headers: { "cache-control": "no-store" } },
  );
}
