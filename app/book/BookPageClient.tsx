"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { COACH_IMAGE, COACH_NAME } from "@/app/lib/authority";

// ── DataLayer ────────────────────────────────────────────────────────────────

import { pushDL, trackViewContent, trackCtaClick } from "@/app/lib/analytics";

// ── EMQ capture (Meta CAPI attribution) ──────────────────────────────────────

function useEMQCapture() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const stored = localStorage.getItem("emq_data");
      const emq: Record<string, string> = stored ? JSON.parse(stored) : {};
      const now = String(Date.now());

      if (!emq.session_id) {
        emq.session_id = `${now}-${Math.random().toString(36).slice(2)}`;
      }

      for (const k of [
        "fbclid",
        "gclid",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
      ]) {
        const v = url.searchParams.get(k);
        if (v) {
          emq[k] = v;
          emq[`${k}_ts`] = now;
        }
      }

      emq.last_page = window.location.pathname;
      emq.last_seen = now;
      localStorage.setItem("emq_data", JSON.stringify(emq));
      pushDL({ event: "emq_captured", session_id: emq.session_id });
    } catch {
      // non-critical
    }
  }, []);
}

// ── Motion variants ───────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.58, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.11 } },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TALLY_FORM_ID =
  process.env.NEXT_PUBLIC_TALLY_FORM_ID ?? "PLACEHOLDER";

const REASSURANCE = [
  {
    icon: "🌿",
    title: "Real Indian food. Zero restrictions.",
    body: "No salads you hate. No giving up roti. This is built around your kitchen, your culture, your life.",
  },
  {
    icon: "🔬",
    title: "Your thyroid — not a generic protocol",
    body: "Swapnil studies your bloodwork and symptoms before the session. Every minute is about your specific situation.",
  },
  {
    icon: "💙",
    title: "You'll finally feel heard",
    body: "You've probably been told 'your thyroid looks fine.' Swapnil looks at the full hormonal picture — not just TSH.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Fill your thyroid profile",
    body: "8 short questions about your symptoms, history, and goals. Under 4 minutes.",
  },
  {
    num: "02",
    title: "Swapnil prepares your session",
    body: "Your answers are reviewed before the call. No time wasted on basics — we start with insight.",
  },
  {
    num: "03",
    title: "Your private 60-minute strategy session",
    body: "A focused call. No generic advice. You leave with clarity and a personal action plan.",
  },
];

const COACH_POINTS = [
  "5+ years specialising in thyroid-friendly fat loss",
  "Evidence-based nutrition built around Indian cooking",
  "Weekly 1-on-1 accountability — not a group chat",
  "4.9 ★ average rating across 200+ clients",
];

// ── Tally embed ───────────────────────────────────────────────────────────────

