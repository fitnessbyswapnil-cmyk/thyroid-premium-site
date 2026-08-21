"use client";

import Image from "next/image";
import { Fragment } from "react";

// Hero social-proof strip: 100+ laurel block + four client claims.
// No headshots exist in the repo (only WhatsApp screenshots and full-body
// composites), so avatars render INITIALS on a --p-tint fill; the img slot is
// wired so a real portrait can be dropped in later without touching layout.
// Never use stock photos here — consent/advertising-standards problem.
type ProofAvatar = { initials: string; name: string; claim: string; img?: string };

// Claims match SocialProof.tsx exactly. Heenal's photo is her REAL portrait
// (cropped from her own story graphic). The other three render initials until
// real client photos land at public/avatars/{priya-r,divya-m,shariya-s}.jpg —
// set `img` and they drop straight in. Never stock faces.
const PROOF: ProofAvatar[] = [
  { initials: "PR", name: "Priya R.", claim: "Lost 4.5 kg in 6 weeks" },
  { initials: "DM", name: "Divya M.", claim: "Lost 6 kg in 10 weeks" },
  { initials: "HS", name: "Heenal S.", claim: "Lost 15 kg in 90 days", img: "/avatars/heenal-s.jpg" },
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
      <span className="relative block h-[36px] w-[36px] shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--p-border)] sm:h-[42px] sm:w-[42px]">
        <Image src={a.img} alt={a.name} fill sizes="42px" className="object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-[var(--p300)] ring-1 ring-[var(--p-border)] sm:h-[42px] sm:w-[42px] sm:text-[13px]"
      style={{ background: "var(--p-tint)" }}
    >
      {a.initials}
    </span>
  );
}

export default function HeroProofStrip() {
  return (
    // All five items visible on a 390px screen with NO horizontal scrolling —
    // the old row overflowed, cutting quotes mid-word ("Lost 4.5 …") unless
    // she swiped, and most visitors never swipe. Mobile: laurel block on top,
    // quotes in a compact 2x2 grid (keeps the hero short so the CTA stays
    // reachable). sm+: the original single centred row.
    <div className="container-default mt-[36px] sm:mt-[44px]">
      <div role="list" aria-label="Client results" className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
        {/* 100+ laurel block */}
        <div role="listitem" className="flex shrink-0 items-center gap-1.5">
          <Laurel />
          <div className="text-center">
            <div className="text-[26px] font-bold leading-none text-[var(--p300)] sm:text-[30px]" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
              100+
            </div>
            <div className="mx-auto mt-1 max-w-[11ch] text-[11px] leading-[1.25] text-[var(--t2)] sm:text-[12px]">
              Indian Women Coached
            </div>
          </div>
          <Laurel flip />
        </div>

        {/* Quotes — 2x2 grid on mobile, inline row from sm up */}
        <div className="grid w-full grid-cols-2 gap-x-3 gap-y-3 sm:flex sm:w-auto sm:items-center sm:gap-6">
          {PROOF.map((a) => (
            <Fragment key={a.initials}>
              <span aria-hidden="true" className="hidden h-12 w-px shrink-0 bg-[var(--b-soft)] sm:block" />
              <div role="listitem" className="flex min-w-0 items-center gap-2 sm:shrink-0 sm:gap-3">
                <Avatar a={a} />
                <div className="min-w-0 sm:max-w-[150px]">
                  <p className="text-[11px] leading-[1.3] text-[var(--t1)] sm:text-[12.5px] sm:leading-[1.4]">&ldquo;{a.claim}&rdquo;</p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-[var(--p400)] sm:text-[11.5px]">&ndash; {a.name}</p>
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
