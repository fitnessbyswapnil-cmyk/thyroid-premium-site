import type { Metadata } from "next";
import dynamic from "next/dynamic";
import HeroProofStrip from "@/app/components/HeroProofStrip";
import HeroVideo from "@/app/components/HeroVideo";
import { PILLARS } from "@/app/components/PillarsSection";
import DecodeStickyCta from "./DecodeStickyCta";
import CoachIntro from "./CoachIntro";

/**
 * /decode — the paid (₹299) 1-1 consultation offer. Ad traffic only.
 *
 * LOOK (owner's call, 14-Sep-2026): the layout of feeldvibes.in, a thyroid
 * coach the owner reports closing consistently — white hero, near-black
 * everything after it, gold labels, red buttons, a coach section, the method
 * as cards, a checkmark list. Spec and the list of what was deliberately NOT
 * copied (their words, their numbers, their scarcity lines, their free call):
 * docs/decode-redesign-feeldvibes-style.md.
 *
 * WORDS: short on purpose (same day, earlier). The long page is kept unchanged
 * at /decode-long.
 *
 * Order:
 *   1 hero (white) ...... headline, the why, the refund line, button, video
 *   2 symptoms .......... six lines, tap the true ones
 *   3 proof ............. before/afters · video stories · WhatsApp screenshots
 *   4 meet your coach ... the owner's own words
 *   5 the method ........ the three pillars
 *   6 what you get ...... three lines, then how booking works in three steps
 *   7 who this is for ... five checkmarks
 *   8 FAQ ............... three one-line answers
 *   9 last button
 *
 * Unchanged, and must stay so: ₹299 (ads run on it — owner, 14-Sep); every
 * button goes to /decode/quiz with the ad's own label and the price; the refund
 * sentence is quoted, not reworded; the proof claim is "100+"; testimonial
 * words are verbatim.
 */

const SymptomChips = dynamic(() => import("@/app/components/SymptomChips"));
const VideoTestimonial = dynamic(() => import("@/app/components/VideoTestimonial"));
const TransformationWall = dynamic(() => import("@/app/components/TransformationWall"));
const WhatsappProofSection = dynamic(() => import("@/app/components/WhatsappProofSection"));

export const metadata: Metadata = {
  title: "Book your 1-1 Thyroid Consultation | Swapnil Umbarkar",
  description:
    "Book a 1-1 Thyroid Fat Loss Consultation for ₹299. Your own blood report read line by line to find the exact reason you are not losing weight even though you eat less.",
  // Ad traffic only. Indexing it would put it in competition with the main site.
  robots: { index: false, follow: false },
};

/** The six most recognisable lines, by index into SymptomChips' own list. */
const SYMPTOM_PICK = [0, 1, 2, 3, 8, 9] as const;

// Mirrors the video ad (17-Sep): she was promised a Root Cause Map, her
// report read, and what the next 90 days should look like.
const GET = [
  "Your Root Cause Map: your biggest fat-loss blocker, in simple words",
  "Your report read line by line: TSH, T3, T4, and antibodies if you have them",
  "What your next 90 days should look like, with real Indian food and no starving",
] as const;

const STEPS = [
  { h: "Fill your intake form", p: "12 quick taps about your report and what you have tried. I read it before we speak." },
  { h: "Pay ₹299", p: "Refunded if you leave the call without knowing your blocker." },
  { h: "Pick your slot", p: "Sixty minutes, one to one, on a video call." },
] as const;

// Self-qualification. TWO LINES ARE DELIBERATELY ABSENT and must not be added:
// a price filter ("if you cannot invest…") and a decision-maker filter — on the
// recorded calls neither predicted the buyer, and the quiz asks the second one
// far more softly.
const FOR_YOU = [
  "Your report says normal and your body says otherwise",
  "You have been diagnosed hypothyroid and take the tablet, but the weight has not moved in two years or more",
  "You have already paid someone else to fix this at least once",
  "You want the reason, not another diet chart",
  "You are ready to start within the next 30 days",
] as const;

