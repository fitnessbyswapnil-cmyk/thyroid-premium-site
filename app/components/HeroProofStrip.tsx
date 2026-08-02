"use client";

import Image from "next/image";
import { Fragment } from "react";

// Hero social-proof strip: 200+ laurel block + four client claims.
// No headshots exist in the repo (only WhatsApp screenshots and full-body
// composites), so avatars render INITIALS on a --p-tint fill; the img slot is
// wired so a real portrait can be dropped in later without touching layout.
// Never use stock photos here — consent/advertising-standards problem.
type ProofAvatar = { initials: string; name: string; claim: string; img?: string };

// Claims match SocialProof.tsx and ResultsSection.tsx exactly.
const PROOF: ProofAvatar[] = [
  { initials: "PR", name: "Priya R.", claim: "Lost 4.5 kg in 6 weeks" },
  { initials: "DM", name: "Divya M.", claim: "Lost 6 kg in 10 weeks" },
  { initials: "HS", name: "Heenal S.", claim: "Lost 15 kg in 90 days" },
  { initials: "SS", name: "Shariya S.", claim: "More energy, TSH is in range" },
];

function Laurel({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="26"
      height="44"
      viewBox="0 0 26 44"
      fill="none"
      stroke="var(--p500)"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
      className="opacity-90"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M22 42 C10 38 4 28 5 16 C5.5 10 8 5 12 2" />
      {[36, 30, 24, 18, 12].map((y, i) => (
        <path key={y} d={`M${8 - i * 0.6} ${y} q -6 -1 -7 -7 q 7 0 7 7z`} fill="var(--p500)" stroke="none" opacity="0.9" />
      ))}
    </svg>
  );
}

function Avatar({ a }: { a: ProofAvatar }) {
  if (a.img) {
    return (
      <span className="relative block h-[42px] w-[42px] shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--p-border)]">
        <Image src={a.img} alt={a.name} fill sizes="42px" className="object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-[var(--p300)] ring-1 ring-[var(--p-border)]"
      style={{ background: "var(--p-tint)" }}
    >
      {a.initials}
    </span>
  );
}

export default function HeroProofStrip() {
  return (
    <div className="container-default mt-[44px]">
      <div
        role="list"
        aria-label="Client results"
        className="flex snap-x snap-mandatory items-center gap-5 overflow-x-auto pb-2 lg:justify-center lg:gap-6 lg:overflow-visible lg:pb-0"
        style={{ scrollbarWidth: "none" }}
      >
        {/* 200+ laurel block */}
        <div role="listitem" className="flex shrink-0 snap-center items-center gap-1.5">
          <Laurel />
          <div className="text-center">
            <div className="text-[30px] font-bold leading-none text-[var(--p300)]" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
              200+
            </div>
            <div className="mx-auto mt-1 max-w-[11ch] text-[12px] leading-[1.25] text-[var(--t2)]">
              Indian Women Transformed
            </div>
          </div>
          <Laurel flip />
        </div>

        {PROOF.map((a) => (
          <Fragment key={a.initials}>
            <span aria-hidden="true" className="h-12 w-px shrink-0 bg-[var(--b-soft)]" />
            <div role="listitem" className="flex shrink-0 snap-center items-center gap-3">
              <Avatar a={a} />
              <div className="max-w-[150px]">
                <p className="text-[12.5px] leading-[1.4] text-[var(--t1)]">&ldquo;{a.claim}&rdquo;</p>
                <p className="mt-0.5 text-[11.5px] font-medium text-[var(--p400)]">&ndash; {a.name}</p>
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
