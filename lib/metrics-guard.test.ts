/**
 * Source-text guard: the three admin tabs READ Leads/Booked/Won/Revenue from
 * lib/metrics, they never work them out again.
 *
 * Before 14-Sep-2026 each tab had its own rule — Pipeline counted any Paid=Y
 * row as won, Analytics priced every paid row at Rs 299, Today called a close
 * anything over Rs 5,000 — and the same fortnight showed three different
 * numbers. The equality test in metrics.test.ts proves the shared function
 * agrees with itself; this one catches a tab quietly growing its own copy.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const TABS = ["app/admin/Today.tsx", "app/admin/Pipeline.tsx", "app/admin/AnalyticsDashboard.tsx"];

// ok(regex.test()) rather than match(): a failure should name the rule, not
// print a 1,500-line component.
const has = (src: string, re: RegExp) => re.test(src);

test("every tab takes its headline numbers from lib/metrics", () => {
  // Pipeline and Analytics fetch /api/admin/metrics; Today gets the same
  // Summary inside its own feed, which calls summarize() on the same dataset.
  for (const tab of ["app/admin/Pipeline.tsx", "app/admin/AnalyticsDashboard.tsx"]) {
    assert.ok(has(read(tab), /useMetrics\(/), `${tab} must read /api/admin/metrics via useMetrics`);
  }
  assert.ok(has(read("app/admin/Today.tsx"), /metrics:\s*Summary/), "Today must show the Summary its feed returns");
  const feed = read("app/api/admin/today/route.ts");
  assert.ok(has(feed, /summarize\(/) && has(feed, /loadMetricsDataset\(/), "the Today feed must build its numbers with summarize()");
  for (const tab of TABS) {
    assert.ok(has(read(tab), /useRange\(/), `${tab} must use the shared range, not its own`);
  }
});

test("no tab or feed carries a private revenue or win rule", () => {
  const files = [...TABS, "app/api/admin/today/route.ts", "app/api/admin/crm/route.ts", "app/api/admin/digest/route.ts"];
  for (const f of files) {
    const src = read(f);
    assert.ok(!has(src, /CONSULT_PRICE/), `${f}: paid rows are not priced at a constant`);
    assert.ok(!has(src, /closedAmt\s*>=?\s*5000/), `${f}: a close is lib/metrics isWonRow, not a Rs 5,000 guess`);
  }
});

test("the CRM screens send nothing to Meta", () => {
  const files = [
    ...TABS,
    "app/api/admin/metrics/route.ts",
    "app/api/admin/call-outcome/route.ts",
    "app/api/admin/today/route.ts",
    "app/api/admin/crm/route.ts",
    "app/api/admin/digest/route.ts",
    "lib/metrics.ts",
    "lib/metrics-source.ts",
    "lib/follow-up-queue.ts",
  ];
  for (const f of files) {
    const src = read(f);
    assert.ok(!has(src, /meta-conversion|server-tracking|sendProgramConversion|graph\.facebook\.com/), `${f} must not reach Meta`);
  }
});
