"use client";

/**
 * JourneySteps — where one client is, on one line of her card.
 *
 * Lead → Confirmed → Report → Call → Summary → Paid → Onboarded, drawn as one
 * track she moves along, the way Pipeline draws its stages: one hue getting
 * stronger as she goes, never seven categories.
 *
 *   done     a filled tealFill3 node with a tick: the lightest step of the
 *            ramp that still clears 3:1 as a mark
 *   current  the strongest teal, ringed, and the only label set in ink1
 *   todo     an ink3 ring, hollow: nothing has happened yet, and nothing is owed
 *   missed   clay ring on clayTint with a "!". Clay means exactly one thing in
 *            this system: should have happened and didn't. Never "not yet".
 *
 * The line is teal as far as she has got (through anything missed on the
 * way) and a hairline after that. Each state is also a shape, and also words
 * a screen reader hears ("Report: missed, should have happened"), so none of
 * it rests on colour.
 *
 * At 375px a card has about 300px for seven steps, and "Confirmed" or
 * "Onboarded" is wider than its 43px column. Words are never broken to fit
 * (hyphenation dictionaries are not on every phone, and "Confir-med" without
 * the hyphen is worse than no label). The full form measures itself and
 * names as many steps as fit, always including the current step and any
 * missed one, counted back from the last; the rest stay dots, named in their
 * tooltip and to screen readers. `compact` keeps only the dots and says the
 * current step in words beside them, which is what a row in a list wants.
 */
import { useEffect, useState, type JSX } from "react";
import { FONT, type Tokens } from "../tokens";
import { thinLabels } from "../charts/geometry";

export type StepState = "done" | "current" | "todo" | "missed";
export type JourneyStep = { key: string; label: string; state: StepState; hint?: string };

const SAY: Record<StepState, string> = {
  done: "done",
  current: "current step",
  todo: "not yet",
  missed: "missed, should have happened",
};

const SR_ONLY: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
};

