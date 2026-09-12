import type { Metadata } from "next";
import dynamic from "next/dynamic";
import HeroProofStrip from "@/app/components/HeroProofStrip";
import DeficitDiagram from "@/app/components/DeficitDiagram";
import DecodeStickyCta from "./DecodeStickyCta";

/**
 * /decode — the paid (Rs 299) report-reading offer.
 *
 * A SEPARATE ROUTE, DELIBERATELY NOT A COPY OF `/`.
 *
 * The free funnel on `/` books consultations at roughly Rs 1,000 each and is
 * the only thing in the account currently working. Putting a price on that page
 * would put it at risk, and the Meta custom-conversion split that keeps a
 * Rs 299 Purchase separate from a programme sale is a URL rule — so the two
 * offers need two URLs or the signals cannot be told apart.
 *
 * What it does share is COMPONENTS, not markup: HeroProofStrip, AbsolveBlock,
 * VideoTestimonial and CertificationsSection are imported, so the proof and the
 * "100+ thyroid women coached" claim have exactly one definition. Anything with
 * a CTA in it (SymptomChips) is left out on purpose — its button routes to the
 * free booking flow, which is the wrong destination from here.
 *
 * NO VSL, on purpose. Three reasons:
 *  - A video sells belief over 6-8 minutes; a Rs 299 decision does not need
 *    that much belief, and the page that asks for it loses her before she gets
 *    there.
 *  - `/` already pays for its VSL in weight: 803 kB of JS, and only 59% of ad
 *    clicks reached the page against 71% on a lighter route. The hero here is
 *    text and one ~4 kB inline SVG.
 *  - The VSL's actual job on this page is explaining ONE mechanism, and
 *    DeficitDiagram does that in about four seconds of looking, with nothing
 *    to shoot.
 *
 * Payment leg is ScheduleClient, unchanged and already live-tested: three
 * fields, lead captured BEFORE payment (so the unpaid-lead WhatsApp recovery
 * still fires), then the embedded Cashfree checkout at SESSION_PRICE.
 */

const AbsolveBlock = dynamic(() => import("@/app/components/AbsolveBlock"));
const VideoTestimonial = dynamic(() => import("@/app/components/VideoTestimonial"));
const CertificationsSection = dynamic(() => import("@/app/components/CertificationsSection"));
const TransformationWall = dynamic(() => import("@/app/components/TransformationWall"));
const WhatsappProofSection = dynamic(() => import("@/app/components/WhatsappProofSection"));

export const metadata: Metadata = {
  title: "Book your 1-1 Thyroid Consultation | Swapnil Umbarkar",
  description:
    "Book a 1-1 Thyroid Fat Loss Consultation for ₹299. Your own blood report read line by line to find the exact reason you are not losing weight even though you eat less.",
  // Ad traffic only. Indexing it would put it in competition with the main site.
  robots: { index: false, follow: false },
};

const AGENDA = [
  {
    n: "01",
    h: "Your report, read line by line",
    p: "TSH, T3, T4 and the ones most labs skip. Not just a check of whether each number is inside the range — where it sits inside that range. That is usually where the answer is hiding.",
  },
  {
    n: "02",
    h: "The month your body started burning less",
    p: "Worked out from your own numbers and your own diet history — not a copy-paste answer. You will see which diet it came after.",
  },
  {
    n: "03",
    h: "What is stopping you right now",
    p: "Told to you clearly, in simple words, with the reason shown — so you can check it against anything anyone tells you later.",
  },
  {
    n: "04",
    h: "What to do about it",
    p: "Written down before we finish, whether you ever work with me or not.",
  },
];

// The three pillars, in the order they are worked. Names are the documented
// ones (docs/business-handover.md §1 "Method"); the bodies are the owner's
// 12-Sep brief. The section exists because a named method is what turns a
// service into a system — and the name appeared nowhere on this page at all,
// while it is on every ad creative pointing at it.
const PILLARS = [
  {
    n: "1",
    name: "Fix the Root",
    body:
      "Your blood work read properly: TSH, T3, T4, D3, B12, iron. Find the deficiency or conversion problem the tablet was never going to solve.",
  },
  {
    n: "2",
    name: "Fuel the Body",
    body:
      "Ordinary Indian home food, built to support thyroid function instead of starving it. No imported ingredients. Your family eats the same meal.",
  },
  {
    n: "3",
    name: "Flow into Fitness",
    body:
      "Low-impact and joint-safe. Walking and bodyweight progression, not two-hour gym sessions you will abandon in week two.",
  },
] as const;

