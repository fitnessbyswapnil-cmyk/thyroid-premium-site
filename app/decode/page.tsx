import type { Metadata } from "next";
import dynamic from "next/dynamic";
import HeroProofStrip from "@/app/components/HeroProofStrip";
import DeficitDiagram from "@/app/components/DeficitDiagram";
import DecodeQuiz from "./DecodeQuiz";
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

export const metadata: Metadata = {
  title: "Small plate, same weight | Thyroid report reading",
  description:
    "Get your report decoded. Find the exact reason you are not losing weight even though you eat less — read from your own thyroid blood report, in 45 minutes.",
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
    a: "Me. Not an assistant, not a sales team. Forty-five minutes, one to one.",
  },
];

export default function DecodePage() {
  return (
    <main>
      {/* ── Hero: the paradox, and nothing else ─────────────────────────── */}
      <section className="bg-[var(--bg-page)]">
        <div className="container-default mx-auto w-full max-w-[900px] px-4 pb-10 pt-12 text-center md:px-6 md:pb-14 md:pt-16">
          <p
            className="mb-5 inline-block rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.1em]"
            style={{
              background: "var(--p-subtle)",
              color: "var(--p600)",
              border: "1px solid var(--p-border)",
            }}
          >
            Small plate. Same weight.
          </p>

          <h1
            className="mx-auto max-w-[760px] text-balance text-[length:var(--text-xl)] font-bold leading-[1.12] text-[var(--t1)]"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            You eat less than everyone at your table.
            <span className="block" style={{ color: "var(--p600)" }}>
              The scale still shows the same number.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-[620px] text-[16px] leading-[1.62] text-[var(--t2)] md:text-[17.5px]">
            This is not about willpower. When you eat less for a long time, a
            slow thyroid makes your body burn less too. So the gap you made
            closes. <strong>Your blood report can show the exact reason</strong>
            &mdash; but almost nobody reads it that way.
          </p>

          <div className="mt-8 flex flex-col items-center">
            <a
              href="#quiz"
              className="cta-button"
              style={{ maxWidth: "24rem", textDecoration: "none" }}
            >
              Find the exact reason &mdash; 10 questions
              <span className="cta-sub">Free. Takes about 40 seconds.</span>
            </a>
            <p className="mt-3 text-[13px] text-[var(--t3)]">
              No report yet? Answer anyway &mdash; I will tell you what to do next.
            </p>
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
              What happens in the 45 minutes
            </h2>
          </header>

          <ol className="grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
            {AGENDA.map((a) => (
              <li
                key={a.n}
                className="rounded-2xl bg-white p-5 md:p-6"
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

      {/* Qualify, then sell. The quiz owns the checkout: it only shows the
          Rs 299 form to someone who actually has a report to read, and hands
          everyone else to the free call instead. */}
      <DecodeQuiz />

      <VideoTestimonial />
      <CertificationsSection />

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

          <div className="mt-9 text-center">
            <a
              href="#quiz"
              className="cta-button"
              style={{ maxWidth: "24rem", textDecoration: "none" }}
            >
              Find the exact reason &mdash; 10 questions
              <span className="cta-sub">Free. Takes about 40 seconds.</span>
            </a>
          </div>
        </div>
      </section>

      <DecodeStickyCta />
    </main>
  );
}
