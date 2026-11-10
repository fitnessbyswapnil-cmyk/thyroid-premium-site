import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_ROUTINE_ID, JOB_TTL_S, activeJobForMedia, createJob, fireRoutine, fireText, fireUrl, mintJobToken,
  parseMarkersResult, publicJob, routineConfig, signJobToken, verifyJobToken, type JobRow,
} from "./ai-jobs.ts";

// The dashboard hands report reading to a Claude routine on the owner's plan:
// no API key. These lock the parts that keep that safe: the job token, what
// the fire carries (nothing about her), the result's shape, and who may call what.

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const SECRET = "test-only-ai-job-secret-91c2";
const NOW = 1_800_000_000;
const ID = "4b9f7c0e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";

test("a job token opens its own job until it expires, and no other", () => {
  const tok = mintJobToken(SECRET, ID, NOW);
  assert.equal(verifyJobToken(SECRET, ID, tok, NOW + 60), true);
  assert.equal(verifyJobToken(SECRET, ID, tok, NOW + JOB_TTL_S), false, "expired");
  assert.equal(verifyJobToken(SECRET, "another-job-id", tok, NOW + 60), false, "minted for a different job");
  assert.equal(verifyJobToken("other-secret", ID, tok, NOW + 60), false);
});

test("a stretched, altered or junk token fails closed", () => {
  const far = NOW + JOB_TTL_S * 48;
  assert.equal(verifyJobToken(SECRET, ID, `${far}.${signJobToken(SECRET, ID, far)}`, NOW), false, "no token outlives the TTL");
  const tok = mintJobToken(SECRET, ID, NOW);
  const [exp, sig] = tok.split(".");
  assert.equal(verifyJobToken(SECRET, ID, `${Number(exp) + 60}.${sig}`, NOW), false);
  for (const junk of [undefined, null, "", "abc", "123", ".x", `${exp}.`, 42]) {
    assert.equal(verifyJobToken(SECRET, ID, junk, NOW), false, String(junk));
  }
  assert.equal(verifyJobToken(undefined, ID, tok, NOW), false, "no secret, no entry");
});

test("the fire tells Claude the job and nothing about her", () => {
  const text = fireText("https://www.example.test", ID, "1800001800.sig");
  assert.match(text, new RegExp(`job_id: ${ID}`));
  assert.match(text, /job_token: 1800001800\.sig/);
  assert.match(text, /docs\/ai-runner\.md/);
  assert.doesNotMatch(text, /phone|name|tsh|report value/i);
  assert.equal(fireText.length, 3, "fireText takes only site, id and token: there is no slot for her details");
});

test("the fire is the documented request, authenticated by the routine's own token", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const ok = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ type: "routine_fire", claude_code_session_id: "session_x", claude_code_session_url: "https://claude.ai/code/session_x" }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await fireRoutine({ routineId: "trig_abc", token: "sk-ant-oat01-test", text: "hello" }, ok);
  assert.deepEqual(r, { ok: true, sessionUrl: "https://claude.ai/code/session_x" });
  assert.ok(seen);
  const s = seen as { url: string; init: RequestInit };
  assert.equal(s.url, fireUrl("trig_abc"));
  assert.equal(s.url, "https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire");
  const h = s.init.headers as Record<string, string>;
  assert.equal(s.init.method, "POST");
  assert.equal(h.Authorization, "Bearer sk-ant-oat01-test");
  assert.equal(h["anthropic-version"], "2023-06-01");
  assert.deepEqual(JSON.parse(String(s.init.body)), { text: "hello" });
});

test("a refused or failed fire is reported, never thrown", async () => {
  const limited = (async () => new Response(JSON.stringify({ type: "error", error: { type: "rate_limit_error" } }), { status: 429, headers: { "retry-after": "120" } })) as unknown as typeof fetch;
  assert.deepEqual(await fireRoutine({ routineId: "trig_abc", token: "t", text: "x" }, limited), { ok: false, status: 429, error: "rate_limit_error", retryAfter: "120" });
  const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  assert.deepEqual(await fireRoutine({ routineId: "trig_abc", token: "t", text: "x" }, down), { ok: false, status: 0, error: "network" });
});

test("the routine is only configured with both its id and its token", () => {
  assert.equal(routineConfig({}), null);
  assert.equal(routineConfig({ CLAUDE_ROUTINE_ID: "trig_abc" }), null);
  assert.deepEqual(routineConfig({ CLAUDE_ROUTINE_TOKEN: "sk-ant-oat01-x" }), { id: DEFAULT_ROUTINE_ID, token: "sk-ant-oat01-x" }, "the token alone is enough: the routine id is in code");
  assert.match(DEFAULT_ROUTINE_ID, /^trig_[A-Za-z0-9]+$/);
  assert.deepEqual(routineConfig({ CLAUDE_ROUTINE_ID: "trig_abc", CLAUDE_ROUTINE_TOKEN: "sk-ant-oat01-x" }), { id: "trig_abc", token: "sk-ant-oat01-x" });
});

