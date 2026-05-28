"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

const TRUST_ITEMS = [
  { icon: "🔒", label: "Secure payment" },
  { icon: "💳", label: "All UPI & cards" },
  { icon: "✅", label: "Instant confirmation" },
  { icon: "♻️", label: "Full refund if no clarity" },
];

const WHAT_NEXT = [
  {
    num: "02",
    title: "Complete your thyroid assessment",
    body: "A short personalised intake — your symptoms, history, and frustrations. Swapnil studies this before you speak.",
  },
  {
    num: "03",
    title: "Pick your session time",
    body: "Choose any available private slot. Zoom link sent instantly to WhatsApp.",
  },
  {
    num: "04",
    title: "Your private 60-minute strategy session",
    body: "A focused call built entirely around your thyroid case. You leave with a clear, personal action plan.",
  },
];

const CTA_BULLETS = [
  "Personalized thyroid review",
  "60-minute private strategy session",
  "Written action plan included",
  "Fully refundable if no clarity",
];

export function PaymentScreen({
  name,
  onPay,
  loading = false,
  error = "",
}: {
  name: string;
  onPay: () => void;
  loading?: boolean;
  error?: string;
}) {
  const firstName = name.split(" ")[0] || name;

  // Dynamic scarcity — computed once per mount; believable range 2–4
  const slotCount = useMemo(() => Math.floor(Math.random() * 3) + 2, []);

  return (
    <div className="space-y-5">

      {/* Step label */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        className="text-center text-[0.62rem] font-bold uppercase tracking-[0.22em] text-purple-400/70"
      >
        Step 2 of 4 · Secure Your Spot
      </motion.p>

      {/* Scarcity indicator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="flex justify-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-4 py-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          <span className="text-[0.64rem] font-bold uppercase tracking-[0.18em] text-emerald-300/90">
            {slotCount} private slots remaining this week
          </span>
        </div>
      </motion.div>

      {/* Hero message */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[24px] border border-white/8 bg-white/[0.025] p-6 text-center backdrop-blur-xl"
      >
        <h2 className="mb-3 text-[1.55rem] font-black leading-[1.1] tracking-[-0.04em] text-white">
          Your Thyroid Consultation{" "}
          <span className="bg-gradient-to-r from-purple-300 to-violet-500 bg-clip-text text-transparent">
            Spot Is Ready{firstName ? `, ${firstName}` : ""}.
          </span>
        </h2>

        <p className="text-[0.82rem] leading-relaxed text-white/50">
          Your answers have been received successfully.
          Swapnil will personally review your thyroid profile before the session.
        </p>
        <p className="mt-2 text-[0.82rem] font-medium leading-relaxed text-white/65">
          Secure your private consultation slot now to continue.
        </p>
      </motion.div>

      {/* Payment card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[28px] border border-purple-500/22 bg-gradient-to-b from-purple-500/[0.11] to-transparent p-6 shadow-[0_20px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
      >
        {/* Session line */}
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4">
          <div>
            <p className="text-[0.88rem] font-semibold text-white/90">
              Private Thyroid Strategy Session
            </p>
            <p className="mt-1 text-[0.72rem] text-white/38">
              60 min · 1-on-1 · With Swapnil
            </p>
          </div>
          <div className="text-right">
            <p className="bg-gradient-to-r from-purple-300 to-violet-500 bg-clip-text text-[1.5rem] font-black text-transparent">
              ₹299
            </p>
            <p className="text-[0.65rem] text-white/28 line-through">₹2,999</p>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onPay}
          disabled={loading}
          className="group mb-4 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 px-5 py-5 shadow-[0_10px_40px_rgba(124,58,237,0.4)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_14px_50px_rgba(124,58,237,0.5)] active:scale-[0.99] disabled:opacity-70"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {loading ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin text-white/80"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-[1rem] font-extrabold tracking-[-0.02em] text-white">
                  Redirecting to secure payment…
                </span>
              </div>
              <div className="mt-1 text-[0.72rem] text-white/60">Please wait, do not close this page</div>
            </>
          ) : (
            <>
              <div className="text-[1.05rem] font-extrabold tracking-[-0.02em] text-white">
                Secure My Private Consultation — ₹299
              </div>
              <div className="mt-1 text-[0.72rem] text-white/65">
                Tap to pay securely · All UPI & cards accepted
              </div>
            </>
          )}
        </button>

        {/* CTA bullet trust points */}
        <ul className="mb-4 space-y-1.5">
          {CTA_BULLETS.map((b) => (
            <li key={b} className="flex items-center gap-2 text-[0.75rem] text-white/55">
              <span className="text-emerald-400/80">✔</span>
              {b}
            </li>
          ))}
        </ul>

        {error && (
          <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-[0.78rem] text-red-300/90">
            {error}
          </p>
        )}

        <p className="text-center text-[0.66rem] text-white/25">
          Full refund if you do not leave with complete clarity
        </p>
      </motion.div>

      {/* What happens next */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="mb-3 text-center text-[0.62rem] font-bold uppercase tracking-[0.22em] text-white/20">
          After payment
        </p>
        <div className="space-y-2.5">
          {WHAT_NEXT.map((step) => (
            <div
              key={step.num}
              className="flex gap-4 rounded-2xl border border-white/7 bg-white/[0.025] p-4"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-purple-500/25 bg-purple-500/10 text-[0.65rem] font-bold text-purple-300">
                {step.num}
              </div>
              <div>
                <p className="text-[0.84rem] font-semibold text-white/85">{step.title}</p>
                <p className="mt-0.5 text-[0.74rem] leading-relaxed text-white/40">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Trust row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.45 }}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
      >
        {TRUST_ITEMS.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/6 bg-white/[0.02] py-3.5"
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="text-center text-[0.64rem] font-medium text-white/35">
              {item.label}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
