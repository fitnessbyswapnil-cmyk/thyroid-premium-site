import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOT_CHECK_HEADER,
  INTERNAL_LEAD_HEADER,
  MAX_TOKEN_LENGTH,
  SITEVERIFY_URL,
  UNVERIFIED,
  callSiteverify,
  checkTurnstile,
  findOrAddColumn,
  internalLeadHeaders,
  internalLeadSignature,
  interpretSiteverify,
  isInternalLeadCall,
  isTurnstileEnabled,
  precheckTurnstile,
  type SiteverifyOutcome,
} from "./turnstile.ts";

const ON = { enabled: true, secret: "test-secret" };
const OFF = { enabled: false, secret: "" };
const ok = (body: unknown, status = 200): SiteverifyOutcome => ({ kind: "response", status, body });

// ── Configuration: safe by default ──────────────────────────────────────────

test("it is off unless BOTH keys are set", () => {
  assert.equal(isTurnstileEnabled("", ""), false);
  assert.equal(isTurnstileEnabled(undefined, undefined), false);
  // Secret alone would mark every lead unverified: there is no widget, so no token.
  assert.equal(isTurnstileEnabled("sec", ""), false);
  // Site key alone gives the server nothing to verify with.
  assert.equal(isTurnstileEnabled("", "site"), false);
  assert.equal(isTurnstileEnabled("  ", "site"), false);
  assert.equal(isTurnstileEnabled("sec", "site"), true);
});

test("switched off, every submission is accepted exactly as before — token or not", () => {
  for (const token of [undefined, "", "anything", 42, { x: 1 }]) {
    assert.deepEqual(precheckTurnstile({ enabled: false, token }), { verdict: "accept", reason: "disabled" });
  }
});

test("switched off, siteverify is never called", async () => {
  let calls = 0;
  const d = await checkTurnstile({
    config: OFF,
    token: "tok",
    fetchImpl: async () => { calls++; return { status: 200, json: async () => ({ success: false }) }; },
  });
  assert.equal(d.verdict, "accept");
  assert.equal(calls, 0);
});

// ── Missing token: keep the lead, skip the cost ─────────────────────────────

test("a missing token is UNVERIFIED, never rejected — the widget may simply have failed to load", () => {
  for (const token of [undefined, null, "", "   "]) {
    assert.deepEqual(precheckTurnstile({ enabled: true, token }), { verdict: "unverified", reason: "no-token" }, String(token));
  }
});

test("a missing token does not spend a siteverify call", async () => {
  let calls = 0;
  const d = await checkTurnstile({
    config: ON,
    token: undefined,
    fetchImpl: async () => { calls++; return { status: 200, json: async () => ({ success: true }) }; },
  });
  assert.equal(d.verdict, "unverified");
  assert.equal(calls, 0);
});

// ── Malformed tokens: nothing a real widget produces ────────────────────────

test("a token that is not a string, or is absurdly long, is rejected without asking Cloudflare", () => {
  assert.equal(precheckTurnstile({ enabled: true, token: 12345 })?.verdict, "reject");
  assert.equal(precheckTurnstile({ enabled: true, token: { a: 1 } })?.verdict, "reject");
  assert.equal(precheckTurnstile({ enabled: true, token: "x".repeat(MAX_TOKEN_LENGTH + 1) })?.verdict, "reject");
  // At the limit it still goes to siteverify.
  assert.equal(precheckTurnstile({ enabled: true, token: "x".repeat(MAX_TOKEN_LENGTH) }), null);
});

test("a present, well-formed token always goes to siteverify", () => {
  assert.equal(precheckTurnstile({ enabled: true, token: "0.abc" }), null);
});

// ── Internal calls ──────────────────────────────────────────────────────────

test("a signed internal call is accepted without a token", () => {
  assert.deepEqual(precheckTurnstile({ enabled: true, internal: true, token: undefined }), { verdict: "accept", reason: "internal" });
});

