/**
 * lib/wa-autoreply.ts — the reply brain for inbound WhatsApp messages.
 *
 * WHY THIS EXISTS
 * The webhook's original auto-reply sent ONE fixed string to everybody. A woman
 * asking "kitna charge hai?" and a woman asking "kaise book karu?" got the same
 * sentence, which reads like a bot and wastes the only free channel we have.
 *
 * WHY FREE-FORM AND NOT TEMPLATES
 * Her inbound message opens a 24-hour service window. Inside it, free-form text
 * needs no template, no Meta approval, and — since Meta's Nov-2024 pricing —
 * costs nothing. That matters enormously right now: the WABA holding
 * +91 79784 60386 has no usable payment method (an orphaned BSP credit line
 * blocks it), so every TEMPLATE send is accepted and then silently dropped.
 * Service-window replies are the one path that actually reaches her today.
 *
 * DESIGN
 * Pure functions, no I/O, no env reads — so the routing is unit-testable and
 * the webhook stays in charge of sending, logging and cooldowns. First rule to
 * match wins, so order is meaningful: handoff and opt-out are checked before
 * anything else, and the generic hook is last.
 *
 * LANGUAGE
 * Leads write Hinglish in Latin script ("kitna", "kaise", "haan"), so patterns
 * cover both. ASCII only — the repo has a documented history of non-ASCII
 * getting mangled in message pipelines, and a mojibake reply is worse than a
 * plain one.
 */
import { GUIDE_URL } from "./draft-message.ts";

/** Kept in sync with app/lib/pricing.ts. Duplicated rather than imported so a
 *  server-only module never pulls in the app/ tree. */
export const CONSULT_PRICE = 299;
export const QUIZ_URL = "https://www.swapnilumbarkarfitness.in/assessment";
export const HOW_IT_WORKS_URL = "https://www.swapnilumbarkarfitness.in/how-it-works";

/** Every intent the bot can answer. `handoff` and `optout` are terminal: the
 *  webhook must stop auto-replying to that person afterwards. */
export type Intent =
  | "optout"
  | "handoff"
  | "price"
  | "booking"
  | "quiz"
  | "guide"
  | "medication"
  | "diet"
  | "results"
  | "greeting";

export type Rule = {
  intent: Intent;
  /** Lowercased, punctuation-stripped substrings. Any hit selects the rule. */
  keywords: string[];
  reply: string;
  /** Terminal intents silence the bot for this contact from then on. */
  terminal?: boolean;
};

/**
 * Ordered rules. FIRST MATCH WINS — put the intents whose mis-fire is most
 * expensive at the top. Getting "stop" wrong is a Meta-policy problem; getting
 * "price" wrong is only an awkward sentence.
 */
