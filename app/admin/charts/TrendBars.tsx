"use client";

/**
 * TrendBars — a small column chart of one number over time (leads per week).
 *
 * One series, so one colour and no legend: the chart's title says what it is.
 * Columns are tealFill3, the lightest ramp step that clears 3:1 as a mark; the
 * highlighted period (this week) takes the strongest teal and keeps its value
 * printed on its cap. Every other value appears on hover, on tap, or when a
 * column has keyboard focus. Arrow keys, Home and End move along the columns,
 * which are one tab stop between them. Values are never gated behind the
 * pointer: each column also carries its label and value as text for screen
 * readers.
 *
 * The plot is scaled to a "nice" maximum (geometry.niceMax), so the busiest
 * week is measured against a round number instead of always touching the
 * top, and a band above the plot holds the value label. A label wider than
 * its column sits above every column it spans, so it never lands on a taller
 * neighbour. The baseline is a hairline on purpose: the columns carry the
 * data, the line only grounds them.
 *
 * X labels are thinned to fit the measured width, counted back from the
 * newest so the current period is always named. In a 375px card eight short
 * labels ("W45") all fit, eight dates ("13 Oct") show every other one, and
 * twenty-six weeks every third.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import { FONT, RADIUS, type Tokens } from "../tokens";
import { barHeights, clean, thinLabels } from "./geometry";

export type TrendPoint = { label: string; value: number; highlight?: boolean };

const CSS =
  ".akt-col:focus-visible{outline:2px solid var(--akt-ring);outline-offset:0}" +
  "@media (prefers-reduced-motion:reduce){.akt-bar{transition:none!important}}";

const SR_ONLY: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
};

const BAND = 18; // room above the plot for the value label
const PLOT = 80;
const AXIS = 18;
const defaultFormat = (n: number) => n.toLocaleString("en-IN");

export function TrendBars({ t, points, ariaLabel, format = defaultFormat }: { t: Tokens; points: TrendPoint[]; ariaLabel: string; format?: (n: number) => string }): JSX.Element {
  const n = points.length;
  // The list is held in state, not a ref, so the observer follows it: a chart
  // that first renders empty (still loading) has no list to measure until
  // its data arrives, and a mount-only effect would never see it.
  const [list, setList] = useState<HTMLUListElement | null>(null);
  const cols = useRef<(HTMLLIElement | null)[]>([]);
  const [width, setWidth] = useState(0);
  // The column under the pointer, the tap, or keyboard focus. Its value shows.
  const [active, setActive] = useState<number | null>(null);
  // The one column that takes Tab; arrows move it.
  const [rover, setRover] = useState<number | null>(null);

  useEffect(() => {
    if (!list || typeof ResizeObserver === "undefined") return;
    // Fires once on observe, so the first measurement needs no setState here.
    const ro = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? 0));
    ro.observe(list);
    return () => ro.disconnect();
  }, [list]);

  if (n === 0) {
    return (
      <figure role="group" aria-label={ariaLabel} style={{ margin: 0 }}>
        <p style={{ margin: 0, fontFamily: FONT.sans, fontSize: 12.5, color: t.ink2 }}>Nothing to show yet.</p>
      </figure>
    );
  }

  const values = points.map((p) => clean(p.value));
  const heights = barHeights(values);
  const highlighted = points.flatMap((p, i) => (p.highlight ? [i] : []));
  // At rest, the highlighted period is labelled; with none, the newest is.
  const resting = highlighted.length ? highlighted : [n - 1];
  const labelled = active === null ? resting : [active];
  const showX = thinLabels(points.map((p) => p.label), width, { charPx: 6, gapPx: 8, keep: highlighted });
  const tabStop = rover !== null && rover < n ? rover : resting[resting.length - 1];

  const move = (to: number) => {
    const i = Math.max(0, Math.min(n - 1, to));
    setRover(i);
    setActive(i);
    cols.current[i]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1
        : e.key === "Home" ? 0
          : e.key === "End" ? n - 1
            : null;
    if (to === null) return;
    e.preventDefault();
    move(to);
  };

  return (
    <figure role="group" aria-label={ariaLabel} style={{ margin: 0, minWidth: 0 }}>
      <style href="admin-kit-trend" precedence="admin-kit">
        {CSS}
      </style>
      <ul
        ref={setList}
        role="list"
        style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", alignItems: "stretch", ["--akt-ring" as string]: t.teal } as React.CSSProperties}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
      >
        {points.map((p, i) => {
          const on = active === i;
          const hot = !!p.highlight;
          const h = heights[i];
          const capPx = h * PLOT;
          // A value label sits centred over its column. On an edge column, one too
          // wide to centre ("₹1,20,000" over a 37px week) is anchored inward
          // instead, so it never runs off the card. Mono digits are 0.6em wide.
          const text = showX[i] ? format(p.value) : `${p.label} · ${format(p.value)}`;
          const textW = text.length * 6.6;
          const col = width / n;
          const fits = width > 0 && textW <= col + 8;
          const side = n > 1 && !fits && i === 0 ? "left" : n > 1 && !fits && i === n - 1 ? "right" : "centre";
          const anchor: React.CSSProperties =
            side === "left" ? { left: 0 } : side === "right" ? { right: 0 } : { left: "50%", transform: "translateX(-50%)" };
          // A label wider than its column hangs over its neighbours, so it sits
          // above the tallest column it spans, not just its own.
          let over = h;
          if (width > 0) {
            const from = side === "left" ? i * col : side === "right" ? (i + 1) * col - textW : (i + 0.5) * col - textW / 2;
            for (let j = Math.max(0, Math.floor(from / col)); j <= Math.min(n - 1, Math.floor((from + textW - 0.01) / col)); j++) {
              over = Math.max(over, heights[j]);
            }
          }
          return (
            <li
              key={`${i}-${p.label}`}
              ref={(el) => {
                cols.current[i] = el;
              }}
              className="akt-col"
              tabIndex={i === tabStop ? 0 : -1}
              onKeyDown={(e) => onKey(e, i)}
              onFocus={() => {
                setRover(i);
                setActive(i);
              }}
              onBlur={() => setActive((a) => (a === i ? null : a))}
              onPointerEnter={() => setActive(i)}
              style={{
                position: "relative",
                flex: "1 1 0",
                minWidth: 0,
                borderRadius: RADIUS.cell,
                background: on ? t.sunk : "transparent",
                cursor: "default",
              }}
            >
              <span style={SR_ONLY}>
                {p.label}: {format(p.value)}
                {hot ? " (current)" : ""}
              </span>
              <div aria-hidden="true" style={{ position: "relative", height: BAND + PLOT, borderBottom: `1px solid ${t.hairline}` }}>
                {labelled.includes(i) ? (
                  <span
                    style={{
                      position: "absolute",
                      bottom: Math.max(2, over * PLOT) + 4,
                      ...anchor,
                      fontFamily: FONT.mono,
                      fontVariantNumeric: "tabular-nums",
                      fontSize: 11,
                      lineHeight: "13px",
                      fontWeight: 500,
                      color: t.ink1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {/* A column whose x label was thinned away names its period here instead. */}
                    {text}
                  </span>
                ) : null}
                {h > 0 ? (
                  <span
                    className="akt-bar"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "min(24px, 62%)",
                      minWidth: 2,
                      height: Math.max(2, capPx),
                      background: hot ? t.tealFill4 : t.tealFill3,
                      // Rounded at the value, square on the baseline.
                      borderRadius: `${RADIUS.cell}px ${RADIUS.cell}px 0 0`,
                      transition: "height .5s cubic-bezier(.16,1,.3,1)",
                    }}
                  />
                ) : null}
              </div>
              <div
                aria-hidden="true"
                style={{
                  height: AXIS,
                  paddingTop: 4,
                  boxSizing: "border-box",
                  textAlign: "center",
                  fontFamily: FONT.sans,
                  fontSize: 10.5,
                  lineHeight: "14px",
                  whiteSpace: "nowrap",
                  color: on || hot ? t.ink1 : t.ink2,
                  fontWeight: hot ? 600 : 400,
                }}
              >
                {showX[i] ? p.label : ""}
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
