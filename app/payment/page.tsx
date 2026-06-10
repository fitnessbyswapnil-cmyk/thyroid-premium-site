/**
 * /payment — enrollment page for the 3-month "Personalised Thyroid Fat-Loss
 * Blueprint" program. Clients land here AFTER a 1-on-1 consultation; the page
 * recaps exactly what they get and hands off to Cashfree's hosted checkout.
 *
 * Editorial light palette (matches ad creative): onyx #16141B · ivory #F5EFE6 ·
 * dusty rose #CBA39B · plum-rose #6E3B52 · champagne gold #C7A25E (light
 * #E4CB95) · charcoal #2A2630. Playfair Display headlines, Inter body.
 */
import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import PayButton from "./PayButton";

// ── Editable constants ─────────────────────────────────────────────────────────
const CASHFREE_URL =
  "https://payments.cashfree.com/forms?code=PersonalizThyroid_Fat_Loss_Blueprint";
const PROGRAM_PRICE = "₹45,000 · 3 months"; // change or set to "" to hide
// ───────────────────────────────────────────────────────────────────────────────

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-playfair",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Personalised Thyroid Fat-Loss Blueprint · Swapnil Umbarkar",
  description:
    "Your 3-month, 1-on-1 thyroid fat-loss program — personalised Indian nutrition, low-impact training, weekly check-ins and unlimited WhatsApp support, all tracked in your private app.",
  robots: { index: false }, // private enrollment page reached after consultation
};

// ── Content ────────────────────────────────────────────────────────────────────

const DELIVERABLES = [
  {
    title: "Thyroid & Lifestyle Consultation Call",
    body: "A 60-minute deep-dive where I analyse your blood reports, lifestyle and symptoms to pinpoint the root causes blocking your progress.",
    icon: (
      <path d="M9 3v5a4 4 0 0 0 8 0V3M13 12v4a4 4 0 0 1-8 0v-1m0 0a2 2 0 1 0 0 .01" />
    ),
  },
  {
    title: "Customised Indian Nutrition Plan",
    body: "Built around Indian meals you love, designed for thyroid health and sustainable fat loss. Delivered in PDF and in-app, easy to follow.",
    icon: (
      <path d="M12 21a9 9 0 1 0-9-9c0 5 4 9 9 9Zm0-13v4l3 2" />
    ),
  },
  {
    title: "Low-Impact Custom Training Plan",
    body: "A personalised, joint-friendly plan (home or gym) with demo videos and clear goals, built to steadily grow your strength and energy.",
    icon: (
      <path d="M4 12h2m12 0h2M7 9v6m10-6v6M9 12h6" />
    ),
  },
  {
    title: "Weekly Check-Ins + Biweekly Progress Reviews",
    body: "Weekly check-ins on what's working, plus deeper fortnightly reviews tracking weight, energy, mood, sleep and workouts.",
    icon: (
      <path d="M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-3" />
    ),
  },
  {
    title: "Unlimited WhatsApp Support",
    body: "Direct access to me over WhatsApp for real-time help, so you're never stuck or left hanging.",
    icon: (
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" />
    ),
  },
] as const;

const CHECKLIST = [
  "60-minute thyroid & lifestyle consultation call",
  "Customised Indian nutrition plan (PDF + in-app)",
  "Low-impact custom training plan with demo videos",
  "Weekly check-ins + biweekly progress reviews",
  "Unlimited WhatsApp support",
  "Bonus: lifetime access to my private client community",
] as const;

