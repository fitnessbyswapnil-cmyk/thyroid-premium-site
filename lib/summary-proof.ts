/**
 * lib/summary-proof.ts — the one published result her consultation summary
 * shows on page 2, under "Someone who started where you are".
 *
 * WHY A COPY AND NOT AN IMPORT
 * The cards live in app/components/TransformationWall.tsx, a "use client"
 * component that pulls in next/image and React. The summary is built on the
 * worker from plain strings, and importing a client component there for four
 * small objects would drag the component into a server route for nothing. So
 * the fields the PDF prints are copied here, and lib/summary-proof.test.ts
 * reads the component's source and fails the moment a copied name, weight or
 * claim stops matching what the website publishes. The wall stays the source
 * of truth; this file can only ever repeat it.
 *
 * WHAT MAY BE SAID
 * Exactly what a card already says on the site: her first name, the
 * occupation pill where the card has one, "In 90 days, despite <condition>",
 * the before and after weights off the composite's own chips, the loss, and
 * the card's one line of detail. The site qualifies every card as one
 * client's own outcome, not a typical result, and the PDF carries that line
 * with it. Nothing about her age, her TSH or how long she was stuck is
 * published, so nothing about them is printed. The house rule is absolute:
 * never invent a client name, weight, timeframe, occupation or marker.
 */

export type ProofCard = {
  name: string;
  /** The ALL-CAPS pill on the website card. Empty for every card but one. */
  occupation: string;
  condition: string;
  from: string;
  to: string;
  kg: string;
  story: string;
};

/** Same order as the wall, so "the first card" means the same woman in both places. */
export const PROOF_CARDS: readonly ProofCard[] = [
  {
    name: "Vaidehi",
    occupation: "",
    condition: "Hypothyroidism",
    from: "72 kg",
    to: "60 kg",
    kg: "12 kg",
    story: "Balanced her thyroid naturally.",
  },
  {
    name: "Surekha",
    occupation: "",
    condition: "Hypothyroidism",
    from: "78 kg",
    to: "66 kg",
    kg: "12 kg",
    story: "Bloating and afternoon fatigue, gone.",
  },
  {
    name: "Namrata",
    occupation: "",
    condition: "Hypothyroidism",
    from: "84 kg",
    to: "68 kg",
    kg: "16 kg",
    story: "The all-day tiredness went with it.",
  },
  {
    name: "Heenal",
    occupation: "IT Professional",
    condition: "Hypothyroidism",
    from: "82 kg",
    to: "67 kg",
    kg: "15 kg",
    story: "Her blocker was in Pillar 1. The root, not her diet.",
  },
];

/** The published qualifier, said of one card instead of the whole wall. */
export const PROOF_QUALIFIER = "One client's own outcome, not a typical result.";

/**
 * The card he named under "Proof to show", or the first card when he left it
 * blank or named someone who is not on the wall. `ignored` is true only in the
 * second case, so the route can tell him his choice was not used.
 *
 * Matched on any word of what he typed, case-insensitively: "Vaidehi",
 * "vaidehi" and "show Vaidehi's" all pick the same card. A first name that is
 * not on the wall never becomes a card — that would be a client the website
 * has never published.
 */
export function pickProof(want: string): { card: ProofCard; ignored: boolean; asked: string } {
  const asked = String(want ?? "").replace(/\s+/g, " ").trim();
  const words = new Set(
    asked
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean),
  );
  const hit = PROOF_CARDS.find((c) => words.has(c.name.toLowerCase()));
  if (hit) return { card: hit, ignored: false, asked };
  return { card: PROOF_CARDS[0], ignored: asked !== "", asked };
}
