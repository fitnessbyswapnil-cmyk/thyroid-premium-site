/**
 * /payment — enrollment page for the 3-month "Personalised Thyroid Fat-Loss
 * Blueprint". Reached AFTER a 1-on-1 consultation; hands off to Cashfree's
 * hosted checkout. Dark purple/gold theme native to the rest of the site
 * (uses the global tokens + .cta-button / .section-* classes). Text kept minimal.
 */
import type { Metadata } from "next";
import Image from "next/image";
import PayButton from "./PayButton";

// ── Editable constants ─────────────────────────────────────────────────────────
const CASHFREE_URL =
  "https://payments.cashfree.com/forms?code=PersonalizThyroid_Fat_Loss_Blueprint";
const PROGRAM_PRICE = "₹45,000 · 3 months"; // change, or set to "" to hide
// ───────────────────────────────────────────────────────────────────────────────

const GOLD = "rgba(213,183,101,0.85)";

export const metadata: Metadata = {
  title: "Personalised Thyroid Fat-Loss Blueprint · Swapnil Umbarkar",
  description:
    "Your 3-month, 1-on-1 thyroid fat-loss program — personalised Indian nutrition, low-impact training, weekly check-ins and unlimited WhatsApp support.",
  robots: { index: false }, // private page reached after consultation
};

// What's included — short labels only (minimal copy).
const INCLUDED = [
  "60-minute thyroid & lifestyle consultation call",
  "Customised Indian nutrition plan (PDF + app)",
  "Low-impact custom training plan with demo videos",
  "Weekly check-ins + biweekly progress reviews",
  "Unlimited WhatsApp support",
] as const;

// Real client proof — actual screenshots + names already used on the site
// (app/components/WhatsappProofSection.tsx). Nothing fabricated.
const PROOF = [
  { image: "/whatsapp-proof/Shariya-Sultana.jpeg", name: "Shariya Sultana", line: "TSH finally in range." },
  { image: "/whatsapp-proof/Pooja-Sharma.jpeg", name: "Pooja Sharma", line: "Hair loss stopped." },
  { image: "/whatsapp-proof/Priya-Shree.jpeg", name: "Priya Shree", line: "Metabolism alive again." },
  { image: "/whatsapp-proof/Ritika-Deshmukh.jpeg", name: "Ritika Deshmukh", line: "No more exhaustion." },
  { image: "/whatsapp-proof/Heenal R4.png", name: "Heenal", line: "TSH 6.2 → 2.9." },
  { image: "/whatsapp-proof/Sima R1.png", name: "Sima", line: "Weight finally moving." },
] as const;

const FAQS = [
  { q: "Is payment secure?", a: "Yes — processed entirely by Cashfree, 256-bit encrypted. Your details never touch this site." },
  { q: "What happens after I pay?", a: "Instant app access + onboarding, then we schedule your consultation call." },
  { q: "Can I pay in EMI?", a: "UPI, cards, net-banking and EMI on eligible cards — all shown at checkout." },
] as const;

