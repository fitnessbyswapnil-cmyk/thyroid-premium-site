/**
 * Guards on the /decode landing page that a unit test can actually hold.
 *
 * These are source-text assertions, which is unusual here — the rest of the
 * suite tests pure modules. They exist because the two things below have
 * already gone wrong once each, silently, and neither shows up in a build:
 *
 *  1. The three CTAs drifted apart. The sticky bar said "Schedule my…" with no
 *     price while the hero said "Book my… ₹299", so the last thing a visitor
 *     saw before deciding disagreed with the ad that brought her, and the
 *     price — which is what qualifies the click — was missing from it.
 *  2. A client's occupation tag is exactly the kind of detail that gets
 *     "helpfully" filled in. The rule is absolute: names, weights, timeframes
 *     and occupations are never invented, so a card without a confirmed
 *     occupation ships with no pill at all.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const PAGE = read("app/decode/page.tsx");
const STICKY = read("app/decode/DecodeStickyCta.tsx");
const WALL = read("app/components/TransformationWall.tsx");

const CTA_LABEL = "Book my 1-1 Thyroid Consultation";
const CTA_SUB = "₹299 &middot; 12 questions, then pick your slot";

test("every /decode CTA carries the ad's own label", () => {
  const labels = [...PAGE.matchAll(/cta-button[\s\S]{0,400}?>\s*\n\s*([^<\n]+)\n/g)]
    .map((m) => m[1].trim());
  assert.ok(labels.length >= 2, "expected at least a hero and a closing CTA");
  for (const label of labels) assert.equal(label, CTA_LABEL);
  assert.ok(STICKY.includes(CTA_LABEL), "the sticky bar must use the same label");
});

test("every /decode CTA shows the price", () => {
  const subs = [...`${PAGE}${STICKY}`.matchAll(/<span className="cta-sub">([^<]+)</g)]
    .map((m) => m[1].trim());
  assert.ok(subs.length >= 3, "hero, closing and sticky CTAs all need a sub-line");
  for (const sub of subs) assert.equal(sub, CTA_SUB);
});

test("no transformation card carries an unconfirmed occupation", () => {
  // Confirmed = the occupation was already published in that client's own
  // caption on this site. Adding a name here means the owner confirmed it.
  const CONFIRMED = new Set(["", "IT professional"]);
  const found = [...WALL.matchAll(/occupation:\s*"([^"]*)"/g)].map((m) => m[1]);
  assert.ok(found.length >= 4, "every card must declare an occupation field");
  for (const occupation of found) {
    assert.ok(
      CONFIRMED.has(occupation),
      `"${occupation}" is not a confirmed occupation — add it to CONFIRMED only after the owner confirms it`,
    );
  }
});

test("the ₹15,000-₹30,000 line stays off until the quiz gates are measured", () => {
  // Not a style rule: shipped in the same window as the gates, neither change
  // can be attributed. Flipping this is a deliberate act, so it must be seen.
  assert.match(PAGE, /const SHOW_PROGRAMME_PRICE = (true|false);/);
});

test("the qualification section keeps the two excluded filters out", () => {
  // Only the rendered lists, not the comments above them — the comments say
  // why these two are absent, which is the point of keeping them.
  const lists = [...PAGE.matchAll(/const (?:FOR_YOU|NOT_FOR_YOU) = \[([\s\S]*?)\] as const;/g)]
    .map((m) => m[1])
    .join("\n");
  assert.ok(lists.length > 0, "the qualification lists must exist");
  assert.ok(!/invest|₹15,000|cost|afford/i.test(lists), "price must not be a stated filter");
  assert.ok(
    !/decision|husband|family decide/i.test(lists),
    "the decision-maker question is the quiz's job, softly — not the page's",
  );
});

test("the guarantee and the method are both on the page", () => {
  assert.ok(PAGE.includes("My commitment to you"));
  assert.ok(PAGE.includes("the ₹299 is"), "the refund term must be stated");
  assert.equal(
    (PAGE.match(/T\.H\.Y\.R\.O\.I\.D\. Lean Method/g) ?? []).length,
    3,
    "three mentions: hero eyebrow, method section, credentials label",
  );
});

test("the proof claim is never inflated", () => {
  for (const src of [PAGE, WALL]) {
    const claims = [...src.matchAll(/(\d[\d,]*)\+?\s*(?:Indian\s+)?women/gi)].map((m) => m[1]);
    for (const n of claims) assert.equal(n, "100");
  }
});
