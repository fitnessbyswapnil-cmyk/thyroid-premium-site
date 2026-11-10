/**
 * The dashboard hands him lib/drive-bridge-source.ts to paste into Apps Script.
 * If it lagged behind scripts/drive-bridge.gs, he would deploy an old script
 * that the tests in drive-bridge.test.ts never ran, and find out on a live
 * call.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DRIVE_BRIDGE_SOURCE, DRIVE_BRIDGE_VERSION } from "./drive-bridge-source.ts";

const GS = readFileSync(new URL("../scripts/drive-bridge.gs", import.meta.url), "utf8");
const STALE = "lib/drive-bridge-source.ts is out of date with scripts/drive-bridge.gs. Run `npm run sync:bridge` and commit both.";

/** Where two texts first part, as "line N", so the failure says what to look at. */
function firstDifference(a: string, b: string): string {
  const x = a.split("\n");
  const y = b.split("\n");
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] !== y[i]) return `line ${i + 1}: script has ${JSON.stringify(y[i] ?? "<end>")}, copy has ${JSON.stringify(x[i] ?? "<end>")}`;
  }
  return "no line differs";
}

test("the script the dashboard hands out is exactly the one in the repo", () => {
  assert.ok(DRIVE_BRIDGE_SOURCE === GS, `${STALE}\nFirst difference at ${firstDifference(DRIVE_BRIDGE_SOURCE, GS)}`);
});

test("the version the dashboard reports is the one the script answers with", () => {
  const declared = GS.match(/^var VERSION_ = "([^"]+)";$/m)?.[1];
  assert.ok(declared, "scripts/drive-bridge.gs no longer declares var VERSION_");
  assert.equal(DRIVE_BRIDGE_VERSION, declared, STALE);
  assert.equal(DRIVE_BRIDGE_VERSION, "v2");
});
