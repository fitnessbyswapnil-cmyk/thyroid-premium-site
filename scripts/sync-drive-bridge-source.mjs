#!/usr/bin/env node
/**
 * Writes lib/drive-bridge-source.ts from scripts/drive-bridge.gs.
 *
 * WHY: "Connect Google Drive" on the dashboard hands him the script to paste
 * into Apps Script, and a route on Workers cannot read the repo's files at
 * runtime, so the text is compiled in. lib/drive-bridge-source.test.ts fails
 * whenever the two differ, so an edit to the .gs cannot ship while the copy he
 * is handed is still the old one.
 *
 * Run after every edit to the .gs:  npm run sync:bridge
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const GS = join(root, "scripts/drive-bridge.gs");
const TS = join(root, "lib/drive-bridge-source.ts");

const src = readFileSync(GS, "utf8");
const version = src.match(/^var VERSION_ = "([^"]+)";$/m)?.[1];
if (!version) {
  console.error('scripts/drive-bridge.gs has no `var VERSION_ = "...";` line, which doGet reports and the dashboard shows.');
  process.exit(1);
}

// A template literal whose value is exactly the file: escape the three things
// a template literal would otherwise interpret, and carriage returns, which
// it would silently turn into line feeds.
const literal =
  "`" + src.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${").replace(/\r/g, "\\r") + "`";

writeFileSync(
  TS,
  `/**
 * lib/drive-bridge-source.ts — GENERATED from scripts/drive-bridge.gs by
 * scripts/sync-drive-bridge-source.mjs. Do not edit it: change the .gs, then
 * run \`npm run sync:bridge\`.
 *
 * The exact text of the Apps Script, for the dashboard's "Copy script" button:
 * a route on Workers cannot read the repo's files at runtime.
 * lib/drive-bridge-source.test.ts fails while this copy and the .gs differ.
 */
export const DRIVE_BRIDGE_VERSION: string = ${JSON.stringify(version)};

export const DRIVE_BRIDGE_SOURCE: string = ${literal};
`,
);
console.log(`lib/drive-bridge-source.ts written from scripts/drive-bridge.gs (${version}, ${src.length} characters)`);
