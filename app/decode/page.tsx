import type { Metadata } from "next";
import dynamic from "next/dynamic";
import HeroProofStrip from "@/app/components/HeroProofStrip";
import HeroVideo from "@/app/components/HeroVideo";
import { PILLARS } from "@/app/components/PillarsSection";
import DecodeStickyCta from "./DecodeStickyCta";
import CoachIntro from "./CoachIntro";
import HashimotoProof from "@/app/components/HashimotoProof";

/**
 * /decode — the FREE 1-1 consultation offer. Ad traffic only.
 *
 * The ₹299 came off the cold path on 23-Sep-2026 (owner). It is bypassed, not
 * deleted: /schedule and /complete-payment still charge, for anyone who
 * genuinely owes money. See app/decode/DecodeQuiz.tsx for what changed in the
 * booking flow and why.
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
 *   1 hero (white) ...... headline, the why, proof strip, button, refund line, video
 *   2 symptoms .......... six lines, tap the true ones
 *   3 proof ............. before/afters · video stories · WhatsApp screenshots
 *   4 meet your coach ... the owner's own words
 *   5 the method ........ the three pillars
 *   6 what you get ...... three lines, then how booking works in three steps
 *   7 who this is for ... five checkmarks
 *   8 FAQ ............... three one-line answers
 *   9 last button
 *
 * Unchanged, and must stay so: every button goes to /decode/quiz with the ad's
 * own label; the proof claim is "100+"; testimonial words are verbatim. (The
 * ₹299 and its refund sentence were in this list until 23-Sep. The call is free
 * now, so the price is gone and the refund promise is reworded, deliberately.)
 *
 * COMPLIANCE FLOOR (22-Sep, Events Manager gave this domain 20 days before its
 * data is blocked under Meta's health terms). Two rules for this hero now:
 *   - No sentence may tell the reader she has a thyroid condition. Describe the
 *     situation or describe clients, never diagnose the visitor. That is Meta's
 *     personal-attributes standard and it is enforced on ad copy and landing
 *     page alike.
 *   - No kilogram figure and no timeframe in a promise. Meta prohibits
 *     "promises of specific outcomes within a set timeframe without disclaimers
 *     or qualifiers". Client cards may state what a named client actually did,
 *     because TransformationWall carries the results-vary qualifier.
 * Both rules were broken by the 15-17 Sep hero, which is what this revision
 * undoes. Owner may override, but not by accident.
 *
 * OVERRIDE, 23-Sep-2026: he did, deliberately, twice, after being shown the
 * Events Manager deadline both times. The headline carries "Lose 10+ kg … In 90
 * Days" again, and the qualifier directly under it is what keeps the claim
 * inside Meta's rule — the standard bans the promise "without disclaimers or
 * qualifiers". The personal-attributes rule above is NOT overridden: no
 * sentence here tells the reader she has a thyroid condition.
 */

const VideoTestimonial = dynamic(() => import("@/app/components/VideoTestimonial"));
const TransformationWall = dynamic(() => import("@/app/components/TransformationWall"));
const WhatsappProofSection = dynamic(() => import("@/app/components/WhatsappProofSection"));

export const metadata: Metadata = {
  title: "Book your 1-1 Thyroid Consultation | Swapnil Umbarkar",
  description:
    "Book a free 1-1 Thyroid Fat Loss Consultation. Your own blood report read line by line to find the exact reason you are not losing weight even though you eat less.",
  // Ad traffic only. Indexing it would put it in competition with the main site.
  robots: { index: false, follow: false },
};

// Mirrors the video ad (17-Sep): she was promised a Root Cause Map, her
// report read, and what the next 90 days should look like.
const GET = [
  "Your Root Cause Map: your biggest fat-loss blocker, in simple words",
  "Your report read line by line: TSH, T3, T4, and antibodies if you have them",
  "What your next 90 days should look like, with real Indian food and no starving",
] as const;

