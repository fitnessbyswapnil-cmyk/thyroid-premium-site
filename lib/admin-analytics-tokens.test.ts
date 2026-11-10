/**
 * Source-text guard: the Analytics tab is on the design system, and stays there.
 *
 * Until Nov-2026 Analytics painted itself a dark purple instrument panel — a
 * dozen palette constants and some fifty hex literals of its own — and the
 * shell flipped its whole chrome dark whenever that tab was open. One desk read
 * as two products, and the theme switch moved only two of its three screens.
 * It now renders from app/admin/tokens.ts like Today and Pipeline. These checks
 * catch a colour literal creeping back in: a single "just this once" hex is how
 * the old palette started.
 *
 * There is no exception list, because none of the three files needs one. A new
 * colour belongs in tokens.ts (append-only, with its measured ratio), never at
 * the call site — which is also why a token with a hand-written alpha suffix is
 * refused here: that is a new colour too, with no ratio anyone checked.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const ANALYTICS = "app/admin/AnalyticsDashboard.tsx";
const CREATIVES = "app/admin/CreativeOutcomes.tsx";
const SHELL = "app/admin/page.tsx";
const FILES = [ANALYTICS, CREATIVES, SHELL];

/** Every match with its line number, so a failure names the line rather than printing the file. */
function hits(src: string, re: RegExp): string[] {
  return [...src.matchAll(re)].map((m) => `line ${src.slice(0, m.index).split("\n").length}: ${m[0]}`);
}

// #abc, #abcd, #aabbcc, #aabbccdd. Anchors such as "#today" never match: "t" is not hex.
const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|oklab|oklch)\s*\(/gi;
// A named colour in a style or SVG paint position, in a plain quoted string. Not
// a template literal: `${t.teal}` contains the word "teal" and is exactly right.
const NAMED =
  /\b(?:color|background|backgroundColor|border\w*|outline\w*|fill|stroke|boxShadow)\s*[:=]\s*\{?\s*["'][^"']*(?<![\w.-])(?:white|black|red|green|blue|purple|violet|orange|yellow|gold|gray|grey|silver|pink|magenta|cyan|teal|navy|maroon|olive|lime)\b/gi;
// `${t.amber}55` or t.clay + "33": a token with an alpha suffix is a new, unmeasured colour.
const ALPHA_SUFFIX = /\$\{t\.\w+\}[0-9a-fA-F]{2}\b|\bt\.\w+\s*\+\s*["'][0-9a-fA-F]{2}["']/g;

test("Analytics, its creative table and the shell carry no colour literals", () => {
  for (const f of FILES) {
    const src = read(f);
    assert.deepEqual(hits(src, HEX), [], `${f}: hex colours belong in app/admin/tokens.ts`);
    assert.deepEqual(hits(src, COLOR_FN), [], `${f}: rgb()/hsl() colours belong in app/admin/tokens.ts`);
    assert.deepEqual(hits(src, NAMED), [], `${f}: named colours belong in app/admin/tokens.ts`);
    assert.deepEqual(hits(src, ALPHA_SUFFIX), [], `${f}: a token with a hand-made alpha is a new colour — add it to tokens.ts`);
  }
});

test("the shell has one chrome: no dark branch for the Analytics tab", () => {
  const src = read(SHELL);
  // `onLight` was the switch that gave Analytics a dark purple header.
  assert.ok(!/\bonLight\b/.test(src), "page.tsx must not key the chrome off the tab any more");
  assert.ok(/<main style=\{\{ background: t\.paper,/.test(src), "the page ground is always t.paper");
  assert.ok(/background: t\.card,\s*borderBottom: `1px solid \$\{t\.hairline\}`/.test(src), "the header is always t.card over a hairline");
  assert.ok(/<AnalyticsDashboard dark=\{dark\} \/>/.test(src), "Analytics must follow the theme switch like Today and Pipeline");
});

test("Analytics takes its tokens from the theme the way Pipeline does", () => {
  const src = read(ANALYTICS);
  assert.ok(/from "\.\/tokens"/.test(src), "Analytics must import ./tokens");
  assert.ok(/export default function AnalyticsDashboard\(\{ dark = false \}: \{ dark\?: boolean \}\)/.test(src));
  assert.ok(/const t: Tokens = dark \? \(DARK as unknown as Tokens\) : LIGHT;/.test(src), "t must be derived exactly as Pipeline derives it");
  assert.ok(/<CreativeOutcomes t=\{t\} \/>/.test(src) && /<WebinarPanel t=\{t\} \/>/.test(src), "the panels below Analytics must get the same tokens");
  assert.ok(/export default function CreativeOutcomes\(\{ t \}: \{ t: Tokens \}\)/.test(read(CREATIVES)));
});

test("the old palette is gone by name, not just by value", () => {
  const src = read(ANALYTICS);
  assert.deepEqual(hits(src, /\bconst (?:INK1|INK2|MUTED|GRID|CARD|PURPLE|GOOD|WARN|CRIT|SRC_COLORS|FUNNEL_RAMP|TONE)\b/g), []);
});

test("charts use the one hue and neutrals: clay, amber and won are never a series colour", () => {
  const src = read(ANALYTICS);
  assert.deepEqual(hits(src, /\b(?:color|fill|stroke)=\{t\.(?:clay|amber|won)\}/g), [], "a chart mark is teal or ink, never a status colour");
  const sources = src.match(/const srcColors = \(t: Tokens\)[^;]*;/)?.[0] ?? "";
  assert.ok(sources, "srcColors must exist");
  const used = [...sources.matchAll(/\bt\.(\w+)/g)].map((m) => m[1]);
  assert.ok(used.length === 3 && used.every((k) => /^(?:tealFill[1-4]|teal|ink[1-3])$/.test(k)), `lead sources must be teal steps or ink, got ${used.join(", ")}`);
});

test("ink3 never carries words on Analytics: it is a 3.25:1 grey, so it only draws marks", () => {
  for (const f of [ANALYTICS, CREATIVES]) {
    const src = read(f);
    assert.deepEqual(hits(src, /\bcolor: t\.ink3\b/g), [], `${f}: text is ink1 or ink2`);
    assert.deepEqual(hits(src, /<text\b[^>]*\bfill=\{t\.ink3\}/g), [], `${f}: SVG text is ink1 or ink2`);
  }
});
