import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Image from "next/image";
import HeroProofStrip from "@/app/components/HeroProofStrip";
import DeficitDiagram from "@/app/components/DeficitDiagram";
import { CERTIFICATIONS } from "@/app/lib/authority";
import DecodeStickyCta from "./DecodeStickyCta";
import ShareWithFamily from "./ShareWithFamily";

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
 * What it does share is COMPONENTS, not markup: HeroProofStrip, SymptomChips,
 * AbsolveBlock, VideoTestimonial and the proof blocks are imported, so the
 * proof and the "100+ thyroid women coached" claim have exactly one definition.
 * Anything with a CTA in it renders with that CTA suppressed — those buttons
 * route to the FREE booking flow, which is the wrong destination from here and
 * would fire the wrong conversion event.
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
 * ── SECTION ORDER (owner's rule, 12-Sep-2026) ───────────────────────────────
 * Answer her questions in the order she asks them:
 *
 *   1 hero .................. is this about me?
 *   2 symptom checklist ..... how much of it is about me?
 *   3 the gap chart ......... why has nothing worked so far?
 *   4 you didn't fail ....... is it my fault?
 *   5 the diets comparison .. why is this different?
 *   6 proof ................. does it work on people like me?
 *   7 credentials ........... who is this man?
 *   8 the 60 minutes ........ what exactly do I get for Rs 299?
 *   9 who this is for ....... am I right for it?
 *  10 FAQ ................... is there a catch?
 *  11 share with family ..... how do I explain this at home?
 *  12 final CTA ............. I'll book.
 *
 * The agenda USED to sit above the proof. That was backwards: she does not
 * care what happens in the 60 minutes until she believes the 60 minutes work.
 * Process detail only matters to someone already convinced.
 *
 * ── LENGTH ──────────────────────────────────────────────────────────────────
 * The page carried twenty-two separate proof units. A woman deciding on a
 * Rs 299 call is convinced by about six, or she is gone by about six — past
 * that, proof stops persuading and starts tiring. The WhatsApp gallery is
 * capped at three here and the certificates are one line instead of four
 * cards. The transformations and the video testimonials are NOT cut (owner's
 * call): they are the proof that carries faces and voices.
 *
 * Nothing was shortened on the ARGUMENT side. The gap chart, the absolve
 * block, the comparison and the FAQ are the reason a sceptical buyer believes
 * the mechanism, and cutting length out of them would cost sales rather than
 * scroll.
 *
 * Payment leg is ScheduleClient, unchanged and already live-tested: three
 * fields, lead captured BEFORE payment (so the unpaid-lead WhatsApp recovery
 * still fires), then the embedded Cashfree checkout at SESSION_PRICE.
 */

const AbsolveBlock = dynamic(() => import("@/app/components/AbsolveBlock"));
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

// The one comparison on the page.
//
// There were two drafted — a "method vs other methods" table and this one.
// This one survives because it does a second job the other cannot: it moves
// the blame off her. "You did not choose four wrong diets" is a different
// sentence from "my method is better", and it is the one she has never heard.
// The method's actual argument (start at the report, not the plate) arrives
// inside it for free, on the right-hand column, without a separate section.
const COMPARISON = [
  {
    them: "Starts with a food list.",
    us: "Starts with your blood report.",
  },
  {
    them: "Assumes your metabolism is working normally.",
    us: "Checks whether it is: TSH, T3, T4, D3, B12, iron.",
  },
  {
    them: "When the weight stalls, cuts the food further.",
    us: "When the weight stalls, finds out why before touching your food.",
  },
  {
    them: "The same plan for everyone with a thyroid problem.",
    us: "Built around what your own numbers say is blocked.",
  },
  {
    them: "Works for about six weeks.",
    us: "Is built to still hold in month three.",
  },
] as const;

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
    // Was "whether you ever work with me or not". That sentence was written to
    // sound generous and did the opposite of its job: it told her the plan was
    // hers to take and leave, which is a reason NOT to buy, and it was one of
    // the two lines the owner identified as costing him closes on the call.
    // What replaces it keeps the whole promise — she leaves with it in writing
    // — without arguing against the programme in the same breath.
    p: "Written down before we finish, so you can start acting on it that same day.",
  },
];

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
//    (lib/decision-maker.ts), and the section above it now hands her the words
//    to take home instead. On the page it would lose qualified women whose
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
// Naming the Rs 15,000-30,000 programme band will REDUCE Rs 299 volume, which
// is the intent — the constraint is 7 slots and 60-minute calls, not fee
// revenue. But the quiz gates (commitment follow-up, timing gate) shipped on
// 12-Sep and move the same number this line moves: quiz starts / landing-page
// views. Shipped in the same window, neither change can be attributed to
// anything. Flip to true on or after 26-Sep-2026, once the gates have had
// their two weeks. It renders at the FINAL CTA, not the hero — by then she has
// read the case, so the number reads as candour rather than as a price tag
// hung on the door.
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
    // Second of the two lines the owner flagged. It used to end "but you will
    // not be asked to decide anything on the call" — which pre-authorises "let
    // me think about it" in his own words, and then makes any actual ask feel
    // like a broken promise. The honest version keeps the part that earns
    // trust (the reading happens either way, nothing is held back) and drops
    // the part that forbids him from closing.
    a: "No. You get the reading of your report either way. If a full programme really suits your case I will say so, show you exactly what it involves and what it costs, and ask you what you would like to do. You will not be pressured, and nothing is kept hidden until the end.",
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
      {/* ── 1. Hero — "is this about me?" ────────────────────────────────── */}
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

          {/* The guarantee, on the page rather than only on the call.
              It has always been a term of the offer — docs/business-handover.md
              §1 records it verbatim — but it was only ever SAID, which means it
              could only reassure someone who had already paid to get there.
              Above the CTA, above the fold, because it is the sentence that
              makes Rs 299 feel like a test rather than a bet.

              The refund term is quoted from that file and not reworded.
              Nothing open-ended is promised: an "I'll keep coaching you free
              until it works" clause cannot be honoured at 7 clients a month,
              so it is not offered. */}
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
              what is blocking your weight. You get it written down before we
              finish, so you can start acting on it that same day.
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
          </div>

          {/* The 100+ claim only. The four client quotes under it were the
              weakest four of the page's twenty-two proof units — an initial, a
              name and a number, sitting above four transformation composites
              that say the same thing with faces. */}
          <HeroProofStrip claimsOnly />
        </div>
      </section>

      {/* ── 2. "How much of it is about me?" ─────────────────────────────── */}
      <SymptomChips hideCta />

      {/* ── 3. "Why has nothing worked so far?" — replaces the VSL ───────── */}
      <DeficitDiagram />

      {/* ── 4. "Is it my fault?" ─────────────────────────────────────────── */}
      <AbsolveBlock />

      {/* ── 5. "Why is this different?" ──────────────────────────────────── */}
      <section className="bg-[var(--bg-elevated)]" aria-labelledby="compare-heading">
        <div className="mx-auto w-full max-w-[900px] px-4 py-10 md:px-6 md:py-14">
          <header className="mb-8 text-center">
            <p className="section-label">The difference</p>
            <h2 id="compare-heading" className="section-title mx-auto text-balance">
              You did not choose four wrong diets
            </h2>
            <p className="mx-auto mt-3 max-w-[40ch] text-[14.5px] leading-[1.6] text-[var(--t3)]">
              All four made the same mistake. They started at your plate.
            </p>
          </header>

          {/* A two-column table on desktop, stacked pairs on mobile. Not a
              <table>: on a 375px screen a real table either scrolls sideways
              or crushes both columns to three words a line. */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {COMPARISON.map((row) => (
              <div
                key={row.them}
                className="rounded-2xl bg-white p-4"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <p className="m-0 text-[14px] leading-[1.55] text-[var(--t3)] line-through decoration-[var(--t5)] decoration-1">
                  {row.them}
                </p>
                <p className="mb-0 mt-2 text-[14.5px] font-semibold leading-[1.55] text-[var(--t1)]">
                  {row.us}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <div className="grid grid-cols-2 gap-4">
              <p className="m-0 pb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--t4)]">
                Every plan you have been given
              </p>
              <p className="m-0 pb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--accent-ink)]">
                What we do instead
              </p>
            </div>
            <div className="mt-2 flex flex-col gap-3">
              {COMPARISON.map((row) => (
                <div key={row.them} className="grid grid-cols-2 gap-4">
                  <p
                    className="m-0 rounded-2xl px-5 py-4 text-[14.5px] leading-[1.55] text-[var(--t3)]"
                    style={{ background: "var(--s1)", border: "1px solid var(--border-hairline)" }}
                  >
                    {row.them}
                  </p>
                  <p
                    className="m-0 rounded-2xl px-5 py-4 text-[14.5px] font-semibold leading-[1.55] text-[var(--t1)]"
                    style={{ background: "var(--accent-wash)", border: "1px solid var(--accent-yellow)" }}
                  >
                    {row.us}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="mx-auto mt-7 max-w-[62ch] text-center text-[14.5px] leading-[1.62] text-[var(--t2)]">
            A diet handed to a suppressed metabolism is built on a wrong
            assumption from its first line. That is why it worked for six weeks
            and then stopped &mdash; every time, for everybody.
          </p>
        </div>
      </section>

      {/* ── 6. "Does it work on people like me?" ─────────────────────────────
          Three proof formats, in descending order of how hard they are to
          fake: before/after composites, then screenshots she can read, then
          clients on camera. The WhatsApp gallery is capped at three — it was
          eight, and eight screenshots after four transformations is where the
          scroll started costing more than the proof was adding. */}
      <div className="band-deep">
        <TransformationWall />
      </div>
      <WhatsappProofSection hideCta limit={3} />
      <VideoTestimonial />

      {/* ── 7. "Who is this man?" ────────────────────────────────────────────
          One line and a logo strip, where there used to be four full cards
          with captions. The credentials are strong and they are worth naming,
          but naming is all this question needs at this point in the page —
          she is checking that he is qualified, not studying the certificates.
          The disclaimer stays: it is the one thing here that is not optional. */}
      <section className="bg-[var(--bg-page)]" aria-labelledby="credentials-heading">
        <div className="mx-auto w-full max-w-[900px] px-4 py-9 md:px-6 md:py-12">
          <h2
            id="credentials-heading"
            className="m-0 text-center text-[15px] font-bold uppercase leading-[1.5] tracking-[0.1em] text-[var(--t2)]"
          >
            ACE &middot; INFS &middot; AIHM Nutrition for Hashimoto&rsquo;s
            Thyroiditis &middot; AHA BLS
          </h2>

          {/* Four across at every width. Flex-wrap put three on one row and a
              lonely fourth underneath at 375px, which reads as an afterthought
              rather than a set. */}
          <ul
            className="mx-auto mt-5 grid max-w-[560px] list-none grid-cols-4 items-center gap-2 p-0 md:gap-6"
            aria-label="Certifications"
          >
            {CERTIFICATIONS.map((cert) => (
              <li key={cert.id} className="relative h-[46px] w-full md:h-[64px]">
                <Image
                  src={cert.image}
                  alt={cert.title}
                  fill
                  sizes="100px"
                  className="object-contain"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>

          <p className="mt-5 text-center text-[0.7rem] leading-relaxed text-[var(--t5)]">
            Credentials support your coaching. They are not a substitute for
            medical care.
          </p>
        </div>
      </section>

      {/* ── 8. "What exactly do I get for ₹299?" ─────────────────────────────
          Moved here from above the proof. She does not care what happens in
          the 60 minutes until she believes the 60 minutes work. */}
      <section className="bg-[var(--bg-elevated)]" aria-labelledby="agenda-heading">
        <div className="mx-auto w-full max-w-[900px] px-4 py-10 md:px-6 md:py-14">
          <header className="mb-8 text-center">
            {/* Second and last mention of the method name. The first is the
                hero eyebrow. A name gives the work an identity; a full
                three-pillar breakdown on a Rs 299 page is the programme's
                sales material, not this one's. */}
            <p className="section-label">The T.H.Y.R.O.I.D. Lean Method</p>
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
              to make a paid session feel like a bait.

              What it does NOT say any more is "you will not be asked to decide
              anything on the call". That line was meant to lower the stakes and
              instead handed her the exact sentence she needed to end the call
              without deciding. Warning her that an offer exists is what keeps
              the session honest; promising never to ask is a different thing,
              and it was costing the close. */}
          <p
            className="mx-auto mt-7 max-w-[680px] rounded-2xl px-5 py-4 text-center text-[14.5px] leading-[1.6] text-[var(--t2)]"
            style={{ background: "var(--p-tint)", border: "1px solid var(--p-border)" }}
          >
            If a full programme turns out to be the right next step for you, I
            will show you what it involves and what it costs, and ask what you
            would like to do. No pressure, and nothing kept back until the end.
          </p>
        </div>
      </section>

      {/* ── 9. "Am I right for this?" ────────────────────────────────────── */}
      <section className="bg-[var(--bg-page)]" aria-labelledby="fit-heading">
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
        </div>
      </section>

      {/* ── 10. "Is there a catch?" ──────────────────────────────────────── */}
      <section className="bg-[var(--bg-elevated)]" aria-labelledby="faq-heading">
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

      {/* ── 11. "How do I explain this at home?" ─────────────────────────── */}
      <ShareWithFamily />

      {/* ── 12. The last CTA ─────────────────────────────────────────────── */}
      <section className="bg-[var(--bg-elevated)]">
        <div className="mx-auto w-full max-w-[760px] px-4 py-10 text-center md:px-6 md:py-14">
          <a
            href="/decode/quiz"
            className="cta-button mx-auto"
            style={{ maxWidth: "24rem", textDecoration: "none" }}
          >
            Book my 1-1 Thyroid Consultation
            <span className="cta-sub">₹299 &middot; 12 questions, then pick your slot</span>
          </a>
          {SHOW_PROGRAMME_PRICE && (
            <p className="mx-auto mt-4 max-w-[48ch] text-[13.5px] leading-[1.6] text-[var(--t3)]">
              After the ₹299 consultation, if the full 3-month programme is the
              right next step, it is ₹15,000&ndash;₹30,000. Saying so now so
              nobody&rsquo;s time is wasted.
            </p>
          )}
        </div>
      </section>

      <DecodeStickyCta />
    </main>
  );
}
