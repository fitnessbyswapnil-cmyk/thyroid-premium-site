import type { Metadata } from "next";
import dynamic from "next/dynamic";
import HeroProofStrip from "@/app/components/HeroProofStrip";
import DecodeStickyCta from "./DecodeStickyCta";

/**
 * /decode — the paid (₹299) 1-1 consultation offer. Ad traffic only.
 *
 * SHORT ON PURPOSE (owner's call, 14-Sep-2026). The page had grown to ~1,850
 * words in 13 sections — about 14 phone screens — with the first proof four
 * screens down and only two Book buttons. The owner's read: so much text that
 * it reads as noise and she never gets to the button. The long version is kept
 * unchanged at /decode-long, one change away if this books fewer calls.
 *
 * What stays is what she needs to book, in the order she needs it:
 *   1 hero ............ is this about me, what is it, what does it cost
 *   2 symptoms ........ six lines, tap the true ones
 *   3 proof ........... faces, screenshots, voices — words around them cut
 *   4 what you get .... three lines
 *   5 how booking works three steps
 *   6 FAQ ............. three one-line answers
 *   7 last button
 * with a Book button after the hero, inside and after the proof, after the
 * steps and at the end.
 *
 * The "why" argument (gap chart, "you didn't fail", the diets comparison) is
 * ONE sentence in the hero now — owner's choice. "Who this is for" and the
 * share-with-family block are gone: the 12-question quiz already filters.
 *
 * Unchanged, and must stay so: every button goes to /decode/quiz with the ad's
 * own label and the price; the refund sentence is quoted, not reworded; the
 * proof claim is "100+"; testimonial words are verbatim (the proof components
 * only lose their section intro lines, through props, so `/` is untouched).
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

const GET = [
  "Your report, read line by line",
  "What is stopping your weight loss, in simple words",
  "What to do about it, written down before we finish",
] as const;

const STEPS = ["Answer 12 quick questions", "Pay ₹299", "Pick your slot"] as const;

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
      <span className="cta-sub">₹299 &middot; 12 questions, then pick your slot</span>
    </a>
  );
}

export default function DecodePage() {
  return (
    // theme-decode re-skins the CTAs to the red of the creatives (globals.css).
    <main className="theme-decode">
      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      <section className="decode-hero bg-[var(--bg-page)]">
        <div className="container-default mx-auto w-full max-w-[760px] px-4 pb-8 pt-8 text-center md:px-6 md:pb-12 md:pt-14">
          <h1
            className="mx-auto max-w-[680px] text-balance text-[length:var(--fs-2xl)] font-bold leading-[var(--lh-display)] text-[var(--t1)]"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            Eating less but still not losing weight?
            <span className="block" style={{ color: "var(--p600)" }}>
              Your blood report shows why.
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-[560px] text-[length:var(--fs-xs)] leading-[var(--lh-body)] text-[var(--t2)] md:text-[length:var(--fs-base)]">
            Eat less for months and a slow thyroid makes your body burn less too
            &mdash; so the gap closes. On a 60-minute 1-1 call I read your report
            and tell you exactly what is blocking your weight.
          </p>

          <p className="mx-auto mt-3 max-w-[560px] text-[length:var(--fs-2xs)] font-medium leading-[var(--lh-body)] text-[var(--t1)]">
            Leave the call without knowing your blocker and the ₹299 is refunded.
          </p>

          <div className="mt-6 flex flex-col items-center">
            <a
              href="/decode/quiz"
              className="cta-button"
              style={{ maxWidth: "24rem", textDecoration: "none" }}
            >
              Book my 1-1 Thyroid Consultation
              <span className="cta-sub">₹299 &middot; 12 questions, then pick your slot</span>
            </a>
          </div>

          <HeroProofStrip claimsOnly />
          <p className="mx-auto mt-3 text-[length:var(--fs-3xs)] tracking-[var(--ls-caps)] text-[var(--t3)]">
            ACE &middot; INFS &middot; AIHM (Hashimoto&rsquo;s nutrition) certified
          </p>
        </div>
      </section>

      {/* ── 2. Symptoms ─────────────────────────────────────────────────── */}
      <SymptomChips hideCta compact pick={SYMPTOM_PICK} />

      {/* ── 3. Proof ────────────────────────────────────────────────────── */}
      <div className="band-deep">
        <TransformationWall compact />
      </div>
      {/* A button between the faces and the screenshots: proof runs about three
          phone screens, and the next button should never be further away. */}
      <section className="bg-[var(--bg-page)]">
        <div className="mx-auto w-full max-w-[760px] px-4 pt-8 text-center md:px-6">
          <BookButton />
        </div>
      </section>
      <WhatsappProofSection hideCta limit={3} />
      <VideoTestimonial compact />
      <section className="bg-[var(--bg-page)]">
        <div className="mx-auto w-full max-w-[760px] px-4 pb-10 text-center md:px-6">
          <BookButton />
        </div>
      </section>

      {/* ── 4. What you get · 5. How booking works ──────────────────────── */}
      <section className="bg-[var(--bg-elevated)]" aria-labelledby="get-heading">
        <div className="mx-auto w-full max-w-[640px] px-4 py-10 md:px-6 md:py-14">
          <h2 id="get-heading" className="section-title mx-auto text-balance text-center">
            What you get in 60 minutes
          </h2>
          <ul className="mx-auto mt-6 flex list-none flex-col gap-3 p-0">
            {GET.map((line) => (
              <li
                key={line}
                className="relative rounded-2xl bg-white py-3.5 pl-11 pr-4 text-[length:var(--fs-xs)] font-medium leading-[var(--lh-tight)] text-[var(--t1)]"
                style={{ boxShadow: "var(--shadow-card)" }}
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
          <p className="mx-auto mt-4 text-center text-[length:var(--fs-2xs)] leading-[var(--lh-body)] text-[var(--t3)]">
            If a full programme suits you, I will show you what it involves and
            what it costs. No pressure.
          </p>

          <h2 id="steps-heading" className="section-title mx-auto mt-12 text-balance text-center">
            How booking works
          </h2>
          <ol className="mx-auto mt-6 grid list-none grid-cols-3 gap-3 p-0">
            {STEPS.map((step, i) => (
              <li key={step} className="text-center">
                <span
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[length:var(--fs-2xs)] font-bold text-white"
                  style={{ background: "var(--p600)" }}
                >
                  {i + 1}
                </span>
                <span className="mt-2 block text-[length:var(--fs-2xs)] font-medium leading-[var(--lh-tight)] text-[var(--t1)]">
                  {step}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-8 text-center">
            <BookButton />
          </div>
        </div>
      </section>

      {/* ── 6. FAQ ──────────────────────────────────────────────────────── */}
      <section className="bg-[var(--bg-page)]" aria-labelledby="faq-heading">
        <div className="mx-auto w-full max-w-[640px] px-4 py-10 md:px-6 md:py-14">
          <h2 id="faq-heading" className="section-title mx-auto text-balance text-center">
            Quick questions
          </h2>
          <dl className="mt-6 flex flex-col gap-3">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-2xl bg-white px-5 py-4" style={{ boxShadow: "var(--shadow-card)" }}>
                <dt className="text-[length:var(--fs-xs)] font-medium leading-[var(--lh-tight)] text-[var(--t1)]">{f.q}</dt>
                <dd className="m-0 mt-1.5 text-[length:var(--fs-2xs)] leading-[var(--lh-body)] text-[var(--t2)]">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── 7. Last button ──────────────────────────────────────────────── */}
      <section className="bg-[var(--bg-elevated)]">
        <div className="mx-auto w-full max-w-[760px] px-4 py-10 text-center md:px-6 md:py-12">
          <a
            href="/decode/quiz"
            className="cta-button mx-auto"
            style={{ maxWidth: "24rem", textDecoration: "none" }}
          >
            Book my 1-1 Thyroid Consultation
            <span className="cta-sub">₹299 &middot; 12 questions, then pick your slot</span>
          </a>
          {SHOW_PROGRAMME_PRICE && (
            <p className="mx-auto mt-4 max-w-[var(--measure-caption)] text-[length:var(--fs-3xs)] leading-[var(--lh-body)] text-[var(--t3)]">
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
