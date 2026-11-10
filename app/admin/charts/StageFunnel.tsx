"use client";

/**
 * StageFunnel — how many reached each step, and what share of the step above.
 *
 * One bar per stage, all measured against the FIRST stage, so a bar's length
 * reads straight off as "of everyone who came in" (if a later stage ever
 * out-counts the first, it sets the scale instead: no bar is clamped). Between
 * two bars sits the share of the upper stage that reached the lower one, which
 * is the number he acts on: it says WHERE they fall out. Above 100% is printed
 * as it is.
 *
 * Colour is the ordinal teal ramp, lightest at the top and strongest at the
 * bottom: one woman moving forward, not seven categories. The two lightest
 * ramp steps are tints (1.3 to 2.6:1 against card and paper), too faint to be
 * a mark on their own, so a bar in either carries a tealFill3 edge, which
 * clears 3:1. Every count is printed beside its bar as well.
 *
 * Screen readers get a list, one item per stage, read as "Confirmed 64, 53%
 * of Lead". When `onSelect` is given, each row is a real button. With nobody
 * at the first stage the stages still list, at 0, under one plain sentence.
 */
import type { JSX } from "react";
import { FONT, RADIUS, stageRamp, type Tokens } from "../tokens";
import { clean, formatPct, funnelWidths, rampIndex, stepConversions } from "./geometry";

export type FunnelStage = { key: string; label: string; count: number };

const CSS =
  ".akf-row{background-color:transparent;transition:background-color .12s ease}" +
  "@media (hover:hover){.akf-row:hover{background-color:var(--akf-wash)}}" +
  ".akf-row:active{background-color:var(--akf-wash)}" +
  ".akf-row:focus-visible{outline:2px solid var(--akf-ring);outline-offset:1px}" +
  "@media (prefers-reduced-motion:reduce){.akf-row{transition:none}.akf-bar{transition:none!important}}";

const SR_ONLY: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
};

/** Ramp steps 0 and 1 are tints: below 3:1 on card and paper in both themes. */
const TINT_STEPS = 2;
const BAR = 16;

const count = (n: number) => clean(n).toLocaleString("en-IN");

export function StageFunnel({ t, stages, onSelect, ariaLabel }: { t: Tokens; stages: FunnelStage[]; onSelect?: (key: string) => void; ariaLabel?: string }): JSX.Element {
  const note: React.CSSProperties = { margin: 0, fontFamily: FONT.sans, fontSize: 12.5, lineHeight: 1.45, color: t.ink2 };
  if (!stages.length) return <p style={note}>No stages to show.</p>;

  const ramp = stageRamp(t);
  const counts = stages.map((s) => s.count);
  const widths = funnelWidths(counts);
  const conv = stepConversions(counts);
  const empty = clean(counts[0]) === 0;

  // Columns shared by every row, so the bars start on one line and the counts
  // end on one. The label column is sized to the longest label, capped so the
  // bars keep most of a 375px card; a longer label wraps instead.
  const longest = Math.max(...stages.map((s) => s.label.length));
  const digits = Math.max(...stages.map((s) => count(s.count).length));
  const columns = `minmax(0, min(${(longest * 0.6 + 0.6).toFixed(1)}em, 38%)) minmax(0, 1fr) ${digits + 0.5}ch`;
  // fontSize is set on the grid itself so its em and ch units are the 12.5px
  // of the labels and counts, not whatever size the page inherits.
  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: columns, columnGap: 10, alignItems: "center", padding: "0 6px", fontSize: 12.5 };

  return (
    <div style={{ minWidth: 0 }}>
      <style href="admin-kit-funnel" precedence="admin-kit">
        {CSS}
      </style>
      <ol
        role="list"
        aria-label={ariaLabel ?? "Funnel by stage"}
        style={{ listStyle: "none", margin: 0, padding: 0, ["--akf-wash" as string]: t.sunk, ["--akf-ring" as string]: t.teal } as React.CSSProperties}
      >
        {stages.map((s, i) => {
          const step = rampIndex(i, stages.length, ramp.length);
          const fill = ramp[step];
          const pct = conv[i];
          const said = i > 0 && pct !== null ? `, ${formatPct(pct)} of ${stages[i - 1].label}` : "";
          const row: React.CSSProperties = {
            ...grid,
            boxSizing: "border-box",
            width: "100%",
            minHeight: 32,
            borderRadius: RADIUS.cell,
            fontFamily: FONT.sans,
          };
          const inner = (
            <>
              <span style={{ fontSize: 12.5, lineHeight: 1.25, color: t.ink2, overflowWrap: "break-word", minWidth: 0 }}>{s.label}</span>
              <span aria-hidden="true" style={{ display: "block", height: BAR, minWidth: 0 }}>
                {widths[i] > 0 ? (
                  <span
                    className="akf-bar"
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${(widths[i] * 100).toFixed(2)}%`,
                      background: fill,
                      // Square where the bar starts, rounded where the value is.
                      borderRadius: `0 ${RADIUS.cell}px ${RADIUS.cell}px 0`,
                      boxShadow: step < TINT_STEPS ? `inset 0 0 0 1px ${ramp[TINT_STEPS]}` : undefined,
                      transition: "width .5s cubic-bezier(.16,1,.3,1)",
                    }}
                  />
                ) : null}
              </span>
              <span style={{ fontFamily: FONT.mono, fontVariantNumeric: "tabular-nums", fontSize: 12.5, color: t.ink1, textAlign: "right" }}>
                {count(s.count)}
                <span style={SR_ONLY}>{said}</span>
              </span>
            </>
          );
          return (
            <li key={s.key}>
              {i > 0 ? (
                // The share between two bars belongs to the lower one; it is
                // in that row's spoken text, so here it is for the eye only.
                <div aria-hidden="true" style={{ ...grid, minHeight: 18 }}>
                  <span />
                  <span style={{ fontFamily: FONT.mono, fontVariantNumeric: "tabular-nums", fontSize: 11, lineHeight: "18px", color: t.ink2 }}>
                    {pct === null ? "" : `↓ ${formatPct(pct)}`}
                  </span>
                  <span />
                </div>
              ) : null}
              {onSelect ? (
                <button
                  type="button"
                  className="akf-row"
                  onClick={() => onSelect(s.key)}
                  style={{ ...row, margin: 0, border: 0, textAlign: "left", color: "inherit", cursor: "pointer" }}
                >
                  {inner}
                </button>
              ) : (
                <div style={row}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
      {empty ? (
        <p style={{ ...note, marginTop: 10 }}>
          Nobody has reached {stages[0].label} yet, so there is nothing to compare.
        </p>
      ) : null}
    </div>
  );
}
