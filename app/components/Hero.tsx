"use client";

const CTA_URL =
  "https://swapnilumbarkarfitness.in/case-studies/#cta";

const PROOF_POINTS = [
  "10–15 kg fat loss",
  "Real Indian food",
  "Energy restored",
] as const;

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[var(--bg-page)] text-white"
      aria-labelledby="hero-heading"
    >
      {/* Ambient glow — softer on narrow viewports */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(52vw,320px)] overflow-hidden sm:h-[380px]"
      >
        <div
          className="absolute left-1/2 top-[-18%] h-[min(72vw,300px)] w-[min(72vw,300px)] -translate-x-1/2 rounded-full bg-purple-500/[0.08] blur-[80px] sm:bg-purple-500/10 sm:blur-[100px]"
        />
        <div
          className="absolute left-1/2 top-[8%] h-[140px] w-[min(90vw,420px)] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.04] blur-[60px]"
        />
      </div>

      <div className="container-default relative z-10 flex flex-col items-center pt-[clamp(2.25rem,6vw,3.5rem)] pb-[clamp(3rem,8vw,5rem)] text-center sm:pt-14 sm:pb-20">
        {/* Urgency badge */}
        <div
          className="badge-pill mb-[clamp(1rem,3.5vw,1.35rem)]"
          role="status"
          aria-live="polite"
        >
          <span className="badge-dot shrink-0" aria-hidden="true" />
          <span className="leading-snug">Only 5 Spots Left This Month</span>
        </div>

        {/* Eyebrow */}
        <p className="section-label !mb-[clamp(0.85rem,2.5vw,1.1rem)] max-w-[26ch] leading-[1.55] tracking-[0.14em] sm:max-w-none sm:tracking-[0.18em]">
          For Indian women with hypothyroidism
        </p>

        {/* Headline */}
        <h1
          id="hero-heading"
          className="mx-auto max-w-[14ch] text-balance text-[length:var(--text-hero)] font-black leading-[1.02] tracking-[-0.045em] text-white sm:max-w-[16ch] sm:leading-[0.98] sm:tracking-[-0.06em] md:max-w-[18ch] md:leading-[0.94] md:tracking-[-0.07em]"
        >
          Lose The{" "}
          <span className="text-gradient">Thyroid Belly Fat.</span>{" "}
          Sustainably.
        </h1>

        {/* Subheadline */}
        <p className="mt-[clamp(1.1rem,3.5vw,1.5rem)] max-w-[34ch] text-pretty text-[length:var(--text-sm)] leading-[1.65] text-[var(--t2)] sm:max-w-[38ch] sm:text-[length:var(--text-base)] sm:leading-[1.7]">
          India&apos;s premium thyroid fat-loss coaching for women exhausted by
          failed diets, low energy, and stubborn weight gain.
        </p>

        {/* Proof pills */}
        <ul
          className="chip-list mt-[clamp(1.25rem,4vw,1.75rem)] max-w-[22rem] justify-center sm:max-w-none"
          aria-label="Program outcomes"
        >
          {PROOF_POINTS.map((item) => (
            <li key={item}>
              <span className="chip whitespace-nowrap px-3 py-2 text-[0.72rem] sm:text-[0.74rem]">
                {item}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA cluster */}
        <div className="relative mt-[clamp(1.75rem,5vw,2.25rem)] w-full max-w-[min(100%,22rem)] sm:max-w-sm">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 -top-3 bottom-6 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.22)_0%,transparent_72%)] opacity-80"
          />

          <button
            type="button"
            className="cta-button relative z-[1] min-h-[60px] text-[clamp(0.94rem,2.8vw,1rem)] shadow-[0_12px_36px_rgba(168,85,247,0.26),0_1px_0_rgba(255,255,255,0.16)_inset] active:scale-[0.99] sm:min-h-[58px]"
            onClick={() => window.location.assign(CTA_URL)}
          >
            <span className="leading-tight">
              🔥 Book FREE Strategy Call
            </span>
            <span className="cta-sub mt-0.5 max-w-[28ch] text-center leading-snug opacity-95">
              60 Min Consultation · Limited Spots
            </span>
          </button>

          <p className="micro-trust mx-auto mt-[clamp(0.75rem,2.5vw,0.95rem)] max-w-[32ch] text-pretty leading-[1.55] text-[var(--t3)] sm:max-w-[36ch]">
            <span
              className="mr-1 inline-block tracking-widest text-[var(--p300)]"
              aria-hidden="true"
            >
              ★★★★★
            </span>
            <span className="text-[var(--t4)]">
              Trusted by 200+ hypothyroid women across India
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