export const RULES: Rule[] = [
  {
    intent: "optout",
    keywords: ["stop", "unsubscribe", "do not message", "dont message", "band karo", "mat bhejo"],
    terminal: true,
    reply:
      "Understood - I will not send you any more messages. If you ever want help with your thyroid weight, just message here and I will reply personally. All the best.",
  },
  {
    intent: "handoff",
    keywords: [
      "talk to swapnil", "speak to swapnil", "call me", "human", "real person",
      "aap kaun", "baat karni", "baat karna", "phone karo",
    ],
    terminal: true,
    reply:
      "Swapnil here - I read every message myself. Give me a few hours and I will reply to you personally with something specific to your case.",
  },
  {
    intent: "price",
    keywords: [
      "price", "cost", "fees", "fee", "charge", "how much", "kitna", "kitne",
      "paisa", "rupees", "payment", "expensive", "afford",
    ],
    reply:
      `The 1-on-1 Thyroid Consultation is Rs ${CONSULT_PRICE}. In 60 minutes I go through your reports, your food and your routine, and tell you the exact blocker keeping your weight stuck - plus your 90-day plan. If you leave without clarity on your blocker, you get the Rs ${CONSULT_PRICE} back.\n\nThe 3-month coaching programme is quoted only on the call, after I have seen your case. No pressure either way.\n\nStart with the free 2-minute quiz: ${QUIZ_URL}`,
  },
  {
    intent: "booking",
    keywords: [
      "book", "booking", "appointment", "slot", "schedule", "consultation",
      "call kab", "time", "available", "kaise book", "kab milega",
    ],
    reply:
      `Happy to help you book. The quickest way: take the free 2-minute quiz first so I can see your case before we speak, and the booking page opens right after it.\n\n${QUIZ_URL}\n\nIf you would rather see how the call actually works first, this page shows a real one step by step: ${HOW_IT_WORKS_URL}`,
  },
  {
    intent: "quiz",
    keywords: ["quiz", "score", "test", "assessment", "link", "form"],
    reply:
      `Here is the free 2-minute quiz - it narrows down which blocker is yours: ${QUIZ_URL}\n\nNo payment needed to take it. Your result comes up straight away.`,
  },
  {
    intent: "guide",
    keywords: ["guide", "pdf", "blocker", "3 reasons", "three reasons", "ebook", "book bhejo", "send guide"],
    reply:
      `Here it is - the 3 reasons a thyroid body stops losing weight, all on one short page: ${GUIDE_URL}\n\nRead it and tell me which one sounds like you.`,
  },
  {
    intent: "medication",
    keywords: [
      "medicine", "medication", "tablet", "thyronorm", "eltroxin", "levothyroxine",
      "dawa", "goli", "tsh", "report", "blood test", "already taking",
    ],
    reply:
      "Good - keep taking it exactly as your doctor prescribed. Coaching works alongside your medication and your doctor, never instead of them.\n\nHere is the thing most women are never told: the tablet manages your hormone level, it does not rebuild the metabolism around it. That gap is why your TSH can be 'in range' while the weight will not move.\n\n" +
      `Find which gap is yours in 2 minutes: ${QUIZ_URL}`,
  },
  {
    intent: "diet",
    keywords: [
      "diet", "food", "meal", "khana", "roti", "what to eat", "diet plan",
      "recipe", "nutrition", "gym", "workout", "exercise",
    ],
    reply:
      "No crash diets and no cutting out Indian food - home-cooked roti-sabzi built for a thyroid body, and 30-40 minutes of joint-friendly movement that fits a working day.\n\nBut which of those two is actually blocking YOU is the part that has to be worked out for your case, not guessed.\n\n" +
      `2-minute quiz to narrow it down: ${QUIZ_URL}`,
  },
  {
    intent: "results",
    keywords: [
      "results", "kitna weight", "how much weight", "kg", "proof", "testimonial",
      "genuine", "real", "scam", "trust", "guarantee",
    ],
    reply:
      "Fair question. Real clients, real numbers: Heenal lost 15 kg in 90 days, Namrata 16 kg, Vaidehi 12 kg - all with thyroid problems. Individual results vary, and I will not promise you a number before seeing your case.\n\nYou can watch their videos and read their messages here: https://www.swapnilumbarkarfitness.in/\n\n" +
      `And the 2-minute quiz is free: ${QUIZ_URL}`,
  },
];

/** The default when nothing matches — the curiosity hook, same one the
 *  dashboard drafts use, so the voice is identical across channels. */
export const FALLBACK_REPLY =
  "Hi, Swapnil here. Thanks for messaging.\n\nIf your weight will not move despite trying, it is usually not willpower - it is one specific blocker. There are 3 common ones, and I put all 3 on one short page for you:\n\n" +
  `${GUIDE_URL}\n\nWhich one sounds like you?`;

/** Lowercase, strip punctuation/emoji, collapse whitespace. Matching happens on
 *  this normalised form so "How much?!" and "how much" behave identically. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Routed = {
  intent: Intent;
  reply: string;
  /** True when the bot should never auto-reply to this contact again. */
  terminal: boolean;
};

/**
 * Pick the reply for one inbound message.
 *
 * Returns the fallback hook (intent "greeting") when nothing matches, so a lead
 * is never met with silence — the webhook's cooldown is what stops repetition,
 * not a null here.
 */
export function routeReply(inbound: string): Routed {
  const text = normalise(inbound || "");
  if (text) {
    for (const rule of RULES) {
      if (rule.keywords.some((k) => text.includes(normalise(k)))) {
        return { intent: rule.intent, reply: rule.reply, terminal: !!rule.terminal };
      }
    }
  }
  return { intent: "greeting", reply: FALLBACK_REPLY, terminal: false };
}
