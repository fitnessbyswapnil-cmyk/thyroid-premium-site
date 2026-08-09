"use client";

import { useScarcity } from "../context/ScarcityProvider";
import { trackCtaClick } from "../lib/analytics";

type CtaVariant = "primary" | "secondary" | "ghost" | "sticky";

type CtaButtonProps = {
  label: string;
  sublabel?: string;
  variant?: CtaVariant;
  className?: string;
  id?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
  location?: string;
  /** Appends a right-pointing arrow after the label (hero mockup style).
      Optional and default-off so the other call sites are untouched. */
  showArrow?: boolean;
};

const variantClass: Record<CtaVariant, string> = {
  primary: "cta-button",
  secondary: "btn-primary",
  ghost: "btn-ghost",
  sticky: "btn-sticky",
};

export default function CtaButton({
  label,
  sublabel,
  variant = "primary",
  className = "",
  id,
  ariaLabel,
  style,
  location = "unknown",
  showArrow = false,
}: CtaButtonProps) {
  const { goToCta } = useScarcity();

  const handleClick = () => {
    trackCtaClick(location, label);
    goToCta(location);
  };

  return (
    <button
      type="button"
      id={id}
      aria-label={ariaLabel ?? label}
      className={`${variantClass[variant]} ${className}`.trim()}
      style={style}
      onClick={handleClick}
    >
      <span className="cta-label">
        {label}
        {showArrow && (
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: "inline-block", verticalAlign: "-3px", marginLeft: "10px" }}
          >
            <path d="M4 12h15M13 6l6 6-6 6" />
          </svg>
        )}
      </span>

      {sublabel ? (
        <span className="cta-sub">{sublabel}</span>
      ) : null}
    </button>
  );
}