const FAQS = [
  {
    q: "Is the payment secure?",
    a: "Yes. Payment is processed entirely by Cashfree, one of India's leading payment gateways — your card or UPI details never touch our site. The checkout is 256-bit encrypted.",
  },
  {
    q: "What happens right after I pay?",
    a: "You receive instant confirmation, your private app access and onboarding details, and we schedule your consultation call. You'll know exactly what happens next at every step.",
  },
  {
    q: "Can I pay in instalments or EMI?",
    a: "The Cashfree checkout supports UPI, all major cards, net-banking, and EMI options on eligible cards. Available EMI plans are shown at checkout.",
  },
  {
    q: "How is everything delivered?",
    a: "Your nutrition plan, training plan, check-ins, progress history and resources all live inside your private client app — with the nutrition plan also provided as a PDF. WhatsApp support runs alongside throughout.",
  },
  {
    q: "Who is this program for?",
    a: "Women with thyroid challenges — including hypothyroidism and Hashimoto's — who want a personalised, sustainable approach to fat loss built around real Indian food, not another generic diet.",
  },
] as const;

const STEPS = [
  { n: "1", label: "Complete payment" },
  { n: "2", label: "Instant app access + onboarding" },
  { n: "3", label: "We schedule your consultation call" },
] as const;

// ── Small building blocks ──────────────────────────────────────────────────────

