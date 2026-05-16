"use client";

import CtaButton from "./CtaButton";

type SectionCtaProps = {
  label: string;
  sublabel?: string;
  trust?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
  id?: string;
  style?: React.CSSProperties;
};

export default function SectionCta({
  label,
  sublabel,
  trust,
  variant = "secondary",
  className = "",
  buttonClassName = "",
  ariaLabel,
  id,
  style,
}: SectionCtaProps) {
  const wrapClass =
    variant === "primary" ? "cta-wrap section-cta" : "section-cta";

  return (
    <div className={`${wrapClass} ${className}`.trim()}>
      <CtaButton
        id={id}
        variant={variant}
        className={buttonClassName}
        style={style}
        label={label}
        sublabel={sublabel}
        ariaLabel={ariaLabel ?? label}
      />
      {trust ? <p className="micro-trust text-center text-pretty">{trust}</p> : null}
    </div>
  );
}