function TallyEmbed({ formId }: { formId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [iframeSrc, setIframeSrc] = useState("");

  // Lazy-load: start loading 300px before viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          obs.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Build src with UTM / fbclid attribution continuity
  useEffect(() => {
    if (!shouldLoad) return;
    const params = new URLSearchParams({
      alignLeft: "1",
      hideTitle: "1",
      transparentBackground: "1",
    });
    try {
      const url = new URL(window.location.href);
      for (const k of [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "fbclid",
        "gclid",
      ]) {
        const v = url.searchParams.get(k);
        if (v) params.set(k, v);
      }
    } catch {
      // non-critical
    }
    setIframeSrc(`https://tally.so/embed/${formId}?${params.toString()}`);
    pushDL({ event: "tally_in_view", form_id: formId });
  }, [shouldLoad, formId]);

  // Listen for Tally postMessage events
  useEffect(() => {
    function handler(e: MessageEvent) {
      try {
        const data: unknown =
          typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (
          data &&
          typeof data === "object" &&
          "type" in data
        ) {
          const t = (data as { type: string }).type;
          if (t === "tally-form-submitted") {
            pushDL({ event: "tally_form_submitted", form_id: formId });
          }
          if (t === "tally-form-started") {
            pushDL({ event: "form_start", form_id: formId });
          }
        }
      } catch {
        // non-critical
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [formId]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight: 680 }}>
      {/* Skeleton shown while loading */}
      {!loaded && (
        <div
          className="absolute inset-0 rounded-[var(--r-xl)] overflow-hidden"
          style={{
            background: "var(--s1)",
            border: "1px solid var(--b-soft)",
          }}
          aria-hidden="true"
        >
          {shouldLoad ? (
            <div className="flex h-full items-center justify-center gap-2.5">
              {[0, 140, 280].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 animate-bounce rounded-full bg-[var(--p500)]"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="section-label">Your Application</p>
              <p
                className="text-[length:var(--text-sm)]"
                style={{ color: "var(--t4)" }}
              >
                Form loading shortly…
              </p>
            </div>
          )}
        </div>
      )}

      {/* Iframe — opacity transition prevents CLS flash */}
      {iframeSrc && (
        <iframe
          src={iframeSrc}
          width="100%"
          height="680"
          style={{
            border: "none",
            display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 500ms ease",
          }}
          title="Book your thyroid strategy session"
          onLoad={() => {
            setLoaded(true);
            pushDL({ event: "tally_loaded", form_id: formId });
          }}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookPageClient() {
  useEMQCapture();

  // Page-level tracking + scroll depth
  useEffect(() => {
    // page_view is fired by RouteTracker in layout — no duplicate here
    trackViewContent("book");

    const depths = [25, 50, 75, 100];
    const fired = new Set<number>();

    function onScroll() {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.round((window.scrollY / max) * 100);
      for (const d of depths) {
        if (pct >= d && !fired.has(d)) {
          fired.add(d);
          pushDL({ event: "scroll_depth", depth: d, page_type: "book" });
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToForm(location: string) {
    trackCtaClick(location);
    document
      .getElementById("book-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--bg-page)", color: "var(--t1)" }}
    >

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        className="relative overflow-hidden"
        aria-labelledby="book-hero-heading"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(80vw,500px)]"
        >
          <div className="absolute left-1/2 top-[-12%] h-[min(72vw,360px)] w-[min(72vw,360px)] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.08] blur-[130px]" />
          <div className="absolute left-1/2 top-[18%] h-20 w-[min(90vw,420px)] -translate-x-1/2 rounded-full bg-[#c026d3]/[0.04] blur-[80px]" />
        </div>

        <div className="container-narrow relative z-10 flex flex-col items-center pb-[clamp(3.5rem,8vw,5.5rem)] pt-[clamp(3rem,6vw,4.5rem)] text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="flex w-full flex-col items-center"
          >
            {/* Category badge */}
            <motion.div variants={fadeUp} className="mb-6">
              <span className="badge-pill">
                <span className="badge-dot" aria-hidden="true" />
                ₹299 · Private Thyroid Strategy Session
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              id="book-hero-heading"
              variants={fadeUp}
              className="mx-auto max-w-[17ch] text-balance text-[length:var(--text-hero)] font-black leading-[1.04] tracking-[-0.045em]"
            >
              You&apos;ve already{" "}
              <span className="text-gradient">done the hardest part.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-5 max-w-[38ch] text-pretty text-[length:var(--text-base)] leading-[1.8] text-[var(--t2)] sm:mt-6"
            >
              You decided to stop guessing and start understanding. Complete the
              short form below — and in 60 minutes, you&apos;ll know exactly
              what your thyroid needs to start moving.
            </motion.p>

            {/* CTA */}
            <motion.div
              variants={fadeUp}
              className="cta-wrap mt-8 max-w-[min(100%,20rem)] sm:mt-9"
            >
              <button
                type="button"
                onClick={() => scrollToForm("hero")}
                className="cta-button relative z-[1]"
                aria-label="Scroll to application form"
              >
                <span className="cta-label">Complete My Application</span>
                <span className="cta-sub">
                  Takes under 4 minutes · ₹299 session
                </span>
              </button>
            </motion.div>

            {/* Micro trust signals */}
            <motion.ul
              variants={fadeUp}
              className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.72rem] text-[var(--t4)]"
              aria-label="Guarantees"
            >
              {[
                "Full refund if no clarity",
                "Real Indian food · No crash diets",
                "200+ women helped",
              ].map((s) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span
                    className="text-emerald-400/70"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  {s}
                </li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ REASSURANCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        className="section-pad relative"
        style={{ background: "var(--bg-section)" }}
        aria-label="Why this works"
      >
        <div className="section-glow" aria-hidden="true">
          <div className="glow-section" />
        </div>

        <div className="container-narrow relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center"
          >
            <motion.p variants={fadeUp} className="section-label">
              Why this feels different
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="section-title mx-auto"
              style={{ maxWidth: "26ch" }}
            >
              Because you&apos;ve tried everything else.{" "}
              <span className="text-gradient">
                This is designed for your thyroid.
              </span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="section-lead mx-auto mt-4"
              style={{ maxWidth: "44ch" }}
            >
              You&apos;re not broken. You&apos;ve never had a plan that accounts
              for how a thyroid actually works — with Indian food, your schedule,
              your specific hormones.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mt-10 grid gap-4 sm:grid-cols-3"
          >
            {REASSURANCE.map((pt) => (
              <motion.div key={pt.title} variants={fadeUp} className="glass-card p-6">
                <div className="mb-3 text-2xl" aria-hidden="true">
                  {pt.icon}
                </div>
                <h3 className="mb-2 text-[length:var(--text-base)] font-bold leading-snug tracking-[-0.02em] text-[var(--t1)]">
                  {pt.title}
                </h3>
                <p className="text-[length:var(--text-sm)] leading-relaxed text-[var(--t3)]">
                  {pt.body}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━ WHAT HAPPENS NEXT ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        className="section-pad relative"
        style={{ background: "var(--bg-page)" }}
        aria-labelledby="process-heading"
      >
        <div className="container-narrow relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center"
          >
            <motion.p variants={fadeUp} className="section-label">
              What happens next
            </motion.p>
            <motion.h2
              id="process-heading"
              variants={fadeUp}
              className="section-title mx-auto"
              style={{ maxWidth: "22ch" }}
            >
              Simple. Private.{" "}
              <span className="text-gradient">
                Focused entirely on you.
              </span>
            </motion.h2>
          </motion.div>

          <motion.ol
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mt-10 flex flex-col gap-4"
            aria-label="How the session works"
          >
            {STEPS.map((step, i) => (
              <motion.li
                key={step.num}
                variants={fadeUp}
                className="glass-card flex gap-5 p-6"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black text-[var(--p300)]"
                  style={{
                    background: "var(--p-subtle)",
                    border: "1px solid var(--p-border)",
                  }}
                  aria-label={`Step ${i + 1}`}
                >
                  {step.num}
                </div>
                <div>
                  <h3 className="mb-1.5 text-[length:var(--text-base)] font-bold tracking-[-0.02em] text-[var(--t1)]">
                    {step.title}
                  </h3>
                  <p className="text-[length:var(--text-sm)] leading-relaxed text-[var(--t3)]">
                    {step.body}
                  </p>
                </div>
              </motion.li>
            ))}
          </motion.ol>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="cta-wrap cta-glow-mid mx-auto mt-9 max-w-[min(100%,20rem)]"
          >
            <button
              type="button"
              onClick={() => scrollToForm("process")}
              className="cta-button relative z-[1]"
            >
              <span className="cta-label">Begin My Application</span>
              <span className="cta-sub">₹299 · 60 minutes · Limited spots</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ COACH TRUST ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        className="section-pad relative"
        style={{ background: "var(--bg-section)" }}
        aria-labelledby="coach-heading"
      >
        <div className="section-glow" aria-hidden="true">
          <div className="glow-section" />
        </div>

        <div className="container-narrow relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="flex flex-col items-center gap-8 sm:flex-row sm:items-start"
          >
            {/* Portrait */}
            <motion.div variants={fadeUp} className="coach-portrait-wrap shrink-0">
              <div className="coach-portrait-glow" aria-hidden="true" />
              <article
                className="glass-card relative overflow-hidden rounded-[var(--r-xl)]"
                style={{ border: "1px solid var(--p-border)" }}
              >
                <div
                  className="relative aspect-[3/4] w-full"
                  style={{ background: "var(--s2)" }}
                >
                  <Image
                    src={COACH_IMAGE}
                    alt={`${COACH_NAME}, thyroid fat-loss coach`}
                    fill
                    sizes="(max-width: 640px) 68vw, 200px"
                    className="object-cover object-top"
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-0"
                    aria-hidden="true"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(15,16,18,0.55) 0%, transparent 42%)",
                    }}
                  />
                </div>
                <div
                  className="border-t px-3 py-2.5 text-center"
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}
                >
                  <p className="text-sm font-bold tracking-[-0.02em] text-[var(--t1)]">
                    {COACH_NAME}
                  </p>
                  <p className="mt-0.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-[var(--p400)]">
                    Thyroid Fat-Loss Specialist
                  </p>
                </div>
              </article>
            </motion.div>

            {/* Copy */}
            <motion.div
              variants={fadeUp}
              className="min-w-0 flex-1 text-center sm:text-left"
            >
              <p className="section-label">Your Coach</p>
              <h2
                id="coach-heading"
                className="section-title"
                style={{ maxWidth: "22ch" }}
              >
                The specialist who{" "}
                <span className="text-gradient">built this for you</span>
              </h2>
              <p
                className="section-lead mx-auto mt-3 sm:mx-0"
                style={{ maxWidth: "44ch" }}
              >
                Swapnil Umbarkar has helped 200+ Indian women with
                hypothyroidism lose weight sustainably — without crash diets,
                without giving up Indian food, and without ignoring how their
                thyroid actually works.
              </p>

              <ul className="mx-auto mt-5 max-w-md space-y-2.5 sm:mx-0">
                {COACH_POINTS.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2.5 text-[length:var(--text-sm)] leading-snug text-[var(--t2)]"
                  >
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--p400)]"
                      aria-hidden="true"
                    />
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => scrollToForm("coach")}
                  className="btn-ghost"
                  style={{ maxWidth: "22rem" }}
                >
                  <span>Reserve My Session With Swapnil</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TALLY FORM ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        id="book-form"
        className="section-pad relative"
        style={{ background: "var(--bg-page)" }}
        aria-labelledby="form-heading"
      >
        <div className="container-narrow relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="text-center"
          >
            <motion.p variants={fadeUp} className="section-label">
              Your Application
            </motion.p>
            <motion.h2
              id="form-heading"
              variants={fadeUp}
              className="section-title mx-auto"
              style={{ maxWidth: "26ch" }}
            >
              Tell us about your thyroid.{" "}
              <span className="text-gradient">We&apos;ll do the rest.</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="section-lead mx-auto mt-3"
              style={{ maxWidth: "40ch" }}
            >
              8 short questions. Under 4 minutes. Your answers let Swapnil
              prepare a session that&apos;s entirely about your situation.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={fadeUp}
            className="mt-8"
          >
            <TallyEmbed formId={TALLY_FORM_ID} />
          </motion.div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ GUARANTEE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        className="section-pad relative"
        style={{ background: "var(--bg-section)" }}
        aria-labelledby="guarantee-heading"
      >
        <div className="section-glow" aria-hidden="true">
          <div className="glow-section" />
        </div>

        <div className="container-narrow relative z-10 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="flex flex-col items-center"
          >
            <motion.div variants={fadeUp} className="mb-6">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
                style={{
                  background: "var(--p-subtle)",
                  border: "1px solid var(--p-border)",
                }}
                aria-hidden="true"
              >
                🛡️
              </div>
            </motion.div>

            <motion.p variants={fadeUp} className="section-label">
              Our Guarantee
            </motion.p>
            <motion.h2
              id="guarantee-heading"
              variants={fadeUp}
              className="section-title mx-auto"
              style={{ maxWidth: "24ch" }}
            >
              Leave with clarity —{" "}
              <span className="text-gradient">
                or your ₹299 back. No questions.
              </span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="section-lead mx-auto mt-4"
              style={{ maxWidth: "46ch" }}
            >
              If you complete the session and don&apos;t walk away with a
              clearer understanding of your thyroid and a concrete next step, we
              refund you immediately. That&apos;s how confident Swapnil is in
              this process.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="cta-wrap cta-glow-strong mx-auto mt-9 max-w-[min(100%,20rem)]"
            >
              <button
                type="button"
                onClick={() => scrollToForm("guarantee")}
                className="cta-button relative z-[1]"
              >
                <span className="cta-label">Complete My Application</span>
                <span className="cta-sub">
                  ₹299 · Fully refundable if not satisfied
                </span>
              </button>
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="mt-5 text-[0.7rem] leading-relaxed text-[var(--t5)]"
            >
              Limited slots available each week. Applications reviewed within 24
              hours.
            </motion.p>
          </motion.div>
        </div>
      </section>

    </main>
  );
}
