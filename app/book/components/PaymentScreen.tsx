"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const TRUST_ITEMS = [
  { icon: "🔒", label: "Secure payment" },
  { icon: "💳", label: "All UPI & cards" },
  { icon: "✅", label: "Instant confirmation" },
  { icon: "♻️", label: "Full refund if no clarity" },
];

const WHAT_NEXT = [
  {
    num: "01",
    title: "Pay the ₹299 booking fee",
    body: "Secures your priority slot. Fully refundable if you don't leave with clarity.",
  },
  {
    num: "02",
    title: "Answer 6 deep intake questions",
    body: "Helps Swapnil study your case before you even speak. No wasted time.",
  },
  {
    num: "03",
    title: "Pick your session time",
    body: "Choose from available private slots. Zoom link sent instantly.",
  },
];

export function PaymentScreen({
  name,
  onPay,
}: {
  name: string;
  onPay: () => void;
}) {
  const [loading, setLoading] = useState(false);

  function handlePay() {
    setLoading(true);
    onPay();
  }

  const firstName = name.split(" ")[0] || name;

  return (
    <div className="space-y-5">
      {/* Approved badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex justify-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 shadow-[0_0_24px_rgba(52,211,153,0.1)]">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
            Profile Accepted
          </span>
        </div>
      </motion.div>

      {/* Hero message */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[24px] border border-white/8 bg-white/[0.025] p-6 text-center backdrop-blur-xl"
      >
        <h2 className="mb-3 text-[1.6rem] font-black leading-[1.1] tracking-[-0.04em] text-white">
          Your profile has been{" "}
          <span className="bg-gradient-to-r from-purple-300 to-violet-500 bg-clip-text text-transparent">
            accepted{firstName ? `, ${firstName}` : ""}.
          </span>
        </h2>

        <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-3.5">
          <p className="text-[0.83rem] font-semibold text-amber-200/85">
            Your slot is not secured yet.
          </p>
          <p className="mt-1 text-[0.75rem] text-amber-200/50">
            Complete the ₹299 booking fee to lock your priority consultation.
          </p>
        </div>

        <p className="text-[0.8rem] leading-relaxed text-white/45">
          Swapnil personally reviews every intake before speaking with you.
          Nothing is wasted — every minute of your 60-minute session is
          focused entirely on your thyroid case.
        </p>
      </motion.div>

      {/* What happens next */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="mb-3 text-center text-[0.62rem] font-bold uppercase tracking-[0.22em] text-white/20">
          What happens after payment
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

      {/* Payment card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[28px] border border-purple-500/20 bg-gradient-to-b from-purple-500/[0.10] to-transparent p-6 shadow-[0_20px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
      >
        {/* Scarcity pill */}
        <div className="mb-5 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-400/10 px-4 py-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-300 shadow-[0_0_8px_rgba(196,181,253,0.8)]" />
            <span className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-purple-200/85">
              Only 3 slots remaining this week
            </span>
          </div>
        </div>

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
          onClick={handlePay}
          disabled={loading}
          className="group mb-4 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 px-5 py-5 shadow-[0_10px_40px_rgba(124,58,237,0.4)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_14px_50px_rgba(124,58,237,0.5)] active:scale-[0.99] disabled:opacity-70"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <div className="text-[1.05rem] font-extrabold tracking-[-0.02em] text-white">
            {loading ? "Taking you to payment…" : "Secure My Private Slot — ₹299"}
          </div>
          <div className="mt-1 text-[0.72rem] text-white/65">
            Private · 60 min · Written action plan included
          </div>
        </button>

        <p className="text-center text-[0.68rem] text-white/30">
          Full refund if you do not leave with complete clarity
        </p>
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
