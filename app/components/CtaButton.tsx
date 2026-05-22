"use client";

import { useScarcity } from "../context/ScarcityProvider";

type CtaVariant = "primary" | "secondary" | "ghost" | "sticky";

type CtaButtonProps = {
  label: string;
  sublabel?: string;
  variant?: CtaVariant;
  className?: string;
  id?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
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
}: CtaButtonProps) {
  const { goToCta } = useScarcity();

  const handleClick = () => {
    goToCta();
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
      <span className="cta-label">{label}</span>

      {sublabel ? (
        <span className="cta-sub">{sublabel}</span>
      ) : null}
    </button>
  );
}