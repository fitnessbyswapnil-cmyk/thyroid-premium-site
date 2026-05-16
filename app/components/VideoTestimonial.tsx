```jsx
"use client";

import CtaButton from "./CtaButton";
import SectionHeader from "./SectionHeader";

const testimonials = [
  {
    stats: [
      { num: "4.2 kg", label: "Lost" },
      { num: "3 Wks", label: "Timeline" },
      { num: "Energy", label: "Back" },
    ],
    quote: "In 3 weeks I saw what 3 years couldn't give me.",
    name: "Rashmi D.",
    role: "Hypothyroid Client",
    videoUrl:
      "https://swapnilumbarkarfitness.in/wp-content/uploads/2025/08/%F0%9F%8E%A5-Rashmis-3-Week-Thyroid-Fat-Loss-Transformation.mp4",
  },
  {
    stats: [
      { num: "3.8 kg", label: "Lost" },
      { num: "2 Inch", label: "Waist ↓" },
      { num: "Bloat", label: "Gone" },
    ],
    quote: "For the first time in years, I feel confident in my body.",
    name: "Fathima P.",
    role: "Thyroid Coaching Client",
    videoUrl:
      "https://swapnilumbarkarfitness.in/wp-content/uploads/2026/05/%F0%9F%8C%B8-Fathimas-2-Week-Thyroid-Fat-Loss-Update.mp4",
  },
];

export default function VideoTestimonial() {
  return (
    <section className="section-pad relative overflow-hidden bg-[var(--bg-page)] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[var(--p300)] opacity-[0.06] blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[500px] rounded-full bg-purple-900 opacity-[0.08] blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-violet-950 opacity-[0.07] blur-[100px]" />
      </div>

      <div className="container-default relative z-10">
        <SectionHeader
          label="Client Stories"
          title={
            <>
              They Felt Stuck.{" "}
              <span className="text-gradient">Then Everything Changed.</span>
            </>
          }
          lead="Real Indian women sharing honest thyroid fat-loss progress — in their own words."
          titleMaxCh="20ch"
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {testimonials.map((t) => (
            <article
              key={t.name}
              className="group relative overflow-hidden rounded-[var(--r-xl)]"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.07), 0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              {/* ─── VIDEO BLOCK ─────────────────────────────────────────────
                  Key fixes:
                  1. Padding-bottom trick (56.25% = 16:9) gives a stable,
                     layout-shift-free container the browser honours on all
                     mobile engines — no inline aspectRatio style needed.
                  2. The <video> is absolutely positioned and stretched to
                     fill 100 % of that box via inset-0 / h-full / w-full.
                  3. object-cover + object-center ensures the content crops
                     to fill rather than letterboxing.  The inline style
                     duplicates the Tailwind classes — this is intentional:
                     Safari/WebView on iOS sometimes ignores object-fit on
                     <video> when applied only via a stylesheet class; the
                     inline style forces correct rendering.
                  4. overflow-hidden on the wrapper clips any sub-pixel bleed
                     at the rounded corners.
              ──────────────────────────────────────────────────────────────── */}
              <div
                className="relative w-full overflow-hidden bg-black"
                style={{ paddingBottom: "177.78%" /* 9:16 portrait reel */ }}
              >
                <video
                  controls
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 h-full w-full"
                  style={{
                    objectFit: "cover",
                    objectPosition: "center top",
                    display: "block",
                    backgroundColor: "#000",
                  }}
                  aria-label={`Transformation video: ${t.name}`}
                >
                  <source src={t.videoUrl} type="video/mp4" />
                </video>

                {/* Top cinematic vignette — keeps stats pill legible */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-32"
                  style={{
                    background:
                      "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)",
                  }}
                />

                {/* Bottom vignette — bleeds into quote area */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(10,5,25,0.9) 0%, transparent 100%)",
                  }}
                />

                {/* Stats pill */}
                <div
                  className="absolute inset-x-3 top-3 flex overflow-hidden rounded-full"
                  style={{
                    background: "rgba(0,0,0,0.52)",
                    backdropFilter: "blur(18px) saturate(1.5)",
                    WebkitBackdropFilter: "blur(18px) saturate(1.5)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
                  }}
                >
                  {t.stats.map((s, i) => (
                    <div
                      key={`${t.name}-${s.label}-${i}`}
                      className={`flex flex-1 flex-col items-center justify-center py-2 ${
                        i !== t.stats.length - 1
                          ? "border-r border-white/[0.08]"
                          : ""
                      }`}
                    >
                      <span className="text-[12px] font-extrabold leading-none tracking-tight text-[var(--p300)]">
                        {s.num}
                      </span>
                      <span className="mt-[3px] text-[8.5px] font-semibold uppercase tracking-[0.16em] text-white/50">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ─── QUOTE BLOCK ──────────────────────────────────────────── */}
              <div
                className="relative px-5 pb-5 pt-4"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(10,5,25,0.6) 0%, rgba(10,5,25,0.92) 100%)",
                }}
              >
                <div
                  aria-hidden="true"
                  className="absolute left-5 top-4 w-[2px] rounded-full"
                  style={{
                    height: "48px",
                    background:
                      "linear-gradient(to bottom, var(--p300), transparent)",
                    opacity: 0.75,
                  }}
                />
                <p className="pl-4 text-[length:var(--text-sm)] font-semibold leading-snug text-white/90">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-2.5 flex items-center gap-2.5 pl-4">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--p300), #7c3aed)",
                    }}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <p className="text-[0.72rem] leading-none text-white/45">
                    <span className="font-medium text-white/70">{t.name}</span>
                    {" · "}
                    {t.role}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="cta-wrap section-cta mx-auto mt-10 max-w-sm">
          <p className="micro-trust text-center">
            <span className="text-[var(--p300)]" aria-hidden="true">
              ★★★★★
            </span>{" "}
            200+ women transformed across India
          </p>
          <CtaButton
            variant="primary"
            className="w-full"
            label="Apply For Private Coaching"
            sublabel="₹299 strategy session · Limited coaching intake"
            ariaLabel="Apply for private thyroid coaching"
          />
          <p className="text-center text-[0.72rem] text-[var(--t5)]">
            No pressure · Personalized fit review
          </p>
        </div>
      </div>
    </section>
  );
}
```