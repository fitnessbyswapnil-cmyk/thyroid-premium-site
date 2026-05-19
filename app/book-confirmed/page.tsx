"use client";

import { useEffect, useState } from "react";

// ── REPLACE WITH YOUR ACTUAL LINKS ──────────────────────────────────────────
const CASHFREE_URL = "https://payments.cashfree.com/forms/thyroid-session";
const CALENDLY_URL = "https://calendly.com/swapnilumbarkar";
// ────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    title: "Reserve Your Session",
    body: "Complete your Rs.299 payment to confirm your private slot with Swapnil.",
  },
  {
    num: "02",
    title: "WhatsApp Confirmation",
    body: "Swapnil personally sends a confirmation within 2 hours of your payment.",
  },
  {
    num: "03",
    title: "Show Up Ready",
    body: "Bring your most recent thyroid report if you have one. Everything else, Swapnil handles.",
  },
];

export default function BookConfirmedPage() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);

    // Facebook Pixel — Lead event
    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "Lead", {
        content_name: "Thyroid Strategy Session Intake",
        currency: "INR",
        value: 299,
      });
    }

    return () => clearTimeout(t);
  }, []);

  return (
    <main
      className="relative min-h-screen overflow-hidden text-white"
      style={{ background: "#07060f" }}
    >
      {/* ── Background glows ──────────────────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
          style={{
            width: "min(100vw, 720px)",
            height: "600px",
            background:
              "radial-gradient(ellipse, rgba(124,58,237,0.13) 0%, transparent 72%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute -bottom-20 left-0 rounded-full"
          style={{
            width: "380px",
            height: "380px",
            background:
              "radial-gradient(circle, rgba(109,40,217,0.09) 0%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />
        <div
          className="absolute -bottom-20 right-0 rounded-full"
          style={{
            width: "380px",
            height: "380px",
            background:
              "radial-gradient(circle, rgba(88,28,135,0.08) 0%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />
      </div>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <div
        className="relative z-10 mx-auto flex max-w-md flex-col items-center px-5 pb-16 pt-12"
        style={{
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.55s ease, transform 0.55s ease",
        }}
      >

        {/* ── 1. CONFIRMATION HERO ────────────────────────────────────────── */}
        <div className="mb-10 flex w-full flex-col items-center text-center">

          {/* Checkmark circle */}
          <div
            className="mb-5 flex h-[60px] w-[60px] items-center justify-center rounded-full"
            style={{
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.22), rgba(109,40,217,0.12))",
              border: "1px solid rgba(124,58,237,0.38)",
              boxShadow:
                "0 0 28px rgba(124,58,237,0.22), inset 0 1px 0 rgba(255,255,255,0.09)",
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 26 26"
              fill="none"
              aria-hidden
            >
              <path
                d="M5.5 13L10.5 18L20.5 8"
                stroke="#c084fc"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Eyebrow */}
          <p
            className="mb-3 text-[0.62rem] font-bold uppercase tracking-[0.22em]"
            style={{ color: "rgba(167,139,250,0.65)" }}
          >
            Intake Confirmed
          </p>

          {/* Headline */}
          <h1
            className="mb-4 text-balance text-[1.9rem] font-black leading-[1.1] tracking-[-0.04em]"
          >
            Your Private Session{" "}
            <span
              style={{
                background: "linear-gradient(130deg, #c084fc 0%, #7c3aed 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Is Reserved.
            </span>
          </h1>

          <p
            className="max-w-[32ch] text-pretty text-[0.88rem] leading-[1.68]"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Swapnil will personally review your intake before you speak.
            One final step below — it takes 30 seconds.
          </p>
        </div>

        {/* ── 2. WHAT HAPPENS NEXT ────────────────────────────────────────── */}
        <div className="mb-10 w-full">
          <p
            className="mb-3 text-center text-[0.6rem] font-bold uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            What happens next
          </p>

          <div className="flex flex-col gap-2.5">
            {STEPS.map((s, i) => (
              <div
                key={s.num}
                className="flex items-start gap-3.5 rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.038)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.055)",
                  opacity: show ? 1 : 0,
                  transform: show ? "translateY(0)" : "translateY(12px)",
                  transition: `opacity 0.5s ease ${0.15 + i * 0.1}s,
                               transform 0.5s ease ${0.15 + i * 0.1}s`,
                }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center
                              rounded-xl text-[0.68rem] font-black"
                  style={{
                    background: "rgba(124,58,237,0.15)",
                    border: "1px solid rgba(124,58,237,0.3)",
                    color: "#c084fc",
                  }}
                >
                  {s.num}
                </div>
                <div>
                  <p
                    className="mb-0.5 text-[0.85rem] font-bold leading-none"
                    style={{ color: "rgba(255,255,255,0.88)" }}
                  >
                    {s.title}
                  </p>
                  <p
                    className="text-[0.76rem] leading-[1.55]"
                    style={{ color: "rgba(255,255,255,0.42)" }}
                  >
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. PAYMENT CTA ──────────────────────────────────────────────── */}
        <div
          className="mb-8 w-full rounded-3xl p-5"
          style={{
            background:
              "linear-gradient(145deg, rgba(124,58,237,0.14), rgba(109,40,217,0.07))",
            border: "1px solid rgba(124,58,237,0.28)",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.09)",
          }}
        >
          {/* Scarcity badge */}
          <div className="mb-4 flex justify-center">
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{
                background: "rgba(124,58,237,0.15)",
                border: "1px solid rgba(124,58,237,0.3)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: "#c084fc",
                  boxShadow: "0 0 6px #c084fc",
                }}
              />
              <span
                className="text-[0.65rem] font-bold uppercase tracking-[0.14em]"
                style={{ color: "#c084fc" }}
              >
                Only 3 Sessions Remaining This Week
              </span>
            </div>
          </div>

          {/* Value summary */}
          <div className="mb-5 flex items-center justify-between rounded-xl px-3 py-2.5"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div>
              <p
                className="text-[0.8rem] font-semibold"
                style={{ color: "rgba(255,255,255,0.8)" }}
              >
                Private Thyroid Strategy Session
              </p>
              <p
                className="text-[0.7rem]"
                style={{ color: "rgba(255,255,255,0.38)" }}
              >
                60 min · 1-on-1 · With Swapnil
              </p>
            </div>
            <p
              className="text-[1.15rem] font-black"
              style={{
                background: "linear-gradient(130deg, #c084fc, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Rs.299
            </p>
          </div>

          {/* CTA Button */}
          
            href={CASHFREE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex w-full flex-col items-center justify-center
                       rounded-2xl py-4 text-white transition-all duration-200
                       active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              boxShadow:
                "0 0 0 1px rgba(124,58,237,0.5), 0 8px 32px rgba(124,58,237,0.35)",
            }}
          >
            <span className="text-[1rem] font-bold leading-none">
              Reserve My Session — Rs.299
            </span>
            <span
              className="mt-1 text-[0.72rem] font-medium"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              Private · 60 min · Written plan included
            </span>
          </a>

          {/* Guarantee */}
          <p
            className="text-center text-[0.68rem] font-medium leading-[1.5]"
            style={{ color: "rgba(255,255,255,0.38)" }}
          >
            <span style={{ color: "rgba(134,239,172,0.75)" }}>✓</span>{" "}
            Full refund if you don&apos;t leave with complete clarity
          </p>
        </div>

        {/* ── 4. TRUST TESTIMONIAL ────────────────────────────────────────── */}
        <div
          className="mb-8 w-full rounded-2xl p-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p
            className="mb-3 text-[0.82rem] font-semibold italic leading-[1.6]"
            style={{ color: "rgba(255,255,255,0.72)" }}
          >
            &ldquo;I walked in expecting a sales pitch. He spent the full hour
            on my actual reports — my TSH history, my food, my sleep. I left
            with three specific things to try that evening. That alone was
            worth Rs.299.&rdquo;
          </p>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center
                          rounded-full text-[11px] font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              }}
            >
              K
            </div>
            <div>
              <p
                className="text-[0.76rem] font-semibold leading-none"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                Kavitha N.
              </p>
              <p
                className="mt-0.5 text-[0.65rem] uppercase tracking-[0.1em]"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                Hypothyroid · Hyderabad
              </p>
            </div>
            <div className="ml-auto">
              <span
                className="text-[0.65rem] tracking-widest"
                style={{ color: "rgba(167,139,250,0.6)" }}
              >
                ★★★★★
              </span>
            </div>
          </div>
        </div>

        {/* ── 5. BOTTOM TRUST ROW ─────────────────────────────────────────── */}
        <div className="flex w-full items-center justify-center gap-4">
          {[
            "Private & confidential",
            "200+ women helped",
            "ACE · INFS certified",
          ].map((t) => (
            <p
              key={t}
              className="text-center text-[0.62rem] font-medium"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              {t}
            </p>
          ))}
        </div>

      </div>
    </main>
  );
}