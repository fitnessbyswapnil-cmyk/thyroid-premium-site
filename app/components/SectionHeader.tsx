import type { ReactNode } from "react";

type SectionHeaderProps = {
  label: string;
  title: ReactNode;
  lead?: string;
  className?: string;
  titleMaxCh?: string;
};

export default function SectionHeader({
  label,
  title,
  lead,
  className = "",
  titleMaxCh,
}: SectionHeaderProps) {
  return (
    <header className={`section-header ${className}`.trim()}>
      <p className="section-label">{label}</p>
      <h2
        className="section-title mx-auto"
        style={titleMaxCh ? { maxWidth: titleMaxCh } : undefined}
      >
        {title}
      </h2>
      {lead ? <p className="section-lead mx-auto text-pretty">{lead}</p> : null}
    </header>
  );
}
