/**
 * lib/cal-theme.ts
 *
 * Cal.com embed theming, mapped onto the site's white / lemon / red system so
 * the booker does not read as a third-party widget bolted onto the page.
 *
 * Cal.com exposes its design tokens to the embed as CSS variables via
 * `cssVarsPerTheme`. The mapping below is the same one used everywhere else on
 * the site (app/globals.css), so a colour change there should be mirrored here.
 *
 * Two rules carried over from the colour system:
 *  - RED IS THE ACTION COLOUR AND NOTHING ELSE. cal-brand drives the selected
 *    day, the chosen time slot and the confirm button, which are exactly the
 *    "this is the thing you press" surfaces. It is not used for text.
 *  - YELLOW IS A SURFACE, NEVER TEXT. #ffeb00 is 1.09:1 on white, so lemon only
 *    ever appears as a background (cal-bg-subtle / cal-bg-muted) with ink on
 *    top, never as cal-text-*.
 *
 * Both values are passed for light AND dark so the booker cannot flip into its
 * own dark palette on a visitor whose OS is set to dark mode — the site is a
 * committed light design and the embed must match it.
 */

const VARS: Record<string, string> = {
  // Action — red, and only red, on the surfaces you press.
  "cal-brand": "#e60000",
  "cal-brand-emphasis": "#cc0000",
  "cal-brand-text": "#ffffff",

  // Surfaces — white ground, lemon wash for grouped areas.
  "cal-bg": "#ffffff",
  "cal-bg-subtle": "#fffdeb",
  "cal-bg-muted": "#fff7b8",
  "cal-bg-emphasis": "#f4f0e2",
  "cal-bg-inverted": "#241f1a",

  // Ink ramp — matches --t1..--t4 in globals.css.
  "cal-text-emphasis": "#241f1a",
  "cal-text": "#423b33",
  "cal-text-subtle": "#6b6157",
  "cal-text-muted": "#7a7065",
  "cal-text-inverted": "#ffffff",

  // Lines — warm, belonging to the yellow family without being yellow.
  "cal-border": "#ede7dd",
  "cal-border-subtle": "#f2e9a8",
  "cal-border-emphasis": "#ddd4c6",
  "cal-border-muted": "#f4f0e2",
  "cal-border-booker": "#ede7dd",
};

/** Passed to cal("ui", …) — identical on every embed on the site. */
export const CAL_UI_CONFIG = {
  theme: "light" as const,
  layout: "month_view" as const,
  hideEventTypeDetails: false,
  cssVarsPerTheme: { light: VARS, dark: VARS },
};
