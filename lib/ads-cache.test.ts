/**
 * The ad cache's pure half, and the rule that makes it worth having: no admin
 * page or feed calls Windsor. Only the hourly refresh does.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { sumSpend, daysToFetch, isoDate, HISTORY_DAYS, RECENT_DAYS, HISTORY_MIN_ROWS } from "./ads-cache.ts";

test("sumSpend adds the days inside the window, inclusive at both ends", () => {
  const rows = [
    { date: "2026-09-01", spend: 100 },
    { date: "2026-09-02", spend: 250.5 },
    { date: "2026-09-03", spend: 49.5 },
    { date: "2026-09-04", spend: Number.NaN },
  ];
  assert.equal(sumSpend(rows, "2026-09-02", "2026-09-03"), 300);
  assert.equal(sumSpend(rows, "0000-00-00", "2026-09-30"), 400);
  assert.equal(sumSpend(rows, "2026-10-01", "2026-10-31"), 0);
});

test("the first fill fetches history; after that only recent days", () => {
  assert.equal(daysToFetch(0, false), HISTORY_DAYS);
  assert.equal(daysToFetch(HISTORY_MIN_ROWS - 1, false), HISTORY_DAYS);
  assert.equal(daysToFetch(HISTORY_MIN_ROWS, false), RECENT_DAYS);
  assert.equal(daysToFetch(365, true), HISTORY_DAYS);
});

test("isoDate is the UTC calendar date", () => {
  assert.equal(isoDate(Date.parse("2026-09-14T23:30:00Z")), "2026-09-14");
});

test("only the refresh job talks to Windsor or the Marketing API", () => {
  const root = join(import.meta.dirname, "..");
  const allowed = new Set(["lib/ads-source.ts", "lib/ads-cache.test.ts"]);
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name)) {
        const rel = relative(root, p);
        if (allowed.has(rel)) continue;
        const src = readFileSync(p, "utf8");
        if (/connectors\.windsor\.ai|\/insights\?/.test(src)) offenders.push(rel);
      }
    }
  };
  walk(join(root, "app"));
  walk(join(root, "lib"));
  assert.deepEqual(offenders, [], `live ads calls outside lib/ads-source.ts: ${offenders.join(", ")}`);
});
