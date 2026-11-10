/**
 * POST /api/ai-runner/jobs/{id}/fail   header x-job-token   body: { reason }
 *
 * The routine reports that it could not read the report (unreadable photo,
 * not a lab report, download failed). The dashboard then offers a retry and
 * manual entry. The reason is kept short and shown to the owner as-is.
 */
import { NextRequest, NextResponse } from "next/server";
import { getLedgerDb } from "@/lib/ledger";
import { ensureAiJobs, failJob, getJob, verifyJobToken } from "@/lib/ai-jobs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!verifyJobToken(process.env.MEDIA_URL_SECRET, id, req.headers.get("x-job-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 160) : "unspecified";
  const db = await getLedgerDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  await ensureAiJobs(db);
  const job = await getJob(db, id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (job.status === "done") return NextResponse.json({ error: "job_closed", status: job.status }, { status: 409 });
  await failJob(db, id, `claude: ${reason}`, Date.now());
  return NextResponse.json({ ok: true });
}