// Self-qualification, placed immediately before the last CTA. Lead quality is
// the constraint the business actually runs into — 7 client slots a month and
// 60-minute calls — so a visitor who rules herself out here costs nothing,
// while the same woman ruling herself out after paying Rs 299 costs an hour.
//
// TWO LINES ARE DELIBERATELY ABSENT and must not be added back:
//  - "if you cannot invest Rs 15,000" — on the recorded calls the LOWEST price
//    quoted did not close and the highest closed twice. Price does not predict
//    the buyer here, so it must not be built into the filter.
//  - "you must be the decision-maker" — the quiz asks this far more softly
//    (lib/decision-maker.ts). On the page it would lose qualified women whose
//    only sin is talking to their family first.
const FOR_YOU = [
  "You have been diagnosed hypothyroid and take the tablet, but the weight has not moved in two years or more",
  "Your report says normal and your body says otherwise",
  "You have already paid someone else to fix this at least once",
  "You want the reason, not another diet chart",
  "You are ready to start within the next 30 days",
] as const;

const NOT_FOR_YOU = [
  "You want to lose weight fast for an event",
  "You are not willing to get blood work done — the whole method starts there",
  "You only want a diet chart emailed to you",
  "You are not ready to start for a few months yet",
] as const;

// Task 6 of the 12-Sep brief, built and deliberately left OFF.
//
// Naming the Rs 15,000-30,000 programme band under the hero CTA will REDUCE
// Rs 299 volume, which is the intent — the constraint is 7 slots and 60-minute
// calls, not fee revenue. But the quiz gates (commitment follow-up, timing
// gate) shipped on 12-Sep and move the same number this line moves: quiz
// starts / landing-page views. Shipped in the same window, neither change can
// be attributed to anything. Flip to true on or after 26-Sep-2026, once the
// gates have had their two weeks.
const SHOW_PROGRAMME_PRICE = false;

const FAQ = [
  {
    q: "Is ₹299 the whole cost?",
    a: "Yes. That is the full cost. Nothing extra is added at the end.",
  },
  {
    q: "I don’t have a blood report. Is this not for me?",
    a: "You are still welcome — just answer the questions above. If you have no report, I will not take ₹299 to read one that does not exist. Instead you get a free call where I tell you exactly which tests to get and why. Do them, and then we read them together.",
  },
  {
    q: "Is this a sales call in disguise?",
    a: "No. You get the reading of your report either way. If a full programme really suits your case I will say so and show you what it looks like — but you will not be asked to decide anything on the call.",
  },
  {
    q: "I am already on thyroid medication. Does that change it?",
    a: "No. Most women I see are on it. Just bring your dose and how long you have been taking it — both change how the numbers should be read.",
  },
  {
    q: "Who is actually on the call?",
    a: "Me. Not an assistant, not a sales team. Sixty minutes, one to one.",
  },
];

