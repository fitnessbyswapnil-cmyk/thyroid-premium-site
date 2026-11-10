/**
 * app/admin/charts/geometry.ts — the arithmetic behind StageFunnel and TrendBars
 * (and the label thinning JourneySteps shares with TrendBars).
 *
 * Pure: no React, no DOM, no tokens, so lib/admin-charts.test.ts can run it
 * under plain `node --test`. Every input here comes off a sheet and can be
 * missing, negative or NaN; every output is a number a style attribute can
 * take, so a chart can never print "NaN%" or draw an Infinity-wide bar.
 */

/** A count as a chart can use it: finite and above zero, or else 0. */
export function clean(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ── funnel ─────────────────────────────────────────────────────────────────

/**
 * Bar widths for a funnel, as fractions 0..1 of the track.
 *
 * Proportional to the FIRST stage: everyone who entered is the whole bar.
 * A later stage may be larger than the first (counts taken from different
 * sources do that), and when one is, it becomes the scale instead, so its bar
 * fills the track and nothing is clamped to look smaller than it is.
 *
 * A stage that is not zero always gets at least `minFraction`, so one woman
 * out of a thousand is still a visible sliver. Zero is exactly zero. Neither
 * rule can reorder bars: a funnel that only ever shrinks draws bars that only
 * ever shrink.
 */
export function funnelWidths(counts: readonly number[], minFraction = 0.015): number[] {
  const c = counts.map(clean);
  const scale = Math.max(0, ...c);
  if (scale === 0) return c.map(() => 0);
  return c.map((n) => (n === 0 ? 0 : Math.max(n / scale, minFraction)));
}

/**
 * The share of the stage above that reached this one, as a whole percentage,
 * or null when there is no one above to convert (0 of 0 is not 0%).
 *
 * Rounded honestly. A real but tiny conversion never prints as 0%, "all but
 * one" never prints as 100%, and a stage that grew never prints as 100%
 * either. Above 100% is reported as it is: the data says so, so the label does.
 */
export function conversionPct(prev: number, cur: number): number | null {
  const p = clean(prev);
  const c = clean(cur);
  if (p === 0) return null;
  if (c === 0) return 0;
  const pct = Math.round((100 * c) / p);
  if (c < p) return Math.min(99, Math.max(1, pct));
  if (c > p) return Math.max(101, pct);
  return 100;
}

/** conversionPct for every stage against the one directly above it; the first has none. */
export function stepConversions(counts: readonly number[]): (number | null)[] {
  return counts.map((n, i) => (i === 0 ? null : conversionPct(counts[i - 1], n)));
}

/** "53%", or an em dash where there is nothing to convert. */
export function formatPct(pct: number | null): string {
  return pct === null ? "—" : `${pct}%`;
}

/**
 * Which step of an ordinal ramp stage `i` of `n` wears: the first stage the
 * lightest, the last the darkest, the rest spread evenly between. Seven
 * stages on the four-step teal ramp come out 0 1 1 2 2 3 3.
 */
export function rampIndex(i: number, n: number, steps = 4): number {
  if (!(n > 1) || !(steps > 1)) return 0;
  const k = Math.round((i * (steps - 1)) / (n - 1));
  return Math.min(steps - 1, Math.max(0, k));
}

// ── bars ───────────────────────────────────────────────────────────────────

// The 1-2-5 series is too coarse for a chart this small: 12 leads on a scale
// of 20 leaves the tallest bar at 60%. These steps keep it above roughly 80%.
const NICE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** The smallest "nice" number at or above `n`: 7 → 8, 12 → 15, 41 → 50. Never 0. */
export function niceMax(n: number): number {
  const v = clean(n);
  if (v === 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = NICE.find((s) => s * mag >= v * (1 - 1e-12)) ?? 10;
  return Number((step * mag).toPrecision(12));
}

/**
 * Bar heights as fractions 0..1 of the plot, against `max` (a nice max of the
 * data by default). A max below the data is raised to the data, never used to
 * clip it. A value that is not zero always shows at least `minFraction`.
 */
export function barHeights(values: readonly number[], max?: number, minFraction = 0.02): number[] {
  const v = values.map(clean);
  const dataMax = Math.max(0, ...v);
  const scale = max === undefined ? niceMax(dataMax) : Math.max(clean(max), dataMax) || 1;
  return v.map((x) => (x === 0 ? 0 : Math.max(x / scale, minFraction)));
}

// ── labels ─────────────────────────────────────────────────────────────────

/**
 * Which x-axis labels to draw so none of them collide.
 *
 * Every column is `widthPx / labels.length` wide and a label needs roughly
 * `charPx` per character plus `gapPx` of air, so the chart labels every
 * `step`-th column, counted back from the newest so the current period is
 * always named. Columns in `keep` (the highlighted period) always get their
 * label, and the regular labels too close to one are dropped instead.
 * An unknown width (0, before the chart has been measured) labels only the
 * newest and the kept columns.
 */
export function thinLabels(
  labels: readonly string[],
  widthPx: number,
  opts: { charPx?: number; gapPx?: number; keep?: readonly number[] } = {},
): boolean[] {
  const n = labels.length;
  if (n === 0) return [];
  const { charPx = 6.2, gapPx = 8 } = opts;
  const keep = new Set((opts.keep ?? []).filter((k) => Number.isInteger(k) && k >= 0 && k < n));
  const show = labels.map(() => false);
  if (!(widthPx > 0)) {
    show[n - 1] = true;
    for (const k of keep) show[k] = true;
    return show;
  }
  const longest = Math.max(1, ...labels.map((l) => l.length));
  const step = Math.max(1, Math.ceil((longest * charPx + gapPx) / (widthPx / n)));
  for (let i = n - 1; i >= 0; i -= step) show[i] = true;
  for (const k of keep) {
    for (let j = Math.max(0, k - step + 1); j <= Math.min(n - 1, k + step - 1); j++) {
      if (!keep.has(j)) show[j] = false;
    }
    show[k] = true;
  }
  return show;
}
