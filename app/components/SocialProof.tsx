"use client";

const TESTIMONIALS = [
  {
    name: "Priya R.",
    location: "Mumbai",
    initials: "PR",
    quote:
      "I'd tried every diet for 3 years. Nothing worked. I didn't know my thyroid was the actual problem — not my willpower. In 6 weeks I lost 4.5 kg without giving up roti.",
    result: "−4.5 kg · 6 weeks",
  },
  {
    name: "Ananya S.",
    location: "Pune",
    initials: "AS",
    quote:
      "The fatigue was unbearable. I slept 9 hours and still felt exhausted every morning. After 8 weeks on the protocol, I stopped needing afternoon naps. My family noticed before I did.",
    result: "Energy fully restored",
  },
  {
    name: "Divya M.",
    location: "Bengaluru",
    initials: "DM",
    quote:
      "I cried on our first call because someone finally understood why nothing was working. This isn't just a coaching program — it's the first time I felt truly seen.",
    result: "−6 kg · 10 weeks",
  },
] as const;

function Stars() {
  return (
    <span aria-hidden="true" className="flex gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M6 1L7.545 4.13L11 4.635L8.5 7.07L9.09 10.5L6 8.875L2.91 10.5L3.5 7.07L1 4.635L4.455 4.13L6 1Z"
            fill="#f4c430"
          />
        </svg>
      ))}
    </span>
  );
}

export default function SocialProof() {
  return (
    <section
      aria-label="Client testimonials"
      className="relative overflow-hidden border-b border-white/[0.04] bg-[var(--bg-section)] py-[clamp(3.5rem,9vw,5.5rem)]"
    >
      {/* Ambient glow — subtler than hero, signals section shift */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-28 overflow-hidden">
        <div className="absolute left-1/2 top-[-50%] h-20 w-[46vw] max-w-[220px] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.05] blur-[64px]" />
      </div>

      <div className="container-narrow relative z-10">

        {/* Section header */}
        <div className="mb-9 text-center sm:mb-11">
          <p className="section-label">Client Stories</p>
          <h2 className="section-title mt-1 text-balance leading-[1.06] tracking-[-0.038em]">
            They were where you are.
          </h2>
          <p className="mx-auto mt-3 max-w-[30ch] text-center text-pretty text-[length:var(--text-sm)] leading-[1.68] text-[var(--t3)]">
            Indian women with hypothyroidism. Real food. Real results.
          </p>
        </div>

        {/* Testimonial cards — vertical stack, full-width at 320px */}
        <div className="flex flex-col gap-[14px]" role="list">
          {TESTIMONIALS.map((t) => (
            <article
              key={t.name}
              role="listitem"
              className="rounded-[var(--r-xl)] p-5 sm:p-6"
              style={{
                background: "rgba(255,255,255,0.024)",
                border: "1px solid rgba(255,255,255,0.062)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.048), 0 2px 12px rgba(0,0,0,0.18)",
              }}
            >
              {/* Top row: stars + location */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stars />
                  <span className="text-[10px] font-bold tracking-[0.04em] text-[#f4c430]/70">
                    5.0
                  </span>
                </div>
                <span
                  className="flex items-center gap-[5px] rounded-full px-[9px] py-[4px] text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[var(--t4)]"
                  style={{
                    background: "rgba(255,255,255,0.028)",
                    border: "1px solid rgba(255,255,255,0.065)",
                  }}
                >
                  <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                    <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
                    <circle cx="4" cy="4" r="1" fill="currentColor" opacity="0.6" />
                  </svg>
                  {t.location}
                </span>
              </div>

              {/* Quote — the emotional core */}
              <blockquote className="mt-4 text-[15px] font-normal leading-[1.72] text-[var(--t2)]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* Bottom: avatar + name + result chip */}
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-[10px]">
                  <div
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold leading-none tracking-[0.04em] text-[var(--p300)]"
                    style={{
                      background: "rgba(168,85,247,0.11)",
                      border: "1px solid rgba(168,85,247,0.2)",
                    }}
                    aria-hidden="true"
                  >
                    {t.initials}
                  </div>
                  <div className="leading-none">
                    <p className="text-[13px] font-semibold text-[var(--t1)]">{t.name}</p>
                    <p className="mt-[4px] text-[10px] font-medium text-[var(--t5)]">
                      Verified client
                    </p>
                  </div>
                </div>

                <span
                  className="shrink-0 rounded-full px-[10px] py-[5px] text-[10.5px] font-semibold leading-none text-[var(--p300)]"
                  style={{
                    background: "rgba(168,85,247,0.09)",
                    border: "1px solid rgba(168,85,247,0.17)",
                  }}
                >
                  {t.result}
                </span>
              </div>
            </article>
          ))}
        </div>

        {/* Micro trust anchor — restrained, for the skeptical scanner */}
        <p className="mt-8 text-center text-[11px] font-medium leading-[1.55] text-[var(--t5)] sm:mt-9">
          <span className="mr-1 text-[var(--p500)]/60" aria-hidden="true">★★★★★</span>
          Trusted by 200+ Indian hypothyroid women &mdash; thyroid-specific coaching only
        </p>

      </div>
    </section>
  );
}
