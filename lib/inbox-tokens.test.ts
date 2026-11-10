/**
 * Source-text guard: /inbox paints itself from app/admin/tokens.ts, the
 * measured palette Today and Pipeline render from, and from nothing else.
 *
 * Until Nov-2026 it carried ten colour literals of its own, violet on
 * near-black, so the screen he opens most between calls looked like another
 * product next to the desk that links to it. A screen with a private palette
 * drifts the first time anyone touches it; this catches the first literal
 * rather than the tenth.
 *
 * There is no documented exception. Translucent edges are written as a token
 * plus an alpha suffix, the way Pipeline writes them, never as a literal.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONT } from "../app/admin/tokens.ts";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const INBOX = ["app/inbox/InboxClient.tsx", "app/inbox/page.tsx"];

// ok(regex.test()) rather than match(): a failure should name the rule, not
// print a 500-line component.
const has = (src: string, re: RegExp) => re.test(src);

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/i;
const FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/i;
const NAMED = /["'`](?:white|black|red|green|blue|purple|violet|orange|yellow|gr[ae]y|pink|navy|teal|cyan|magenta|silver|gold)["'`]/i;

test("the inbox carries no colour of its own: no hex, no rgb() or hsl(), no named colours", () => {
  for (const f of INBOX) {
    const src = read(f);
    assert.ok(!has(src, HEX), `${f}: a hex colour literal; use a token from app/admin/tokens.ts`);
    assert.ok(!has(src, FN), `${f}: a colour function literal; use a token from app/admin/tokens.ts`);
    assert.ok(!has(src, NAMED), `${f}: a named colour; use a token from app/admin/tokens.ts`);
  }
});

test("the guard itself catches what it claims to", () => {
  // A regex that matches nothing passes every file, so prove it bites.
  for (const bad of [`color: "#fff"`, `background: "#0e0e11"`, `"#7c5cff80"`]) assert.ok(has(bad, HEX), bad);
  for (const bad of [`"rgba(255,255,255,0.06)"`, `"rgb(0 0 0)"`, `"hsl(200 50% 50%)"`]) assert.ok(has(bad, FN), bad);
  assert.ok(has(`color: "white"`, NAMED));
  // ...and leaves alone what the inbox legitimately writes.
  for (const ok of ["`${t.amber}55`", `background: "transparent"`, "https://wa.me/", "#today"]) {
    assert.ok(!has(ok, HEX) && !has(ok, FN) && !has(ok, NAMED), ok);
  }
});

test("both inbox files take their palette from app/admin/tokens", () => {
  const client = read("app/inbox/InboxClient.tsx");
  assert.ok(has(client, /import \{[^}]*\bLIGHT\b[^}]*\bDARK\b[^}]*\} from "\.\.\/admin\/tokens";/), "InboxClient must import LIGHT and DARK from ../admin/tokens");
  assert.ok(has(client, /\btype Tokens\b/), "InboxClient must type its palette as Tokens, as Today and Pipeline do");
  assert.ok(has(client, /const t: Tokens = dark \? \(DARK as unknown as Tokens\) : LIGHT;/), "InboxClient must pick LIGHT or DARK the way Pipeline does");
  assert.ok(has(read("app/inbox/page.tsx"), /import \{[^}]*\bLIGHT\b[^}]*\} from "\.\.\/admin\/tokens";/), "page.tsx must take theme-color and the body ground from the tokens");
});

test("every face FONT names is loaded on /inbox, which inherits nothing from app/admin/layout", () => {
  // An undefined var() voids the whole font-family declaration, so a missing
  // face does not fall back politely: even FONT.mono would inherit Inter.
  const page = read("app/inbox/page.tsx");
  const vars = Object.values(FONT).map((stack) => stack.match(/var\((--[a-z0-9-]+)\)/)?.[1]);
  assert.equal(vars.length, 3);
  for (const v of vars) {
    assert.ok(v, "a FONT stack no longer starts with a var()");
    assert.ok(page.includes(`variable: "${v}"`), `page.tsx must load the face behind ${v}`);
  }
});

test("on a light page the status bar keeps a strip of its own, and the reply bar keeps the gesture area", () => {
  const page = read("app/inbox/page.tsx");
  // black-translucent draws a white clock over the page; on paper it vanishes.
  assert.ok(!has(page, /statusBarStyle:\s*"black-translucent"/), "black-translucent puts white status-bar text over a light page");
  assert.ok(has(page, /statusBarStyle:\s*"default"/), "statusBarStyle must be default");
  assert.ok(has(page, /color:\s*LIGHT\.card/) && has(page, /color:\s*DARK\.card/), "theme-color must be the header surface in both themes");
  assert.ok(has(page, /viewportFit:\s*"cover"/), "viewportFit cover is what lets the reply bar own the gesture area");
  assert.ok(has(read("app/inbox/InboxClient.tsx"), /env\(safe-area-inset-bottom\)/), "the reply bar must still pad for the gesture area");
});

test("the inbox follows the dashboard's own theme switch, under the same storage key", () => {
  const shell = read("app/admin/page.tsx").match(/const THEME_STORE = "([^"]+)"/)?.[1];
  const inbox = read("app/inbox/InboxClient.tsx").match(/const THEME_STORE = "([^"]+)"/)?.[1];
  assert.ok(shell, "app/admin/page.tsx no longer names its theme key THEME_STORE");
  assert.equal(inbox, shell, "a renamed key would leave the inbox silently ignoring the switch");
});
