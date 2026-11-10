/**
 * The consultation summary may only show a client the website already
 * publishes, saying only what her card already says.
 *
 * lib/summary-proof.ts copies the wall's fields so the PDF route never has to
 * import a client component. A copy can drift, so this reads the wall's own
 * source and fails the moment a copied name, weight, loss or claim differs
 * from it — including a card the wall has dropped, which is no longer
 * published and so may no longer be shown to anyone.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROOF_CARDS, PROOF_QUALIFIER, pickProof } from "./summary-proof.ts";

const WALL_SRC = readFileSync(new URL("../app/components/TransformationWall.tsx", import.meta.url), "utf8");

/** The WALL array's entries, field by field, straight from the component source. */
function wallEntries(): Record<string, string>[] {
  const start = WALL_SRC.indexOf("const WALL = [");
  const end = WALL_SRC.indexOf("] as const;", start);
  assert.ok(start >= 0 && end > start, "TransformationWall.tsx no longer declares `const WALL = [ … ] as const;`");
  const block = WALL_SRC.slice(start, end);
  return [...block.matchAll(/\{([^{}]*)\}/g)].map((m) =>
    Object.fromEntries([...m[1].matchAll(/(\w+):\s*"([^"]*)"/g)].map((f) => [f[1], f[2]])),
  );
}

test("the wall parses into cards that each have a name and both weights", () => {
  const wall = wallEntries();
  assert.ok(wall.length >= 1, "no cards found in WALL");
  for (const w of wall) assert.ok(w.name && w.from && w.to && w.kg, JSON.stringify(w));
});

test("every copied card is on the wall, with the same name, weights and loss", () => {
  const wall = wallEntries();
  for (const card of PROOF_CARDS) {
    const w = wall.find((x) => x.name === card.name);
    assert.ok(w, `${card.name} is not on the website's wall — the PDF may not show her`);
    assert.equal(card.from, w.from, `${card.name}: "from" differs from the wall`);
    assert.equal(card.to, w.to, `${card.name}: "to" differs from the wall`);
    assert.equal(card.kg, w.kg, `${card.name}: "kg" differs from the wall`);
  }
});

test("the words printed with each card are the wall's own", () => {
  const wall = wallEntries();
  for (const card of PROOF_CARDS) {
    const w = wall.find((x) => x.name === card.name);
    assert.ok(w);
    assert.equal(card.condition, w.condition, `${card.name}: condition differs from the wall`);
    assert.equal(card.story, w.story, `${card.name}: story differs from the wall`);
    // An invented occupation is a lie about a real person; the wall has one.
    assert.equal(card.occupation, w.occupation, `${card.name}: occupation differs from the wall`);
  }
});

test("the cards are in the wall's order, so 'the first card' is the same woman in both", () => {
  const wallNames = wallEntries().map((w) => w.name);
  const copied = PROOF_CARDS.map((c) => c.name);
  assert.deepEqual(copied, wallNames.filter((n) => copied.includes(n)));
  assert.equal(copied[0], wallNames[0]);
});

test("the qualifier is the wall's own, said of one card", () => {
  assert.match(WALL_SRC, /one client&apos;s own outcome, not a typical result\./i);
  assert.equal(PROOF_QUALIFIER, "One client's own outcome, not a typical result.");
});

test("he picks a card by her first name, however he types it", () => {
  for (const asked of ["Heenal", "heenal", "  HEENAL ", "show Heenal's card", "Heenal, IT one"]) {
    const p = pickProof(asked);
    assert.equal(p.card.name, "Heenal", asked);
    assert.equal(p.ignored, false, asked);
  }
});

test("blank means the first card, and nothing to warn about", () => {
  const p = pickProof("");
  assert.equal(p.card.name, PROOF_CARDS[0].name);
  assert.equal(p.ignored, false);
});

test("a name that is not on the wall never becomes a card", () => {
  // "Priya" was never published. Printing her would be inventing a client.
  const p = pickProof("Priya");
  assert.equal(p.card.name, PROOF_CARDS[0].name);
  assert.equal(p.ignored, true);
  assert.ok(!PROOF_CARDS.some((c) => c.name === "Priya"));
});