export default function DecodePage() {
  return (
    // theme-decode re-skins every CTA on this page to the red of the creatives
    // that send it traffic (#c8102e). It is a scoped token override in
    // globals.css, NOT a site-wide change: `/` runs the free funnel off
    // different ads and keeps its green button.
    <main className="theme-decode">
      {/* ── Hero: the paradox, the promise, and nothing else ────────────── */}
      <section className="bg-[var(--bg-page)]">
        <div className="container-default mx-auto w-full max-w-[900px] px-4 pb-10 pt-12 text-center md:px-6 md:pb-14 md:pt-16">
          <p
            className="mb-5 inline-block rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.1em]"
            style={{
              background: "var(--accent-wash)",
              color: "var(--accent-ink)",
              border: "1px solid var(--accent-yellow)",
            }}
          >
            The T.H.Y.R.O.I.D. Lean Method &middot; for women 30+ with a slow
            thyroid
          </p>

          <h1
            className="mx-auto max-w-[760px] text-balance text-[length:var(--text-xl)] font-bold leading-[1.12] text-[var(--t1)]"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            Eating less. And still not losing weight.
            <span className="block" style={{ color: "var(--p600)" }}>
              You are not the problem. Your report will show why.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-[620px] text-[16px] leading-[1.62] text-[var(--t2)] md:text-[17.5px]">
            This is not about willpower. When you eat less for a long time, a
            slow thyroid makes your body burn less too. So the gap you made
            closes. <strong>Your blood report can show the exact reason</strong>{" "}
            &mdash; but almost nobody reads it that way.
          </p>

          {/* The guarantee, on the page for the first time.
              It has always existed — docs/business-handover.md §1 records it
              verbatim as a term of the offer — but it was only ever SAID, on
              the call, which means it could only reassure someone who had
              already paid to get there. Above the CTA, above the fold, because
              it is the sentence that makes Rs 299 feel like a test rather than
              a bet.

              The second paragraph is the refund term, quoted from that file
              and not reworded. Nothing open-ended is promised: an
              "I'll keep coaching you free until it works" clause cannot be
              honoured at 7 clients a month, so it is not offered. */}
          <div
            className="mx-auto mt-7 max-w-[620px] rounded-r-2xl px-5 py-4 text-left"
            style={{
              background: "var(--accent-wash)",
              borderLeft: "4px solid var(--accent-yellow)",
            }}
          >
            <p className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--accent-ink)]">
              My commitment to you
            </p>
            <p className="mb-0 mt-2 text-[14.5px] leading-[1.6] text-[#14110f]">
              On the call I read your report line by line and tell you exactly
              what is blocking your weight. You get that written down before we
              finish &mdash; whether or not you ever work with me.
            </p>
            <p className="mb-0 mt-2 text-[14.5px] font-semibold leading-[1.6] text-[#14110f]">
              Leave the call without knowing your blocker and the ₹299 is
              refunded.
            </p>
          </div>

          <div className="mt-7 flex flex-col items-center">
            <a
              href="/decode/quiz"
              className="cta-button"
              style={{ maxWidth: "24rem", textDecoration: "none" }}
            >
              Book my 1-1 Thyroid Consultation
              <span className="cta-sub">₹299 &middot; 12 questions, then pick your slot</span>
            </a>
            <p className="mt-3 text-[13px] text-[var(--t3)]">
              No report yet? Answer anyway &mdash; I will tell you what to do next.
            </p>
            {SHOW_PROGRAMME_PRICE && (
              <p className="mx-auto mt-2 max-w-[42ch] text-[13px] leading-[1.55] text-[var(--t3)]">
                After the ₹299 consultation, if the full 3-month programme is
                the right next step, it is ₹15,000&ndash;₹30,000. Saying so now
                so nobody&rsquo;s time is wasted.
              </p>
            )}
          </div>

          <HeroProofStrip />
        </div>
      </section>

      {/* ── The argument. This replaces the VSL. ────────────────────────── */}
      <DeficitDiagram />

      {/* ── Move the cause off her before asking for anything ───────────── */}
      <AbsolveBlock />

      {/* ── What the money actually buys ────────────────────────────────── */}
      <section className="bg-[var(--bg-page)]" aria-labelledby="agenda-heading">
        <div className="mx-auto w-full max-w-[900px] px-4 py-10 md:px-6 md:py-14">
          <header className="mb-8 text-center">
            <p className="section-label">No surprises</p>
            <h2 id="agenda-heading" className="section-title mx-auto text-balance">
              What happens in the 60 minutes
            </h2>
          </header>

          <ol className="grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
            {AGENDA.map((a) => (
              <li
                key={a.n}
                className="rounded-2xl bg-white p-4 md:p-6"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div
                  className="mb-2.5 text-[12px] font-bold tracking-[0.1em]"
                  style={{ color: "var(--p600)", fontFamily: "var(--font-mono)" }}
                >
                  {a.n}
                </div>
                <div className="mb-2 text-[17.5px] font-semibold leading-[1.35] text-[var(--t1)]">
                  {a.h}
                </div>
                <p className="m-0 text-[14.5px] leading-[1.6] text-[var(--t2)]">{a.p}</p>
              </li>
            ))}
          </ol>

          {/* Said here, before payment, on purpose: she is buying a reading,
              and being pitched without warning at minute 40 is the fastest way
              to make a paid session feel like a bait. */}
          <p
            className="mx-auto mt-7 max-w-[680px] rounded-2xl px-5 py-4 text-center text-[14.5px] leading-[1.6] text-[var(--t2)]"
            style={{ background: "var(--p-tint)", border: "1px solid var(--p-border)" }}
          >
            If a full programme turns out to be the right next step for you, I
            will show you what it looks like. You will not be asked to decide
            anything on the call.
          </p>
        </div>
      </section>

      {/* ── The named method ────────────────────────────────────────────
          Three mentions on this page and no more: the hero eyebrow, this
          section, and the credentials label. The competitor page benchmarked
          on 12-Sep repeats its own acronym about fifteen times, which is
          worse than useless — but zero, which is what this page had, is worse
          still. A method is what makes the PROGRAMME the thing being bought
          rather than whichever plan an individual coach happens to write. */}
      <section className="bg-[var(--bg-elevated)]" aria-labelledby="method-heading">
        <div className="mx-auto w-full max-w-[900px] px-4 py-10 md:px-6 md:py-14">
          <header className="mb-8 text-center">
            <p className="section-label">The method</p>
            <h2 id="method-heading" className="section-title mx-auto text-balance">
              The T.H.Y.R.O.I.D. Lean Method
            </h2>
            <p className="mx-auto mt-3 max-w-[34ch] text-[14.5px] leading-[1.6] text-[var(--t3)]">
              Three pillars. They only work in this order.
            </p>
          </header>

          <ol className="grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <li
                key={pillar.n}
                className="rounded-2xl bg-white p-5 md:p-6"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <span
                  aria-hidden="true"
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-full text-[17px] font-extrabold"
                  style={{
                    background: "var(--accent-yellow)",
                    color: "#14110f",
                  }}
                >
                  {pillar.n}
                </span>
                <h3 className="mb-2 text-[17.5px] font-semibold leading-[1.35] text-[var(--t1)]">
                  {pillar.name}
                </h3>
                <p className="m-0 text-[14.5px] leading-[1.6] text-[var(--t2)]">
                  {pillar.body}
                </p>
              </li>
            ))}
          </ol>

          {/* The order IS the argument. Without this paragraph the three cards
              are just a table of contents. */}
          <p
            className="mx-auto mt-7 max-w-[680px] rounded-2xl px-5 py-4 text-[14.5px] leading-[1.62] text-[var(--t2)]"
            style={{ background: "var(--accent-wash)", border: "1px solid var(--accent-yellow)" }}
          >
            <strong className="text-[var(--t1)]">Why the order matters:</strong>{" "}
            every plan you were handed before started at Pillar 2. A diet given
            to a suppressed metabolism is built on a wrong assumption from its
            first line &mdash; which is exactly why it worked for six weeks and
            then stopped.
          </p>
        </div>
      </section>

      {/* The quiz lives on its own page (/decode/quiz) so nothing on this one
          competes with it once she has decided to start. Every CTA here goes
          there. */}

      {/* Proof after the ask, in the reference build's order. The wall is
          CTA-free; the WhatsApp block drops its button here so it cannot hand
          paid-intent traffic to the free booking flow. */}
      <div className="band-deep">
        <TransformationWall />
      </div>
      <WhatsappProofSection hideCta />
      <VideoTestimonial />
      <CertificationsSection label="Behind the T.H.Y.R.O.I.D. Lean Method" />

      {/* ── Objections specific to a paid reading ───────────────────────── */}
      <section className="bg-[var(--bg-page)]" aria-labelledby="faq-heading">
        <div className="mx-auto w-full max-w-[760px] px-4 py-10 md:px-6 md:py-14">
          <header className="mb-7 text-center">
            <p className="section-label">Before you pay</p>
            <h2 id="faq-heading" className="section-title mx-auto text-balance">
              The fair questions
            </h2>
          </header>

          <div className="flex flex-col gap-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl bg-white px-5 py-4"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <summary className="cursor-pointer list-none text-[16px] font-semibold leading-[1.4] text-[var(--t1)] marker:content-none">
                  {f.q}
                </summary>
                <p className="mb-0 mt-2.5 text-[14.5px] leading-[1.62] text-[var(--t2)]">
                  {f.a}
                </p>
              </details>
            ))}
          </div>

        </div>
      </section>

      {/* ── Self-qualification, then the last CTA ───────────────────────── */}
      <section className="bg-[var(--bg-elevated)]" aria-labelledby="fit-heading">
        <div className="mx-auto w-full max-w-[900px] px-4 py-10 md:px-6 md:py-14">
          <header className="mb-8 text-center">
            <p className="section-label">Before you book</p>
            <h2 id="fit-heading" className="section-title mx-auto text-balance">
              Who this is for
            </h2>
          </header>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              className="rounded-2xl bg-white p-5 md:p-6"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h3 className="mb-3 mt-0 text-[17.5px] font-semibold leading-[1.35] text-[var(--t1)]">
                This is for you if
              </h3>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {FOR_YOU.map((line) => (
                  <li
                    key={line}
                    className="relative pl-6 text-[14.5px] leading-[1.6] text-[var(--t2)]"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-[0.45em] h-2.5 w-2.5 rounded-full"
                      style={{ background: "var(--accent-yellow)" }}
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="rounded-2xl bg-white p-5 md:p-6"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h3 className="mb-3 mt-0 text-[17.5px] font-semibold leading-[1.35] text-[var(--t1)]">
                This is not for you if
              </h3>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {NOT_FOR_YOU.map((line) => (
                  <li
                    key={line}
                    className="relative pl-6 text-[14.5px] leading-[1.6] text-[var(--t3)]"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-[0.62em] h-[2px] w-3 rounded-full"
                      style={{ background: "var(--t5)" }}
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-9 text-center">
            <a
              href="/decode/quiz"
              className="cta-button"
              style={{ maxWidth: "24rem", textDecoration: "none" }}
            >
              Book my 1-1 Thyroid Consultation
              <span className="cta-sub">₹299 &middot; 12 questions, then pick your slot</span>
            </a>
          </div>
        </div>
      </section>

      <DecodeStickyCta />
    </main>
  );
}
