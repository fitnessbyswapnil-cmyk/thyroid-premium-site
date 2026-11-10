/**
 * lib/ai-jobs.ts — work the dashboard hands to Claude, with no API key.
 *
 * WHY THIS SHAPE
 * The owner chose (10-Nov-2026) not to use an Anthropic API key. AI work runs
 * as a Claude Code ROUTINE on his own Claude plan, in Anthropic's cloud, fired
 * by the routine's API trigger:
 *   POST https://api.anthropic.com/v1/claude_code/routines/{trig_id}/fire
 * The bearer token for that endpoint (CLAUDE_ROUTINE_TOKEN, generated in the
 * routine's API trigger settings at claude.ai/code/routines) can do exactly
 * one thing: start that one routine. It reads nothing and reaches nothing else.
 *
 * THE FLOW
 *  1. He presses "Read report with Claude". POST /api/admin/ai-jobs stores a
 *     job in D1 and fires the routine with ONLY a job id, a job token and the
 *     site URL. No name, no phone, no health data travels in the fire.
 *  2. The routine follows docs/ai-runner.md: it fetches the job's input from
 *     /api/ai-runner/jobs/{id} with that token, downloads the report through a
 *     short-lived media pass, reads it, and posts the values back.
 *  3. The dashboard polls GET /api/admin/ai-jobs and shows the values for him
 *     to check. Nothing here ever sends anything to a client.
 *
 * TOKENS
 * A job token is "{exp}.{hmac}" over "ai-job|v1|{id}|{exp}", keyed with
 * MEDIA_URL_SECRET: the same high-entropy server secret as media passes, kept
 * apart by its prefix, so there is one secret fewer to set. It opens one job's
 * input and result endpoints until it expires (JOB_TTL_S), and nothing else.
 *
 * DATA
 * D1 keeps the WhatsApp media id, a status and, for RESULT_KEEP_MS only, the
 * values Claude read. No name and no phone is stored. Old results are cleared
 * on every write (purgeOld), because lab values are health data and the
 * ledger database is meant to hold ids and statuses.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { D1Database } from "./ledger.ts";

export const JOB_TTL_S = 30 * 60;
export const RESULT_KEEP_MS = 48 * 60 * 60 * 1000;
/** A queued or running job younger than this is reused, never fired twice. */
export const ACTIVE_REUSE_MS = 15 * 60 * 1000;
export const JOB_KINDS = ["report_markers"] as const;
export type JobKind = (typeof JOB_KINDS)[number];
export type JobStatus = "queued" | "running" | "done" | "failed";

/**
 * The routine's id is not a secret (its token is). CLAUDE_ROUTINE_ID, when
 * set on the worker, wins over this constant.
 */
export const DEFAULT_ROUTINE_ID = "trig_01XusVCZ1Gnt2qMZgYt15XBv"; // "Thyroid AI desk: read blood report"

export function routineConfig(env: Record<string, string | undefined>): { id: string; token: string } | null {
  const id = (env.CLAUDE_ROUTINE_ID || DEFAULT_ROUTINE_ID).trim();
  const token = (env.CLAUDE_ROUTINE_TOKEN || "").trim();
  return id && token ? { id, token } : null;
}

export const fireUrl = (routineId: string) =>
  `https://api.anthropic.com/v1/claude_code/routines/${encodeURIComponent(routineId)}/fire`;

// ── Job tokens ───────────────────────────────────────────────────────────────
const SKEW_S = 120;
const payload = (id: string, exp: number) => `ai-job|v1|${id}|${exp}`;

export function signJobToken(secret: string, id: string, exp: number): string {
  return createHmac("sha256", secret).update(payload(id, exp)).digest("base64url");
}

export function mintJobToken(secret: string, id: string, nowS: number = Math.floor(Date.now() / 1000)): string {
  const exp = nowS + JOB_TTL_S;
  return `${exp}.${signJobToken(secret, id, exp)}`;
}

/** Fails closed on a missing secret, junk, expiry, a stretched expiry or a token minted for another job. */
export function verifyJobToken(
  secret: string | undefined,
  id: string,
  token: unknown,
  nowS: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !id || typeof token !== "string") return false;
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{20,})$/.exec(token);
  if (!m) return false;
  const exp = Number(m[1]);
  if (exp <= nowS || exp > nowS + JOB_TTL_S + SKEW_S) return false;
  const want = Buffer.from(signJobToken(secret, id, exp));
  const got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got);
}

// ── Firing the routine ───────────────────────────────────────────────────────
/** Everything the routine is told. Deliberately nothing about her. */
export function fireText(site: string, id: string, jobToken: string): string {
  return [
    "AI desk job for the thyroid coaching dashboard.",
    `job_id: ${id}`,
    `job_token: ${jobToken}`,
    `site: ${site}`,
    "Follow docs/ai-runner.md in this repository exactly. Never print, log or commit the job token.",
  ].join("\n");
}

export type FireResult =
  | { ok: true; sessionUrl: string }
  | { ok: false; status: number; error: string; retryAfter?: string };

