import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_HOST } from "./tracking-host.ts";
import { isLedgerable } from "./ledger.ts";
import {
  PAGEVIEW_BEACON_PATH,
  PAGEVIEW_ID_PATTERN,
  isPageViewEventId,
  pageViewServerLegSnippet,
} from "./pageview-beacon.ts";

// The PageView server leg (D2). The browser leg is web GTM tag 75, whose Event
// ID is the variable below; the beacon must send the SAME id, exactly once per
// document, and only on the production host's funnel pages. Every check RUNS
// the snippet that ships in the HTML rather than reading it.

// Verbatim from web GTM-P3S5BXQB, variable 167 "JS - Persistent PageView ID",
// the Event ID of tag 75 "Meta Ads PageView" (container export, 28-Nov-2026).
// If the GTM variable is ever changed, change this and the snippet together.
const GTM_PAGEVIEW_ID_VARIABLE =
  "function() {\n  if (!window._pageViewId) {\n    window._pageViewId = 'pv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);\n  }\n  return window._pageViewId;\n}";

const root = join(import.meta.dirname, "..");
const FUNNEL = ["/", "/decode", "/decode/quiz", "/session-booked", "/booking-confirmed", "/privacy"];
const OPERATOR = ["/admin", "/admin/today", "/crm", "/crm/x", "/inbox", "/inbox/thread"];
const OFF_HOSTS = [
  "localhost",
  "127.0.0.1",
  "thyroid-funnel.thyroid-premium-site.workers.dev",
  "thyroid-premium-site-git-main.vercel.app",
  // The apex only ever 307s to www, so it is not a tracking host either.
  "swapnilumbarkarfitness.in",
];

type FakeWindow = Record<string, unknown>;
type Clock = { now: number; random: number };

function gtmPageViewId(window: FakeWindow, clock?: Clock): string {
  const DateImpl = clock ? { now: () => clock.now } : Date;
  const MathImpl = clock ? { random: () => clock.random } : Math;
  return new Function("window", "Date", "Math", `return (${GTM_PAGEVIEW_ID_VARIABLE})();`)(
    window,
    DateImpl,
    MathImpl,
  ) as string;
}

function runSnippet(opts: {
  href: string;
  window?: FakeWindow;
  beacon?: "accepts" | "refuses" | "missing" | "throws";
  noFetch?: boolean;
  prerendering?: boolean;
  clock?: Clock;
}) {
  const url = new URL(opts.href);
  const location = { href: opts.href, hostname: url.hostname, pathname: url.pathname };
  const beaconCalls: Array<{ url: string; body: string }> = [];
  const fetchCalls: Array<{ url: string; init: Record<string, unknown> }> = [];
  const listeners: Record<string, Array<() => void>> = {};

  const mode = opts.beacon ?? "accepts";
  const navigator: Record<string, unknown> = {};
  if (mode !== "missing") {
    navigator.sendBeacon = (u: string, body: string) => {
      if (mode === "throws") throw new Error("payload refused");
      beaconCalls.push({ url: u, body });
      return mode === "accepts";
    };
  }
  const fetch = opts.noFetch
    ? undefined
    : (u: string, init: Record<string, unknown>) => {
        fetchCalls.push({ url: u, init });
        return Promise.resolve({});
      };
  const document = {
    prerendering: !!opts.prerendering,
    addEventListener: (type: string, fn: () => void) => {
      (listeners[type] ??= []).push(fn);
    },
  };
  const window = opts.window ?? {};
  const DateImpl = opts.clock ? { now: () => opts.clock!.now } : Date;
  const MathImpl = opts.clock ? { random: () => opts.clock!.random } : Math;

  new Function("window", "document", "navigator", "location", "fetch", "Date", "Math", pageViewServerLegSnippet())(
    window,
    document,
    navigator,
    location,
    fetch,
    DateImpl,
    MathImpl,
  );
  const fire = (type: string) => (listeners[type] ?? []).forEach((fn) => fn());
  return { window, beaconCalls, fetchCalls, fire };
}

