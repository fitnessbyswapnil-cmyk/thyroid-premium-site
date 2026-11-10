/**
 * StatusPill — one state, in a word or two, on a small rounded label.
 *
 * Five tones, each carried three ways (colour, a glyph, and the words) so a
 * state never rests on colour alone. That matters most between "ok" and
 * "progress": won green and teal sit close together for anyone colourblind,
 * and the tick against the dot is what tells them apart.
 *
 *   ok         won, outlined, tick       sent, paid, confirmed
 *   progress   teal, outlined, dot       sending, booked, in progress
 *   attention  amber on amberTint, "!"   waiting too long, high is bad
 *   failed     clay on clayTint, cross   should have happened and didn't
 *   neutral    ink2 on sunk, hairline    nothing owed, not applicable
 *
 * Only the two tones that ask for something get a tinted surface; ok and
 * progress stay outlined, so a column of "Sent" pills does not shout. The
 * pill draws its own glyph, so pass it the words only.
 *
 * Text clears 4.5:1 on its own surface in light and dark (outlined tones on
 * both card and paper); every coloured outline clears 3:1. The neutral
 * hairline is decorative: the words carry that pill.
 */
import type { JSX } from "react";
import { FONT, RADIUS, type Tokens } from "../tokens";

export type PillTone = "ok" | "progress" | "attention" | "failed" | "neutral";

type Look = { fg: string; bg: string; bd: string };

function look(t: Tokens, tone: PillTone): Look {
  switch (tone) {
    case "ok":
      return { fg: t.won, bg: "transparent", bd: t.won };
    case "progress":
      return { fg: t.teal, bg: "transparent", bd: t.teal };
    case "attention":
      return { fg: t.amber, bg: t.amberTint, bd: t.amber };
    case "failed":
      return { fg: t.clay, bg: t.clayTint, bd: t.clay };
    default:
      // A hairline, not a coloured edge: on dark, sunk is all but the card's own
      // colour, and without it the pill would dissolve into loose text.
      return { fg: t.ink2, bg: t.sunk, bd: t.hairline };
  }
}

/** Drawn in currentColor, so each glyph is exactly as strong as the words beside it. */
function Glyph({ tone }: { tone: PillTone }) {
  if (tone === "neutral") return null;
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 10 10" width="0.8em" height="0.8em" aria-hidden="true" style={{ flex: "none" }}>
      {tone === "ok" ? <path d="M1.8 5.2l2.1 2.1 4.3-4.6" {...stroke} /> : null}
      {tone === "progress" ? <circle cx="5" cy="5" r="3" fill="currentColor" /> : null}
      {tone === "attention" ? (
        <>
          <path d="M5 1.6v4" {...stroke} />
          <circle cx="5" cy="8.2" r="1" fill="currentColor" />
        </>
      ) : null}
      {tone === "failed" ? <path d="M2.2 2.2l5.6 5.6M7.8 2.2l-5.6 5.6" {...stroke} /> : null}
    </svg>
  );
}

export function StatusPill({ t, tone, children, title }: { t: Tokens; tone: PillTone; children: React.ReactNode; title?: string }): JSX.Element {
  const s = look(t, tone);
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        boxSizing: "border-box",
        padding: "2px 9px",
        borderRadius: RADIUS.chip,
        border: `1px solid ${s.bd}`,
        background: s.bg,
        color: s.fg,
        fontFamily: FONT.sans,
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      <Glyph tone={tone} />
      {children}
    </span>
  );
}
