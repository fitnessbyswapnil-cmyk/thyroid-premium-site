import type { Metadata } from "next";
import dynamic from "next/dynamic";
import HeroProofStrip from "@/app/components/HeroProofStrip";
import DeficitDiagram from "@/app/components/DeficitDiagram";
import ScheduleClient from "@/app/schedule/ScheduleClient";
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
  title: "Why you are not losing weight on less food | Report decoding",
  description:
    "You cut your calories and the scale stopped anyway. A 45-minute reading of your own thyroid and metabolic panel to find where your burn came down to meet you.",
  // Ad traffic only. Indexing it would put it in competition with the main site.
  robots: { index: false, follow: false },
};

const AGENDA = [
  {
    n: "01",
    h: "Your panel, read line by line",
    p: "TSH, T3, T4 and the markers that usually get skipped. Not a glance at whether each one is in range — a look at where it sits inside that range, which is where the answer normally is.",
  },
  {
    n: "02",
    h: "The month your burn stopped matching your effort",
    p: "Placed from your own numbers and your own diet history, not from a template. You will see which cut it followed.",
  },
  {
    n: "03",
    h: "What is blocking it right now",
    p: "Named specifically, in plain language, with the reasoning shown — so you can check it against anything you are told later.",
  },
  {
    n: "04",
    h: "What to do about it",
    p: "Written down before we finish, whether or not you ever work with me.",
  },
];

const FAQ = [
  {
    q: "Is ₹299 the whole cost?",
    a: "It is the whole cost of this session. Nothing further is charged for it, and nothing is added at the end.",
  },
  {
    q: "What if I don’t have a recent blood report?",
    a: "Then this is not the right session for you yet, and you should not pay for it. Get a thyroid profile including T3, T4 and TSH done at any diagnostic lab, then book once you have it in hand.",
  },
  {
    q: "Is this a sales call in disguise?",
    a: "It is a reading of your report, and you get the reading whatever you decide afterwards. If a structured programme genuinely fits your case I will say so and show you what it involves — but you will not be asked to decide anything on the call.",
  },
  {
    q: "I am already on thyroid medication. Does that change it?",
    a: "No. Most people I see are. Bring your dose and how long you have been on it — both change how the numbers should be read.",
  },
  {
    q: "Who is actually on the call?",
    a: "Me, not an assistant or a sales team. Forty-five minutes, one to one.",
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
            Thyroid report decoding &middot; &#8377;299
          </p>

          <h1
            className="mx-auto max-w-[760px] text-balance text-[length:var(--text-xl)] font-bold leading-[1.12] text-[var(--t1)]"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            You are eating less than everyone around you.
            <span className="block" style={{ color: "var(--p600)" }}>
              And the scale has not moved in months.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-[620px] text-[16px] leading-[1.62] text-[var(--t2)] md:text-[17.5px]">
            That is not willpower failing. When intake stays low for long
            enough, an underactive thyroid brings your burn down to meet it
            &mdash; and the blood work you already have will usually show where
            that happened. Most reports simply never get read that way.
          </p>

          <div className="mt-8 flex flex-col items-center">
            <a
              href="#book"
              className="cta-button"
              style={{ maxWidth: "24rem", textDecoration: "none" }}
            >
              Get my report decoded &mdash; &#8377;299
              <span className="cta-sub">45 minutes, one to one</span>
            </a>
            <p className="mt-3 text-[13px] text-[var(--t3)]">
              Bring your latest thyroid panel. That is the only thing you need.
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
            <p className="section-label">No mystery about it</p>
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
            If a structured programme turns out to be the right next step for
            your case, I will show you what it involves. You will not be asked
            to decide on the call.
          </p>
        </div>
      </section>

      {/* ── Capture + Cashfree. Unchanged, already live-tested. ─────────── */}
      <div id="book" style={{ scrollMarginTop: "16px" }}>
        <ScheduleClient
          wrapper="div"
          eyebrow="Bring your latest thyroid panel"
          heading="Book your report decoding"
          subheading="45 minutes, one to one with Swapnil. Your own blood work, read line by line, and the point your burn stopped matching your effort."
          ctaLabel={"Decode my report — ₹299"}
          rationaleTitle="Why it costs ₹299"
          rationaleBody="So the slot is held by someone who will turn up, and so I arrive having actually read your report rather than seeing it for the first time on the call. It is adjusted against your programme fee if you go on to work with me."
        />
      </div>

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
              href="#book"
              className="cta-button"
              style={{ maxWidth: "24rem", textDecoration: "none" }}
            >
              Get my report decoded &mdash; &#8377;299
              <span className="cta-sub">45 minutes, one to one</span>
            </a>
          </div>
        </div>
      </section>

      <DecodeStickyCta />
    </main>
  );
}
