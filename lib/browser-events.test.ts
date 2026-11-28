import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_HOST } from "./tracking-host.ts";
import { handleBrowserEvent } from "./browser-events.ts";
import { TEST_EVENT_COOKIE } from "./test-event-cookie.ts";

// POST /api/events, run for real: a real Request in, the real CAPI request
// body out (global fetch is replaced, so nothing leaves the machine). Every
// identity below is fake.

const root = join(import.meta.dirname, "..");
const PV_ID = "pv_1764316800123_abc123xyz";
const FBP = "fb.1.1764316800000.1234567890";
const FBC = "fb.1.1764316800000.TESTCLICKID";
const VISITOR = "v_1764316800000_test0001";
const IP = "203.0.113.7"; // TEST-NET-3, never a real visitor
const UA = "Mozilla/5.0 (test runner)";

type Sent = { url: string; body: Record<string, unknown> };
let sent: Sent[] = [];
const realFetch = globalThis.fetch;
const realTestCode = process.env.META_TEST_EVENT_CODE;

beforeEach(() => {
  sent = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realTestCode === undefined) delete process.env.META_TEST_EVENT_CODE;
  else process.env.META_TEST_EVENT_CODE = realTestCode;
});

function request(
  body: unknown,
  opts: { host?: string; origin?: string | null; cookie?: string } = {},
): Request {
  const headers: Record<string, string> = {
    host: opts.host ?? PRODUCTION_HOST,
    "content-type": "text/plain;charset=UTF-8", // what sendBeacon sends for a string body
    "cf-connecting-ip": IP,
    "user-agent": UA,
    cookie: opts.cookie ?? `_fbp=${FBP}; _fbc=${FBC}; _visitor_id=${VISITOR}`,
  };
  if (opts.origin !== null) headers.origin = opts.origin ?? `https://${PRODUCTION_HOST}`;
  return new Request(`https://${opts.host ?? PRODUCTION_HOST}/api/events`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const pageView = (overrides: Record<string, unknown> = {}) => ({
  event_name: "PageView",
  event_id: PV_ID,
  source_url: `https://${PRODUCTION_HOST}/decode`,
  ...overrides,
});

const metaCalls = () => sent.filter((s) => s.url.startsWith("https://graph.facebook.com/"));
const onlyEvent = () => {
  assert.equal(sent.length, 1, "exactly one outbound request");
  assert.equal(metaCalls().length, 1, "and it went to Meta");
  const data = sent[0].body.data as Array<Record<string, unknown>>;
  assert.equal(data.length, 1);
  return data[0];
};
const sha256 = (v: string) => crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

test("a production PageView reaches Meta once, with the browser's id and her cookies, IP and user agent", async () => {
  const res = await handleBrowserEvent(request(pageView()));
  assert.equal(res.status, 200);
  const ev = onlyEvent();
  assert.equal(ev.event_name, "PageView");
  assert.equal(ev.event_id, PV_ID, "the same id GTM tag 75 sends, so Meta keeps one");
  assert.equal(ev.action_source, "website");
  assert.equal(ev.event_source_url, `https://${PRODUCTION_HOST}/decode`);
  const ud = ev.user_data as Record<string, string>;
  assert.equal(ud.fbp, FBP, "fbp is sent raw, as Meta requires");
  assert.equal(ud.fbc, FBC, "fbc is sent raw, as Meta requires");
  assert.equal(ud.client_ip_address, IP);
  assert.equal(ud.client_user_agent, UA);
  assert.equal(ud.external_id, sha256(VISITOR), "the same external_id the pixel uses, hashed");
  assert.equal(ud.em, undefined);
  assert.equal(ud.ph, undefined);
  assert.equal(sent[0].body.test_event_code, undefined, "a real visit is never a test event");
});

test("a page URL reaches Meta with fbclid and utm_* only — never her name from /booking-confirmed", async () => {
  const href =
    `https://${PRODUCTION_HOST}/booking-confirmed?uid=testuid&name=Test%20Priya&date=Monday&time=10%3A00` +
    `&utm_source=ig&fbclid=TESTCLICKID#top`;
  const res = await handleBrowserEvent(request(pageView({ source_url: href })));
  assert.equal(res.status, 200);
  const url = String(onlyEvent().event_source_url);
  assert.equal(url, `https://${PRODUCTION_HOST}/booking-confirmed?utm_source=ig&fbclid=TESTCLICKID`);
  assert.doesNotMatch(url, /Priya|name=|uid=|#/);
});

test("a request to any other host is refused before Meta is called", async () => {
  for (const host of ["thyroid-funnel.thyroid-premium-site.workers.dev", "x.vercel.app", "localhost:3000", "swapnilumbarkarfitness.in"]) {
    const res = await handleBrowserEvent(request(pageView(), { host }));
    assert.equal(res.status, 403, host);
  }
  assert.equal(sent.length, 0);
});

test("a production source_url from another origin, or an off-host source_url, is refused", async () => {
  assert.equal((await handleBrowserEvent(request(pageView(), { origin: "https://evil.example" }))).status, 403);
  assert.equal(
    (await handleBrowserEvent(request(pageView({ source_url: "https://x.vercel.app/decode" })))).status,
    403,
  );
  assert.equal((await handleBrowserEvent(request(pageView({ source_url: "/decode" })))).status, 403);
  assert.equal(sent.length, 0);
});

test("a same-origin request without an Origin header is still accepted", async () => {
  const res = await handleBrowserEvent(request(pageView(), { origin: null }));
  assert.equal(res.status, 200);
  assert.equal(metaCalls().length, 1);
});

test("a PageView id that could never pair with GTM's tag is refused", async () => {
  for (const event_id of ["page_view_1764316800_ab12", "pv_1", "custom-id", ""]) {
    const res = await handleBrowserEvent(request(pageView({ event_id })));
    assert.equal(res.status, 400, event_id);
  }
  assert.equal(sent.length, 0);
});

test("Schedule is still refused here; /api/cal-webhook is its only server sender", async () => {
  const res = await handleBrowserEvent(request(pageView({ event_name: "Schedule", event_id: "schedule_testuid" })));
  assert.equal(res.status, 409);
  assert.equal(sent.length, 0);
});

test("a body that is not a JSON object is a 400, not a crash", async () => {
  for (const body of ["not json", "null", "42"]) {
    assert.equal((await handleBrowserEvent(request(body))).status, 400, body);
  }
  assert.equal(sent.length, 0);
});

test("the owner's test cookie turns HIS PageView into a Test Events send", async () => {
  const cookie = `_fbp=${FBP}; ${TEST_EVENT_COOKIE}=TEST12345; _visitor_id=${VISITOR}`;
  const res = await handleBrowserEvent(request(pageView(), { cookie }));
  assert.equal(res.status, 200);
  onlyEvent();
  assert.equal(sent[0].body.test_event_code, "TEST12345");
});

test("a malformed or look-alike test cookie is ignored and the event counts", async () => {
  for (const cookie of [
    `${TEST_EVENT_COOKIE}=TEST1`,
    `${TEST_EVENT_COOKIE}=test12345`,
    `${TEST_EVENT_COOKIE}=TEST12345x`,
    `${TEST_EVENT_COOKIE}=TEST123456789`,
    `meta_test_event_code=TEST12345`,
    `x${TEST_EVENT_COOKIE}=TEST12345`,
  ]) {
    sent = [];
    const res = await handleBrowserEvent(request(pageView(), { cookie }));
    assert.equal(res.status, 200, cookie);
    assert.equal(sent[0].body.test_event_code, undefined, cookie);
  }
});

test("META_TEST_EVENT_CODE on the worker no longer turns visitors' events into test events", async () => {
  process.env.META_TEST_EVENT_CODE = "TEST99999";
  const res = await handleBrowserEvent(request(pageView()));
  assert.equal(res.status, 200);
  assert.equal(onlyEvent().event_id, PV_ID);
  assert.equal(sent[0].body.test_event_code, undefined);
});

test("PageView does no Google Sheets work, and every send goes through the ledgered sendCAPIEvent", () => {
  for (const file of ["lib/browser-events.ts", "app/api/events/route.ts"]) {
    const src = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(src, /googleapis|getSheetsClient|admin\/_lib|spreadsheets/, `${file} must not touch Sheets`);
    assert.doesNotMatch(src, /\bsendToCAPI\b/, `${file} must not bypass the D1 ledger`);
    assert.doesNotMatch(src, /process\.env\.META_TEST_EVENT_CODE/, `${file} must not read the global test code`);
  }
  assert.match(readFileSync(join(root, "lib/browser-events.ts"), "utf8"), /sendCAPIEvent\(/);
  assert.match(readFileSync(join(root, "app/api/events/route.ts"), "utf8"), /handleBrowserEvent\(req\)/);
});
