import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

test("the GTM snippet as written loads the container on funnel pages and never on operator pages", () => {
  const tsx = readFileSync(join(root, "app/components/tracking/GTM.tsx"), "utf8");
  const template = tsx.match(/__html: `(\(function\(\)\{\$\{inlineHostGuard\(\)\}[\s\S]*?)`,/)?.[1];
  assert.ok(template, "GTM.tsx no longer builds its snippet around inlineHostGuard()");
  const code = template
    .replace("${inlineHostGuard()}", inlineHostGuard())
    .replace("${SGTM_URL}", "https://sgtm.test")
    .replace("${GTM_ID}", "GTM-TEST");
  assert.doesNotMatch(code, /\$\{/, "an unfilled placeholder is left in the snippet");

  const loadsGtm = (pathname: string) => {
    const inserted: string[] = [];
    const first = { parentNode: { insertBefore: (el: { src: string }) => inserted.push(el.src) } };
    const document = { getElementsByTagName: () => [first], createElement: () => ({}) };
    const window: Record<string, unknown> = {};
    new Function("window", "document", "location", code)(window, document, { hostname: PRODUCTION_HOST, pathname });
    return inserted.length === 1 && inserted[0].startsWith("https://sgtm.test/gtm.js?id=GTM-TEST");
  };
  for (const p of FUNNEL) assert.equal(loadsGtm(p), true, `GTM must still load on ${p}`);
  for (const p of OPERATOR) assert.equal(loadsGtm(p), false, `GTM must not load on ${p}`);
});
