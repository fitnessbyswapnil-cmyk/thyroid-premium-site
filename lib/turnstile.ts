/**
 * lib/turnstile.ts — SERVER-ONLY Cloudflare Turnstile verification.
 *
 * Why it exists: the quiz gate and the webinar form each trigger a paid
 * WhatsApp template and (for the quiz) Meta Lead / QuizComplete events. A bot
 * that posts to those routes costs money per message and teaches the ad
 * account that bots are customers.
 *
 * The policy, which the pure functions below encode and lib/turnstile.test.ts
 * pins down:
 *
 *   not configured (either key unset)  → accept, exactly as before Turnstile
 *   internal server-to-server call     → accept (signed with the secret)
 *   token valid                        → accept
 *   token present and rejected         → REJECT: 403, write nothing, send nothing
 *   token missing                      → UNVERIFIED: save the lead so the coach
 *                                        can follow up, mark the row, and skip
 *                                        every paid or ad-signal side effect
 *   siteverify unreachable / our own
 *   config error                       → UNVERIFIED (fail soft, never lose her)
 *
 * The asymmetry is deliberate. A missing token is what a real woman in an
 * in-app browser produces when the Turnstile script cannot load, so it must
 * never cost her the lead. A token Cloudflare has looked at and refused is not
 * something a real browser produces, so it costs nothing to refuse it.
 *
 * Both keys are needed before anything changes: the secret alone would mark
 * every lead unverified (no widget means no token), and the site key alone
 * gives the server nothing to check with.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** siteverify normally answers in well under 100 ms; this caps a bad day. */
export const SITEVERIFY_TIMEOUT_MS = 3000;
/** Cloudflare's documented maximum token length. */
export const MAX_TOKEN_LENGTH = 2048;

/** Sheet header for the marker, and the one value written to it. */
export const BOT_CHECK_HEADER = "Bot Check";
export const UNVERIFIED = "unverified";

/** Header that proves a call came from our own server (e.g. booking-payment). */
export const INTERNAL_LEAD_HEADER = "x-internal-lead-sig";

export type TurnstileConfig = { enabled: boolean; secret: string };

export type TurnstileDecision =
  | { verdict: "accept"; reason: "disabled" | "internal" | "verified" }
  | { verdict: "unverified"; reason: string }
  | { verdict: "reject"; reason: string };

/** What came back from siteverify, before any interpretation. */
export type SiteverifyOutcome =
  | { kind: "response"; status: number; body: unknown }
  | { kind: "network-error"; message: string };

/**
 * Read both keys at request time. The site key is a NEXT_PUBLIC_ variable, so
 * `next build` inlines it into server code as well as client code: the server
 * sees exactly the value the browser was built with.
 */
export function turnstileConfig(): TurnstileConfig {
  const secret = (process.env.TURNSTILE_SECRET_KEY ?? "").trim();
  const siteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
  return { enabled: isTurnstileEnabled(secret, siteKey), secret };
}

export function isTurnstileEnabled(secret: string | undefined, siteKey: string | undefined): boolean {
  return !!(secret ?? "").trim() && !!(siteKey ?? "").trim();
}

/**
 * Everything that can be decided without asking Cloudflare. Returns null when
 * the token has to go to siteverify.
 */
export function precheckTurnstile(input: {
  enabled: boolean;
  internal?: boolean;
  token: unknown;
}): TurnstileDecision | null {
  if (!input.enabled) return { verdict: "accept", reason: "disabled" };
  if (input.internal) return { verdict: "accept", reason: "internal" };
  const t = input.token;
  if (t === undefined || t === null || (typeof t === "string" && t.trim() === "")) {
    return { verdict: "unverified", reason: "no-token" };
  }
  // A real widget only ever hands over a string of bounded length. Anything
  // else was typed by something that is not a browser.
  if (typeof t !== "string") return { verdict: "reject", reason: "malformed-token" };
  if (t.length > MAX_TOKEN_LENGTH) return { verdict: "reject", reason: "malformed-token" };
  return null;
}

/** Error codes that mean the TOKEN is bad — the visitor's problem. */
const TOKEN_FAULTS = new Set(["invalid-input-response", "timeout-or-duplicate", "missing-input-response"]);
/** Error codes that mean WE or Cloudflare are broken — never the visitor's fault. */
const OUR_FAULTS = new Set(["missing-input-secret", "invalid-input-secret", "bad-request", "internal-error"]);

/**
 * Turn a siteverify outcome into a decision.
 *
 * Only an explicit `success: false` about the token itself rejects. A wrong or
 * missing secret would otherwise 403 every real visitor, so configuration
 * faults, Cloudflare outages, timeouts and unreadable replies all fail soft.
 */
