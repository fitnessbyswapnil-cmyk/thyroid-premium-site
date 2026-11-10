/**
 * POST /api/ai-runner/jobs/{id}/result   header x-job-token
 *   body: { markers: [{ name, value, unit?, refRange?, flag? }], reportDate?, lab?, notes? }
 *
 * The routine hands back what it read. The body is validated against
 * MarkersResultSchema (lib/ai-jobs.ts): anything else is refused with 422, so
 * a confused run can never write free text into the dashboard.
 */
import { NextRequest, NextResponse } from "next/server";
import { getLedgerDb } from "@/lib/ledger";
import { ensureAiJobs, getJob, parseMarkersResult, saveResult, verifyJobToken } from "@/lib/ai-jobs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!verifyJobToken(process.env.MEDIA_URL_SECRET, id, req.headers.get("x-job-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = parseMarkersResult(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: "bad_result", detail: parsed.error }, { status: 422 });
  const db = await getLedgerDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  await ensureAiJobs(db);
  const job = await getJob(db, id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (job.status === "done" || job.status === "failed") return NextResponse.json({ error: "job_closed", status: job.status }, { status: 409 });
  await saveResult(db, id, parsed.value, Date.now());
  return NextResponse.json({ ok: true, markers: parsed.value.markers.length });
}