function GoldTick() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
      <circle cx="9" cy="9" r="8.25" stroke={GOLD} strokeWidth="1.4" />
      <path d="M5.5 9.2l2.3 2.3 4.7-5" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PaymentPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-white antialiased">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-5 text-center">
        <p className="font-black tracking-[-0.02em]">Swapnil Umbarkar</p>
        <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--t4)]">
          ACE &amp; INFS Certified Thyroid Coach
        </p>
      </header>

      <main className="container-narrow">
        {/* Hero */}
        <section className="pb-12 pt-14 text-center sm:pt-16" aria-labelledby="program-heading">
          <p className="section-label">Your 3-Month Transformation</p>
          <h1
            id="program-heading"
            className="mx-auto max-w-[16ch] text-balance text-[length:clamp(2rem,1.5rem+2.6vw,3.2rem)] font-black leading-[1.06] tracking-[-0.03em]"
          >
            The Personalised{" "}
            <span className="text-gradient italic">Thyroid Fat-Loss Blueprint</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[42ch] text-pretty text-[length:clamp(0.98rem,0.94rem+0.3vw,1.1rem)] leading-[1.6] text-[var(--t2)]">
            A private program built around your thyroid, your body, and the Indian
            food you love.
          </p>
        </section>

        {/* What's included */}
        <section className="pb-14" aria-labelledby="included-heading">
          <h2 id="included-heading" className="section-label text-center">What&apos;s included</h2>
          <ul className="mx-auto mt-5 max-w-[26rem] space-y-3">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[0.95rem] leading-snug text-[var(--t2)]">
                <GoldTick />
                <span>{item}</span>
              </li>
            ))}
            <li className="flex items-start gap-3 text-[0.95rem] leading-snug">
              <GoldTick />
              <span className="text-white">
                <span style={{ color: GOLD }}>Bonus —</span> lifetime access to my private client community
              </span>
            </li>
          </ul>
        </section>
      </main>

      {/* Real client proof */}
      <section className="border-y border-white/[0.05] bg-[var(--bg-section)] py-12" aria-labelledby="proof-heading">
        <div className="container-narrow">
          <h2 id="proof-heading" className="section-label text-center">Real client results</h2>
          <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3" role="list">
            {PROOF.map((p) => (
              <li key={p.name} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                <div className="relative aspect-[3/4] w-full">
                  <Image
                    src={p.image}
                    alt={`${p.name} — client message`}
                    fill
                    sizes="(max-width:640px) 50vw, 240px"
                    className="object-cover object-top"
                  />
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-white/85">{p.name}</p>
                  <p className="mt-0.5 text-[11px] leading-snug" style={{ color: GOLD }}>{p.line}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <main className="container-narrow">
        {/* Payment panel */}
        <section className="py-14" aria-labelledby="enroll-heading">
          <div className="mx-auto max-w-[460px] rounded-[1.75rem] border border-[var(--p-border)] bg-[var(--bg-elevated)] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.4)] sm:p-9">
            <h2 id="enroll-heading" className="text-center text-[1.3rem] font-black leading-snug tracking-[-0.02em]">
              Secure your place
            </h2>
            {PROGRAM_PRICE && (
              <p className="mt-3 text-center text-[1.5rem] font-black">
                <span className="text-gradient">{PROGRAM_PRICE}</span>
              </p>
            )}
            <div className="mt-7">
              <PayButton href={CASHFREE_URL} />
            </div>
            <p className="mt-3 text-center text-[11.5px] leading-relaxed text-[var(--t4)]">
              Secured by Cashfree · UPI · Cards · Net-banking · EMI · 256-bit encrypted
            </p>

            <ol className="mt-7 space-y-2.5 border-t border-white/[0.06] pt-6">
              {["Complete payment", "Instant app access + onboarding", "We schedule your consultation call"].map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-[0.88rem] text-[var(--t3)]">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold text-[var(--p400)]"
                    style={{ borderColor: "var(--p-border)" }}
                  >
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-16" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="section-label text-center">Questions</h2>
          <div className="mx-auto mt-5 max-w-[34rem] space-y-2.5">
            {FAQS.map((f) => (
              <details key={f.q} className="group rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-[0.9rem] font-semibold text-white/90 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden="true" className="text-[var(--p400)] transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none">+</span>
                </summary>
                <p className="pb-4 text-[0.85rem] leading-relaxed text-[var(--t3)]">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-10 text-center">
        <p className="text-[0.8rem] text-[var(--t3)]">@heal_thyroid_with_swapnil · swapnilumbarkarfitness.in</p>
        <p className="mx-auto mt-4 max-w-[48ch] text-[11px] leading-relaxed text-[var(--t5)]">
          A nutrition and lifestyle coaching program, not medical treatment. Always
          continue working with your doctor on the medical management of your thyroid.
        </p>
      </footer>
    </div>
  );
}
