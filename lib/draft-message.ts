/**
 * lib/draft-message.ts — writes the first follow-up message for one woman,
 * from what she actually answered in the quiz.
 *
 * WHY THIS EXISTS
 * The WhatsApp API cannot send template messages while a BSP credit line sits
 * on the WABA, and the fix is weeks away. Every follow-up therefore has to be
 * typed by hand from the business phone — which is slower per message but
 * converts far better, because a hand-sent message can say something only her
 * form could have revealed. This turns the row into that message so the work
 * is copy-and-send rather than copy-and-compose.
 *
 * WHAT THE MESSAGE DELIBERATELY DOES NOT DO
 *   - no payment link
 *   - no price
 *   - no calendar link
 *   - no "book now"
 * A first message that asks for money is answering a question she has not
 * asked yet. Her form says she is still deciding whether anything CAN work,
 * so message one earns a reply and nothing else. The reply is what matters:
 * it opens WhatsApp's 24-hour window, which is the only state in which the
 * API can send free-form messages at all. One reply converts a dead contact
 * into a reachable one.
 *
 * SHAPE — five short blocks, read in under ten seconds on a phone:
 *   1. who is writing
 *   2. one detail only her form could have told us, so it cannot read as a blast
 *   3. an open loop — a reason the weight will not move, stated but not resolved
 *   4. the guide that closes the loop
 *   5. one question that is easier to answer than to ignore
 *
 * Curiosity carries this message, not persuasion. Block 3 names a reason and
 * deliberately stops short of explaining it; the guide is the only place the
 * explanation exists. Block 5 asks which of the three is hers, which means
 * answering requires opening the guide first — the click and the reply are
 * the same action.
 */

/**
 * The free guide. Every draft ends here, so it lives in one place: swapping
 * the asset must never mean editing four message variants.
 */
export const GUIDE_URL =
  "https://drive.google.com/file/d/1kCbCKxmvEC3kHQGKwUyZjsAxUdfn-HbD/view";

export type DraftLead = {
  name?: string;
  /** "Biggest Challenge" — her symptoms, comma-separated. */
  challenge?: string;
  /** "Diagnosis" — hypothyroid / Hashimoto's / TSH normal / undiagnosed. */
  diagnosis?: string;
  /** "On Medication" — free text, e.g. "on medication but still struggling". */
  medication?: string;
  /** "Struggle Duration" — e.g. "6 months to 1 year", "More than 5 years". */
  duration?: string;
  /** "Tried Before" — comma-separated list. */
  tried?: string;
  /** "Budget" / "Investment Ability" — her stated ability to invest. */
  budget?: string;
};

export type Segment =
  | "medicated_stuck"
  | "normal_labs"
  | "undiagnosed"
  | "hashimotos"
  | "generic";

const has = (v: string | undefined, ...needles: string[]): boolean => {
  const s = (v ?? "").toLowerCase();
  return needles.some((n) => s.includes(n));
};

export function firstName(full: string | undefined): string {
  const n = (full ?? "").trim().split(/\s+/)[0] ?? "";
  if (!n) return "there";
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/**
 * Which story she is living in. Order matters: Hashimoto's and "labs are
 * normal" are more specific than "on medication", and a woman can be both.
 * The most specific true statement is the one worth opening with.
 */
export function segmentOf(lead: DraftLead): Segment {
  if (has(lead.diagnosis, "hashimoto")) return "hashimotos";
  if (has(lead.diagnosis, "normal range", "tsh is in the normal", "tests are normal", "levels are fine")) {
    return "normal_labs";
  }
  if (has(lead.diagnosis, "no diagnosis", "not been formally diagnosed", "not diagnosed")) {
    return "undiagnosed";
  }
  if (has(lead.medication, "still struggling", "on thyroid medication", "on medication")) {
    return "medicated_stuck";
  }
  if (has(lead.diagnosis, "hypothyroid")) return "medicated_stuck";
  return "generic";
}

/** Her top two symptoms, in her own words, as a readable phrase. */
function symptomPhrase(challenge: string | undefined): string {
  const parts = (challenge ?? "")
    .split(/[,/]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} and ${parts[1]}`;
}

/** What she has already spent effort on — used to validate, never to scold. */
function triedPhrase(tried: string | undefined): string {
  const parts = (tried ?? "")
    .split(/[,/]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && !s.includes("nothing structured"))
    .slice(0, 3);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Long struggles get "years"; short ones must not, or the message reads false. */
function durationPhrase(duration: string | undefined): string {
  const d = (duration ?? "").toLowerCase();
  if (d.includes("more than 5") || d.includes("5+")) return "for years now";
  if (d.includes("3 to 5")) return "for a few years now";
  if (d.includes("1 to 3")) return "for a while now";
  if (d.includes("6 months") || d.includes("months")) return "over the last several months";
  return "";
}

/**
 * The open loop. Each segment gets the one sentence that makes her want the
 * answer — a reason stated flatly, with the mechanism withheld. Resolving it
 * here would remove any reason to open the guide.
 */
function hookFor(segment: Segment): string {
  switch (segment) {
    case "medicated_stuck":
      return "The tablet does its job on paper. It does not touch the thing that is actually holding your weight.";
    case "normal_labs":
      return "A normal report does not mean a normal body. There is a specific reason for that.";
    case "undiagnosed":
      return "The symptoms show up long before a report ever goes abnormal. That gap is where most women get stuck.";
    case "hashimotos":
      return "With Hashimoto's the usual advice quietly makes it worse. There is a reason every plan backfires.";
    default:
      return "When the effort is this high and nothing moves, something specific is blocking it.";
  }
}

/**
 * The full first-touch message. Plain text, WhatsApp-shaped, and carrying no
 * price and no payment link — the only URL is the free guide.
 */
export function draftMessage(lead: DraftLead): string {
  const name = firstName(lead.name);
  const symptoms = symptomPhrase(lead.challenge);
  const tried = triedPhrase(lead.tried);
  const when = durationPhrase(lead.duration);

  // One detail, not three. A long recap reads like a file being quoted back
  // at her; a single specific noun reads like someone actually looked.
  let detail = "";
  if (symptoms) detail = `the ${symptoms}`;
  else if (tried) detail = `that you have already tried ${tried}`;
  else if (when) detail = `that this has been going on ${when}`;

  // ASCII + em-dash only: two rounds of real-send testing (see
  // app/admin/page.tsx) showed emoji — pictographic AND plain BMP symbols —
  // arriving corrupted through the wa.me ?text= pipeline.
  return [
    `Hi ${name}, Swapnil here.`,
    detail ? `I read your thyroid form — ${detail} stood out.` : `I read your thyroid form properly.`,
    hookFor(segmentOf(lead)),
    `There are 3 reasons the weight will not move on a thyroid body. Most women are doing at least one without knowing.\n\nI put all 3 on one short page for you:\n${GUIDE_URL}`,
    `Which one sounds like you?`,
  ].join("\n\n");
}

/** Tap-to-send link for the business phone, so sending is one click. */
export function draftWaLink(phone: string, message: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  const e164 = digits.length === 10 ? `91${digits}` : digits;
  if (e164.length < 12) return "";
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}
