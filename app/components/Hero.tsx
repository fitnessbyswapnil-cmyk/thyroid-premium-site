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
//
// COMPLIANCE FLOOR (23-Sep, Events Manager gave this domain until ~11 Oct
// before its data is blocked under Meta's health terms). The same two rules
// app/decode/page.tsx now carries apply here:
//   - No sentence may tell the reader she has a thyroid condition or takes
//     medication. Describe the situation or describe clients, never diagnose
//     the visitor. That is Meta's personal-attributes standard and it is
//     enforced on ad copy and landing page alike.
//   - No kilogram figure and no timeframe in a promise. Meta prohibits
//     "promises of specific outcomes within a set timeframe without
//     disclaimers or qualifiers". Client cards may state what a named client
//     actually did, because TransformationWall carries the results-vary
//     qualifier.
// The h1 here was "Lose 10-15 kg in 90 days, even with a thyroid problem."
// until 23-Sep, which broke both at once. Do not put a kilogram figure or a
// timeframe back in that slot. Owner may override, but not by accident.

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
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-7 px-[18px] pb-9 pt-10 md:grid-cols-[1.1fr_1fr] md:gap-x-14 md:gap-y-6 md:px-6 md:pb-12 md:pt-14">
        {/* ── Left, upper: the claim ──────────────────────────────────── */}
        <div className="order-1 md:col-start-1 md:row-start-1 md:self-end">
          <div className="mb-[14px] text-[12px] font-bold uppercase leading-[1.5] tracking-[0.1em] text-[var(--gold-ink)]">
            For busy professional women 30+
          </div>

          <h1
            id="hero-heading"
            className="m-0 mb-4 text-balance font-extrabold leading-[1.12] tracking-[-0.01em]"
            style={{ fontSize: "clamp(1.875rem, 1.05rem + 2.9vw, 2.875rem)" }}
          >
            Thyroid fat loss does not work like ordinary fat loss.
          </h1>

          <p className="m-0 mb-6 text-[15.5px] leading-[1.5] text-[var(--t2)] md:text-[17px]">
            Eating less has been making it{" "}
            <strong className="font-bold text-[var(--t1)]">harder</strong>, not
            easier. Your report can show exactly where &mdash; and almost nobody
            reads it that way.
          </p>
        </div>

        {/* ── The VSL. Third on mobile, right column on desktop. ──────── */}
        <div
          className="order-3 w-full overflow-hidden md:order-none md:col-start-2 md:row-start-1 md:row-span-2 md:self-center"
          style={{
            borderRadius: 20,
            boxShadow: "0 20px 48px rgba(0,0,0,0.14)",
          }}
        >
          <HeroVideo />
        </div>

        {/* ── The ask. Second on mobile so it lands inside the fold. ──── */}
        <div className="order-2 md:col-start-1 md:row-start-2 md:self-start">
          <CtaButton
            variant="primary"
            className=""
            label="Schedule My 1-1 Thyroid Consultation"
            sublabel="₹299 · 60 minutes · one to one"
            ariaLabel="Schedule my 1-1 thyroid fat loss session"
            location="hero"
          />

          <div className="mt-[14px] text-[13px] leading-[1.5] text-[var(--t3)]">
            Leave the call knowing your exact blocker, and it costs you nothing.
          </div>

          {/* Scope qualifier, required by the compliance floor above: it states
              what this service is and is not, next to the ask. It belongs
              wherever the primary CTA goes. */}
          <p className="m-0 mt-2 text-[12px] leading-[1.5] text-[var(--t3)]">
            Nutrition and lifestyle coaching. Not medical treatment. Continue any
            medication as advised by your doctor. Results vary.
          </p>

          <BookingActivity className="mt-3" />
        </div>
      </div>
    </section>
  );
}
