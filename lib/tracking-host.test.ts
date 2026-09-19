import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCTION_HOST,
  isTrackingHost,
  isTrackingUrl,
  inlineHostGuard,
} from "./tracking-host.ts";

test("the production host is the one Cloudflare serves", () => {
  assert.equal(PRODUCTION_HOST, "www.swapnilumbarkarfitness.in");
  assert.equal(isTrackingHost(PRODUCTION_HOST), true);
});

test("a Host header carrying a port still matches", () => {
  assert.equal(isTrackingHost("www.swapnilumbarkarfitness.in:443"), true);
  assert.equal(isTrackingHost("www.swapnilumbarkarfitness.in:3000"), true);
});

test("case and surrounding whitespace do not matter", () => {
  assert.equal(isTrackingHost("  WWW.SwapnilUmbarkarFitness.IN  "), true);
});

test("the apex is NOT a tracking host — the worker redirects it to www", () => {
  assert.equal(isTrackingHost("swapnilumbarkarfitness.in"), false);
});

test("the hosts Meta actually flagged are all rejected", () => {
  // The three *.vercel.app domains from the 19-Sep Events Manager notice.
  assert.equal(isTrackingHost("thyroid-premium-site-3uwikpbfv-fitnessbyswapnil-5026s-projects.vercel.app"), false);
  assert.equal(isTrackingHost("thyroid-premium-site-hgcbsmn67-fitnessbyswapnil-5026s-projects.vercel.app"), false);
  assert.equal(isTrackingHost("thyroidfatlosspremiumconsultation-nbjjbmyu1.vercel.app"), false);
  // The host flagged under the health-data terms.
  assert.equal(isTrackingHost("thyroid-funnel.thyroid-premium-site.workers.dev"), false);
});

test("local development never reaches the live dataset", () => {
  assert.equal(isTrackingHost("localhost"), false);
  assert.equal(isTrackingHost("localhost:3000"), false);
  assert.equal(isTrackingHost("127.0.0.1"), false);
});

test("fails closed on missing or malformed input", () => {
  assert.equal(isTrackingHost(undefined), false);
  assert.equal(isTrackingHost(null), false);
  assert.equal(isTrackingHost(""), false);
  assert.equal(isTrackingHost("   "), false);
  // @ts-expect-error — a non-string must not throw, it must be refused.
  assert.equal(isTrackingHost(123), false);
});

test("a lookalike host does not slip through on a prefix or suffix", () => {
  assert.equal(isTrackingHost("www.swapnilumbarkarfitness.in.evil.com"), false);
  assert.equal(isTrackingHost("evil-www.swapnilumbarkarfitness.in"), false);
  assert.equal(isTrackingHost("wwwXswapnilumbarkarfitness.in"), false);
});

test("isTrackingUrl accepts only absolute production URLs", () => {
  assert.equal(isTrackingUrl("https://www.swapnilumbarkarfitness.in/decode"), true);
  assert.equal(isTrackingUrl("https://www.swapnilumbarkarfitness.in/decode/quiz?x=1"), true);
  // http is still the production host; the worker upgrades it.
  assert.equal(isTrackingUrl("http://www.swapnilumbarkarfitness.in/"), true);
});

test("isTrackingUrl rejects the hosts that caused the incident", () => {
  assert.equal(isTrackingUrl("https://thyroidfatlosspremiumconsultation-nbjjbmyu1.vercel.app/decode"), false);
  assert.equal(isTrackingUrl("https://thyroid-funnel.thyroid-premium-site.workers.dev/decode"), false);
  assert.equal(isTrackingUrl("https://swapnilumbarkarfitness.in/decode"), false);
});

test("a relative URL has no host to verify, so it is refused", () => {
  assert.equal(isTrackingUrl("/decode"), false);
  assert.equal(isTrackingUrl("decode/quiz"), false);
});

test("isTrackingUrl fails closed on junk rather than throwing", () => {
  assert.equal(isTrackingUrl(undefined), false);
  assert.equal(isTrackingUrl(null), false);
  assert.equal(isTrackingUrl(""), false);
  assert.equal(isTrackingUrl("not a url at all"), false);
  assert.equal(isTrackingUrl("javascript:alert(1)"), false);
});

test("the inline guard embeds the host as a quoted literal and returns early", () => {
  const guard = inlineHostGuard();
  assert.ok(guard.includes(JSON.stringify(PRODUCTION_HOST)));
  assert.ok(guard.trim().endsWith("return;"));
  // It must be a complete statement — the snippets concatenate it directly.
  assert.ok(guard.startsWith("if("));
});

test("the inline guard actually gates, when run as code", () => {
  const run = (hostname: string): boolean => {
    let reached = false;
    // Mirrors how the snippets use it: first statement inside an IIFE.
    const fn = new Function(
      "location",
      `${inlineHostGuard()} return true;`,
    ) as (loc: { hostname: string }) => boolean | undefined;
    reached = fn({ hostname }) === true;
    return reached;
  };
  assert.equal(run(PRODUCTION_HOST), true);
  assert.equal(run("thyroidfatlosspremiumconsultation-nbjjbmyu1.vercel.app"), false);
  assert.equal(run("localhost"), false);
});
