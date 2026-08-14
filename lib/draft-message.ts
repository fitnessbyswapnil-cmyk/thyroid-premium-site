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
 * SHAPE — three short blocks, then one question:
 *   1. name her situation using her own answers, so it cannot read as a blast
 *   2. one clinical observation that reframes why nothing has worked
 *   3. one question that is easy to answer and moves her into diagnosis
 *
 * The question is almost always about her last TSH reading. It is specific,
 * takes ten seconds to answer, positions him as someone who reads reports
 * rather than sells plans, and whatever she replies is the opening line of
 * the consultation he is trying to sell.
 */

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
 * The reframe. Each segment gets the one sentence that explains why her
 * effort has not worked — stated as a mechanism, not as a promise.
 */
function observationFor(segment: Segment): string {
  switch (segment) {
    case "medicated_stuck":
      return "When the medication is doing its job on paper and the weight still will not move, something else is holding your metabolism down. That part is not treated by the tablet.";
    case "normal_labs":
      return "A TSH inside the normal range only tells us one number is acceptable. It does not tell us your metabolism is working — which is why you can be told you are fine while your body says otherwise.";
    case "undiagnosed":
      return "The symptoms usually show up long before a report goes abnormal. Most women are told to wait until it gets worse, when that is exactly the stage where it is easiest to correct.";
    case "hashimotos":
      return "With Hashimoto's, the usual advice makes it worse — harder dieting and more cardio raise the stress load on an already inflamed thyroid. That is why every plan seems to backfire.";
    default:
      return "When effort has been high and the scale still has not moved, the problem is almost never willpower. Something specific is blocking it, and it is findable.";
  }
}

/** The ask. Low friction, ten seconds to answer, and useful to him either way. */
function questionFor(segment: Segment): string {
  switch (segment) {
    case "undiagnosed":
      return "Quick question — have you had a TSH test done at any point, even an old one?";
    case "hashimotos":
      return "Quick question — do you know your last TPO antibody reading?";
    default:
      return "Quick question — what was your last TSH reading?";
  }
}

/**
 * The full first-touch message. Plain text, WhatsApp-shaped, no link and no
 * price anywhere in it.
 */
export function draftMessage(lead: DraftLead): string {
  const name = firstName(lead.name);
  const segment = segmentOf(lead);
  const symptoms = symptomPhrase(lead.challenge);
  const tried = triedPhrase(lead.tried);
  const when = durationPhrase(lead.duration);

  // ASCII + em-dash only: two rounds of real-send testing (see
  // app/admin/page.tsx) showed emoji — pictographic AND plain BMP symbols —
  // arriving corrupted through the wa.me ?text= pipeline.
  const opener = `Hi ${name}, Swapnil here.`;

  // Line two must contain something only her form could have told us —
  // symptoms first, then what she has already tried. Without at least one of
  // them the message is generic, and a generic message is worse than none.
  const details: string[] = [];
  if (symptoms) details.push(`the ${symptoms}`);
  if (tried) details.push(`that you have already tried ${tried}`);

  let context: string;
  if (details.length === 2) {
    context = `I read through your Thyroid Assessment properly. What stood out was ${details[0]} — and ${details[1]}${when ? `, ${when}` : ""}.`;
  } else if (details.length === 1) {
    context = `I read through your Thyroid Assessment properly, and ${details[0]} stood out${when ? `, especially ${when}` : ""}.`;
  } else {
    context = `I read through your Thyroid Assessment properly${when ? `, and you have been dealing with this ${when}` : ""}.`;
  }

  return [opener, context, observationFor(segment), questionFor(segment)].join("\n\n");
}

/** Tap-to-send link for the business phone, so sending is one click. */
export function draftWaLink(phone: string, message: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  const e164 = digits.length === 10 ? `91${digits}` : digits;
  if (e164.length < 12) return "";
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}
