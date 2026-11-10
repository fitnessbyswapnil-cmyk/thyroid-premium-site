import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The hero player has two cuts (CUTS in app/components/HeroVideo.tsx). These
// lock which page plays which, and the two ways a new cut silently goes wrong:
// a poster path with a typo (a black box at the top of the ad's landing page)
// and an upload over an old file name (the media domain serves `immutable` for
// a year, so the old cut keeps playing from every warm cache).

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const PLAYER = read("app/components/HeroVideo.tsx");

function cut(name: string) {
  const body = PLAYER.match(new RegExp(`\\n\\s*${name}: \\{([\\s\\S]*?)\\n\\s*\\},`))?.[1];
  assert.ok(body, `HeroVideo.tsx has no "${name}" cut`);
  const field = (k: string) => body.match(new RegExp(`\\b${k}: ([^\\n]+),`))?.[1] ?? "";
  return { src: field("src"), poster: field("poster").replace(/^"|"$/g, ""), label: field("label") };
}

test("/decode plays its own cut, and the homepage keeps the original", () => {
  assert.match(read("app/decode/page.tsx"), /<HeroVideo cut="decode" \/>/);
  const home = read("app/components/Hero.tsx");
  assert.match(home, /<HeroVideo \/>/, "the ₹299 homepage keeps the original cut");
  assert.doesNotMatch(home, /cut="decode"/, "the decode cut ends on a free session");
});

test("every cut has a poster on disk and a label", () => {
  for (const name of ["original", "decode"]) {
    const c = cut(name);
    assert.ok(c.poster.startsWith("/videos/posters/"), `${name}: poster path`);
    assert.ok(existsSync(join(root, "public", c.poster)), `${name}: public${c.poster} must exist`);
    assert.ok(c.label.length > 10, `${name}: the video names itself for screen readers`);
  }
});

test("the decode cut is a file of its own on the media domain", () => {
  const src = cut("decode").src;
  assert.match(src, /^`\$\{MEDIA_BASE\}\/videos\/[a-z0-9-]+\.mp4`$/);
  assert.doesNotMatch(src, /\/videos\/vsl\.mp4/, "never reuse the original's file name");
});
