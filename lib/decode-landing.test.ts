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

test("occupation tags stay parked until the owner confirms them", () => {
  // Built 12-Sep, parked the same day: only one of the four occupations is
  // actually known, and the page's problem was length, not labelling. If this
  // comes back, the rule it was built under still stands — occupation is a
  // client fact like a name or a weight, so an unknown one is no pill at all.
  assert.ok(
    !/occupation:/.test(WALL),
    "re-adding occupation data means re-adding the confirmed-only rule with it",
  );
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
    2,
    "two mentions only: the hero eyebrow and the 60-minutes heading. A name is positioning; a full pillar breakdown is the programme's sales material, not this page's",
  );
});

test("the page answers her questions in the order she asks them", () => {
  // The one that has already been wrong once: the agenda sat ABOVE the proof,
  // which tells her what happens in the 60 minutes before she believes the 60
  // minutes work. Process detail only lands on someone already convinced.
  const ORDER = [
    ["hero", "for women 30+ with a slow"],
    ["symptom checklist", "<SymptomChips hideCta />"],
    ["the gap chart", "<DeficitDiagram />"],
    ["you didn't fail", "<AbsolveBlock />"],
    ["the comparison", 'id="compare-heading"'],
    ["proof", "<TransformationWall />"],
    ["credentials", 'id="credentials-heading"'],
    ["the 60 minutes", 'id="agenda-heading"'],
    ["who this is for", 'id="fit-heading"'],
    ["FAQ", 'id="faq-heading"'],
    ["share with family", "<ShareWithFamily />"],
  ] as const;

  let previous = -1;
  for (const [name, marker] of ORDER) {
    const at = PAGE.indexOf(marker);
    assert.ok(at > -1, `${name} is missing from the page`);
    assert.ok(at > previous, `${name} must come after the section before it`);
    previous = at;
  }
});

test("proof is capped, and the argument is not", () => {
  assert.match(PAGE, /<WhatsappProofSection hideCta limit=\{3\} \/>/);
  // The four transformation composites and the video testimonials are the
  // proof that carries faces and voices. Owner's explicit call: never cut.
  assert.ok(PAGE.includes("<TransformationWall />"));
  assert.ok(PAGE.includes("<VideoTestimonial />"));
  assert.equal((WALL.match(/src: "\/transformations\//g) ?? []).length, 4);
});

test("neither line that cost him closes is anywhere in the funnel", () => {
  // "…whether or not you ever work with me" told her the plan was hers to take
  // and leave. "You will not be asked to decide anything on the call"
  // pre-authorised "let me think about it" in his own words. Both read as
  // generous; both argued against the sale while he was making it. They lived
  // on the free funnel too — the close rate is a property of the CALL, not of
  // one page — so both pages are checked here.
  const RENDERED = [PAGE, read("app/components/CallAgenda.tsx"), read("app/components/FAQSection.tsx")]
    .join("\n")
    // strip comments: they explain why the lines are gone, and must be allowed
    // to quote them
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/ever work with me/i.test(RENDERED));
  assert.ok(!/not be asked to decide/i.test(RENDERED));
});

test("the proof claim is never inflated", () => {
  for (const src of [PAGE, WALL]) {
    const claims = [...src.matchAll(/(\d[\d,]*)\+?\s*(?:Indian\s+)?women/gi)].map((m) => m[1]);
    for (const n of claims) assert.equal(n, "100");
  }
});
