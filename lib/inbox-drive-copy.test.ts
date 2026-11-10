/**
 * Source-text guard: "Save to Drive" on the phone inbox sends exactly what
 * /api/admin/save-report reads, and an attachment already in Drive shows its
 * link instead of a button.
 *
 * The inbox carries its own copy of the dashboard tile's DriveCopy
 * (app/admin/AnalyticsDashboard.tsx), so a blood report can be filed from the
 * phone. A drifted copy would not fail loudly: the route reads every field
 * through str(), so a renamed key arrives as "" and the save quietly loses
 * her name or her file. The repo has no component tests, so this reads the
 * source, the way metrics-guard.test.ts does.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** The eight fields the route reads, which are also the eight the dashboard's tile sends. */
const KEYS = ["filename", "kind", "mediaId", "messageId", "mime", "name", "phone", "ts"];

/** One top-level function, from its declaration to the next top-level declaration. */
function fn(src: string, name: string): string {
  const start = src.indexOf(`\nfunction ${name}(`);
  assert.ok(start >= 0, `function ${name} is gone from the inbox`);
  const next = src.slice(start + 1).search(/\n(?:export default )?function |\nconst \w+ = /);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

/** Top-level keys of the object literal the save-report POST sends. */
function payloadKeys(src: string): string[] {
  const body = src.match(/fetch\("\/api\/admin\/save-report", \{[\s\S]*?body: JSON\.stringify\(\{([\s\S]*?)\}\),/)?.[1];
  assert.ok(body, "no POST to /api/admin/save-report with a JSON body");
  return body.split(",").map((p) => p.trim()).filter(Boolean).map((p) => p.split(":")[0].trim()).sort();
}

const inbox = read("app/inbox/InboxClient.tsx");
const driveCopy = fn(inbox, "DriveCopy");
const media = fn(inbox, "Media");

test("the phone's Save to Drive sends exactly the eight fields the route reads", () => {
  const route = read("app/api/admin/save-report/route.ts");
  const read8 = [...route.matchAll(/\w+: str\(body\.(\w+)\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(read8, KEYS, "the route reads a different set of fields: update KEYS, the inbox and the dashboard together");
  assert.deepEqual(payloadKeys(driveCopy), KEYS);
  // The name is hers, from the thread, and the phone is the thread's.
  assert.ok(/name: clientName/.test(driveCopy), "name must be the client's name the thread passes in");
  assert.ok(/<Media m=\{m\} apiKey=\{apiKey\} phone=\{open\.phone\} clientName=\{open\.name\}/.test(inbox), "the thread view must pass its own phone and name");
});

test("it is the dashboard's request: a POST with JSON and the admin key header", () => {
  assert.ok(
    /fetch\("\/api\/admin\/save-report", \{\s*method: "POST",\s*headers: \{ "Content-Type": "application\/json", "x-admin-key": apiKey \}/.test(driveCopy),
    "save-report must be a POST carrying x-admin-key",
  );
});

test("an attachment already in Drive shows its link before any button is considered", () => {
  const link = driveCopy.indexOf("const url = m.driveUrl || savedUrl;");
  const gate = driveCopy.indexOf("if (!canSaveToDrive(m)) return null;");
  assert.ok(link >= 0, "the link must come from driveUrl, or from the url a save just returned");
  assert.ok(/if \(url\) \{\s*return \(\s*<a href=\{url\}[\s\S]*?In Drive/.test(driveCopy), "a known url renders the In Drive link");
  assert.ok(gate > link, "the canSaveToDrive gate must come after the link: a saved copy shows even where no button would");
  assert.ok(/import \{ canSaveToDrive \} from "@\/lib\/admin-actions";/.test(inbox), "the button follows the same rule the route uses to look up driveUrl");
});

test("the button keeps the dashboard's states, and a failed save is clay", () => {
  assert.ok(/\{busy \? "Saving…" : "Save to Drive"\}/.test(driveCopy), "Save to Drive, then Saving… while it runs");
  assert.ok(/if \(inFlight\.current\) return;/.test(driveCopy), "a double tap must not save twice");
  assert.ok(/\{!note\?\.ok && \(/.test(driveCopy), "the button goes once a save succeeded without a link");
  assert.ok(/"Saved to her Drive folder"/.test(driveCopy));
  assert.ok(/color: note\.ok \? t\.ink2 : t\.clay/.test(driveCopy), "a save he asked for that did not happen is clay");
});

test("the Drive affordance sits under every attachment, including one WhatsApp has deleted", () => {
  // The failed branch used to return early; past 30 days the Drive copy is
  // the only one that still opens, so it must not.
  assert.ok(/if \(failed\) \{\s*media = /.test(media), "an expired attachment must still fall through to DriveCopy");
  assert.ok(/\{media\}\s*<DriveCopy m=\{m\} apiKey=\{apiKey\} phone=\{phone\} clientName=\{clientName\} t=\{t\} \/>/.test(media));
});
