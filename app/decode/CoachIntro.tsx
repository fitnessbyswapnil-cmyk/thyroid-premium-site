import Image from "next/image";
import { COACH_IMAGE, COACH_NAME } from "@/app/lib/authority";

/**
 * "Meet your coach" on /decode, in the owner's own words (14-Sep-2026):
 * "Scientific Thyroid Lean Method for fat loss" and "ACE, INFS, BLS
 * certified". AIHM is deliberately NOT on this line: the owner did not list it
 * when asked, and a credential is not added on anyone else's say-so. The quote
 * is a line the site already uses, not a new testimonial.
 *
 * Sits on the page's dark band, so it takes the band's light ink.
 */
export default function CoachIntro() {
  return (
    <section className="px-4 py-12 md:px-6 md:py-16" aria-labelledby="coach-heading">
      <div className="mx-auto grid w-full max-w-[880px] grid-cols-1 items-center gap-8 md:grid-cols-[280px_1fr] md:gap-12">
        <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl">
          <Image
            src={COACH_IMAGE}
            alt={`${COACH_NAME}, thyroid fat-loss coach`}
            fill
            sizes="(max-width: 768px) 280px, 280px"
            className="object-cover"
            loading="lazy"
          />
        </div>

        <div>
          <p className="section-label">Meet your coach</p>
          <h2 id="coach-heading" className="section-title m-0 text-balance">
            Hey, I&rsquo;m <span className="decode-gold">Coach Swapnil</span>.
          </h2>
          <p className="mt-4 text-[length:var(--fs-lg)] font-bold leading-[var(--lh-tight)] text-white">
            Scientific Thyroid Lean Method for fat loss
          </p>
          <p className="mt-3 text-[length:var(--fs-2xs)] leading-[var(--lh-body)] text-[var(--t2)]">
            <span className="decode-gold">ACE</span> &middot; <span className="decode-gold">INFS</span> &middot;{" "}
            <span className="decode-gold">BLS</span> certified &middot;{" "}
            <span className="decode-gold">100+</span> thyroid women coached
          </p>
          <blockquote
            className="m-0 mt-6 py-1 pl-4 text-[length:var(--fs-lg)] font-bold italic leading-[var(--lh-tight)] text-white"
            style={{ borderLeft: "4px solid var(--accent-yellow)" }}
          >
            Your report will show why.
          </blockquote>
        </div>
      </div>
    </section>
  );
}