export function interpretSiteverify(outcome: SiteverifyOutcome): TurnstileDecision {
  if (outcome.kind === "network-error") {
    return { verdict: "unverified", reason: `siteverify-unreachable: ${outcome.message}`.slice(0, 200) };
  }
  if (outcome.status < 200 || outcome.status >= 300) {
    return { verdict: "unverified", reason: `siteverify-http-${outcome.status}` };
  }
  const body = outcome.body as { success?: unknown; "error-codes"?: unknown } | null;
  if (!body || typeof body !== "object" || typeof body.success !== "boolean") {
    return { verdict: "unverified", reason: "siteverify-bad-response" };
  }
  if (body.success) return { verdict: "accept", reason: "verified" };

  const codes = Array.isArray(body["error-codes"])
    ? body["error-codes"].filter((c): c is string => typeof c === "string")
    : [];
  const list = codes.join(",") || "none";
  if (codes.some((c) => OUR_FAULTS.has(c))) {
    return { verdict: "unverified", reason: `siteverify-config: ${list}` };
  }
  if (codes.length === 0 || codes.some((c) => TOKEN_FAULTS.has(c))) {
    return { verdict: "reject", reason: `token-rejected: ${list}` };
  }
  // A code Cloudflare has added since this was written. success:false is
  // still Cloudflare's answer about this token, so it is refused.
  return { verdict: "reject", reason: `token-rejected: ${list}` };
}

type FetchLike = (url: string, init: { method: string; body: URLSearchParams; signal?: AbortSignal }) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;

/** One POST to siteverify. Never throws: failures come back as an outcome. */
export async function callSiteverify(opts: {
  secret: string;
  token: string;
  remoteIp?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<SiteverifyOutcome> {
  const form = new URLSearchParams();
  form.set("secret", opts.secret);
  form.set("response", opts.token);
  if (opts.remoteIp) form.set("remoteip", opts.remoteIp);
  const doFetch: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  try {
    const res = await doFetch(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(opts.timeoutMs ?? SITEVERIFY_TIMEOUT_MS),
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { kind: "response", status: res.status, body };
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return { kind: "network-error", message };
  }
}

/** The whole check: precheck, then siteverify only when it is needed. */
export async function checkTurnstile(opts: {
  config: TurnstileConfig;
  token: unknown;
  remoteIp?: string;
  internal?: boolean;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<TurnstileDecision> {
  const pre = precheckTurnstile({ enabled: opts.config.enabled, internal: opts.internal, token: opts.token });
  if (pre) return pre;
  const outcome = await callSiteverify({
    secret: opts.config.secret,
    token: opts.token as string,
    remoteIp: opts.remoteIp,
    timeoutMs: opts.timeoutMs,
    fetchImpl: opts.fetchImpl,
  });
  return interpretSiteverify(outcome);
}

// ── Internal server-to-server calls ─────────────────────────────────────────
//
// /api/booking-payment writes its lead by POSTing to /api/quiz-lead from the
// server, where there is no browser and so no token. Letting a `source` value
// through unchecked would hand every bot the bypass, so the call is signed
// instead: an HMAC of the lead id under the Turnstile secret. It proves the
// caller holds the secret, and a captured header only ever replays that one
// lead id.

export function internalLeadSignature(secret: string, leadId: string): string {
  return createHmac("sha256", secret).update(`internal-lead:${leadId}`).digest("hex");
}

export function isInternalLeadCall(secret: string, leadId: string, presented: string | null | undefined): boolean {
  if (!secret || !leadId || !presented) return false;
  const expected = Buffer.from(internalLeadSignature(secret, leadId), "utf8");
  const got = Buffer.from(presented, "utf8");
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Headers for an internal call. Empty when no secret is set, so nothing changes. */
export function internalLeadHeaders(leadId: string, secret = (process.env.TURNSTILE_SECRET_KEY ?? "").trim()): Record<string, string> {
  return secret && leadId ? { [INTERNAL_LEAD_HEADER]: internalLeadSignature(secret, leadId) } : {};
}

// ── The sheet marker ────────────────────────────────────────────────────────

/**
 * Where the "Bot Check" column is, adding the header if the sheet has none.
 *
 * `known` is the header row the route already read (often a bounded range).
 * Only when the title is absent there is the FULL row read, so a new column is
 * placed after the true last column and can never land on an existing one.
 * The header is written as one cell rather than by rewriting row 1.
 *
 * Returns -1 when the header cannot be written: the marker is lost, never the
 * lead.
 */
export async function findOrAddColumn(opts: {
  known: string[];
  title: string;
  readFullHeader: () => Promise<string[]>;
  writeHeaderCell: (index: number, title: string) => Promise<void>;
}): Promise<number> {
  const inKnown = opts.known.lastIndexOf(opts.title);
  if (inKnown >= 0) return inKnown;
  try {
    const full = (await opts.readFullHeader()).map((h) => String(h ?? "").trim());
    const inFull = full.lastIndexOf(opts.title);
    if (inFull >= 0) return inFull;
    const at = Math.max(full.length, opts.known.length);
    await opts.writeHeaderCell(at, opts.title);
    return at;
  } catch {
    return -1;
  }
}