test("the internal signature proves the secret and binds the lead id", () => {
  const sig = internalLeadSignature("s3cret", "cal_abc");
  assert.equal(isInternalLeadCall("s3cret", "cal_abc", sig), true);
  // Replayed onto a different lead: refused.
  assert.equal(isInternalLeadCall("s3cret", "cal_other", sig), false);
  // Signed with a different secret: refused.
  assert.equal(isInternalLeadCall("s3cret", "cal_abc", internalLeadSignature("guess", "cal_abc")), false);
  // Absent, empty, or a different length: refused, and never throws.
  assert.equal(isInternalLeadCall("s3cret", "cal_abc", null), false);
  assert.equal(isInternalLeadCall("s3cret", "cal_abc", ""), false);
  assert.equal(isInternalLeadCall("s3cret", "cal_abc", "short"), false);
  // No secret configured: nothing is internal, because nothing is being checked.
  assert.equal(isInternalLeadCall("", "cal_abc", sig), false);
  assert.equal(isInternalLeadCall("s3cret", "", sig), false);
});

test("internal headers are empty when no secret is set, so the caller is unchanged", () => {
  assert.deepEqual(internalLeadHeaders("cal_abc", ""), {});
  const h = internalLeadHeaders("cal_abc", "s3cret");
  assert.equal(h[INTERNAL_LEAD_HEADER], internalLeadSignature("s3cret", "cal_abc"));
});

// ── siteverify answers ──────────────────────────────────────────────────────

test("success:true is accepted", () => {
  assert.deepEqual(interpretSiteverify(ok({ success: true, "error-codes": [] })), { verdict: "accept", reason: "verified" });
});

test("a token Cloudflare refused is REJECTED", () => {
  for (const code of ["invalid-input-response", "timeout-or-duplicate"]) {
    const d = interpretSiteverify(ok({ success: false, "error-codes": [code] }));
    assert.equal(d.verdict, "reject", code);
    assert.match(d.reason, new RegExp(code));
  }
  // No codes at all is still Cloudflare saying no.
  assert.equal(interpretSiteverify(ok({ success: false })).verdict, "reject");
  // An unknown future code: still a refusal of this token.
  assert.equal(interpretSiteverify(ok({ success: false, "error-codes": ["some-new-code"] })).verdict, "reject");
});

test("OUR misconfiguration never 403s a real visitor — it fails soft", () => {
  // A wrong secret would otherwise reject every single lead.
  for (const code of ["invalid-input-secret", "missing-input-secret", "bad-request", "internal-error"]) {
    const d = interpretSiteverify(ok({ success: false, "error-codes": [code] }));
    assert.equal(d.verdict, "unverified", code);
  }
  // Mixed with a token fault, the config fault wins: we cannot trust the verdict.
  assert.equal(
    interpretSiteverify(ok({ success: false, "error-codes": ["invalid-input-secret", "invalid-input-response"] })).verdict,
    "unverified",
  );
});

test("an outage, a non-2xx, or an unreadable reply fails soft", () => {
  assert.equal(interpretSiteverify({ kind: "network-error", message: "TimeoutError: aborted" }).verdict, "unverified");
  assert.equal(interpretSiteverify(ok({ success: true }, 500)).verdict, "unverified");
  assert.equal(interpretSiteverify(ok({ success: true }, 429)).verdict, "unverified");
  assert.equal(interpretSiteverify(ok(null)).verdict, "unverified");
  assert.equal(interpretSiteverify(ok("<html>")).verdict, "unverified");
  assert.equal(interpretSiteverify(ok({ success: "true" })).verdict, "unverified");
});

// ── The network call ────────────────────────────────────────────────────────

