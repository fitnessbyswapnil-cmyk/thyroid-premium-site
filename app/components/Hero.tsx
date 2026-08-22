"use client";

import CtaButton from "./CtaButton";
import BookingActivity from "./BookingActivity";
import HeroVideo from "./HeroVideo";

// Hero ported to the supplied design: a two-column split (copy left, video
// right) on a cream ground, gold eyebrow, one flat sans headline at 800.
//
// Deliberately removed to match the design: the drifting aurora glows, the
// film-grain overlay, the yellow mark-swipe behind "10-15 kg", and the
// italic cuts. The design sets the headline as plain ink with no highlight.
//
// The one place this does NOT follow the design literally is the video
// frame. The design's slot is 4/5 portrait; the actual VSL is a 1920x1080
// master with BURNED-IN subtitles along the bottom edge, so cropping it to
// portrait would cut the subtitles off and lose half the frame. It renders
// at its native 16:9 inside the design's rounded frame instead.

export default function Hero() {
  return (
    <section
      className="bg-[var(--bg-page)] text-[var(--t1)]"
      aria-labelledby="hero-heading"
    >
      {/* On desktop this is the design's two-column split. On mobile the
          three blocks reorder to copy → video → CTA, because stacking the
          columns as-authored pushes the video below a full-width button and
          the hero's whole job is to get the video started. */}
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-8 px-6 pb-14 pt-12 md:grid-cols-[1.1fr_1fr] md:gap-x-14 md:gap-y-6 md:pb-14 md:pt-16">
        {/* ── Left, upper: the claim ──────────────────────────────────── */}
        <div className="order-1 md:col-start-1 md:row-start-1 md:self-end">
          <div className="mb-4 text-[12px] font-bold uppercase leading-[1.5] tracking-[0.1em] text-[var(--gold-ink)]">
            For busy professional women 30+ on thyroid medication
          </div>

          <h1
            id="hero-heading"
            className="m-0 mb-5 text-balance font-extrabold leading-[1.1] tracking-[-0.01em]"
            style={{ fontSize: "clamp(2rem, 1.3rem + 3.1vw, 3rem)" }}
          >
            Lose 10&ndash;15 kg in 90 days, even with a thyroid problem.
          </h1>

          <p className="m-0 mb-7 text-[17px] leading-[1.5] text-[var(--t2)]">
            Watch me explain the one thing that is actually{" "}
            <strong className="font-bold text-[var(--t1)]">blocking</strong> it.
          </p>
        </div>

        {/* ── Right: the VSL, in the design's rounded frame ───────────── */}
        <div
          className="order-2 w-full overflow-hidden md:order-none md:col-start-2 md:row-start-1 md:row-span-2 md:self-center"
          style={{
            borderRadius: 20,
            boxShadow: "0 20px 48px rgba(0,0,0,0.14)",
          }}
        >
          <HeroVideo />
        </div>

        {/* ── Left, lower: the ask ────────────────────────────────────── */}
        <div className="order-3 md:col-start-1 md:row-start-2 md:self-start">
          <CtaButton
            variant="primary"
            className="w-full sm:w-auto"
            label="Schedule My 1-1 Thyroid Fat Loss Call"
            sublabel="Free · 60 minutes · one to one"
            ariaLabel="Schedule my 1-1 thyroid fat loss session"
            location="hero"
          />

          <div className="mt-[14px] text-[13px] leading-[1.5] text-[var(--t3)]">
            Leave the call knowing your exact blocker, and it costs you nothing.
          </div>

          <BookingActivity className="mt-3" />
        </div>
      </div>
    </section>
  );
}
