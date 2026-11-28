import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TEST_EVENT_COOKIE,
  TEST_EVENT_COOKIE_MAX_AGE_S,
  TEST_EVENT_COOKIE_OPTIONS,
  normalizeTestEventCode,
  testEventCodeFromCookieHeader,
  testEventCookieAction,
} from "./test-event-cookie.ts";
import { getTestEventCode } from "./server-tracking.ts";

// Meta Test Events, per browser: the owner's cookie marks HIS events as test
// events for an hour, and nobody else's ever. Both directions are checked.

const root = join(import.meta.dirname, "..");

test("only TEST + 3 to 8 digits is a test code", () => {
  assert.equal(normalizeTestEventCode("TEST12345"), "TEST12345");
  assert.equal(normalizeTestEventCode(" test123 "), "TEST123", "typed by hand into a URL");
  assert.equal(normalizeTestEventCode("TEST12345678"), "TEST12345678");
  for (const bad of ["TEST12", "TEST123456789", "TEST", "12345", "TEST12345;x", "TEST 12345", "", null, undefined, 12345]) {
    assert.equal(normalizeTestEventCode(bad), null, String(bad));
  }
});

test("the code is read from its own cookie only, exactly as set", () => {
  assert.equal(testEventCodeFromCookieHeader(`_fbp=fb.1.1.2; ${TEST_EVENT_COOKIE}=TEST12345; _visitor_id=v_1_x`), "TEST12345");
  assert.equal(testEventCodeFromCookieHeader(`${TEST_EVENT_COOKIE}=TEST123`), "TEST123");
  for (const header of [
    "",
    null,
    undefined,
    "_fbp=fb.1.1.2; _visitor_id=v_1_x",
    "meta_test_event_code=TEST12345", // no __Host- prefix: not ours
    `x${TEST_EVENT_COOKIE}=TEST12345`,
    `${TEST_EVENT_COOKIE}=test12345`, // a cookie value is never upper-cased into validity
    `${TEST_EVENT_COOKIE}=TEST1`,
    `${TEST_EVENT_COOKIE}=`,
    `${TEST_EVENT_COOKIE}=TEST12345%00`,
  ]) {
    assert.equal(testEventCodeFromCookieHeader(header), undefined, String(header));
  }
});

test("a malformed %-sequence elsewhere in the cookies cannot throw", () => {
  assert.doesNotThrow(() => testEventCodeFromCookieHeader(`_fbc=%E0%A4%A; ${TEST_EVENT_COOKIE}=TEST12345`));
  assert.equal(testEventCodeFromCookieHeader(`_fbc=%E0%A4%A; ${TEST_EVENT_COOKIE}=TEST12345`), "TEST12345");
});

test("getTestEventCode reads the request's cookie, and a request without it gets none", () => {
  const withCookie = new Request("https://www.swapnilumbarkarfitness.in/api/events", {
    headers: { cookie: `${TEST_EVENT_COOKIE}=TEST4242` },
  });
  assert.equal(getTestEventCode(withCookie), "TEST4242");
  // A webhook: Cal.com's servers carry no browser cookie at all.
  const webhook = new Request("https://www.swapnilumbarkarfitness.in/api/cal-webhook", { method: "POST", body: "{}" });
  assert.equal(getTestEventCode(webhook), undefined);
});

test("the cookie is HttpOnly, Secure, Path=/, host-only and lasts one hour", () => {
  assert.ok(TEST_EVENT_COOKIE.startsWith("__Host-"), "__Host- stops another subdomain planting it");
  assert.equal(TEST_EVENT_COOKIE_OPTIONS.httpOnly, true);
  assert.equal(TEST_EVENT_COOKIE_OPTIONS.secure, true, "__Host- requires Secure");
  assert.equal(TEST_EVENT_COOKIE_OPTIONS.path, "/", "__Host- requires Path=/");
  assert.equal("domain" in TEST_EVENT_COOKIE_OPTIONS, false, "__Host- forbids Domain");
  assert.equal(TEST_EVENT_COOKIE_OPTIONS.maxAge, 3600);
  assert.equal(TEST_EVENT_COOKIE_MAX_AGE_S, 3600);
});

test("the admin route sets a valid code, clears on 'off', and refuses anything else", () => {
  assert.deepEqual(testEventCookieAction("TEST12345"), { kind: "set", code: "TEST12345" });
  assert.deepEqual(testEventCookieAction("test777"), { kind: "set", code: "TEST777" });
  assert.deepEqual(testEventCookieAction("off"), { kind: "clear" });
  assert.deepEqual(testEventCookieAction(" OFF "), { kind: "clear" });
  for (const bad of [null, undefined, "", "TEST1", "on", "TEST12345&x=1"]) {
    assert.deepEqual(testEventCookieAction(bad), { kind: "invalid" }, String(bad));
  }
});

test("the admin route checks the admin key before anything else and never takes the key from the URL", () => {
  const src = readFileSync(join(root, "app/api/admin/test-events/route.ts"), "utf8");
  const body = src.slice(src.indexOf("export async function GET"));
  const auth = body.indexOf("checkAdminKey(req)");
  assert.ok(auth > -1, "the route must call checkAdminKey");
  for (const after of ["searchParams", "cookies.set"]) {
    assert.ok(body.indexOf(after) > auth, `${after} must come after the admin-key check`);
  }
  assert.doesNotMatch(src, /searchParams\.get\(["'](key|admin|adminKey)["']\)/);
  assert.match(src, /TEST_EVENT_COOKIE_OPTIONS/);
});

test("/api/quiz-lead reads the cookie before after() and passes it to both of its Meta sends", () => {
  const src = readFileSync(join(root, "app/api/quiz-lead/route.ts"), "utf8");
  const read = src.indexOf("getTestEventCode(req)");
  assert.ok(read > -1, "quiz-lead must read the test cookie");
  assert.ok(read < src.indexOf("after(async"), "the request is not safe to read inside after()");
  for (const name of ['sendCAPIEvent("QuizComplete"', 'sendCAPIEvent("Lead"']) {
    const at = src.indexOf(name);
    assert.ok(at > -1, name);
    const call = src.slice(at, src.indexOf("});", at));
    assert.match(call, /testCode \? \{ testCode \} : \{\}/, `${name} must carry the per-browser test code`);
  }
  assert.doesNotMatch(src, /META_TEST_EVENT_CODE/, "never the global code");
});
