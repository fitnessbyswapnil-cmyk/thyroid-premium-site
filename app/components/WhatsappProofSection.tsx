"use client";

import { useRef, useState, useEffect } from "react";
import CtaButton from "./CtaButton";
import SectionHeader from "./SectionHeader";

// ─── DATA ─────────────────────────────────────────────────────────────────────
// Replace imgSrc with your actual hosted screenshot URLs
const PROOFS = [
  {
    id: "namarata",
    metric: "TSH 7.8 → 3.1",
    headline: "Finally Not Tired\nAll The Time.",
    tags: ["No More Fatigue", "Focus Restored"],
    name: "Namarata S.",
    role: "Hypothyroid Client",
    imgSrc: "https://swapnilumbarkarfitness.in/wp-content/uploads/namarata-whatsapp.jpg",
    imgPosition: "center top",
  },
  {
    id: "sima",
    metric: "4 KG LOST",
    headline: "4 kg Gone.\nDespite Thyroid.",
    tags: ["Belly Fat ↓", "1 Week Results"],
    name: "Sima P.",
    role: "Hypothyroid Client",
    imgSrc: "https://swapnilumbarkarfitness.in/wp-content/uploads/sima-whatsapp.jpg",
    imgPosition: "center top",
  },
  // ← add more proofs here
] as const;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const CARD_W_CSS = "min(82vw, 340px)";
const SPACER_W_CSS = `calc((100vw - ${CARD_W_CSS}) / 2)`;

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function WhatsAppProof() {
  const trackRef = useRef<HTMLDivElement>(null);
  // active = 0 on both SSR and first client paint → no hydration mismatch
  const [active, setActive] = useState(0);

  // ── Scroll → active card tracking ─────────────────────────────────────────
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const update = () => {
      const viewCenter = track.scrollLeft + track.clientWidth / 2;
      let closest = 0;
      let minDist = Infinity;
      Array.from(track.children).forEach((child, i) => {
        const el = child as HTMLElement;
        const dist = Math.abs(el.offsetLeft + el.offsetWidth / 2 - viewCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      // subtract 1 for the leading spacer div
      setActive(Math.max(0, closest - 1));
    };

    track.addEventListener("scroll", update, { passive: true });
    return () => track.removeEventListener("scroll", update);
  }, []);

  // ── Programmatic scroll ────────────────────────────────────────────────────
  const scrollTo = (idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    // children[0] = spacer, children[idx+1] = card
    const card = track.children[idx + 1] as HTMLElement | undefined;
    if (!card) return;
    track.scrollTo({
      left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
      behavior: "smooth",
    });
  };

  return (
    <section className="section-pad relative overflow-hidden bg-[var(--bg-page)] text-white">

      {/* ── Atmospheric depth glows ──────────────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-violet-600 opacity-[0.055] blur-[130px]" />
        <div className="absolute -bottom-16 left-0 h-[380px] w-[420px] rounded-full bg-purple-950 opacity-[0.08] blur-[100px]" />
        <div className="absolute -bottom-16 right-0 h-[380px] w-[420px] rounded-full bg-violet-950 opacity-[0.07] blur-[100px]" />
      </div>

      <div className="relative z-10">

        {/* ── Section header ─────────────────────────────────────────────────── */}
        <div className="container-default">
          <SectionHeader
            label="Real Proof"
            title={
              <>
                Real Women.{" "}
                <span className="text-gradient">Real WhatsApp.</span>
              </>
            }
            lead="Indian women sharing real progress — belly fat down, energy back, clothes fitting again."
            titleMaxCh="18ch"
          />
        </div>

        {/* ── SNAP CAROUSEL ──────────────────────────────────────────────────── */}
        <div
          ref={trackRef}
          className="flex gap-4 overflow-x-auto pb-5 pt-1
                     [-ms-overflow-style:none] [scrollbar-width:none]
                     [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {/* Leading spacer → first card snaps to visual center */}
          <div className="shrink-0" style={{ width: SPACER_W_CSS }} aria-hidden />

          {PROOFS.map((p, i) => {
            const isActive = active === i;
            return (
              <article
                key={p.id}
                onClick={() => scrollTo(i)}
                className="shrink-0 cursor-pointer overflow-hidden rounded-[28px]
                           transition-all duration-500 ease-out will-change-transform"
                style={{
                  width: CARD_W_CSS,
                  scrollSnapAlign: "center",
                  transform: isActive ? "scale(1)" : "scale(0.92)",
                  opacity: isActive ? 1 : 0.48,
                  // Active card: violet tint + glow; inactive: neutral glass
                  background: isActive
                    ? "linear-gradient(150deg, rgba(139,92,246,0.13) 0%, rgba(109,40,217,0.07) 50%, rgba(255,255,255,0.02) 100%)"
                    : "linear-gradient(150deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.01) 100%)",
                  boxShadow: isActive
                    ? "0 0 0 1px rgba(139,92,246,0.3), 0 32px 80px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.13)"
                    : "0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.35)",
                }}
              >

                {/* ①  METRIC CHIP ─────────────────────────────────────────── */}
                <div className="px-5 pt-5">
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-[7px]"
                    style={{
                      background: "rgba(139,92,246,0.14)",
                      border: "1px solid rgba(139,92,246,0.32)",
                    }}
                  >
                    {/* Pulsing dot */}
                    <span
                      className="h-[7px] w-[7px] shrink-0 rounded-full"
                      style={{
                        background: "var(--p300)",
                        boxShadow: "0 0 8px var(--p300)",
                      }}
                    />
                    <span className="font-mono text-[11px] font-extrabold tracking-[0.15em] text-[var(--p300)]">
                      {p.metric}
                    </span>
                  </div>
                </div>

                {/* ②  HEADLINE ────────────────────────────────────────────── */}
                <div className="px-5 pb-4 pt-3">
                  <h3
                    className="whitespace-pre-line font-bold leading-[1.2] text-white"
                    style={{ fontSize: "clamp(1.15rem, 5vw, 1.3rem)" }}
                  >
                    {p.headline}
                  </h3>
                </div>

                {/* ③  SCREENSHOT — phone-frame treatment ──────────────────── */}
                <div className="px-5">
                  <div
                    className="relative mx-auto w-full overflow-hidden"
                    style={{
                      // 9:15 ≈ slightly taller than 16:9 landscape — ideal for
                      // portrait WhatsApp screenshots showing chat threads
                      aspectRatio: "9 / 15",
                      borderRadius: "18px",
                      border: "1.5px solid rgba(255,255,255,0.1)",
                      background: "#07060f",
                      boxShadow:
                        "0 12px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)",
                    }}
                  >
                    {/* Screen-glass shimmer overlay — pure CSS, no images */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 z-10"
                      style={{
                        background:
                          "linear-gradient(128deg, rgba(255,255,255,0.06) 0%, transparent 40%)",
                      }}
                    />

                    {/* Actual WhatsApp screenshot */}
                    <img
                      src={p.imgSrc}
                      alt={`WhatsApp proof: ${p.name}`}
                      draggable={false}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full select-none"
                      style={{
                        objectFit: "cover",
                        objectPosition: p.imgPosition,
                        display: "block",
                      }}
                    />
                  </div>
                </div>

                {/* ④  BENEFIT TAGS ────────────────────────────────────────── */}
                <div className="flex flex-wrap gap-2 px-5 pt-4">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-3 py-[5px] text-[11px] font-semibold"
                      style={{
                        background: "rgba(139,92,246,0.1)",
                        border: "1px solid rgba(139,92,246,0.2)",
                        color: "rgba(196,181,253,0.88)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* ⑤  CLIENT IDENTITY ─────────────────────────────────────── */}
                <div className="flex items-center gap-3 px-5 pb-5 pt-4">
                  {/* Gradient avatar */}
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                               text-[13px] font-bold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--p300) 0%, #7c3aed 100%)",
                      boxShadow: "0 0 0 2px rgba(139,92,246,0.22)",
                    }}
                  >
                    {p.name.charAt(0)}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold leading-none text-white/85">
                      {p.name}
                    </p>
                    <p className="mt-[5px] text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">
                      {p.role}
                    </p>
                  </div>
                </div>

              </article>
            );
          })}

          {/* Trailing spacer */}
          <div className="shrink-0" style={{ width: SPACER_W_CSS }} aria-hidden />
        </div>

        {/* ── DOT INDICATORS ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-[7px] mt-1">
          {PROOFS.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`Go to proof ${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{
                height: "5px",
                borderRadius: "9999px",
                width: active === i ? "22px" : "5px",
                background:
                  active === i
                    ? "var(--p300)"
                    : "rgba(255,255,255,0.16)",
              }}
            />
          ))}
        </div>

        <p className="mt-2.5 text-center text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-white/18">
          Swipe to see more
        </p>

        {/* ── CTA ────────────────────────────────────────────────────────────── */}
        <div className="container-default">
          <div className="cta-wrap section-cta mx-auto mt-9 max-w-sm">
            <p className="micro-trust text-center">
              <span className="text-[var(--p300)]" aria-hidden>
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

      </div>
    </section>
  );
}