const FAQ = [
  { q: "Is ₹299 the whole cost?", a: "Yes. Nothing extra is added at the end." },
  {
    q: "No blood report yet?",
    a: "Answer the questions anyway. I will not take ₹299 to read a report that does not exist — you get a free call on which tests to get.",
  },
  { q: "Who is on the call?", a: "Me. Not an assistant, not a sales team. Sixty minutes, one to one." },
] as const;

// Built and deliberately left OFF until 26-Sep-2026 (quiz gates first need two
// clean weeks). Renders at the last button only.
const SHOW_PROGRAMME_PRICE = false;

function BookButton() {
  return (
    <a
      href="/decode/quiz"
      className="cta-button mx-auto"
      style={{ maxWidth: "24rem", textDecoration: "none" }}
    >
      Book my 1-1 Thyroid Consultation
      <span className="cta-sub">₹299 &middot; 60-min Thyroid Root Cause Session</span>
    </a>
  );
}

function ButtonRow() {
  return (
    <section className="px-4 pb-12 md:px-6">
      <div className="mx-auto w-full max-w-[760px] text-center">
        <BookButton />
      </div>
    </section>
  );
}

export default function DecodePage() {
  return (
    // theme-decode: red buttons, gold accents (globals.css).
    <main className="theme-decode">
      {/* ── 1. Hero (white) ─────────────────────────────────────────────── */}
      <section className="decode-hero bg-white">
        <div className="container-default mx-auto w-full max-w-[760px] px-4 pb-10 pt-7 text-center md:px-6 md:pb-14 md:pt-14">
          <p className="m-0 text-[length:var(--fs-3xs)] font-medium text-[var(--t2)]">
            For Indian women 28+ with hypothyroidism
          </p>
          <h1
            className="mx-auto mt-3 max-w-[680px] text-balance text-[length:var(--fs-2xl)] font-bold leading-[var(--lh-display)] text-[#0b1120]"
            style={{ fontFamily: "var(--font-body), Inter, system-ui, sans-serif" }}
          >
            {/* The video ad's hook, word for word (17-Sep): she should land on the
                sentence she just heard. */}
            You&apos;re Not The Problem.{" "}
            <span className="block" style={{ color: "#dc3434" }}>
              Your Thyroid Is.
            </span>
          </h1>

          <p className="mx-auto mt-3 text-[length:var(--fs-xs)] font-bold text-[#0b1120] md:text-[length:var(--fs-base)]">
            Lose 8–10 kg in 90 days, even with thyroid.
          </p>

          <p className="mx-auto mt-3 max-w-[560px] text-[length:var(--fs-xs)] leading-[var(--lh-body)] text-[var(--t2)] md:text-[length:var(--fs-base)]">
            In a <strong className="text-[#0b1120]">60-minute 1-on-1 Thyroid Root Cause Session</strong> I
            read your report and show you exactly what is blocking your fat loss.
          </p>

          <p className="mx-auto mt-3 max-w-[560px] text-[length:var(--fs-2xs)] font-bold leading-[var(--lh-body)] text-[#0b1120]">
            Leave the call without knowing your blocker and the ₹299 is refunded.
          </p>

          <div className="mt-6 flex flex-col items-center">
            <a
              href="/decode/quiz"
              className="cta-button"
              style={{ maxWidth: "24rem", textDecoration: "none" }}
            >
              Book my 1-1 Thyroid Consultation
              <span className="cta-sub">₹299 &middot; 60-min Thyroid Root Cause Session</span>
            </a>
            <p className="mx-auto mt-3 max-w-[420px] text-[length:var(--fs-3xs)] leading-[var(--lh-body)] text-[var(--t2)]">
              Every case is personally reviewed before the call. Limited slots each week.
            </p>
          </div>

          {/* The owner's own video, the home page VSL. Only its poster loads
              until she taps play, so it costs the page almost nothing. */}
          <div className="mx-auto mt-8 w-full max-w-[560px]">
            <p className="mb-3 text-[length:var(--fs-xs)] font-bold text-[#0b1120]">
              Why thyroid fat loss is not the same
            </p>
            <HeroVideo />
          </div>

          <HeroProofStrip claimsOnly />
        </div>
      </section>

      {/* Everything after the hero sits on the near-black band. */}
      <div className="band-deep">
        {/* ── 2. Symptoms ──────────────────────────────────────────────── */}
        <SymptomChips hideCta compact pick={SYMPTOM_PICK} />

        {/* ── 3. Proof ─────────────────────────────────────────────────── */}
        <TransformationWall compact />
        <ButtonRow />
        <VideoTestimonial compact />
      </div>

      <div className="band-deep band-deeper">
        <WhatsappProofSection hideCta limit={3} />
        <ButtonRow />
      </div>

      <div className="band-deep">
        {/* ── 4. Meet your coach ───────────────────────────────────────── */}
        <CoachIntro />

        {/* ── 5. The method ────────────────────────────────────────────── */}
        <section className="px-4 py-12 md:px-6 md:py-16" aria-labelledby="method-heading">
          <div className="mx-auto w-full max-w-[880px]">
            <header className="text-center">
              <p className="section-label">The method</p>
              <h2 id="method-heading" className="section-title mx-auto text-balance">
                The <span className="decode-gold">Scientific Thyroid Lean Method</span>
              </h2>
            </header>
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {PILLARS.map((p) => (
                <article key={p.n} className="decode-card p-5 md:p-6">
                  <p className="m-0 text-[length:var(--fs-3xs)] font-bold tracking-[var(--ls-caps)] decode-gold">
                    PILLAR {p.n}
                  </p>
                  <h3 className="mb-2 mt-2 text-[length:var(--fs-base)] font-bold leading-[var(--lh-tight)] text-white">
                    {p.name}
                  </h3>
                  <p className="m-0 text-[length:var(--fs-2xs)] leading-[var(--lh-body)] text-[var(--t2)]">{p.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── 6. What you get · how booking works ──────────────────────── */}
        <section className="px-4 py-12 md:px-6 md:py-16" aria-labelledby="get-heading">
          <div className="mx-auto w-full max-w-[640px]">
            <header className="text-center">
              <p className="section-label">Your Root Cause Session</p>
              <h2 id="get-heading" className="section-title mx-auto text-balance">
                What you leave <span className="decode-gold">with</span>
              </h2>
            </header>
            <ul className="mx-auto mt-7 flex list-none flex-col gap-3 p-0">
              {GET.map((line) => (
                <li
                  key={line}
                  className="decode-card relative py-4 pl-11 pr-4 text-[length:var(--fs-xs)] font-medium leading-[var(--lh-tight)] text-white"
                >
                  <span
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
                    style={{ background: "var(--accent-yellow)" }}
                  />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-4 text-center text-[length:var(--fs-2xs)] leading-[var(--lh-body)] text-[var(--t2)]">
              Even if we never work together, you leave with the answers. If a
              full programme suits you, I will show you what it involves and what
              it costs. No pressure.
            </p>

            <header className="mt-14 text-center">
              <p className="section-label">How booking works</p>
              <h2 id="steps-heading" className="section-title mx-auto text-balance">
                Three steps to <span className="decode-gold">your call</span>
              </h2>
            </header>
            <ol className="mx-auto mt-8 flex list-none flex-col p-0">
              {STEPS.map((s, i) => (
                <li
                  key={s.h}
                  className="flex flex-col items-center py-6 text-center"
                  style={{ borderTop: i ? "1px solid rgba(255,255,255,0.08)" : "none" }}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-md text-[length:var(--fs-2xs)] font-bold decode-gold"
                    style={{ border: "1px solid var(--accent-yellow)" }}
                  >
                    0{i + 1}
                  </span>
                  <h3 className="mb-1 mt-3 text-[length:var(--fs-base)] font-bold leading-[var(--lh-tight)] text-white">
                    {s.h}
                  </h3>
                  <p className="m-0 text-[length:var(--fs-2xs)] leading-[var(--lh-body)] text-[var(--t2)]">{s.p}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 text-center">
              <BookButton />
            </div>
          </div>
        </section>

        {/* ── 7. Who this is for ───────────────────────────────────────── */}
        <section className="px-4 py-12 md:px-6 md:py-16" aria-labelledby="fit-heading">
          <div className="mx-auto w-full max-w-[640px]">
            <header className="text-center">
              <p className="section-label">Who this is for</p>
              <h2 id="fit-heading" className="section-title mx-auto text-balance">
                Not another diet chart. <span className="decode-gold">Your report, read properly.</span>
              </h2>
            </header>
            <p className="mt-7 text-[length:var(--fs-xs)] font-bold text-white">This is for you if:</p>
            <ul className="mt-3 flex list-none flex-col gap-3 p-0">
              {FOR_YOU.map((line) => (
                <li key={line} className="flex gap-3 text-[length:var(--fs-2xs)] leading-[var(--lh-body)] text-[var(--t1)]">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" className="mt-[3px] flex-none">
                    <path d="M4 10.5l4 4 8-9" fill="none" stroke="#ffc91e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 8. FAQ ───────────────────────────────────────────────────── */}
        <section className="px-4 py-12 md:px-6 md:py-16" aria-labelledby="faq-heading">
          <div className="mx-auto w-full max-w-[640px]">
            <header className="text-center">
              <p className="section-label">Before you book</p>
              <h2 id="faq-heading" className="section-title mx-auto text-balance">
                Quick <span className="decode-gold">questions</span>
              </h2>
            </header>
            <dl className="mt-7 flex flex-col gap-3">
              {FAQ.map((f) => (
                <div key={f.q} className="decode-card px-5 py-4">
                  <dt className="text-[length:var(--fs-xs)] font-bold leading-[var(--lh-tight)] text-white">{f.q}</dt>
                  <dd className="m-0 mt-1.5 text-[length:var(--fs-2xs)] leading-[var(--lh-body)] text-[var(--t2)]">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── 9. Last button ───────────────────────────────────────────── */}
        <section className="px-4 pb-14 pt-4 text-center md:px-6">
          <div className="mx-auto w-full max-w-[760px]">
            <a
              href="/decode/quiz"
              className="cta-button mx-auto"
              style={{ maxWidth: "24rem", textDecoration: "none" }}
            >
              Book my 1-1 Thyroid Consultation
              <span className="cta-sub">₹299 &middot; 60-min Thyroid Root Cause Session</span>
            </a>
            <p className="mx-auto mt-4 text-[length:var(--fs-2xs)] text-[var(--t2)]">
              ₹299 &middot; 60 minutes &middot; one to one with Swapnil
            </p>
            {SHOW_PROGRAMME_PRICE && (
              <p className="mx-auto mt-4 max-w-[var(--measure-caption)] text-[length:var(--fs-3xs)] leading-[var(--lh-body)] text-[var(--t3)]">
                After the ₹299 consultation, if the full 3-month programme is the
                right next step, it is ₹15,000&ndash;₹30,000. Saying so now so
                nobody&rsquo;s time is wasted.
              </p>
            )}
            <p className="mx-auto mt-8 text-[length:var(--fs-3xs)] leading-[var(--lh-body)] text-[var(--t3)]">
              Individual results vary. Not a substitute for medical advice.
            </p>
          </div>
        </section>
      </div>

      <DecodeStickyCta fromTop />
    </main>
  );
}