export async function fireRoutine(
  opts: { routineId: string; token: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<FireResult> {
  try {
    const res = await fetchImpl(fireUrl(opts.routineId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: opts.text }),
    });
    let j: { type?: string; claude_code_session_url?: string; error?: { type?: string } } | null = null;
    try {
      j = await res.json();
    } catch {
      j = null;
    }
    if (res.ok && j?.type === "routine_fire") return { ok: true, sessionUrl: String(j.claude_code_session_url ?? "") };
    return {
      ok: false,
      status: res.status,
      error: j?.error?.type || `http_${res.status}`,
      retryAfter: res.headers.get("retry-after") ?? undefined,
    };
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
}

// ── What Claude must send back ───────────────────────────────────────────────
const Marker = z.object({
  name: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(40),
  unit: z.string().trim().max(24).default(""),
  refRange: z.string().trim().max(60).default(""),
  flag: z.enum(["low", "normal", "high", ""]).default(""),
});
export const MarkersResultSchema = z.object({
  markers: z.array(Marker).max(60),
  reportDate: z.string().trim().max(40).optional(),
  lab: z.string().trim().max(80).optional(),
  notes: z.array(z.string().trim().max(200)).max(10).optional(),
});
export type MarkerValue = z.infer<typeof Marker>;
export type MarkersResult = z.infer<typeof MarkersResultSchema>;

export function parseMarkersResult(input: unknown): { ok: true; value: MarkersResult } | { ok: false; error: string } {
  const r = MarkersResultSchema.safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: true, value: r.data };
}

// ── D1 ───────────────────────────────────────────────────────────────────────
export const AI_JOBS_DDL = `CREATE TABLE IF NOT EXISTS ai_jobs (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  media_id    TEXT NOT NULL,
  mime        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL,
  result      TEXT,
  error       TEXT NOT NULL DEFAULT '',
  session_url TEXT NOT NULL DEFAULT '',
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
)`;
const AI_JOBS_INDEX = "CREATE INDEX IF NOT EXISTS idx_ai_jobs_media ON ai_jobs (media_id, created_at)";

export type JobRow = {
  id: string; kind: string; media_id: string; mime: string; status: JobStatus;
  result: string | null; error: string; session_url: string; attempts: number;
  created_at: number; updated_at: number;
};

/** Lazy, like lib/bridge-settings: jobs work before migrations/0007 is applied. */
export async function ensureAiJobs(db: D1Database): Promise<void> {
  await db.prepare(AI_JOBS_DDL).run();
  await db.prepare(AI_JOBS_INDEX).run();
}

export async function purgeOld(db: D1Database, nowMs: number): Promise<void> {
  await db.prepare("UPDATE ai_jobs SET result = NULL WHERE result IS NOT NULL AND updated_at < ?1").bind(nowMs - RESULT_KEEP_MS).run();
  await db.prepare("DELETE FROM ai_jobs WHERE created_at < ?1").bind(nowMs - 30 * 24 * 60 * 60 * 1000).run();
}

export async function createJob(db: D1Database, input: { kind: JobKind; mediaId: string; mime?: string }, nowMs: number): Promise<string> {
  const id = randomUUID();
  await db
    .prepare("INSERT INTO ai_jobs (id, kind, media_id, mime, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?5)")
    .bind(id, input.kind, input.mediaId, (input.mime ?? "").slice(0, 100), nowMs)
    .run();
  return id;
}

export async function getJob(db: D1Database, id: string): Promise<JobRow | null> {
  return (await db.prepare("SELECT * FROM ai_jobs WHERE id = ?1").bind(id).first<JobRow>()) ?? null;
}

export async function latestJobForMedia(db: D1Database, mediaId: string): Promise<JobRow | null> {
  return (await db.prepare("SELECT * FROM ai_jobs WHERE media_id = ?1 ORDER BY created_at DESC LIMIT 1").bind(mediaId).first<JobRow>()) ?? null;
}

export async function activeJobForMedia(db: D1Database, mediaId: string, nowMs: number): Promise<JobRow | null> {
  const j = await latestJobForMedia(db, mediaId);
  return j && (j.status === "queued" || j.status === "running") && nowMs - j.created_at < ACTIVE_REUSE_MS ? j : null;
}

export async function setSessionUrl(db: D1Database, id: string, url: string, nowMs: number): Promise<void> {
  await db.prepare("UPDATE ai_jobs SET session_url = ?2, updated_at = ?3 WHERE id = ?1").bind(id, url.slice(0, 300), nowMs).run();
}

export async function markRunning(db: D1Database, id: string, nowMs: number): Promise<void> {
  await db.prepare("UPDATE ai_jobs SET status = 'running', attempts = attempts + 1, updated_at = ?2 WHERE id = ?1 AND status IN ('queued', 'running')").bind(id, nowMs).run();
}

export async function saveResult(db: D1Database, id: string, result: MarkersResult, nowMs: number): Promise<void> {
  await db.prepare("UPDATE ai_jobs SET status = 'done', result = ?2, error = '', updated_at = ?3 WHERE id = ?1").bind(id, JSON.stringify(result), nowMs).run();
}

export async function failJob(db: D1Database, id: string, error: string, nowMs: number): Promise<void> {
  await db.prepare("UPDATE ai_jobs SET status = 'failed', error = ?2, updated_at = ?3 WHERE id = ?1").bind(id, error.slice(0, 200), nowMs).run();
}

/** What the dashboard sees. */
export function publicJob(j: JobRow): { id: string; kind: string; status: JobStatus; result?: MarkersResult; error?: string; sessionUrl?: string; createdAt: number } {
  let result: MarkersResult | undefined;
  if (j.result) {
    const parsed = parseMarkersResult(JSON.parse(j.result));
    if (parsed.ok) result = parsed.value;
  }
  return {
    id: j.id,
    kind: j.kind,
    status: j.status,
    ...(result ? { result } : {}),
    ...(j.error ? { error: j.error } : {}),
    ...(j.session_url ? { sessionUrl: j.session_url } : {}),
    createdAt: j.created_at,
  };
}