test("only a well-formed list of values is accepted back", () => {
  const good = parseMarkersResult({ markers: [{ name: "TSH", value: "6.8", unit: "µIU/mL", refRange: "0.4-4.0", flag: "high" }, { name: "FT4", value: "1.1" }], reportDate: "28 Oct 2026", extra: "dropped" });
  assert.ok(good.ok);
  if (good.ok) {
    assert.equal(good.value.markers[1].unit, "", "missing fields get safe defaults");
    assert.equal(good.value.markers[1].flag, "");
    assert.equal("extra" in good.value, false, "unknown fields are dropped");
  }
  assert.equal(parseMarkersResult(null).ok, false);
  assert.equal(parseMarkersResult({ markers: "TSH 6.8" }).ok, false);
  assert.equal(parseMarkersResult({ markers: [{ name: "TSH", value: "6.8", flag: "dangerous" }] }).ok, false);
  assert.equal(parseMarkersResult({ markers: [{ name: "x".repeat(61), value: "1" }] }).ok, false);
  assert.equal(parseMarkersResult({ markers: Array.from({ length: 61 }, (_, i) => ({ name: `T${i}`, value: "1" })) }).ok, false);
});

// A tiny D1 stand-in: enough to see what the helpers write and read.
function fakeDb() {
  const rows: JobRow[] = [];
  const db = {
    rows,
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind: (...a: unknown[]) => { args = a; return stmt; },
        run: async () => {
          if (sql.startsWith("INSERT INTO ai_jobs")) {
            const [id, kind, media_id, mime, now] = args as [string, string, string, string, number];
            rows.push({ id, kind, media_id, mime, status: "queued", result: null, error: "", session_url: "", attempts: 0, created_at: now, updated_at: now });
          }
          return { success: true };
        },
        first: async () => {
          if (sql.includes("WHERE id = ?1")) return rows.find((r) => r.id === args[0]) ?? null;
          if (sql.includes("WHERE media_id = ?1")) return [...rows].filter((r) => r.media_id === args[0]).sort((a, b) => b.created_at - a.created_at)[0] ?? null;
          return null;
        },
        all: async () => ({ results: rows }),
      };
      return stmt;
    },
  };
  return db;
}

test("a job stores the report's media id and no phone or name", async () => {
  const db = fakeDb();
  const id = await createJob(db as never, { kind: "report_markers", mediaId: "1234567890123", mime: "image/jpeg" }, NOW * 1000);
  assert.equal(db.rows.length, 1);
  assert.deepEqual(Object.keys(db.rows[0]).sort(), ["attempts", "created_at", "error", "id", "kind", "media_id", "mime", "result", "session_url", "status", "updated_at"]);
  assert.equal(db.rows[0].id, id);
  const view = publicJob(db.rows[0]);
  assert.deepEqual(Object.keys(view).sort(), ["createdAt", "id", "kind", "status"]);
});

test("a report already being read is reused for 15 minutes instead of firing again", async () => {
  const db = fakeDb();
  const t0 = NOW * 1000;
  await createJob(db as never, { kind: "report_markers", mediaId: "1234567890123" }, t0);
  assert.ok(await activeJobForMedia(db as never, "1234567890123", t0 + 60_000));
  assert.equal(await activeJobForMedia(db as never, "1234567890123", t0 + 16 * 60_000), null);
  db.rows[0].status = "done";
  assert.equal(await activeJobForMedia(db as never, "1234567890123", t0 + 60_000), null, "a finished job is not reused");
});

test("the admin side is behind the admin key; the runner side only behind a job token", () => {
  const admin = read("app/api/admin/ai-jobs/route.ts");
  assert.equal((admin.match(/if \(!checkAdminKey\(req\)\) return NextResponse\.json\(\{ error: "unauthorized" \}, \{ status: 401 \}\)/g) ?? []).length, 2, "both POST and GET check the header");
  assert.match(admin, /claude_routine_not_configured/);
  for (const f of ["app/api/ai-runner/jobs/[id]/route.ts", "app/api/ai-runner/jobs/[id]/result/route.ts", "app/api/ai-runner/jobs/[id]/fail/route.ts"]) {
    const src = read(f);
    assert.match(src, /if \(!verifyJobToken\(/, `${f} checks the job token first`);
    assert.doesNotMatch(src, /ADMIN_DASH_KEY|checkAdminKey/, `${f} never takes the admin key`);
  }
  assert.doesNotMatch(read("app/api/ai-runner/jobs/[id]/route.ts"), /[?&]k=/, "the report URL carries a media pass, not the key");
});

test("the runner guide keeps Claude to reading numbers and out of the repository", () => {
  const guide = read("docs/ai-runner.md");
  for (const must of [/never print/i, /change nothing in this repository/i, /do not interpret/i, /\/api\/ai-runner\/jobs\/\$JOB_ID\/result/, /\/api\/ai-runner\/jobs\/\$JOB_ID\/fail/, /x-job-token/]) {
    assert.match(guide, must);
  }
});
