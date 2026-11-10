/**
 * The admin UI kit's chart arithmetic (app/admin/charts/geometry.ts), and the
 * rule that keeps the kit on the design system: no colour in it is written
 * down anywhere except app/admin/tokens.ts.
 *
 * Every input a dashboard feeds these comes off a sheet, so the cases that
 * matter are the awkward ones: nothing yet, zero at the top of a funnel, a
 * later stage that out-counts an earlier one, and a phone-width chart with
 * more weeks than room.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  barHeights, clean, conversionPct, formatPct, funnelWidths, niceMax, rampIndex, stepConversions, thinLabels,
} from "../app/admin/charts/geometry.ts";

const REAL = [120, 64, 41, 30, 22, 9, 6];
const finite = (xs: readonly (number | null)[]) => xs.every((x) => x === null || Number.isFinite(x));

// ── zero and empty ──────────────────────────────────────────────────────────

test("an empty funnel, an empty chart and an empty axis are empty, not errors", () => {
  assert.deepEqual(funnelWidths([]), []);
  assert.deepEqual(stepConversions([]), []);
  assert.deepEqual(barHeights([]), []);
  assert.deepEqual(thinLabels([], 300), []);
});

test("a funnel of zeros draws no bars and no percentages, and nothing is NaN", () => {
  assert.deepEqual(funnelWidths([0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(stepConversions([0, 0, 0]), [null, null, null]);
  assert.equal(formatPct(null), "—");
});

test("zero at the top of the funnel means nobody to convert, not 0% or Infinity", () => {
  assert.equal(conversionPct(0, 5), null);
  assert.equal(conversionPct(0, 0), null);
  const w = funnelWidths([0, 3, 1]);
  assert.ok(finite(w));
  // Scaled to the largest stage instead, so the data still draws honestly.
  assert.deepEqual(w, [0, 1, 1 / 3]);
});

test("garbage counts are treated as zero rather than poisoning the scale", () => {
  assert.equal(clean(Number.NaN), 0);
  assert.equal(clean(-4), 0);
  assert.equal(clean(Number.POSITIVE_INFINITY), 0);
  const w = funnelWidths([Number.NaN, 10, -3, Number.POSITIVE_INFINITY, 5]);
  assert.ok(finite(w));
  assert.deepEqual(w, [0, 1, 0, 0, 0.5]);
  assert.ok(finite(stepConversions([10, Number.NaN, 5])));
  assert.ok(finite(barHeights([Number.NaN, -1, 4])));
});

test("bars of zeros have zero height on a scale of 1, never a divide by zero", () => {
  assert.deepEqual(barHeights([0, 0, 0]), [0, 0, 0]);
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(Number.NaN), 1);
});

// ── widths ──────────────────────────────────────────────────────────────────

test("a funnel that only shrinks draws bars that only shrink, the first one full", () => {
  const w = funnelWidths(REAL);
  assert.equal(w[0], 1);
  for (let i = 1; i < w.length; i++) assert.ok(w[i] <= w[i - 1], `bar ${i} is wider than bar ${i - 1}`);
  assert.ok(Math.abs(w[1] - 64 / 120) < 1e-12, "widths are proportional to the first stage");
});

test("one in a thousand is still a visible sliver, and the floor cannot reorder bars", () => {
  const w = funnelWidths([1000, 3, 1, 0]);
  assert.ok(w[2] > 0, "a count of 1 must still draw");
  assert.ok(w[1] >= w[2] && w[2] > w[3]);
  assert.equal(w[3], 0, "zero stays exactly zero");
});

// ── conversion ──────────────────────────────────────────────────────────────

test("conversion from the stage above, rounded to whole percent", () => {
  assert.deepEqual(stepConversions(REAL), [null, 53, 64, 73, 73, 41, 67]);
  assert.equal(conversionPct(3, 1), 33);
  assert.equal(conversionPct(3, 2), 67);
  assert.equal(conversionPct(8, 1), 13); // 12.5 rounds up
  assert.equal(formatPct(53), "53%");
});

test("rounding never claims 0% for someone, or 100% for all-but-one", () => {
  assert.equal(conversionPct(1000, 1), 1, "0.1% is shown as 1%, not 0%");
  assert.equal(conversionPct(200, 199), 99, "99.5% is shown as 99%, not 100%");
  assert.equal(conversionPct(10, 10), 100);
  assert.equal(conversionPct(10, 0), 0);
});

test("a stage larger than the one above is allowed and shown as over 100%, not clamped", () => {
  assert.equal(conversionPct(41, 46), 112);
  assert.equal(conversionPct(1000, 1001), 101, "100.1% must not read as 100%");
  assert.deepEqual(stepConversions([50, 30, 45]), [null, 60, 150]);
  // The bar is not clamped either: when a later stage out-counts the first,
  // it becomes the full-width bar and the first is drawn shorter than it.
  const w = funnelWidths([50, 30, 80]);
  assert.equal(w[2], 1);
  assert.equal(w[0], 50 / 80);
  assert.ok(w[2] > w[0]);
});

// ── ramp ────────────────────────────────────────────────────────────────────

test("the ramp runs lightest at the first stage to darkest at the last, never backwards", () => {
  assert.deepEqual(REAL.map((_, i) => rampIndex(i, REAL.length)), [0, 1, 1, 2, 2, 3, 3]);
  assert.deepEqual([0, 1, 2, 3].map((i) => rampIndex(i, 4)), [0, 1, 2, 3]);
  assert.deepEqual([0, 1].map((i) => rampIndex(i, 2)), [0, 3]);
  assert.equal(rampIndex(0, 1), 0);
  for (let n = 2; n <= 12; n++) {
    for (let i = 1; i < n; i++) assert.ok(rampIndex(i, n) >= rampIndex(i - 1, n));
    assert.equal(rampIndex(n - 1, n), 3);
  }
});

// ── bar heights ─────────────────────────────────────────────────────────────

test("nice maxima are the next tidy number at or above the data", () => {
  assert.equal(niceMax(7), 8);
  assert.equal(niceMax(10), 10);
  assert.equal(niceMax(12), 12);
  assert.equal(niceMax(13), 15);
  assert.equal(niceMax(41), 50);
  assert.equal(niceMax(120), 120);
  assert.equal(niceMax(121), 150);
  assert.equal(niceMax(0.3), 0.3);
  for (const v of [1, 3, 9, 11, 19, 23, 99, 101, 999, 12345]) assert.ok(niceMax(v) >= v, String(v));
});

test("bar heights sit on the nice max, and a max below the data is raised, never used to clip", () => {
  assert.deepEqual(barHeights([4, 8, 2]), [0.5, 1, 0.25]);
  const h = barHeights([13, 6]);
  assert.equal(h[0], 13 / 15, "13 leads sit on a scale of 15, not drawn as a full-height column");
  assert.deepEqual(barHeights([5, 10], 5), [0.5, 1]);
  assert.ok(barHeights([1000, 1])[1] > 0, "a small value still shows");
});

// ── label thinning ──────────────────────────────────────────────────────────

// A 375px phone leaves about 300px inside a card.
const WEEKS = ["22 Sep", "29 Sep", "6 Oct", "13 Oct", "20 Oct", "27 Oct", "3 Nov", "10 Nov"];
const SHORT = ["W38", "W39", "W40", "W41", "W42", "W43", "W44", "W45"];
const shown = (xs: boolean[]) => xs.flatMap((x, i) => (x ? [i] : []));

test("eight short week labels fit side by side in a 375px card, so every week is named", () => {
  assert.deepEqual(shown(thinLabels(SHORT, 300)), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(shown(thinLabels(WEEKS, 720)), [0, 1, 2, 3, 4, 5, 6, 7], "and dates fit on a desk");
});

test("at 375px eight date labels thin to every other one, counted back from the newest", () => {
  // "13 Oct" needs about 45px and a column is 37.5px, so every second week is named.
  assert.deepEqual(shown(thinLabels(WEEKS, 300)), [1, 3, 5, 7]);
  assert.deepEqual(shown(thinLabels(WEEKS, 150)), [1, 4, 7]);
});

test("twenty-six weeks at 375px never put two labels closer than a label is wide", () => {
  const many = Array.from({ length: 26 }, (_, i) => `W${i + 1}`);
  const s = shown(thinLabels(many, 300));
  assert.equal(s[s.length - 1], 25, "the newest period is always named");
  const col = 300 / many.length;
  for (let i = 1; i < s.length; i++) assert.ok((s[i] - s[i - 1]) * col >= 3 * 6.2 + 8, `${s[i - 1]} and ${s[i]} collide`);
});

test("the highlighted week keeps its label and its crowded neighbours give way", () => {
  // Without a highlight, weeks 1 3 5 7 are named; highlighting week 4 drops 3 and 5.
  assert.deepEqual(shown(thinLabels(WEEKS, 300, { keep: [4] })), [1, 4, 7]);
  // With room for everyone, a highlight costs nobody their label.
  assert.deepEqual(shown(thinLabels(SHORT, 300, { keep: [4] })), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("before the chart is measured only the newest and kept labels show", () => {
  assert.deepEqual(shown(thinLabels(WEEKS, 0)), [7]);
  assert.deepEqual(shown(thinLabels(WEEKS, Number.NaN, { keep: [2, 99, -1] })), [2, 7]);
});

// ── the kit stays on the design system ──────────────────────────────────────

const KIT = [
  "app/admin/ui/Button.tsx",
  "app/admin/ui/StatusPill.tsx",
  "app/admin/ui/JourneySteps.tsx",
  "app/admin/charts/StageFunnel.tsx",
  "app/admin/charts/TrendBars.tsx",
  "app/admin/charts/geometry.ts",
];

test("no file in the kit writes a colour down: every colour comes from app/admin/tokens.ts", () => {
  for (const file of KIT) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const hex = src.match(/#[0-9a-fA-F]{3,8}\b/);
    assert.equal(hex, null, `${file} has a hex colour literal: ${hex?.[0]}`);
    const fn = src.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/i);
    assert.equal(fn, null, `${file} has a colour function literal: ${fn?.[0]}`);
    const named = src.match(/["'`](?:white|black|red|green|blue|gray|grey)["'`]/i);
    assert.equal(named, null, `${file} has a named colour: ${named?.[0]}`);
  }
});

test("the lock above would catch each kind of literal it claims to", () => {
  assert.match("color: #FFF;", /#[0-9a-fA-F]{3,8}\b/);
  assert.match("background: rgba(0,0,0,.1)", /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/i);
  assert.match(`fill: "white"`, /["'`](?:white|black|red|green|blue|gray|grey)["'`]/i);
});