function Node({ t, state, size }: { t: Tokens; state: StepState; size: number }) {
  const base: React.CSSProperties = {
    position: "relative",
    zIndex: 1,
    boxSizing: "border-box",
    width: size,
    height: size,
    flex: "none",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
  };
  if (state === "done") {
    return (
      <span aria-hidden="true" style={{ ...base, background: t.tealFill3 }}>
        {size >= 14 ? (
          <svg viewBox="0 0 10 10" width={size - 4} height={size - 4} style={{ display: "block" }}>
            <path d="M2.3 5.2l1.9 1.9 3.6-3.9" fill="none" stroke={t.card} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
    );
  }
  if (state === "current") {
    // The ring is an outline, not a shadow: its gap shows whatever surface the
    // card sits on, so it never paints a colour this component cannot know.
    return <span aria-hidden="true" style={{ ...base, background: t.teal, outline: `2px solid ${t.teal}`, outlineOffset: size >= 14 ? 2 : 1 }} />;
  }
  if (state === "missed") {
    return (
      <span aria-hidden="true" style={{ ...base, background: t.clayTint, border: `1.5px solid ${t.clay}` }}>
        {size >= 14 ? (
          <span style={{ fontFamily: FONT.sans, fontSize: 9.5, fontWeight: 600, lineHeight: 1, color: t.clay }}>!</span>
        ) : null}
      </span>
    );
  }
  return <span aria-hidden="true" style={{ ...base, border: `1.5px solid ${t.ink3}` }} />;
}

export function JourneySteps({ t, steps, compact = false, ariaLabel = "Client journey" }: { t: Tokens; steps: JourneyStep[]; compact?: boolean; ariaLabel?: string }): JSX.Element {
  const n = steps.length;
  // Held in state, not a ref, so the observer attaches whenever the full list
  // mounts (and lets go when it switches to compact), not only on first render.
  const [list, setList] = useState<HTMLOListElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!list || typeof ResizeObserver === "undefined") return;
    // Fires once on observe, so the first measurement needs no setState here.
    const ro = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? 0));
    ro.observe(list);
    return () => ro.disconnect();
  }, [list]);
  // How far she has got: the last step that is done or under way. The track is
  // travelled up to here, including through a step that was missed on the way.
  let reach = -1;
  steps.forEach((s, i) => {
    if (s.state === "done" || s.state === "current") reach = i;
  });
  const cur = steps.findIndex((s) => s.state === "current");
  const missed = steps.filter((s) => s.state === "missed");
  const line = (travelled: boolean) => (travelled ? t.tealFill3 : t.hairline);

  // The one sentence the dots stand for: beside them in compact form, under
  // the track otherwise. Screen readers get all of it from the list, so this
  // line is hidden from them rather than read twice.
  const next = steps.findIndex((s, i) => i > reach && s.state === "todo");
  const focus: { title: string; position: string; step: JourneyStep | null } | null =
    cur >= 0
      ? { title: steps[cur].label, position: `${cur + 1} of ${n}`, step: steps[cur] }
      : n > 0 && steps.every((s) => s.state === "done")
        ? { title: `All ${n} done`, position: "", step: null }
        : next >= 0
          ? reach >= 0
            ? { title: `Next: ${steps[next].label}`, position: `${next + 1} of ${n}`, step: steps[next] }
            : { title: "Not started", position: "", step: steps[next] }
          : null;
  const hint = focus?.step?.hint;

  const sayStep = (s: JourneyStep) => `: ${SAY[s.state]}${s.hint ? `, ${s.hint}` : ""}`;
  const tip = (s: JourneyStep) => `${s.label}${sayStep(s)}`;
  const text: React.CSSProperties = { fontFamily: FONT.sans, fontSize: 12.5, lineHeight: 1.35 };
  const parts: React.ReactNode[] = [];
  if (compact && focus) {
    parts.push(<span key="now" style={{ color: t.ink1, fontWeight: 600 }}>{focus.title}</span>);
    if (focus.position) parts.push(<span key="pos" style={{ color: t.ink2 }}>{focus.position}</span>);
  }
  if (hint && focus?.step) parts.push(<span key="hint" style={{ color: t.ink2 }}>{compact ? hint : `${focus.step.label}: ${hint}`}</span>);
  if (missed.length) parts.push(<span key="missed" style={{ color: t.clay, fontWeight: 500 }}>Missed: {missed.map((s) => s.label).join(", ")}</span>);
  const summary = parts.length ? (
    <span aria-hidden="true" style={{ ...text, display: "inline-flex", flexWrap: "wrap", columnGap: 6, rowGap: 2, alignItems: "baseline", minWidth: 0 }}>
      {parts.map((part, i) => (
        // A separator travels with the item after it, so a wrapped line never ends on a dot.
        <span key={i} style={{ display: "inline-flex", gap: 6, alignItems: "baseline" }}>
          {i > 0 ? <span style={{ color: t.ink2 }}>·</span> : null}
          {part}
        </span>
      ))}
    </span>
  ) : null;

  if (compact) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 4, minWidth: 0 }}>
        <ol role="list" aria-label={ariaLabel} style={{ listStyle: "none", margin: 0, padding: "4px 4px", display: "flex", alignItems: "center", flex: "none" }}>
          {steps.map((s, i) => (
            <li key={s.key} aria-current={s.state === "current" ? "step" : undefined} title={tip(s)} style={{ display: "flex", alignItems: "center", position: "relative" }}>
              <Node t={t} state={s.state} size={10} />
              <span style={SR_ONLY}>
                {s.label}
                {sayStep(s)}
              </span>
              {i < n - 1 ? <span aria-hidden="true" style={{ width: 8, height: 2, margin: "0 3px", borderRadius: 1, background: line(i + 1 <= reach) }} /> : null}
            </li>
          ))}
        </ol>
        {summary}
      </div>
    );
  }

  const NODE = 14;
  const CHAR = 6.2; // Plex Sans at 11px, a little generous
  // Unmeasured (the server render, the first paint) names only what must be
  // named, so a phone never flashes colliding words before it measures.
  const keep = steps.flatMap((s, i) => (s.state === "current" || s.state === "missed" ? [i] : []));
  const named = thinLabels(steps.map((s) => s.label), width, { charPx: CHAR, gapPx: 6, keep });
  const col = width > 0 ? width / Math.max(1, n) : 0;
  // Each half-line stops short of its node, so the gap is air in whatever
  // colour the surface is, not a ring painted in a guess at it.
  const stop = `calc(50% + ${NODE / 2 + 3}px)`;
  return (
    <div style={{ minWidth: 0 }}>
      <ol
        ref={setList}
        role="list"
        aria-label={ariaLabel}
        style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: `repeat(${Math.max(1, n)}, minmax(0, 1fr))` }}
      >
        {steps.map((s, i) => {
          const isCur = s.state === "current";
          // An end label wider than its column hangs inward, never off the card.
          const wide = !(col > 0) || s.label.length * CHAR > col;
          const edge = n > 1 && wide ? (i === 0 ? "flex-start" : i === n - 1 ? "flex-end" : undefined) : undefined;
          return (
            <li
              key={s.key}
              aria-current={isCur ? "step" : undefined}
              title={tip(s)}
              style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}
            >
              <div style={{ position: "relative", width: "100%", height: 22, display: "grid", placeItems: "center" }}>
                {i > 0 ? <span aria-hidden="true" style={{ position: "absolute", top: 10, height: 2, left: 0, right: stop, background: line(i <= reach) }} /> : null}
                {i < n - 1 ? <span aria-hidden="true" style={{ position: "absolute", top: 10, height: 2, left: stop, right: 0, background: line(i + 1 <= reach) }} /> : null}
                <Node t={t} state={s.state} size={NODE} />
              </div>
              <span
                style={{
                  alignSelf: edge,
                  marginTop: 4,
                  height: 14,
                  textAlign: "center",
                  fontFamily: FONT.sans,
                  fontSize: 11,
                  lineHeight: "14px",
                  whiteSpace: "nowrap",
                  fontWeight: isCur ? 600 : s.state === "missed" ? 500 : 400,
                  color: isCur ? t.ink1 : s.state === "missed" ? t.clay : t.ink2,
                }}
              >
                {named[i] ? s.label : <span style={SR_ONLY}>{s.label}</span>}
                <span style={SR_ONLY}>{sayStep(s)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {summary ? <div style={{ marginTop: 8 }}>{summary}</div> : null}
    </div>
  );
}
