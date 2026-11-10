"use client";

/**
 * Button — every press on the operations desk.
 *
 * Four variants and one rule: a card has ONE primary, the teal fill, and it is
 * the thing to do next. Secondary is an outline, quiet is a teal text link,
 * and danger is clay, rationed (like clay everywhere) to destructive actions
 * and to "missing".
 *
 * States, in the order they win: disabled > busy > status > rest.
 *  - busy: a spinner beside the label, aria-busy, and presses dropped. It
 *    stays focusable (aria-disabled rather than the disabled attribute), so a
 *    keyboard user keeps their place while a send is in flight.
 *  - status "sent": a tick and "Sent" in won, outlined in won. Presses are
 *    dropped, so a second tap can never send the same WhatsApp twice; clear
 *    `status` to re-arm the button.
 *  - status "failed": "Failed · Retry" in clay on its tint. It stays pressable,
 *    because pressing it again IS the retry.
 *  Each result is also said once, politely, by a live region beside it.
 *
 * `busy` only blocks a press once the parent has re-rendered with it, and a
 * quick double tap lands before that. Anything that sends a message should
 * still drop a second call while the first is in flight (RowTools' useOnce
 * does exactly this), or she gets the WhatsApp twice.
 *
 * Inline styles cannot reach :hover, :active or :focus-visible, so a small
 * stylesheet does, and it holds no colours of its own: every button hands it
 * its tokens as custom properties. React hoists the <style> into <head> once,
 * however many buttons render. Hover exists only where a real pointer does
 * (on a phone it would stay stuck on after a tap). Under
 * prefers-reduced-motion the press nudge stops and the spinner becomes a
 * still, dotted ring.
 *
 * Label colour and underline are set inline even on <a>: globals.css resets
 * every link to `color: inherit; text-decoration: none`, unlayered, and that
 * reset beats any class.
 *
 * Contrast for every state, light and dark: the table in the PR that added
 * this file (all text 4.5:1 or more, outlines and fills 3:1 or more).
 */
import type { JSX } from "react";
import { FONT, RADIUS, type Tokens } from "../tokens";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

type Props = {
  t: Tokens;
  /** Default "secondary". */
  variant?: ButtonVariant;
  /** Default "md": at least 44px tall, a thumb target. "sm" is at least 32px. */
  size?: "sm" | "md";
  /** In flight: spinner, aria-busy, presses dropped. */
  busy?: boolean;
  disabled?: boolean;
  /** The result of the last press, shown for as long as it is passed. */
  status?: "sent" | "failed";
  onClick?: () => void;
  /** Renders an <a> instead of a <button>. */
  href?: string;
  target?: string;
  title?: string;
  ariaLabel?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
};

const CSS =
  ".akb{background-color:var(--akb-bg);border-color:var(--akb-bd);transition:background-color .14s ease,border-color .14s ease,transform .08s ease}" +
  ".akb:focus-visible{outline:2px solid var(--akb-ring);outline-offset:2px}" +
  "@media (hover:hover){.akb:not([aria-disabled=true]):hover{background-color:var(--akb-bg-hover);border-color:var(--akb-bd-hover);text-decoration-thickness:2px}}" +
  ".akb:not([aria-disabled=true]):active{background-color:var(--akb-bg-press);border-color:var(--akb-bd-press);transform:translateY(1px)}" +
  ".akb-spin{width:1em;height:1em;flex:none;box-sizing:border-box;border:2px solid;border-color:currentColor currentColor currentColor transparent;border-radius:50%;animation:akb-spin .7s linear infinite}" +
  "@keyframes akb-spin{to{transform:rotate(1turn)}}" +
  "@media (prefers-reduced-motion:reduce){.akb{transition:none}.akb:active{transform:none}.akb-spin{animation:none;border-style:dotted;border-color:currentColor}}";

/** Present for screen readers, absent for everyone else. */
const SR_ONLY: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
};

const CLEAR = "transparent";

/** `a` at `pct`% over `b`. Every derived colour is a mix of two tokens, so it moves with the theme. */
const mix = (a: string, b: string, pct: number) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

type Paint = { fg: string; bg: string; bgHover: string; bgPress: string; bd: string; bdHover: string; bdPress: string; underline: boolean };

function paint(t: Tokens, variant: ButtonVariant, look: "rest" | "disabled" | "sent" | "failed"): Paint {
  if (look === "disabled") {
    // Exempt from contrast minimums, and still kept legible: ink3 is 3.2:1 or more on every surface here.
    const bg = variant === "primary" ? t.sunk : CLEAR;
    const bd = variant === "quiet" ? CLEAR : t.hairline;
    return { fg: t.ink3, bg, bgHover: bg, bgPress: bg, bd, bdHover: bd, bdPress: bd, underline: variant === "quiet" };
  }
  if (look === "sent") {
    // Won is the system's one coloured outcome; on a transparent ground it reads on card and paper alike.
    return { fg: t.won, bg: CLEAR, bgHover: CLEAR, bgPress: CLEAR, bd: t.won, bdHover: t.won, bdPress: t.won, underline: false };
  }
  if (look === "failed") {
    return { fg: t.clay, bg: t.clayTint, bgHover: mix(t.clayTint, t.clay, 92), bgPress: mix(t.clayTint, t.clay, 88), bd: t.clay, bdHover: t.clay, bdPress: t.clay, underline: false };
  }
  switch (variant) {
    case "primary": {
      // Mixing toward ink1 darkens the fill on light and lightens it on dark,
      // so the label's contrast only ever rises on hover and press.
      const hover = mix(t.teal, t.ink1, 86);
      const press = mix(t.teal, t.ink1, 76);
      return { fg: t.card, bg: t.teal, bgHover: hover, bgPress: press, bd: t.teal, bdHover: hover, bdPress: press, underline: false };
    }
    case "quiet":
      return { fg: t.teal, bg: CLEAR, bgHover: CLEAR, bgPress: t.sunk, bd: CLEAR, bdHover: CLEAR, bdPress: CLEAR, underline: true };
    case "danger":
      return { fg: t.clay, bg: CLEAR, bgHover: t.clayTint, bgPress: mix(t.clayTint, t.clay, 92), bd: t.clay, bdHover: t.clay, bdPress: t.clay, underline: false };
    default:
      // ink3, not hairline: an outline that IS the button's edge has to clear 3:1.
      return { fg: t.ink1, bg: CLEAR, bgHover: t.sunk, bgPress: t.hairline, bd: t.ink3, bdHover: t.ink2, bdPress: t.ink2, underline: false };
  }
}

