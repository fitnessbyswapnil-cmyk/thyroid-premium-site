import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MEDIA_PASS_TTL_S, mintMediaPass, signMediaPass, verifyMediaPass } from "./media-pass.ts";

// Attachment URLs used to carry the admin key itself (`?k=`), which put the
// master key in every request log. They now carry a pass: an expiry plus an
// HMAC over it. These lock the pass down, and lock the key out of the inbox.

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const SECRET = "test-only-media-secret-4f7a";
const NOW = 1_800_000_000;

test("a fresh pass opens attachments until it expires", () => {
  const p = mintMediaPass(SECRET, NOW);
  assert.equal(p.exp, NOW + MEDIA_PASS_TTL_S);
  assert.equal(p.ttl, MEDIA_PASS_TTL_S);
  assert.equal(verifyMediaPass(SECRET, String(p.exp), p.sig, NOW + 1), true);
  assert.equal(verifyMediaPass(SECRET, p.exp, p.sig, p.exp - 1), true);
});

test("an expired pass is refused", () => {
  const p = mintMediaPass(SECRET, NOW);
  assert.equal(verifyMediaPass(SECRET, p.exp, p.sig, p.exp), false);
  assert.equal(verifyMediaPass(SECRET, p.exp, p.sig, p.exp + 3600), false);
});

test("a stretched expiry or an altered signature is refused", () => {
  const p = mintMediaPass(SECRET, NOW);
  assert.equal(verifyMediaPass(SECRET, p.exp + 60, p.sig, NOW), false);
  const flipped = (p.sig[0] === "A" ? "B" : "A") + p.sig.slice(1);
  assert.equal(verifyMediaPass(SECRET, p.exp, flipped, NOW), false);
});

test("a pass signed with any other secret is refused", () => {
  const p = mintMediaPass("some-other-secret", NOW);
  assert.equal(verifyMediaPass(SECRET, p.exp, p.sig, NOW), false);
});

test("no pass lives longer than the TTL, even one signed correctly", () => {
  const exp = NOW + MEDIA_PASS_TTL_S * 24;
  assert.equal(verifyMediaPass(SECRET, exp, signMediaPass(SECRET, exp), NOW), false);
});

test("missing secret and junk input fail closed instead of throwing", () => {
  const p = mintMediaPass(SECRET, NOW);
  assert.equal(verifyMediaPass(undefined, p.exp, p.sig, NOW), false);
  assert.equal(verifyMediaPass("", p.exp, p.sig, NOW), false);
  for (const exp of [null, undefined, "", "abc", "1e9", 1.5, -1, " 1800003600"]) {
    assert.equal(verifyMediaPass(SECRET, exp, p.sig, NOW), false, String(exp));
  }
  for (const sig of [null, undefined, "", 42, "short"]) {
    assert.equal(verifyMediaPass(SECRET, p.exp, sig, NOW), false, String(sig));
  }
});

test("the inbox never puts the admin key in a media URL", () => {
  const inbox = read("app/inbox/InboxClient.tsx");
  assert.doesNotMatch(inbox, /api\/admin\/media\?[^`"'\n]*\bk=/, "no ?k= on attachment URLs");
  assert.match(inbox, /mediaSrc\(/, "attachment URLs come from mediaSrc()");
  const hook = read("app/admin/useMediaPass.ts");
  assert.doesNotMatch(hook, /\bk=/);
  // Imports, not mentions: the hook's own comment explains why it avoids both.
  assert.doesNotMatch(hook, /from\s+["'][^"']*media-pass(\.ts)?["']|from\s+["']node:crypto["']/, "the client hook must not pull node:crypto into the browser");
});

test("passes are minted only behind the admin key, and never without a signing secret", () => {
  const route = read("app/api/admin/media-pass/route.ts");
  assert.match(route, /if \(!checkAdminKey\(req\)\) return NextResponse\.json\(\{ error: "unauthorized" \}, \{ status: 401 \}\)/);
  assert.match(route, /if \(!secret\) return NextResponse\.json\(\{ error: "media_signing_not_configured" \}, \{ status: 503 \}\)/);
  assert.match(read("app/api/admin/media/route.ts"), /verifyMediaPass\(process\.env\.MEDIA_URL_SECRET, q\.get\("exp"\), q\.get\("sig"\)\)/);
});