test("siteverify gets the secret, the token and the visitor's IP, form-encoded", async () => {
  let seenUrl = "";
  let seenBody: URLSearchParams | null = null;
  let seenMethod = "";
  const d = await checkTurnstile({
    config: ON,
    token: "tok-123",
    remoteIp: "203.0.113.7",
    fetchImpl: async (url, init) => {
      seenUrl = url; seenBody = init.body; seenMethod = init.method;
      return { status: 200, json: async () => ({ success: true }) };
    },
  });
  assert.equal(d.verdict, "accept");
  assert.equal(seenUrl, SITEVERIFY_URL);
  assert.equal(seenMethod, "POST");
  const body = seenBody as unknown as URLSearchParams;
  assert.equal(body.get("secret"), "test-secret");
  assert.equal(body.get("response"), "tok-123");
  assert.equal(body.get("remoteip"), "203.0.113.7");
});

test("no IP known: remoteip is simply left out", async () => {
  let body: URLSearchParams | null = null;
  await callSiteverify({
    secret: "s", token: "t",
    fetchImpl: async (_u, init) => { body = init.body; return { status: 200, json: async () => ({ success: true }) }; },
  });
  assert.equal((body as unknown as URLSearchParams).has("remoteip"), false);
});

test("a hung siteverify times out and fails soft instead of holding the lead hostage", async () => {
  const started = Date.now();
  const d = await checkTurnstile({
    config: ON,
    token: "tok",
    timeoutMs: 30,
    fetchImpl: (_u, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")));
      }),
  });
  assert.equal(d.verdict, "unverified");
  assert.match(d.reason, /siteverify-unreachable/);
  assert.ok(Date.now() - started < 2000);
});

test("a thrown fetch fails soft", async () => {
  const d = await checkTurnstile({
    config: ON,
    token: "tok",
    fetchImpl: async () => { throw new TypeError("fetch failed"); },
  });
  assert.equal(d.verdict, "unverified");
});

test("a reply whose body is not JSON fails soft", async () => {
  const d = await checkTurnstile({
    config: ON,
    token: "tok",
    fetchImpl: async () => ({ status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } }),
  });
  assert.equal(d.verdict, "unverified");
});

// ── The sheet marker ────────────────────────────────────────────────────────

test("the marker value and header are fixed strings a cron filter can match", () => {
  assert.equal(UNVERIFIED, "unverified");
  assert.equal(BOT_CHECK_HEADER, "Bot Check");
});

test("an existing Bot Check column in the known header is used as-is, with no extra reads", async () => {
  let reads = 0; let writes = 0;
  const i = await findOrAddColumn({
    known: ["Timestamp", "Lead ID", "Bot Check", "Name"],
    title: "Bot Check",
    readFullHeader: async () => { reads++; return []; },
    writeHeaderCell: async () => { writes++; },
  });
  assert.equal(i, 2);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

test("a Bot Check column past the known range is found in the full row, never duplicated", async () => {
  let writes = 0;
  const known = ["Timestamp", "Lead ID", "Name"];
  const i = await findOrAddColumn({
    known,
    title: "Bot Check",
    readFullHeader: async () => [...known, "", "Paid", " Bot Check "],
    writeHeaderCell: async () => { writes++; },
  });
  assert.equal(i, 5);
  assert.equal(writes, 0);
});

test("with no Bot Check column, it is added after the TRUE last column, not the known range", async () => {
  const written: [number, string][] = [];
  const known = ["A", "B", "C"]; // a bounded read that stopped early
  const i = await findOrAddColumn({
    known,
    title: "Bot Check",
    readFullHeader: async () => ["A", "B", "C", "D", "E", "F"],
    writeHeaderCell: async (idx, title) => { written.push([idx, title]); },
  });
  assert.equal(i, 6);
  assert.deepEqual(written, [[6, "Bot Check"]]);
});

test("if the header cannot be written, the marker is dropped — the lead never is", async () => {
  const i = await findOrAddColumn({
    known: ["A"],
    title: "Bot Check",
    readFullHeader: async () => ["A", "B"],
    writeHeaderCell: async () => { throw new Error("quota"); },
  });
  assert.equal(i, -1);
  const j = await findOrAddColumn({
    known: ["A"],
    title: "Bot Check",
    readFullHeader: async () => { throw new Error("quota"); },
    writeHeaderCell: async () => {},
  });
  assert.equal(j, -1);
});