function GoldRule({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-px w-16 bg-gradient-to-r from-transparent via-[#C7A25E] to-transparent ${className}`}
    />
  );
}

function GoldTick() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className="mt-0.5 shrink-0"
    >
      <circle cx="9" cy="9" r="8.25" stroke="#C7A25E" strokeWidth="1.5" />
      <path
        d="M5.5 9.2l2.3 2.3 4.7-5"
        stroke="#C7A25E"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BrandLockup({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <p
        className={`font-[family-name:var(--font-playfair)] text-[1.35rem] font-bold tracking-[-0.01em] ${
          inverted ? "text-[#F5EFE6]" : "text-[#2A2630]"
        }`}
      >
        Swapnil Umbarkar
      </p>
      <p
        className={`mt-1 text-[0.68rem] font-medium uppercase tracking-[0.22em] ${
          inverted ? "text-[#E4CB95]" : "text-[#6E3B52]"
        }`}
      >
        Thyroid Fat-Loss Coach
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PaymentPage() {
  return (
    <div
      className={`${playfair.variable} ${inter.variable} min-h-screen bg-[#F5EFE6] font-[family-name:var(--font-inter)] text-[#2A2630] antialiased`}
    >
      {/* 1 — Header */}
      <header className="bg-[#16141B] px-6 pb-7 pt-8">
        <BrandLockup inverted />
        <p className="mt-3 text-center text-[0.75rem] tracking-[0.04em] text-[#F5EFE6]/60">
          ACE &amp; INFS Certified Thyroid Fat-Loss Coach
        </p>
      </header>

      <main>
        {/* 2 — Hero */}
        <section
          aria-labelledby="program-heading"
          className="mx-auto max-w-[640px] px-6 pb-14 pt-14 text-center sm:pt-16"
        >
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-[#6E3B52]">
            Your 3-Month Transformation
          </p>
          <h1
            id="program-heading"
            className="mx-auto mt-4 max-w-[18ch] text-balance font-[family-name:var(--font-playfair)] text-[clamp(2rem,1.4rem+3vw,3.1rem)] font-bold leading-[1.12] tracking-[-0.01em]"
          >
            The Personalised Thyroid Fat-Loss Blueprint
          </h1>
          <GoldRule className="mx-auto mt-6 w-20" />
          <p className="mx-auto mt-6 max-w-[46ch] text-pretty text-[1.02rem] leading-[1.7] text-[#2A2630]/80">
            A 3-month, 1-on-1 program built around your thyroid, your body, and
            Indian meals you love — so progress finally feels steady, realistic
            and yours.
          </p>
          <p className="mt-5 text-[0.85rem] font-medium text-[#6E3B52]">
            Everything below is delivered and tracked inside your private app.
          </p>
        </section>

        {/* 3 — What's included */}
        <section
          aria-labelledby="included-heading"
          className="mx-auto max-w-[760px] px-6 pb-16"
        >
          <h2
            id="included-heading"
            className="text-center font-[family-name:var(--font-playfair)] text-[1.6rem] font-semibold tracking-[-0.01em]"
          >
            What&apos;s included
          </h2>
          <GoldRule className="mx-auto mt-4" />

          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {DELIVERABLES.map((d) => (
              <li
                key={d.title}
                className="rounded-3xl border border-[#CBA39B]/35 bg-white/65 p-6 shadow-[0_10px_34px_rgba(42,38,48,0.07)]"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6E3B52]/10"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6E3B52"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {d.icon}
                  </svg>
                </span>
                <h3 className="mt-4 font-[family-name:var(--font-playfair)] text-[1.08rem] font-semibold leading-snug">
                  {d.title}
                </h3>
                <p className="mt-2 text-[0.9rem] leading-[1.65] text-[#2A2630]/75">
                  {d.body}
                </p>
              </li>
            ))}

            {/* Bonus card — gold accent */}
            <li className="rounded-3xl border border-[#C7A25E]/60 bg-gradient-to-b from-[#E4CB95]/25 to-white/65 p-6 shadow-[0_10px_34px_rgba(199,162,94,0.16)]">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#C7A25E]">
                Bonus
              </p>
              <h3 className="mt-3 font-[family-name:var(--font-playfair)] text-[1.08rem] font-semibold leading-snug">
                Lifetime Access to My Private Client Community
              </h3>
              <p className="mt-2 text-[0.9rem] leading-[1.65] text-[#2A2630]/75">
                Stay inspired and supported even after your program ends.
              </p>
            </li>
          </ul>
        </section>

        {/* 4 — All in one app */}
        <section
          aria-labelledby="app-heading"
          className="bg-[#6E3B52] px-6 py-12 text-center"
        >
          <h2
            id="app-heading"
            className="mx-auto max-w-[26ch] font-[family-name:var(--font-playfair)] text-[1.4rem] font-semibold leading-snug text-[#F5EFE6]"
          >
            All in one app, fully tracked
          </h2>
          <p className="mx-auto mt-4 max-w-[48ch] text-pretty text-[0.95rem] leading-[1.7] text-[#F5EFE6]/80">
            Your plans, check-ins, progress and history all live in one place —
            tracked properly, week after week — so you always know exactly where
            you stand and what comes next.
          </p>
        </section>

        {/* 5 — Trust / credibility */}
        <section
          aria-labelledby="approach-heading"
          className="mx-auto max-w-[680px] px-6 py-16"
        >
          <h2
            id="approach-heading"
            className="text-center font-[family-name:var(--font-playfair)] text-[1.6rem] font-semibold tracking-[-0.01em]"
          >
            My approach
          </h2>
          <GoldRule className="mx-auto mt-4" />
          <p className="mx-auto mt-7 max-w-[52ch] text-center text-[0.98rem] leading-[1.75] text-[#2A2630]/80">
            Root-cause and diagnostic, not generic dieting. Indian meals you
            actually enjoy, low-impact training that respects your body, and a
            pace built to sustain — specialised for women with thyroid
            challenges, including Hashimoto&apos;s.
          </p>

          <ul
            aria-label="Credentials"
            className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[0.8rem] font-medium text-[#6E3B52]"
          >
            <li>ACE Certified</li>
            <li aria-hidden="true" className="h-1 w-1 rounded-full bg-[#C7A25E]" />
            <li>INFS Certified</li>
            <li aria-hidden="true" className="h-1 w-1 rounded-full bg-[#C7A25E]" />
            <li>Hashimoto&apos;s nutrition focus</li>
          </ul>

          {/*
            ── PLACEHOLDERS — fill with REAL content only. Do NOT invent
            testimonials, client counts, or success percentages. Delete this
            block if you choose not to use it.
          */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-dashed border-[#CBA39B]/60 bg-white/40 p-6 text-center">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#CBA39B]">
                Placeholder — real testimonial
              </p>
              <p className="mt-3 text-[0.85rem] italic leading-[1.65] text-[#2A2630]/50">
                Add a genuine client quote here (with permission), e.g. from your
                WhatsApp results screenshots.
              </p>
            </div>
            <div className="rounded-3xl border border-dashed border-[#CBA39B]/60 bg-white/40 p-6 text-center">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#CBA39B]">
                Placeholder — real results stat
              </p>
              <p className="mt-3 text-[0.85rem] italic leading-[1.65] text-[#2A2630]/50">
                Add one verified client-results figure here when you have it.
              </p>
            </div>
          </div>
        </section>

        {/* 6 — Offer + payment panel */}
        <section
          aria-labelledby="enroll-heading"
          className="px-6 pb-16"
        >
          <div className="mx-auto max-w-[560px] rounded-[32px] border border-[#C7A25E]/45 bg-white p-8 shadow-[0_24px_70px_rgba(42,38,48,0.14)] sm:p-10">
            <p className="text-center text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#6E3B52]">
              Secure Your Place
            </p>
            <h2
              id="enroll-heading"
              className="mt-3 text-center font-[family-name:var(--font-playfair)] text-[1.5rem] font-bold leading-snug tracking-[-0.01em]"
            >
              Personalised Thyroid Fat-Loss Blueprint
            </h2>
            <GoldRule className="mx-auto mt-5" />

            <ul className="mt-7 space-y-3.5">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[0.92rem] leading-snug">
                  <GoldTick />
                  <span className="text-[#2A2630]/85">{item}</span>
                </li>
              ))}
            </ul>

            {PROGRAM_PRICE && (
              <p className="mt-8 text-center font-[family-name:var(--font-playfair)] text-[1.45rem] font-bold text-[#2A2630]">
                {PROGRAM_PRICE}
              </p>
            )}

            <div className="mt-6">
              <PayButton href={CASHFREE_URL} price={PROGRAM_PRICE} />
            </div>

            <p className="mt-4 text-center text-[0.72rem] leading-relaxed text-[#2A2630]/55">
              Secured by Cashfree · UPI, cards, net-banking, EMI · 256-bit
              encrypted
            </p>

            {/* What happens next */}
            <div className="mt-9 border-t border-[#CBA39B]/30 pt-7">
              <h3 className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#6E3B52]">
                What happens next
              </h3>
              <ol className="mt-5 space-y-3">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex items-center gap-3.5">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#C7A25E] text-[0.72rem] font-bold text-[#6E3B52]"
                    >
                      {s.n}
                    </span>
                    <span className="text-[0.9rem] text-[#2A2630]/80">{s.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 7 — FAQ */}
        <section
          aria-labelledby="faq-heading"
          className="mx-auto max-w-[640px] px-6 pb-20"
        >
          <h2
            id="faq-heading"
            className="text-center font-[family-name:var(--font-playfair)] text-[1.6rem] font-semibold tracking-[-0.01em]"
          >
            Questions, answered
          </h2>
          <GoldRule className="mx-auto mt-4" />

          <div className="mt-9 space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-[#CBA39B]/35 bg-white/60 px-5 py-1"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[0.95rem] font-semibold text-[#2A2630] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C7A25E] [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    className="shrink-0 transition-transform duration-200 motion-reduce:transition-none group-open:rotate-45"
                  >
                    <path d="M7 2v10M2 7h10" stroke="#6E3B52" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </summary>
                <p className="pb-5 text-[0.9rem] leading-[1.7] text-[#2A2630]/75">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* 8 — Footer */}
      <footer className="bg-[#16141B] px-6 py-12 text-center">
        <BrandLockup inverted />
        <p className="mt-4 text-[0.78rem] text-[#F5EFE6]/55">
          @heal_thyroid_with_swapnil · swapnilumbarkarfitness.in
        </p>
        <p className="mx-auto mt-6 max-w-[52ch] text-[0.72rem] leading-[1.7] text-[#F5EFE6]/40">
          This is a nutrition and lifestyle coaching program, not medical
          treatment. Always continue working with your doctor on the medical
          management of your thyroid.
        </p>
      </footer>
    </div>
  );
}
