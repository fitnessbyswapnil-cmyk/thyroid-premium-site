"use client";

import CtaButton from "./CtaButton";
import HeroVideo from "./HeroVideo";
import HeroProofStrip from "./HeroProofStrip";

// VSL hero — approved Claude Design "final" port: gold-diamond eyebrow and
// credential chips, gradient-ring video frame, tactile pill CTA, drifting
// aurora glows. Primary CTA books the Rs 299 consultation directly (see
// ScarcityProvider.goToCta → Cashfree form); a soft secondary link offers
// the /schedule booking page so hesitant visitors still become leads.

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[var(--bg-page)] text-[var(--t1)]"
      aria-labelledby="hero-heading"
    >
      {/* Atmospheric glow — slow-drifting aurora, warm tints on cream */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(70vw,440px)] overflow-hidden sm:h-[520px]"
      >
        <div className="hero-aurora-1 absolute left-1/2 top-[-22%] h-[min(82vw,340px)] w-[min(82vw,340px)] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.06] blur-[120px]" />
        <div className="hero-aurora-2 absolute left-1/2 top-[10%] h-[140px] w-[min(88vw,420px)] -translate-x-1/2 rounded-full bg-[#b8322b]/[0.05] blur-[90px]" />
      </div>

      {/* Film-grain texture — ~4% opacity, barely perceptible, adds richness */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="container-default relative z-10 mx-auto flex flex-col items-center pb-[clamp(4rem,11vw,6rem)] pt-[clamp(3.25rem,8vw,5rem)] text-center">

        {/* a) Eyebrow — hyperniche filter: the medicated-but-stuck woman */}
        <div className="hero-rise flex w-full items-center justify-center gap-2" style={{ animationDelay: "0ms" }}>
          <span aria-hidden="true" style={{ color: "var(--gold-ink)", fontSize: 7, lineHeight: 1 }}>◆</span>
          <p className="max-w-[36ch] text-[11px] font-semibold uppercase leading-[1.5] tracking-[0.2em] text-[var(--t3)] sm:max-w-none sm:text-[11.5px] sm:tracking-[0.22em]">
            For busy professional women 30+ on thyroid medication
          </p>
        </div>

        {/* b) Headline — the claim, direct, with the audience right above it */}
        <h1
          id="hero-heading"
          className="hero-rise mx-auto mt-[30px] max-w-[19ch] text-balance font-medium leading-[1.06] tracking-[-0.025em]"
          style={{
            animationDelay: "100ms",
            fontSize: "clamp(2.2rem, 1.6rem + 2.9vw, 4.1rem)",
            fontFamily: "var(--font-display), Georgia, serif",
            // Display-size refinements: lining figures so "10-15" and "90" sit
            // on a common baseline with the caps, and kerning/ligatures on so
            // the pairs Lora is designed for actually engage at large sizes.
            fontVariantNumeric: "lining-nums",
            fontKerning: "normal",
            fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
            textRendering: "optimizeLegibility",
          }}
        >
          Lose{" "}
          <span className="mark-swipe italic">10&ndash;15 kg</span>{" "}
          <span className="italic">in 90 days</span>,
          even with a thyroid problem.
        </h1>

        {/* c) Subhead — mechanism + path, three short sentences */}
        <p
          className="hero-rise mt-[18px] max-w-[44ch] text-pretty leading-[1.6] text-[var(--t2)]"
          style={{ animationDelay: "200ms", fontSize: "clamp(0.98rem, 0.94rem + 0.35vw, 1.1rem)" }}
        >
          Your weight isn&rsquo;t stuck. It&rsquo;s{" "}
          <strong className="font-semibold text-[var(--t1)]">blocked</strong>. The
          tablet fixed your TSH, not your metabolism. Find your blocker on a
          private 1-1 session with me.
        </p>

        {/* d) Proof microline — the claim's receipts, right below it */}
        <p
          className="hero-rise mt-[14px] text-pretty text-[13px] font-semibold leading-[1.6] text-[var(--p300)] sm:text-[14px]"
          style={{ animationDelay: "240ms" }}
        >
          Heenal &minus;15 kg &middot; Namrata &minus;16 kg &middot; Vaidehi
          &minus;12 kg. All in 90 days.
          <span className="ml-1 font-normal text-[var(--t4)]">Results vary.</span>
        </p>
        <p
          className="hero-rise mt-[8px] text-[12.5px] leading-[1.55] text-[var(--t3)]"
          style={{ animationDelay: "260ms" }}
        >
          Real Indian food &middot; No starving &middot; Alongside your doctor
        </p>

        {/* d) Credential strip — gold diamonds before each chip (design port) */}
        <div
          className="hero-rise mt-[26px] flex flex-wrap items-center justify-center gap-x-[18px] gap-y-2"
          style={{ animationDelay: "300ms" }}
          aria-label="Credentials"
        >
          {["ACE & INFS Certified", "Thyroid-Only", "By Private Intake"].map((c) => (
            <span key={c} className="inline-flex items-center gap-[7px]">
              <span aria-hidden="true" style={{ color: "var(--gold-ink)", fontSize: 6, lineHeight: 1 }}>◆</span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--t3)]">
                {c}
              </span>
            </span>
          ))}
        </div>

        {/* e) VSL video frame — teal→coral hairline ring, soft warm shadow.
            The video itself stays dark: it is the page's one dark element. */}
        <div
          className="hero-rise w-full"
          style={{
            animationDelay: "400ms",
            marginTop: 38,
            borderRadius: 22,
            padding: 1,
            background:
              "linear-gradient(165deg, rgba(163, 114, 32,0.45), #ddd4c6 28%, #ddd4c6 72%, rgba(184, 50, 43,0.35))",
            boxShadow:
              "0 24px 60px -20px rgba(36, 31, 26,0.28), 0 10px 30px -10px rgba(36, 31, 26,0.14)",
            overflow: "hidden",
          }}
        >
          <HeroVideo />
        </div>

        {/* f) Social-proof strip */}
        <div className="hero-rise w-full" style={{ animationDelay: "520ms" }}>
          <HeroProofStrip />
        </div>

        {/* g) Primary CTA — quiz-first (owner decision). Every CTA sends her
            into the free Thyroid Score assessment; the paid call is offered
            on the quiz's own result screen once she has a score and reason
            to book, not blind on first click. */}
        <div className="hero-rise mt-[40px] w-full max-w-[720px]" style={{ animationDelay: "620ms" }}>
          <CtaButton
            variant="primary"
            className="relative z-[1] w-full"
            label="Schedule My 1-1 Thyroid Call"
            sublabel="60 minutes, one to one with Swapnil · ₹299 · limited weekly slots"
            ariaLabel="Schedule my 1-1 thyroid fat loss session"
            location="hero"
            showArrow
          />
          {/* Risk reversal at the decision point — the page's strongest line */}
          <p className="mt-3 text-center text-[12.5px] font-medium leading-[1.5] text-[var(--t3)]">
            Leave the call knowing your exact blocker,{" "}
            <span className="font-semibold text-[var(--p300)]">or your ₹299 back.</span>
          </p>
        </div>

        {/* Reassurance line removed per audit — the credential chips above
            already say Thyroid-Only + By Private Intake. */}

      </div>
    </section>
  );
}