const prod = (path: string) => `https://${PRODUCTION_HOST}${path}`;
const parse = (body: string) => JSON.parse(body) as { event_name: string; event_id: string; source_url: string };

test("on every funnel page it sends exactly one PageView beacon to /api/events, carrying the page URL", () => {
  for (const path of FUNNEL) {
    const href = prod(`${path}?utm_source=ig`);
    const { beaconCalls, fetchCalls, window } = runSnippet({ href });
    assert.equal(beaconCalls.length, 1, path);
    assert.equal(fetchCalls.length, 0, `${path}: no fallback when the beacon was accepted`);
    assert.equal(beaconCalls[0].url, PAGEVIEW_BEACON_PATH);
    const body = parse(beaconCalls[0].body);
    assert.equal(body.event_name, "PageView");
    assert.match(body.event_id, PAGEVIEW_ID_PATTERN);
    assert.equal(body.source_url, href);
    assert.equal(window._pageViewId, body.event_id, "window._pageViewId is the id that was sent");
  }
});

test("GTM's PageView tag then reads the SAME id the beacon sent", () => {
  const { beaconCalls, window } = runSnippet({ href: prod("/decode") });
  const sent = parse(beaconCalls[0].body).event_id;
  assert.equal(gtmPageViewId(window), sent);
  assert.equal(gtmPageViewId(window), sent, "and keeps returning it for the whole document");
});

test("if the GTM variable ever ran first, the beacon reuses its id instead of minting another", () => {
  const window: FakeWindow = {};
  const gtmId = gtmPageViewId(window);
  const { beaconCalls } = runSnippet({ href: prod("/decode"), window });
  assert.equal(parse(beaconCalls[0].body).event_id, gtmId);
});

test("the snippet mints its id with the GTM variable's own expression", () => {
  const expr = GTM_PAGEVIEW_ID_VARIABLE.match(/window\._pageViewId = (.+);\n/)?.[1];
  assert.ok(expr, "could not find the id expression in the GTM variable");
  assert.ok(
    pageViewServerLegSnippet().includes(expr.replace(/\s+/g, "")),
    "the snippet's id expression drifted from GTM's",
  );
  // Same clock, same random draw → byte-identical ids, short draws included.
  for (const random of [0.123456789, 0.5, 0.987654321, 0.25]) {
    const clock = { now: 1764316800123, random };
    const { beaconCalls } = runSnippet({ href: prod("/decode"), clock });
    const sent = parse(beaconCalls[0].body).event_id;
    assert.equal(sent, gtmPageViewId({}, clock), `random=${random}`);
    assert.ok(isPageViewEventId(sent), sent);
  }
});

test("running the snippet twice in one document still sends one beacon", () => {
  const window: FakeWindow = {};
  const first = runSnippet({ href: prod("/decode"), window });
  const second = runSnippet({ href: prod("/decode"), window });
  assert.equal(first.beaconCalls.length + second.beaconCalls.length, 1);
  assert.equal(second.fetchCalls.length, 0);
});

test("off the production host nothing is sent and no id is minted", () => {
  for (const host of OFF_HOSTS) {
    for (const path of ["/decode", "/booking-confirmed"]) {
      const { beaconCalls, fetchCalls, window } = runSnippet({ href: `https://${host}${path}` });
      assert.equal(beaconCalls.length + fetchCalls.length, 0, `${host}${path}`);
      assert.equal(window._pageViewId, undefined, `${host}${path}`);
    }
  }
});

test("on the operator pages nothing is sent and no id is minted", () => {
  for (const path of OPERATOR) {
    const { beaconCalls, fetchCalls, window } = runSnippet({ href: prod(path) });
    assert.equal(beaconCalls.length + fetchCalls.length, 0, path);
    assert.equal(window._pageViewId, undefined, path);
  }
});

test("a query string cannot switch an operator page back on", () => {
  const { beaconCalls, fetchCalls } = runSnippet({ href: prod("/admin?next=/decode") });
  assert.equal(beaconCalls.length + fetchCalls.length, 0);
});