function Tick() {
  return (
    <svg viewBox="0 0 12 12" width="1em" height="1em" aria-hidden="true" style={{ flex: "none" }}>
      <path d="M2.4 6.3l2.4 2.4 4.8-5.1" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Button({
  t,
  variant = "secondary",
  size = "md",
  busy = false,
  disabled = false,
  status,
  onClick,
  href,
  target,
  title,
  ariaLabel,
  fullWidth = false,
  children,
}: Props): JSX.Element {
  const look = disabled ? "disabled" : busy ? "rest" : status ?? "rest";
  const p = paint(t, variant, look);
  const showSent = !disabled && !busy && status === "sent";
  const showFailed = !disabled && !busy && status === "failed";
  // Presses are dropped while busy and after a send, not just while disabled.
  const blocked = disabled || busy || showSent;
  const md = size === "md";

  // What this button is called, for the live region and for the label once the
  // visible words have been replaced by the result.
  const name = ariaLabel ?? (typeof children === "string" || typeof children === "number" ? String(children) : "");
  const said = showSent ? (name ? `${name}: sent` : "Sent") : showFailed ? (name ? `${name}: failed. Press again to retry.` : "Failed. Press again to retry.") : "";
  const label = ariaLabel && (showSent || showFailed) ? `${ariaLabel}, ${showSent ? "sent" : "failed, press to retry"}` : ariaLabel;

  const style = {
    "--akb-bg": p.bg,
    "--akb-bg-hover": p.bgHover,
    "--akb-bg-press": p.bgPress,
    "--akb-bd": p.bd,
    "--akb-bd-hover": p.bdHover,
    "--akb-bd-press": p.bdPress,
    "--akb-ring": t.teal,
    boxSizing: "border-box",
    display: fullWidth ? "flex" : "inline-flex",
    width: fullWidth ? "100%" : undefined,
    alignItems: "center",
    justifyContent: "center",
    gap: md ? 8 : 6,
    minHeight: md ? 44 : 32,
    margin: 0,
    padding: variant === "quiet" ? (md ? "0 10px" : "0 6px") : md ? "0 18px" : "0 12px",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: RADIUS.card,
    color: p.fg,
    fontFamily: FONT.sans,
    fontSize: md ? 14 : 12.5,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "normal",
    textAlign: "center",
    whiteSpace: fullWidth ? "normal" : "nowrap",
    textDecorationLine: p.underline ? "underline" : "none",
    textUnderlineOffset: 3,
    verticalAlign: "middle",
    cursor: disabled ? "not-allowed" : busy ? "progress" : showSent ? "default" : "pointer",
    userSelect: "none",
    touchAction: "manipulation",
    WebkitTapHighlightColor: CLEAR,
  } as React.CSSProperties;

  const content = showSent ? (
    <>
      <Tick />
      <span>Sent</span>
    </>
  ) : showFailed ? (
    <>
      <span>Failed</span>
      <span style={SR_ONLY}>,</span>
      <span aria-hidden="true">·</span>
      <span>Retry</span>
    </>
  ) : (
    <>
      {busy ? <span className="akb-spin" aria-hidden="true" /> : null}
      {children}
    </>
  );

  const press = (e: React.MouseEvent) => {
    if (blocked) {
      e.preventDefault();
      return;
    }
    onClick?.();
  };

  // Rendered empty from the first paint: a live region that appears together
  // with its message is not reliably announced.
  const live = (
    <span aria-live="polite" style={SR_ONLY}>
      {said}
    </span>
  );
  const sheet = (
    <style href="admin-kit-button" precedence="admin-kit">
      {CSS}
    </style>
  );

  if (href) {
    return (
      <>
        {sheet}
        <a
          className="akb"
          // A disabled link has no href, so it cannot be followed or focused.
          href={disabled ? undefined : href}
          role={disabled ? "link" : undefined}
          target={target}
          rel={target === "_blank" ? "noopener noreferrer" : undefined}
          aria-disabled={blocked || undefined}
          aria-busy={busy || undefined}
          aria-label={label}
          title={title}
          onClick={press}
          style={style}
        >
          {content}
        </a>
        {live}
      </>
    );
  }

  return (
    <>
      {sheet}
      <button
        type="button"
        className="akb"
        disabled={disabled}
        aria-disabled={blocked || undefined}
        aria-busy={busy || undefined}
        aria-label={label}
        title={title}
        onClick={press}
        style={style}
      >
        {content}
      </button>
      {live}
    </>
  );
}