const STEPS = [
  { h: "Fill your intake form", p: "12 quick taps about your report and what you have tried. I read it before we speak." },
  { h: "Pick your slot", p: "No card, no payment. Choose a time that suits you." },
  { h: "We talk", p: "Sixty minutes, one to one, on a video call." },
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
  { q: "Is it really free?", a: "Yes. No card, nothing to pay on the call, nothing added at the end." },
  {
    q: "No blood report yet?",
    a: "Answer the questions anyway. On the call I tell you exactly which tests to get and why, and we work from your answers until the results are in.",
  },
  { q: "Who is on the call?", a: "Me. Not an assistant, not a sales team. Sixty minutes, one to one." },
] as const;

// Built and deliberately left OFF until 26-Sep-2026 (quiz gates first need two
// clean weeks). Renders at the last button only.
const SHOW_PROGRAMME_PRICE = false;

/**
 * WHY NOTHING HAS WORKED (23-Sep). This slot held SymptomChips: six symptom
 * lines with tick boxes. It was cut for one reason — by the time she is on this
 * page the ad has already read her symptoms back to her, and the quiz asks them
 * again two taps later, where ticking them earns a score. Ticking them here
 * earned nothing, and the objection that actually stops her booking is not
 * "is something wrong with me" but "I have tried five things already".
 *
 * So the slot answers that instead, and it carries the one line from the video
 * that was nowhere on the page: thyroid fat loss is not normal fat loss.
 *
 * The left column is what she has already been handed, in her words from the
 * recorded calls. The right column is only what this programme actually does —
 * every line is a deliverable, not a claim, so nothing here needs a qualifier.
 * SymptomChips itself stays on the homepage, where she arrives cold.
 */
const COMPARE_OLD = [
  "Eat less, walk 10,000 steps",
  "The same calorie chart as everyone else",
  "Your report never opened",
  "Cut out rice and roti",
  "Blamed when the scale does not move",
  "A new diet every time the last one stops",
] as const;

const COMPARE_NEW = [
  "Your blood report read line by line, first",
  "Food built around what your report shows",
  "Roti, dal, sabzi, curd \u2014 nothing banned",
  "Joint-friendly training, 30\u201340 minutes",
  "Weekly check-ins on energy, sleep and bloating, not just the scale",
  "A repeat blood test at the end, so the markers move too",
] as const;