test("when sendBeacon is missing, refuses or throws, one keepalive fetch carries the same body", () => {
  for (const beacon of ["missing", "refuses", "throws"] as const) {
    const { beaconCalls, fetchCalls, window } = runSnippet({ href: prod("/decode"), beacon });
    assert.equal(fetchCalls.length, 1, beacon);
    const { url, init } = fetchCalls[0];
    assert.equal(url, PAGEVIEW_BEACON_PATH);
    assert.equal(init.method, "POST");
    assert.equal(init.keepalive, true);
    assert.equal(init.credentials, "same-origin", "the _fbp/_fbc cookies must ride along");
    const body = parse(init.body as string);
    assert.equal(body.event_name, "PageView");
    assert.equal(body.event_id, window._pageViewId);
    if (beacon === "refuses") assert.equal(parse(beaconCalls[0].body).event_id, body.event_id);
  }
});

test("with no transport at all it fails quietly and never throws into the page", () => {
  assert.doesNotThrow(() => runSnippet({ href: prod("/decode"), beacon: "missing", noFetch: true }));
  assert.doesNotThrow(() => runSnippet({ href: prod("/decode"), beacon: "throws", noFetch: true }));
});

test("a prerendered page sets the id at once but counts the view only on activation", () => {
  const { beaconCalls, window, fire } = runSnippet({ href: prod("/decode"), prerendering: true });
  assert.equal(beaconCalls.length, 0, "nothing while nobody has opened the page");
  assert.match(String(window._pageViewId), PAGEVIEW_ID_PATTERN, "GTM can still pick the id up");
  fire("prerenderingchange");
  assert.equal(beaconCalls.length, 1);
  assert.equal(parse(beaconCalls[0].body).event_id, window._pageViewId);
});

test("isPageViewEventId accepts the GTM shape only", () => {
  assert.equal(isPageViewEventId("pv_1764316800123_abc123xyz"), true);
  assert.equal(isPageViewEventId("pv_1764316800123_i"), true, "a short random draw is still GTM's id");
  assert.equal(isPageViewEventId("pv_1764316800123_"), true);
  for (const bad of [
    "page_view_1764316800_ab12", // the dataLayer / direct-pixel shape, which tag 75 never uses
    "pv_1764316800_abc", // seconds, not milliseconds
    "pv_1764316800123_abc123xyz0", // ten random characters
    "pv_1764316800123_ABC", // base 36 is lower case
    "pv_1764316800123_abc;drop",
    "lead_1764316800_ab12",
    "",
    undefined,
    42,
  ]) {
    assert.equal(isPageViewEventId(bad), false, String(bad));
  }
});

test("every pv_ id can be stored in the D1 ledger, so the exactly-once check applies to it", () => {
  for (let i = 0; i < 2000; i++) {
    const id = gtmPageViewId({});
    assert.ok(isLedgerable(id), id);
    assert.ok(isPageViewEventId(id), id);
  }
});

test("the layout mounts it as a plain script, first in <head>, above GTM and the direct pixel", () => {
  const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
  const head = layout.slice(layout.indexOf("<head>"), layout.indexOf("</head>"));
  assert.ok(head.length > 0, "no <head> in app/layout.tsx");
  const leg = head.indexOf("<PageViewServerLeg />");
  assert.ok(leg > -1, "<PageViewServerLeg /> is not in the root layout's <head>");
  for (const later of ["<GTMScript />", "<MetaPixelHead />"]) {
    const at = head.indexOf(later);
    assert.ok(at === -1 || leg < at, `<PageViewServerLeg /> must come before ${later}`);
  }

  const component = readFileSync(join(root, "app/components/tracking/PageViewServerLeg.tsx"), "utf8");
  assert.match(component, /<script\b/);
  assert.match(component, /pageViewServerLegSnippet\(\)/);
  assert.doesNotMatch(component, /from "next\/script"/, "next/script queues inline scripts until Next boots");
  assert.doesNotMatch(component, /^"use client"/m, "a client component's <script> never executes");
});
