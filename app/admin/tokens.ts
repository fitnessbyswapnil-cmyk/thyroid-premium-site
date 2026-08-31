/**
 * app/admin/tokens.ts — the design system for the operations desk.
 *
 * The brief was "a medical-adjacent tool that shows one man real women's names,
 * weights and blood reports twice a day", so it is set like a clinical case file
 * rather than a product: warm paper instead of cold white, ink-black text, and
 * hairlines instead of boxes and shadows.
 *
 * Two rules do most of the work:
 *
 *  1. ONE saturated hue in the whole system — a deep teal, meaning "progress".
 *     Anything teal is movement. Everything else stays neutral until it
 *     genuinely needs attention.
 *  2. Clay red is rationed to exactly ONE meaning: something that should have
 *     happened and didn't. It is never decoration and never a series colour.
 *     A screen that scolds him every morning stops getting opened — which is
 *     also why, among the outcomes, only WON carries colour. No-show, cancelled
 *     and lost are neutral.
 *
 * Every ratio below is measured against the surface the token actually sits on:
 * body text and ink against paper #F6F4F0, fills against paper. Text clears
 * 4.5:1; marks and boundaries clear 3:1.
 */

export const LIGHT = {
  paper: "#F6F4F0", // page surface
  card: "#FFFFFF", // 1.1:1 against paper — a lift, not a box
  ink1: "#191C1E", // 15.1:1 primary text
  ink2: "#5C6469", // 6.2:1 secondary
  ink3: "#7E868C", // 3.25:1 against PAPER — the spec measured 3.2:1 against card
                   // white, which is a different surface; quiet labels sit on paper
                   // more often than on a card, so it is set to clear there.
  teal: "#17726C", // 5.3:1 progress, links
  tealFill1: "#CBDEDB", // ordinal ramp, lightest
  tealFill2: "#9DC4BF",
  tealFill3: "#4E948D",
  tealFill4: "#17726C", // darkest = furthest along
  won: "#1F6B43", // 5.9:1 — the only coloured outcome
  amber: "#7A5411", // 6.6:1 — "high is bad" figures
  clay: "#A8321E", // 6.4:1 — missing, and nothing else
  clayTint: "#FCF3F0", // the one tinted surface, for a severe row
  amberTint: "#FBF6EC",
  hairline: "#E2DDD5", // 1.3:1 — a boundary, not a line you read
  sunk: "#F1EEE8", // recessed half-step: "nothing was owed here"
} as const;

/**
 * Dark is a designed variant, not an inversion. The paper warmth is kept as a
 * slightly green-grey ink surface; the teal ramp is re-lightened so progress
 * still reads as one hue getting stronger rather than weaker; clay becomes a
 * desaturated salmon so it never glows on a dark field; and card elevation is
 * carried by a lighter surface rather than by a shadow, which does not exist
 * on dark.
 */
export const DARK = {
  paper: "#15181A",
  card: "#1B1F21",
  ink1: "#ECEAE5", // 13.9:1
  ink2: "#A7AFB3",
  ink3: "#767E83",
  teal: "#5FB3AA",
  tealFill1: "#24413F",
  tealFill2: "#2F625C",
  tealFill3: "#43877F",
  tealFill4: "#5FB3AA",
  won: "#5CC98A",
  amber: "#D9A441",
  clay: "#E08A76", // desaturated so it never glows
  clayTint: "#2A1A17",
  amberTint: "#241F14",
  hairline: "#2C3134",
  sunk: "#191D1F",
} as const;

export type Tokens = typeof LIGHT;

export const FONT = {
  serif: "var(--f-serif), Georgia, serif",
  sans: "var(--f-sans), system-ui, sans-serif",
  mono: "var(--f-mono), ui-monospace, Menlo, monospace",
} as const;

/** space 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 */
export const SP = [4, 8, 12, 16, 24, 32, 48, 64] as const;

export const RADIUS = { cell: 3, card: 6, chip: 999 } as const;

/** e0 hairline (default) · e1 card · e2 overlay only. */
export const ELEV = {
  e1: "0 1px 2px rgba(25,28,30,.06)",
  e2: "0 8px 24px rgba(25,28,30,.10)",
} as const;

/**
 * The ordinal stage ramp: ONE hue getting darker as she moves forward. Four
 * steps of a single object advancing, not four categories — which is why the
 * stage bar is chevrons and the outcomes are detached pills.
 */
export const stageRamp = (t: Tokens) => [t.tealFill1, t.tealFill2, t.tealFill3, t.tealFill4] as const;
