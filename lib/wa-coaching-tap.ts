/**
 * Is this inbound message a ThyroWell coaching tap rather than a lead talking?
 *
 * The coaching app (app.swapnilumbarkarfitness.in) sends paying clients a
 * nightly "Did you stick to your plan today?" template on this same WhatsApp
 * number, with Yes / Mostly / No buttons, and follows "Mostly" with Food /
 * Movement / Steps. Meta delivers every tap on the number to every app
 * subscribed to the WABA — so this webhook sees them too.
 *
 * Without this check each tap was logged to the leads Messages sheet as
 * "[tapped: Yes]" under a paying client's name, and — because this bot routes by
 * button LABEL and its cooldown only counts its own sends — auto-reply answered
 * "Yes" or "Mostly" with the funnel's sales fallback and "Food" with the quiz
 * link. A client would have been pitched the programme she is already in, every
 * night, right after checking in.
 *
 * The coaching app records these taps itself. The signal is the payload, not
 * the label: its buttons carry `twd:` (the night's answer) or `twm:` (what
 * slipped) followed by a signed suffix, a prefix no lead flow on this site ever
 * produces. Labels are never trusted here — "Yes" is an ordinary word a lead
 * might send.
 */
const PREFIXES = ["twd:", "twm:"] as const

export interface InboundTapShape {
  button?: { payload?: string; text?: string }
  interactive?: { button_reply?: { id?: string; title?: string } }
}

export function isCoachingTap(m: InboundTapShape): boolean {
  const raw = m.button?.payload ?? m.interactive?.button_reply?.id ?? ""
  return PREFIXES.some((p) => raw.startsWith(p))
}
