import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// /admin used to mount Today, Pipeline and Analytics together and hide two.
// Every hidden tab still fired its API calls on load: about 16 at once, and
// on a cold worker each one paid the bundle's 1.3-2 s CPU boot, some dying
// with error 1102. A tab now mounts on its first visit and stays mounted.

const page = readFileSync(join(import.meta.dirname, "..", "app/admin/page.tsx"), "utf8");

test("no tab mounts before it is first opened", () => {
  assert.match(page, /useState<Record<Tab, boolean>>\(\{ today: false, pipeline: false, analytics: false \}\)/);
  assert.match(page, /\{mounted\.today && \(adminKey \? <Today /);
  assert.match(page, /\{mounted\.pipeline && <Pipeline /);
  assert.match(page, /\{mounted\.analytics && <AnalyticsDashboard /);
  assert.doesNotMatch(page, /^\s*<AnalyticsDashboard /m, "never mounted unconditionally again");
});

test("opening a tab, by click or by the address bar, mounts it and keeps it", () => {
  assert.match(page, /const show = useCallback\(\(x: Tab\) => \{\s*setTab\(x\);\s*setMounted\(\(m\) => \(m\[x\] \? m : \{ \.\.\.m, \[x\]: true \}\)\);/);
  assert.match(page, /show\(h === "analytics"/, "a #analytics link mounts Analytics");
  assert.match(page, /const go = \(x: Tab\) => \{\s*show\(x\);/, "a tab click mounts it");
  assert.doesNotMatch(page, /setMounted\(\(m\) => \(\{ \.\.\.m, \[x\]: false/, "nothing ever un-mounts a tab");
});
