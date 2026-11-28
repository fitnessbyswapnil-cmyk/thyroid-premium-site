import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { INTERNAL_PATHS, PRODUCTION_HOST, inlineHostGuard, isInternalPath } from "./tracking-host.ts";

// The operator pages (/admin, /crm, /inbox) show client names, numbers and
// health conversations. GTM's container fires Clarity's session recorder and
// the Meta pixel on every page it loads on, so no tracking snippet may run
// there. Everything else on the production host keeps tracking exactly as
// before. Both directions are checked by RUNNING the code, not by reading it.

const root = join(import.meta.dirname, "..");
const FUNNEL = ["/", "/decode", "/decode/quiz", "/webinar", "/webinar/confirmed", "/privacy", "/payment", "/booking-confirmed"];
const OPERATOR = ["/admin", "/admin/", "/admin/today", "/crm", "/crm/x", "/inbox", "/inbox/thread"];
const LOOKALIKES = ["/administrator", "/admins", "/crm-guide", "/inboxes", "/decode/admin"];

type Loc = { hostname: string; pathname?: string };
const passes = (loc: Loc) =>
  (new Function("location", `${inlineHostGuard()} return true;`) as (l: Loc) => boolean | undefined)(loc) === true;

test("the guard stops every tracking snippet on the operator pages", () => {
  for (const pathname of OPERATOR) assert.equal(passes({ hostname: PRODUCTION_HOST, pathname }), false, pathname);
});

test("the guard still lets the funnel pages, and look-alike paths, track", () => {
  for (const pathname of [...FUNNEL, ...LOOKALIKES]) assert.equal(passes({ hostname: PRODUCTION_HOST, pathname }), true, pathname);
});

test("off the production host nothing tracks, operator page or not", () => {
  for (const pathname of ["/decode", "/admin"]) {
    assert.equal(passes({ hostname: "localhost", pathname }), false);
    assert.equal(passes({ hostname: "thyroid-funnel.workers.dev", pathname }), false);
  }
});

test("isInternalPath and the inline guard agree on every path", () => {
  for (const pathname of [...FUNNEL, ...OPERATOR, ...LOOKALIKES]) {
    assert.equal(isInternalPath(pathname), !passes({ hostname: PRODUCTION_HOST, pathname }), pathname);
  }
  assert.equal(isInternalPath(undefined), false);
});

test("every operator path is a real page, so a rename cannot leave one tracked", () => {
  for (const path of INTERNAL_PATHS) assert.ok(existsSync(join(root, "app", path, "page.tsx")), `app${path}/page.tsx`);
});

// The GTM snippets, read out of GTM.tsx and filled in the way React fills them.
// Only the guard and the container id are substituted; the loader host is
// whatever the file says, so the tests below run the URL that actually ships.
const gtmTsx = readFileSync(join(root, "app/components/tracking/GTM.tsx"), "utf8");
const fill = (template: string) =>
  template.replaceAll("${inlineHostGuard()}", inlineHostGuard()).replaceAll("${GTM_ID}", "GTM-TEST");
const scriptTemplate = gtmTsx.match(/__html: `(\(function\(\)\{\$\{inlineHostGuard\(\)\}[\s\S]*?)`,/)?.[1];
const noscriptTemplate = gtmTsx.match(/__html: `(<iframe[\s\S]*?)`,/)?.[1];

// Google's own host. The Stape host (lime.) the container used to load from was
// cancelled and now answers 404 behind a self-signed certificate.
const GTM_LOADER = "https://www.googletagmanager.com/gtm.js?id=GTM-TEST";
const GTM_NOSCRIPT = "https://www.googletagmanager.com/ns.html?id=GTM-TEST";

