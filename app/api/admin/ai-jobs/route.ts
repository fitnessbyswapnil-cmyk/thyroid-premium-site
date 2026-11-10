/**
 * POST /api/admin/ai-jobs  { kind: "report_markers", mediaId, mime? }
 *   → { job: { id, status: "queued", sessionUrl? }, reused? }
 * GET  /api/admin/ai-jobs?id=…  or  ?mediaId=…  → { job } | 404
 *
 * Auth: x-admin-key. Hands a job to the Claude routine (lib/ai-jobs.ts) and
 * reports on it. A job already queued or running for the same report is
 * returned instead of firing the routine twice: the fire endpoint has no
 * idempotency key, so a double tap would otherwise start two sessions.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { isMediaId } from "@/lib/wa-media";
import { getLedgerDb } from "@/lib/ledger";
import { PRODUCTION_HOST } from "@/lib/tracking-host";
import {
  activeJobForMedia, createJob, ensureAiJobs, failJob, fireRoutine, fireText, getJob,
  latestJobForMedia, mintJobToken, publicJob, purgeOld, routineConfig, setSessionUrl,
} from "@/lib/ai-jobs";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { kind?: unknown; mediaId?: unknown; mime?: unknown } | null;
  const mediaId = typeof body?.mediaId === "string" ? body.mediaId.trim() : "";
  if (body?.kind !== "report_markers") return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  if (!isMediaId(mediaId)) return NextResponse.json({ error: "bad_media_id" }, { status: 400 });
  const mime = typeof body?.mime === "string" ? body.mime.slice(0, 100) : "";

  const secret = process.env.MEDIA_URL_SECRET;
  if (!secret) return NextResponse.json({ error: "media_signing_not_configured" }, { status: 503 });
  const routine = routineConfig(process.env as Record<string, string | undefined>);
  if (!routine) return NextResponse.json({ error: "claude_routine_not_configured" }, { status: 503 });
  const db = await getLedgerDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const now = Date.now();
  await ensureAiJobs(db);
  await purgeOld(db, now);
  const active = await activeJobForMedia(db, mediaId, now);
  if (active) return NextResponse.json({ job: publicJob(active), reused: true }, { headers: noStore });

  const id = await createJob(db, { kind: "report_markers", mediaId, mime }, now);
  const fired = await fireRoutine({
    routineId: routine.id,
    token: routine.token,
    text: fireText(`https://${PRODUCTION_HOST}`, id, mintJobToken(secret, id)),
  });
  if (!fired.ok) {
    await failJob(db, id, `fire_failed: ${fired.error}`, Date.now());
    console.error("[ai-jobs] fire failed:", fired.status, fired.error);
    return NextResponse.json(
      { error: "fire_failed", detail: fired.error, ...(fired.retryAfter ? { retryAfter: fired.retryAfter } : {}) },
      { status: 502, headers: noStore },
    );
  }
  await setSessionUrl(db, id, fired.sessionUrl, Date.now());
  const job = await getJob(db, id);
  return NextResponse.json({ job: job ? publicJob(job) : { id, status: "queued" } }, { headers: noStore });
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await getLedgerDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  await ensureAiJobs(db);
  const q = req.nextUrl.searchParams;
  const id = (q.get("id") ?? "").trim();
  const mediaId = (q.get("mediaId") ?? "").trim();
  const job = id ? await getJob(db, id) : isMediaId(mediaId) ? await latestJobForMedia(db, mediaId) : null;
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
  return NextResponse.json({ job: publicJob(job) }, { headers: noStore });
}
