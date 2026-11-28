/**
 * GET /api/admin/test-events?code=TEST12345   (header x-admin-key required)
 * GET /api/admin/test-events?code=off         (clears it early)
 *
 * Turns on Meta Test Events for THE BROWSER THAT CALLS IT, for one hour.
 *
 * It sets an HttpOnly, Secure, __Host- cookie holding the code. While that
 * cookie rides on a request, /api/events (the PageView beacon) and
 * /api/quiz-lead (Lead + QuizComplete) attach the code to the events they send
 * for that browser, so they appear under Events Manager → Test Events and do
 * not count. Every other visitor is untouched, and the cookie expires on its
 * own. This replaces setting META_TEST_EVENT_CODE on the worker, which is
 * global and would turn every visitor's events into test events.
 *
 * Not covered, because no browser is on the other end of the request:
 * /api/cal-webhook (Schedule, QualifiedSchedule) is called by Cal.com's
 * servers, so it never sees this cookie. It keeps its own fence: the env var
 * applies only to bookings in the owner's own name.
 *
 * The admin key travels in the x-admin-key header, never the URL (keys in URLs
 * end up in request logs). Call it with fetch from a page on the site, e.g. the
 * browser console on /admin, so the browser stores the cookie for the site.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import {
  TEST_EVENT_COOKIE,
  TEST_EVENT_COOKIE_MAX_AGE_S,
  TEST_EVENT_COOKIE_OPTIONS,
  testEventCookieAction,
} from "@/lib/test-event-cookie";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const action = testEventCookieAction(req.nextUrl.searchParams.get("code"));

  if (action.kind === "invalid") {
    return NextResponse.json(
      { error: "code must look like TEST12345 (TEST + 3 to 8 digits), or 'off' to clear" },
      { status: 400, headers: NO_STORE },
    );
  }

  if (action.kind === "clear") {
    const res = NextResponse.json({ ok: true, cleared: true }, { headers: NO_STORE });
    res.cookies.set(TEST_EVENT_COOKIE, "", { ...TEST_EVENT_COOKIE_OPTIONS, maxAge: 0 });
    return res;
  }

  const expiresAt = new Date(Date.now() + TEST_EVENT_COOKIE_MAX_AGE_S * 1000).toISOString();
  const res = NextResponse.json(
    {
      ok: true,
      testCode: action.code,
      expiresAt,
      appliesTo: ["/api/events (PageView)", "/api/quiz-lead (Lead, QuizComplete)"],
      notCovered: ["/api/cal-webhook (Schedule): Cal.com calls it, so it carries no browser cookie"],
    },
    { headers: NO_STORE },
  );
  res.cookies.set(TEST_EVENT_COOKIE, action.code, TEST_EVENT_COOKIE_OPTIONS);
  return res;
}