/** Runs the real snippet; returns the src of every script it inserted, and the dataLayer. */
function runGtmSnippet(loc: Loc) {
  assert.ok(scriptTemplate, "GTM.tsx no longer builds its snippet around inlineHostGuard()");
  const code = fill(scriptTemplate);
  assert.doesNotMatch(code, /\$\{/, "an unfilled placeholder is left in the snippet");
  const inserted: string[] = [];
  const first = { parentNode: { insertBefore: (el: { src: string }) => inserted.push(el.src) } };
  const document = { getElementsByTagName: () => [first], createElement: () => ({}) };
  const window: Record<string, unknown> = {};
  new Function("window", "document", "location", code)(window, document, loc);
  return { inserted, dataLayer: window.dataLayer };
}

test("the GTM snippet as written loads the container on funnel pages and never on operator pages", () => {
  const loadsGtm = (pathname: string) => {
    const { inserted } = runGtmSnippet({ hostname: PRODUCTION_HOST, pathname });
    return inserted.length === 1 && inserted[0] === GTM_LOADER;
  };
  for (const p of FUNNEL) assert.equal(loadsGtm(p), true, `GTM must still load on ${p}`);
  for (const p of OPERATOR) assert.equal(loadsGtm(p), false, `GTM must not load on ${p}`);
});

test("on the production host the container loads from googletagmanager.com, never the Stape host", () => {
  assert.ok(scriptTemplate);
  const code = fill(scriptTemplate);
  assert.ok(!code.includes("lime."), "the generated GTM snippet still names the cancelled Stape host");
  const { inserted, dataLayer } = runGtmSnippet({ hostname: PRODUCTION_HOST, pathname: "/decode" });
  assert.deepEqual(inserted, [GTM_LOADER]);
  assert.ok(Array.isArray(dataLayer) && dataLayer.length === 1, "gtm.start is pushed once before the loader");
});

test("off the production host, and on operator pages, the snippet loads nothing and leaves no dataLayer", () => {
  const blocked: Loc[] = [
    { hostname: "localhost", pathname: "/decode" },
    { hostname: "thyroid-funnel.workers.dev", pathname: "/decode" },
    { hostname: "thyroid-premium-site-git-main.vercel.app", pathname: "/" },
    { hostname: "swapnilumbarkarfitness.in", pathname: "/decode" },
    { hostname: PRODUCTION_HOST, pathname: "/admin" },
    { hostname: PRODUCTION_HOST, pathname: "/crm/x" },
    { hostname: PRODUCTION_HOST, pathname: "/inbox" },
  ];
  for (const loc of blocked) {
    const { inserted, dataLayer } = runGtmSnippet(loc);
    assert.deepEqual(inserted, [], `${loc.hostname}${loc.pathname} must not load GTM`);
    assert.equal(dataLayer, undefined, `${loc.hostname}${loc.pathname} must not start a dataLayer`);
  }
});

test("the no-JS iframe points at googletagmanager.com too", () => {
  assert.ok(noscriptTemplate, "GTM.tsx no longer renders the noscript iframe");
  const html = fill(noscriptTemplate);
  assert.doesNotMatch(html, /\$\{/, "an unfilled placeholder is left in the noscript iframe");
  assert.equal(html.match(/src="([^"]+)"/)?.[1], GTM_NOSCRIPT);
  assert.ok(!html.includes("lime."), "the noscript iframe still names the cancelled Stape host");
});

test("no code reads NEXT_PUBLIC_SGTM_URL or loads from the Stape host, so a stale build variable cannot bring it back", () => {
  // Code shapes, not bare words: a comment may still name the old host and
  // variable as history (GTM.tsx does), but nothing may read or load them.
  const banned = [
    /\benv\s*(?:\.|\[\s*["'`])NEXT_PUBLIC_SGTM_URL/, // process.env.X, env["X"]
    /["'`]NEXT_PUBLIC_SGTM_URL["'`]\s*:/, // a vars entry in wrangler.jsonc
    /https?:\/\/lime\./, // the host as a URL
  ];
  const self = join("lib", "operator-pages-untracked.test.ts");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (/\.(?:[cm]?[jt]sx?|jsonc?)$/.test(entry.name)) files.push(rel);
    }
  };
  walk("app");
  walk("lib");
  for (const f of ["middleware.ts", "next.config.ts", "custom-worker.js", "wrangler.jsonc", "open-next.config.ts"]) {
    if (existsSync(join(root, f))) files.push(f);
  }
  assert.ok(files.includes(join("app", "components", "tracking", "GTM.tsx")), "the sweep must cover GTM.tsx");
  for (const f of files) {
    if (f === self) continue;
    const text = readFileSync(join(root, f), "utf8");
    for (const pattern of banned) assert.doesNotMatch(text, pattern, `${f} still reads or loads the Stape host`);
  }
});
