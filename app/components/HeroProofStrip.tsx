"use client";

import Image from "next/image";
import { Fragment } from "react";

// Hero social-proof strip: the 100+ claim + four client claims.
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

/* The laurel wreath that used to flank this number is gone.
   It was drawn here, not stock, so it was honest — but the laurel is the
   award-badge motif every template funnel reaches for, and a motif that
   appears on ten thousand pages signifies nothing on the eleven-thousandth.
   What is left is the number itself, set in the display face between two
   hairlines: the same claim, carrying the page's own typography instead of
   borrowed iconography. Rules, not leaves. */
function Rule() {
  return (
    <span
      aria-hidden="true"
      className="block h-px w-10 shrink-0 sm:w-12"
      style={{ background: "linear-gradient(90deg, transparent, var(--p-border), transparent)" }}
    />
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
      className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-[length:var(--fs-2xs)] font-medium text-[var(--p300)] ring-1 ring-[var(--p-border)] sm:h-[42px] sm:w-[42px] sm:text-[length:var(--fs-2xs)]"
      style={{ background: "var(--p-tint)" }}
    >
      {a.initials}
    </span>
  );
}

/**
 * `claimsOnly`: /decode renders the 100+ block WITHOUT the four client
 * quotes. Those quotes are four of the twenty-two separate proof units that
 * page was carrying, and they are the weakest four — a name, an initial and a
 * number, above four full transformation composites saying the same thing with
 * faces. The number stays: it is the "100+ Indian women coached" claim, which
 * is the one proof statement the hero cannot do without. Default false, so the
 * home page is unchanged.
 */
export default function HeroProofStrip({
  claimsOnly = false,
}: { claimsOnly?: boolean } = {}) {
  return (
    // All five items visible on a 390px screen with NO horizontal scrolling —
    // the old row overflowed, cutting quotes mid-word ("Lost 4.5 …") unless
    // she swiped, and most visitors never swipe. Mobile: the claim on top,
    // quotes in a compact 2x2 grid (keeps the hero short so the CTA stays
    // reachable). sm+: the original single centred row.
    <div className="container-default mt-[36px] sm:mt-[44px]">
      <div role="list" aria-label="Client results" className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
        {/* The 100+ claim */}
        <div role="listitem" className="flex shrink-0 flex-col items-center">
          <div className="flex items-center gap-3">
            <Rule />
            <div data-tabular className="text-[length:var(--fs-2xl)] font-bold leading-[var(--lh-display)] tracking-[var(--ls-display)] text-[var(--p300)]" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
              100+
            </div>
            <Rule />
          </div>
          <div className="mt-2 text-[length:var(--fs-3xs)] uppercase leading-[var(--lh-tight)] tracking-[var(--ls-caps)] text-[var(--t2)] sm:text-[length:var(--fs-2xs)]">
            Indian Women Coached
          </div>
        </div>

        {/* Quotes — 2x2 grid on mobile, inline row from sm up */}
        {!claimsOnly && (
        <div className="grid w-full grid-cols-2 gap-x-3 gap-y-3 sm:flex sm:w-auto sm:items-center sm:gap-6">
          {PROOF.map((a) => (
            <Fragment key={a.initials}>
              <span aria-hidden="true" className="hidden h-12 w-px shrink-0 bg-[var(--b-soft)] sm:block" />
              <div role="listitem" className="flex min-w-0 items-center gap-2 sm:shrink-0 sm:gap-3">
                <Avatar a={a} />
                <div className="min-w-0 sm:max-w-[150px]">
                  <p className="text-[length:var(--fs-3xs)] leading-[var(--lh-heading)] text-[var(--t1)] sm:text-[length:var(--fs-2xs)] sm:leading-[var(--lh-tight)]">&ldquo;{a.claim}&rdquo;</p>
                  <p className="mt-0.5 truncate text-[length:var(--fs-3xs)] font-medium text-[var(--p400)] sm:text-[length:var(--fs-3xs)]">&ndash; {a.name}</p>
                </div>
              </div>
            </Fragment>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
