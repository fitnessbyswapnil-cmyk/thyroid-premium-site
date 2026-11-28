/**
 * lib/test-event-cookie.ts — Meta Test Events for ONE browser, for one hour.
 *
 * WHY THIS EXISTS
 * The only switch the code had was META_TEST_EVENT_CODE, an env var on the
 * worker. It is global: while it is set, every event /api/events sends goes to
 * Test Events instead of counting, for every visitor. On 28-Aug-2026 a build
 * that still carried TEST9290 swallowed a real client's Schedule exactly that
 * way (see app/api/cal-webhook). With PageView now sent from /api/events on
 * every page load, a forgotten global code would silently stop every server
 * PageView from counting.
 *
 * So a test code now rides on the request instead. The owner opens
 * GET /api/admin/test-events?code=TEST12345 (admin key required, see that
 * route), which sets this cookie in HIS browser only. For the next hour the
 * routes that a browser calls (/api/events and /api/quiz-lead) attach the code
 * to the events they send for that browser, and to nothing else. Every other
 * visitor's events are unaffected, and the cookie expires by itself.
 *
 * Routes with no browser on the other end (the Cal.com, Cashfree and Fathom
 * webhooks, the crons) never see this cookie and are unchanged.
 *
 * The cookie name carries the __Host- prefix, so the browser accepts it only
 * when it is Secure, Path=/ and has no Domain. A page on another subdomain of
 * the site therefore cannot plant one.
 *
 * Imports NOTHING, so the unit tests load it under `node --test`.
 */

export const TEST_EVENT_COOKIE = "__Host-meta_test_event_code";

/** One hour. Long enough to run a test, short enough to be forgotten safely. */
export const TEST_EVENT_COOKIE_MAX_AGE_S = 60 * 60;

/**
 * Meta's Test Events codes look like TEST12345. Anything else is refused, both
 * when the cookie is set and when it is read, so a hand-edited cookie can
 * never put an arbitrary string into a Meta request.
 */
export const TEST_EVENT_CODE_RE = /^TEST\d{3,8}$/;

/** Options for NextResponse.cookies.set. HttpOnly: page scripts cannot read or forge it. */
export const TEST_EVENT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: TEST_EVENT_COOKIE_MAX_AGE_S,
};

/** The code in canonical form, or null when it is not a valid Test Events code. */
export function normalizeTestEventCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return TEST_EVENT_CODE_RE.test(code) ? code : null;
}

/**
 * The test code carried by a Cookie request header, or undefined.
 *
 * Read with a plain split rather than a regex built from the name, and never
 * URI-decoded: a valid code is ASCII letters and digits only, so there is
 * nothing to decode, and a malformed %-sequence elsewhere in the header must
 * not be able to throw here.
 */
export function testEventCodeFromCookieHeader(header: string | null | undefined): string | undefined {
  if (typeof header !== "string" || !header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== TEST_EVENT_COOKIE) continue;
    const code = part.slice(eq + 1).trim();
    // Exact match only: a cookie value is never upper-cased into validity.
    return TEST_EVENT_CODE_RE.test(code) ? code : undefined;
  }
  return undefined;
}

export type TestEventCookieAction =
  | { kind: "set"; code: string }
  | { kind: "clear" }
  | { kind: "invalid" };

/** What GET /api/admin/test-events?code=… should do with the code it was given. */
export function testEventCookieAction(rawCode: string | null | undefined): TestEventCookieAction {
  const raw = (rawCode ?? "").trim();
  if (raw.toLowerCase() === "off") return { kind: "clear" };
  const code = normalizeTestEventCode(raw);
  return code ? { kind: "set", code } : { kind: "invalid" };
}
