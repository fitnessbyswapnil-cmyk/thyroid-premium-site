/**
 * lib/owner-filter.ts — PURE. Is this booking or lead the coach testing his own
 * funnel, rather than a woman who might buy something?
 *
 * Why this needs to exist: 82 of the 184 records in the live pipeline were his
 * own test bookings — 45% of it — and they accounted for every single one of the
 * 44 "cancelled" rows. A close rate computed over that is not a close rate, and
 * a morning screen that is half self-inflicted noise is one he stops opening.
 *
 * EMAIL IS THE PRIMARY SIGNAL, name only secondary. One of his tests was booked
 * under the name "Akash" with his own address on it, so a name-only rule leaks;
 * and a name-only rule is also the one that could, in principle, delete a real
 * client. The known-address check catches every case in the live data on its own.
 *
 * The name check is kept because he asked for it explicitly and because his
 * buyers are women 30+ with hypothyroidism, which makes a genuine client called
 * Swapnil vanishingly unlikely. It is the looser of the two rules and it is
 * deliberately second.
 *
 * Extra addresses can be added with OWNER_TEST_EMAILS (comma-separated) without
 * a deploy.
 */

/** Addresses known to be the coach himself. Matched on substring, lowercased. */
const BUILT_IN_OWNER_EMAILS = [
  "swapnilumbarkar50@gmail.com",
  "fitnessbyswapnil@gmail.com",
  "support@swapnilumbarkarfitness.in",
];

/** Name fragments that mean "this is him". */
const OWNER_NAME = /\bswapnil\b/i;

function configuredEmails(): string[] {
  const extra = (process.env.OWNER_TEST_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...BUILT_IN_OWNER_EMAILS, ...extra];
}

export function isOwnerTest(
  who: { name?: string; email?: string },
  /** Injected so the rule stays pure and testable. */
  ownerEmails: string[] = configuredEmails(),
): boolean {
  const email = (who.email ?? "").trim().toLowerCase();
  if (email && ownerEmails.some((o) => email === o)) return true;

  // Any address on his own domain is his, whatever the local part.
  if (/@swapnilumbarkarfitness\.in$/i.test(email)) return true;

  return OWNER_NAME.test(who.name ?? "");
}

/** Splits a list, so the caller can report how much was removed rather than hide it. */
export function partitionOwnerTests<T extends { name?: string; email?: string }>(
  rows: T[],
): { real: T[]; ownerTests: T[] } {
  const real: T[] = [];
  const ownerTests: T[] = [];
  for (const r of rows) (isOwnerTest(r) ? ownerTests : real).push(r);
  return { real, ownerTests };
}