function Cross() {
  return (
    <span
      aria-hidden="true"
      className="mt-[2px] flex h-5 w-5 flex-none items-center justify-center rounded-full"
      style={{ background: "rgba(220,52,52,0.16)" }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12">
        <path d="M2 2l8 8M10 2l-8 8" fill="none" stroke="#ff6b6b" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Tick() {
  return (
    <span
      aria-hidden="true"
      className="mt-[2px] flex h-5 w-5 flex-none items-center justify-center rounded-full"
      style={{ background: "rgba(255,201,30,0.16)" }}
    >
      <svg width="11" height="11" viewBox="0 0 12 12">
        <path d="M2 6.4l2.6 2.6L10 3" fill="none" stroke="#ffc91e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function CompareColumn({
  tag, tagColor, tagBg, borderColor, title, lines, good,
}: {
  tag: string; tagColor: string; tagBg: string; borderColor: string;
  title: string; lines: readonly string[]; good: boolean;
}) {
  return (
    <article
      className="rounded-2xl p-5 md:p-7"
      style={{
        border: `1px solid ${borderColor}`,
        background: good
          ? "linear-gradient(180deg, rgba(255,201,30,0.05) 0%, rgba(255,255,255,0.02) 45%)"
          : "rgba(255,255,255,0.02)",
      }}
    >
      <p
        className="m-0 inline-block rounded-md px-2.5 py-1 text-[length:var(--fs-3xs)] font-bold tracking-[var(--ls-caps)]"
        style={{ color: tagColor, background: tagBg }}
      >
        {tag}
      </p>
      <h3 className="mb-0 mt-3 text-[length:var(--fs-lg)] font-bold leading-[var(--lh-tight)] text-white">
        {title}
      </h3>
      <ul className="mt-5 flex list-none flex-col gap-3.5 p-0">
        {lines.map((line) => (
          <li
            key={line}
            className="flex gap-3 text-[length:var(--fs-2xs)] leading-[var(--lh-body)]"
            style={{ color: good ? "var(--t1)" : "var(--t2)" }}
          >
            {good ? <Tick /> : <Cross />}
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function CompareSection() {
  return (
    <section className="px-4 py-12 md:px-6 md:py-16" aria-labelledby="compare-why-heading">
      <div className="mx-auto w-full max-w-[880px]">
        <header className="text-center">
          <p className="section-label">Why nothing has worked</p>
          <h2 id="compare-why-heading" className="section-title mx-auto text-balance">
            Normal fat loss and <span className="decode-gold">thyroid fat loss</span> are not the same thing
          </h2>
        </header>

        <div className="mt-8 grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-5">
          <CompareColumn
            tag="EVERY OTHER PLAN"
            tagColor="#ff8a8a"
            tagBg="rgba(220,52,52,0.14)"
            borderColor="rgba(220,52,52,0.35)"
            title="What you have been handed"
            lines={COMPARE_OLD}
            good={false}
          />

          <div className="flex items-center justify-center md:px-1">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full text-[length:var(--fs-3xs)] font-bold tracking-[var(--ls-caps)] text-[var(--t2)]"
              style={{ border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)" }}
            >
              VS
            </span>
          </div>

          <CompareColumn
            tag="THE THYROID WAY"
            tagColor="#ffc91e"
            tagBg="rgba(255,201,30,0.14)"
            borderColor="rgba(255,201,30,0.5)"
            title="What we do instead"
            lines={COMPARE_NEW}
            good
          />
        </div>
      </div>
    </section>
  );
}

function BookButton() {
  return (
    <a
      href="/decode/quiz"
      className="cta-button mx-auto"
      style={{ maxWidth: "24rem", textDecoration: "none" }}
    >
      Book my 1-1 Thyroid Consultation
      <span className="cta-sub">Free &middot; 60-min Thyroid Root Cause Session</span>
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
            For Indian women 28+ who are doing everything right and still feel stuck
          </p>
          <h1
            className="mx-auto mt-3 max-w-[680px] text-balance text-[length:var(--fs-2xl)] font-bold leading-[var(--lh-display)] text-[#0b1120]"
            style={{ fontFamily: "var(--font-body), Inter, system-ui, sans-serif" }}
          >
            {/* Was "You're Not The Problem. Your Thyroid Is." — the 17-Sep video
                hook, word for word. Replaced 22-Sep: it tells the reader she has
                a thyroid condition, which is exactly what Meta's personal
                attributes standard prohibits, and it is the kind of line feeding
                the health-classification warning now open on this domain
                (Events Manager, 20-Sep: data blocked in 20 days). The insight
                survives without diagnosing her. If the video ad is re-cut, its
                hook should follow this line rather than the reverse. */}
            {/* PROMISE + GUARANTEE (owner, 23-Sep). Structure borrowed from the
                page this one is benchmarked against: who it is for, one promise,
                then the guarantee that removes the risk of believing it.

                What is deliberately NOT here: the word hypothyroidism aimed at
                the reader, and any kilogram figure. The owner asked for "Lose
                10+ kg in 90 days" and for "women managing hypothyroidism"; both
                were the exact sentences that put this domain in front of Meta's
                health reviewers (Events Manager, 20-Sep). The promise is
                therefore stated as what coaching can honestly move — metabolism,
                energy, strength — and the guarantee carries the weight the
                kilogram figure used to. */}
            I&rsquo;ll Help You Lose 10+ kg, Improve Your Metabolism &amp; Energy Levels In 90 Days
          </h1>

          <p className="mx-auto mt-4 text-[length:var(--fs-base)] font-bold leading-[var(--lh-tight)] md:text-[length:var(--fs-lg)]" style={{ color: "#dc3434" }}>
            Or I&rsquo;ll Keep Coaching You Free Until You Get There.
          </p>

          {/* The qualifier is not decoration. Meta's Health and Wellness standard
              prohibits promises of a specific outcome within a set timeframe
              "without disclaimers or qualifiers"; the headline above is exactly
              such a promise, by the owner's decision on 23-Sep, so this line is
              what keeps it inside the rule. It stays directly under the claim,
              visible, never in a footer. Remove the kilogram figure or remove
              nothing. */}
          <p className="mx-auto mt-2 max-w-[560px] text-[length:var(--fs-3xs)] leading-[var(--lh-body)] text-[var(--t3)]">
            Individual results vary with your starting point, consistency and medical history.
          </p>

          <p className="mx-auto mt-4 max-w-[600px] text-[length:var(--fs-xs)] leading-[var(--lh-body)] text-[var(--t2)] md:text-[length:var(--fs-base)]">
            My <strong className="text-[#0b1120]">Scientific Thyroid Lean Method</strong> starts with
            your own blood report, read line by line, then home-cooked Indian food and joint-friendly
            training that fits a working day. No crash diets, no starving.
          </p>

          {/* FOLD ORDER, reset 22-Sep from Microsoft Clarity (14 days to 21-Sep).
              45% of mobile visitors were gone by 10% of scroll depth, and the
              14-17 Sep redesign made that worse, not better: 37.84% gone before,
              51.67% after. The fold was seven stacked text blocks before there was
              anything to look at, on traffic that is 82% mobile and 70% Instagram
              or Facebook in-app browser.

              So: proof comes before the ask, the refund line moves under the
              button where it answers an objection instead of adding to the wall of
              text, and the video stays below the button so it cannot push the CTA
              down the page. Anything added to this hero in future goes BELOW the
              button, not above it. */}
          <HeroProofStrip claimsOnly />

          <div className="mt-6 flex flex-col items-center">
            <a
              href="/decode/quiz"
              className="cta-button"
              style={{ maxWidth: "24rem", textDecoration: "none" }}
            >
              Book my 1-1 Thyroid Consultation
              <span className="cta-sub">Free &middot; 60-min Thyroid Root Cause Session</span>
            </a>
            <p className="mx-auto mt-3 max-w-[420px] text-[length:var(--fs-3xs)] leading-[var(--lh-body)] text-[var(--t2)]">
              Every case is personally reviewed before the call. Limited slots each week.
            </p>
            {/* The refund line was this page's strongest risk-reversal sentence
                and it was quoted, never reworded. With nothing to refund it is
                meaningless, so it is replaced rather than deleted: the promise
                it made was "you will not leave empty-handed", and that still
                stands. Do not reinstate the ₹299 wording while the call is
                free. */}
            <p className="mx-auto mt-3 max-w-[560px] text-[length:var(--fs-2xs)] font-bold leading-[var(--lh-body)] text-[#0b1120]">
              No card, nothing to pay. Come with your report and leave knowing your blocker.
            </p>
            {/* The one line that reframes the whole offer, moved below the button
                on 23-Sep: the fold rule from Clarity is that nothing new goes
                above the CTA. It answers "my reports are normal, why would a call
                help", which is the objection the ad traffic arrives with. */}
            <p className="mx-auto mt-4 text-[length:var(--fs-xs)] font-bold leading-[var(--lh-tight)] text-[#0b1120] md:text-[length:var(--fs-base)]">
              <span className="rounded-md px-2 py-1" style={{ background: "#ffe98a", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
                A &ldquo;normal&rdquo; report is not the same as a thyroid that is working.
              </span>
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
        </div>
      </section>

      {/* Everything after the hero sits on the near-black band. */}
      <div className="band-deep">
        {/* ── 2. Why nothing has worked (was SymptomChips) ─────────────── */}
        <CompareSection />

        {/* ── 3. Proof ─────────────────────────────────────────────────── */}
        <TransformationWall compact />
        <ButtonRow />
        <VideoTestimonial compact />
        <HashimotoProof />
        {/* The Hashimoto's reader is at her most convinced right here: she came
            looking for someone who works with her condition and has just been
            told, plainly, what will and will not change. Without a button she
            has to scroll past the screenshots to find one. */}
        <ButtonRow />
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
              <span className="cta-sub">Free &middot; 60-min Thyroid Root Cause Session</span>
            </a>
            <p className="mx-auto mt-4 text-[length:var(--fs-2xs)] text-[var(--t2)]">
              Free &middot; 60 minutes &middot; one to one with Swapnil
            </p>
            {SHOW_PROGRAMME_PRICE && (
              <p className="mx-auto mt-4 max-w-[var(--measure-caption)] text-[length:var(--fs-3xs)] leading-[var(--lh-body)] text-[var(--t3)]">
                After the consultation, if the full 3-month programme is the
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
