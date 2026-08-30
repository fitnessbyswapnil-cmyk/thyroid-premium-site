/**
 * lib/call-extract.ts — turns a sales-call transcript into structured CRM facts.
 *
 * SERVER ONLY. Reads ANTHROPIC_API_KEY.
 *
 * The schema is not generic "call analysis". Every field exists because a real
 * deal in this account turned on it:
 *  - `lowest_price_said` and `discount_offered`, because nine of twelve losses
 *    contained a concession and not one of them ever produced a yes. Knowing the
 *    quote alone hides that; knowing the FLOOR is what makes the pattern visible.
 *  - `objection_real` separate from `excuse_stated`, because "let me think about
 *    it" is almost never the reason. On one recording the stated excuse was time
 *    and the real blocker was a husband who was never invited onto the call.
 *  - `money_moved_on_call` as a SIGNAL only. One woman agreed, read out her PIN,
 *    and the gateway threw a UPI risk-policy error. Cashfree owns whether she
 *    paid; this field only says what the tape sounded like. Read together they
 *    surface the most recoverable state there is: agreed, never charged.
 *  - the ten scorecard checks, which came out of reading 22 of these calls. They
 *    are what turns "lost — spouse" into "lost, and you cut the price at 1:04:12
 *    before she had objected to anything".
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/** Model is pinned here so a change is one line and shows up in the row. */
export const EXTRACT_MODEL = "claude-opus-5";

const Check = z.object({
  passed: z.boolean(),
  /** Short quote or timecode that justifies the verdict. "" when not applicable. */
  evidence: z.string(),
});

export const ScorecardSchema = z.object({
  past_spend_totalled: Check,
  range_tested: Check,
  proof_shown_before_price: Check,
  decision_maker_found: Check,
  price_said_cleanly: Check,
  silence_after_ask: Check,
  total_held: Check,
  results_gate_used: Check,
  payment_on_screen: Check,
  ended_with_clock_time: Check,
});

export const SCORECARD_LABELS: Record<keyof z.infer<typeof ScorecardSchema>, string> = {
  past_spend_totalled: "Totalled her past spend in rupees before the price",
  range_tested: "Tested what she could invest before pitching",
  proof_shown_before_price: "Showed a real client report on screen before the number",
  decision_maker_found: "Found the real decision-maker with a non-leading question",
  price_said_cleanly: "Price was its own sentence — no 'just', said 'totally', guarantee stated",
  silence_after_ask: "After the ask, the next voice was hers",
  total_held: "The total never went below the quote",
  results_gate_used: "Used the results gate instead of a discount",
  payment_on_screen: "Payment link went on screen while she was still on the call",
  ended_with_clock_time: "Ended with an amount, a clock time and a named next action",
};

export const CallExtractionSchema = z.object({
  attended: z.boolean(),
  coach_talk_pct: z.number(),
  price_pitched: z.number().nullable(),
  lowest_price_said: z.number().nullable(),
  discount_offered: z.boolean(),
  discount_at: z.string(),
  money_moved_on_call: z.boolean(),
  amount_agreed: z.number().nullable(),
  objection_category: z.enum([
    "money",
    "spouse_or_family",
    "proof_or_trust",
    "timing",
    "medical_or_reports",
    "no_objection",
    "other",
  ]),
  objection_real: z.string(),
  excuse_stated: z.string(),
  agreed_callback_at: z.string(),
  summary: z.string(),
  scorecard: ScorecardSchema,
});

export type CallExtraction = z.infer<typeof CallExtractionSchema>;

const SYSTEM = `You analyse recorded sales calls for a 1-to-1 thyroid fat-loss coach in India.
He sells a 3-month coaching programme to women 30+, priced between Rs 15,000 and Rs 30,000.
The call is a free 60-minute consultation. The transcript may mix English, Hindi and Hinglish.

Report what is ON THE TAPE. Never infer, never flatter, never soften.

Definitions you must apply exactly:

- attended: true only if the CLIENT speaks. If only the coach is audible, or the
  transcript is near-empty, she did not attend.
- coach_talk_pct: rough share of words spoken by the COACH, 0-100.
- price_pitched: the FIRST full programme price he states, in rupees, as a number.
  null if no price was ever said out loud.
- lowest_price_said: the LOWEST rupee figure he offers for the programme at any
  point, including instalments, tokens and "just pay X today". null if no price.
  If he never came down, this equals price_pitched.
- discount_offered: true if he offers ANY figure below his first quote, or offers
  to split it, at any point. Splitting a total into instalments while keeping the
  same total is NOT a discount — that is the results gate, see below.
- discount_at: the timecode of the first concession, e.g. "1:04:12". "" if none.
- money_moved_on_call: true only if the tape shows a payment being attempted or
  confirmed during the call — a link opened, a UPI ID read out, a transaction ID
  noted, a screenshot mentioned. Her saying "I will pay tomorrow" is false.
- amount_agreed: rupee figure she agreed to pay, if any. null otherwise.
- objection_real: the actual thing blocking the sale, in one plain sentence,
  even when she never says it directly. Read the whole call, not just her words
  near the price.
- excuse_stated: the reason she gave out loud, verbatim or near-verbatim. This is
  frequently different from objection_real. "" if she gave none.
- agreed_callback_at: a specific time SHE committed to, e.g. "2.30 pm today".
  "" if the call ended without a named time.
- summary: three sentences maximum. What happened, where it turned, how it ended.

The scorecard judges the COACH, not the client. For each check return passed plus
short evidence (a quote or a timecode). Judge strictly — when in doubt, fail it:

- past_spend_totalled: did he add up, out loud and in rupees, what she has
  already spent on this problem BEFORE saying his price?
- range_tested: did he ask what she could realistically invest before pitching?
- proof_shown_before_price: did he share a screen / send a real client's report
  or result before quoting? If she asked for proof at any point and he did not
  show it, this fails.
- decision_maker_found: did he ask who else she would speak to, in a way that did
  NOT lead her to say "just me"? "You're the sole decision maker, right?" fails.
- price_said_cleanly: price in its own sentence, no "just" before the number, the
  word "totally" or equivalent after it, and a guarantee mentioned. All four.
- silence_after_ask: after he asks for the business, is the NEXT voice hers? If he
  speaks again first — even one word — this fails.
- total_held: no number lower than his first quote ever leaves his mouth.
- results_gate_used: did he keep the total and gate the second instalment on a
  result ("don't pay the rest until you've lost 4-5 kg")?
- payment_on_screen: link or UPI actually put in front of her while still on the
  call. Promising to send it later fails.
- ended_with_clock_time: the call ends with an amount, a specific clock time and
  a next action HE named. "Ping me anytime" fails.`;

/**
 * Runs the extraction. Throws on API failure so the caller decides whether a
 * failed extraction should still write a partial row.
 */
export async function extractCall(opts: {
  transcript: string;
  meetingTitle?: string;
  occurredAt?: string;
}): Promise<CallExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey, timeout: 10 * 60 * 1000 });

  const header = [
    opts.meetingTitle ? `Meeting: ${opts.meetingTitle}` : "",
    opts.occurredAt ? `Occurred at: ${opts.occurredAt}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model: EXTRACT_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(CallExtractionSchema),
    },
    messages: [
      {
        role: "user",
        content: `${header}\n\nTranscript:\n\n${opts.transcript}`.trim(),
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("extraction_returned_no_structured_output");
  return parsed;
}

/** Count of scorecard checks that failed — the headline coaching number. */
export function failedCount(s: CallExtraction["scorecard"]): number {
  return Object.values(s).filter((c) => !c.passed).length;
}
