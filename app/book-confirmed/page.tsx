"use client";

import { useEffect, useRef, useState } from "react";

const CASHFREE_URL =
  "https://payments.cashfree.com/forms/thyroid-session";

const TESTIMONIALS = [
  {
    name: "Kavitha N.",
    city: "Hyderabad",
    condition: "Hypothyroid",
    rating: 5,
    review:
      "He spent the full hour reviewing my reports, food habits, sleep and medication timing. I finally felt understood instead of rushed.",
    initial: "K",
  },
  {
    name: "Priya R.",
    city: "Mumbai",
    condition: "Hypothyroid",
    rating: 5,
    review:
      "I had visited multiple doctors but nobody explained why I still felt exhausted. This consultation finally connected all the dots.",
    initial: "P",
  },
  {
    name: "Divya M.",
    city: "Bengaluru",
    condition: "Hashimoto's",
    rating: 5,
    review:
      "This was the first consultation where someone genuinely listened to my symptoms instead of giving generic diet advice.",
    initial: "D",
  },
  {
    name: "Ananya S.",
    city: "Pune",
    condition: "Hypothyroid",
    rating: 5,
    review:
      "I was skeptical initially, but the amount of detail and personalization made this feel far more premium than any clinic visit.",
    initial: "A",
  },
  {
    name: "Rekha T.",
    city: "Chennai",
    condition: "Hypothyroid + PCOS",
    rating: 5,
    review:
      "For the first time someone explained why my body was reacting differently despite normal reports.",
    initial: "R",
  },
  {
    name: "Surekha M.",
    city: "Nashik",
    condition: "Hypothyroid",
    rating: 5,
    review:
      "The bloating and fatigue were ruining my confidence. I finally left the consultation with actual clarity and direction.",
    initial: "S",
  },
  {
    name: "Meera K.",
    city: "Delhi",
    condition: "Hashimoto's",
    rating: 5,
    review:
      "He had already reviewed my intake before the call. It genuinely felt like a premium specialist consultation.",
    initial: "M",
  },
  {
    name: "Pooja L.",
    city: "Ahmedabad",
    condition: "Hypothyroid",
    rating: 5,
    review:
      "I finally understood why low-calorie diets were making my symptoms worse instead of helping.",
    initial: "P",
  },
  {
    name: "Nisha B.",
    city: "Kolkata",
    condition: "Fatigue + Thyroid",
    rating: 5,
    review:
      "The emotional relief alone was worth it. I stopped feeling like my symptoms were all in my head.",
    initial: "N",
  },
  {
    name: "Smita J.",
    city: "Jaipur",
    condition: "Hypothyroid",
    rating: 5,
    review:
      "Everything was adapted to my actual lifestyle and routine. Nothing felt generic.",
    initial: "S",
  },
  {
    name: "Heenal R.",
    city: "Bengaluru",
    condition: "Hypothyroid",
    rating: 5,
    review:
      "I wish I had found this years earlier. The clarity and confidence I got from one session was incredible.",
    initial: "H",
  },
  {
    name: "Fathima P.",
    city: "Kochi",
    condition: "Hypothyroid",
    rating: 5,
    review:
      "I finally feel hopeful about my body again. Everything started changing after this consultation.",
    initial: "F",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Secure Your Private Slot",
    body:
      "Complete the refundable Rs.299 booking fee within the next few minutes to lock your consultation priority.",
  },
  {
    num: "02",
    title: "WhatsApp Confirmation",
    body:
      "You’ll receive a personal confirmation message from Swapnil after payment.",
  },
  {
    num: "03",
    title: "Show Up Ready",
    body:
      "Bring your latest thyroid reports if available. Everything else will be guided personally.",
  },
];

export default function BookConfirmedPage() {
  const [mounted, setMounted] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [fade, setFade] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(
    null
  );

  const timeoutRef = useRef<NodeJS.Timeout | null>(
    null
  );

  useEffect(() => {
    setMounted(true);

    intervalRef.current = setInterval(() => {
      setFade(true);

      timeoutRef.current = setTimeout(() => {
        setActiveIdx(
          (prev) =>
            (prev + 1) % TESTIMONIALS.length
        );

        setFade(false);
      }, 500);
    }, 16000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const active = TESTIMONIALS[activeIdx];

  function openPayment() {
    window.open(
      CASHFREE_URL,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07060f] text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[550px] w-[700px] -translate-x-1/2 rounded-full bg-purple-700/10 blur-[120px]" />

        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-violet-700/10 blur-[120px]" />

        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-fuchsia-700/10 blur-[120px]" />
      </div>

      <div
        className={`relative z-10 mx-auto flex max-w-[460px] flex-col px-5 pb-20 pt-14 transition-all duration-700 ${
          mounted
            ? "translate-y-0 opacity-100"
            : "translate-y-5 opacity-0"
        }`}
      >
        {/* Approved badge */}
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/25 bg-purple-500/10 px-4 py-2 shadow-[0_0_30px_rgba(124,58,237,0.15)]">
          <div className="h-2 w-2 rounded-full bg-purple-300 shadow-[0_0_10px_rgba(196,181,253,0.8)]" />

          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-300">
            Application Approved
          </span>
        </div>

        {/* Hero */}
        <div className="mb-10 text-center">
          <h1 className="mb-5 text-[2.3rem] font-black leading-[0.95] tracking-[-0.05em] text-white">
            Your Intake Has{" "}
            <span className="bg-gradient-to-r from-purple-300 to-violet-500 bg-clip-text text-transparent">
              Been Approved.
            </span>
          </h1>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left backdrop-blur-xl">
            <p className="mb-4 text-[0.92rem] leading-7 text-white/70">
              Swapnil will personally review
              your thyroid case before the
              consultation.
            </p>

            <div className="mb-4 rounded-xl border border-purple-500/25 bg-purple-500/10 p-4">
              <p className="text-[0.88rem] font-semibold text-white/90">
                Your priority session slot is
                not secured yet.
              </p>
            </div>

            <p className="text-[0.84rem] leading-7 text-white/50">
              Complete the refundable Rs.299
              booking fee below to lock your
              consultation priority.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="mb-10">
          <p className="mb-4 text-center text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-white/20">
            What happens next
          </p>

          <div className="space-y-3">
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-[0.7rem] font-bold text-purple-300">
                  {step.num}
                </div>

                <div>
                  <h3 className="mb-1 text-[0.9rem] font-bold text-white/90">
                    {step.title}
                  </h3>

                  <p className="text-[0.76rem] leading-6 text-white/45">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment card */}
        <div className="mb-10 rounded-[28px] border border-purple-500/20 bg-gradient-to-b from-purple-500/[0.10] to-purple-500/[0.03] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          {/* Scarcity */}
          <div className="mb-5 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-400/10 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-purple-300 shadow-[0_0_10px_rgba(196,181,253,0.8)]" />

              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-purple-200/90">
                Only 3 Sessions Remaining
                This Week
              </span>
            </div>
          </div>

          {/* Session row */}
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
            <div>
              <p className="text-[0.86rem] font-semibold text-white/85">
                Private Thyroid Strategy
                Session
              </p>

              <p className="mt-1 text-[0.72rem] text-white/40">
                60 min · 1-on-1 · With
                Swapnil
              </p>
            </div>

            <p className="bg-gradient-to-r from-purple-300 to-violet-500 bg-clip-text text-[1.45rem] font-black text-transparent">
              Rs.299
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={openPayment}
            className="group mb-4 w-full rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 px-5 py-5 shadow-[0_10px_40px_rgba(124,58,237,0.4)] transition-all duration-300 hover:scale-[1.01]"
          >
            <div className="text-[1.08rem] font-extrabold tracking-[-0.02em] text-white">
              Secure My Private Slot —
              Rs.299
            </div>

            <div className="mt-1 text-[0.73rem] text-white/65">
              Private · 60 min · Written
              plan included
            </div>
          </button>

          <p className="text-center text-[0.7rem] text-white/35">
            Full refund if you do not leave
            with complete clarity
          </p>
        </div>

        {/* Testimonials */}
        <div className="mb-10">
          <p className="mb-4 text-center text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-white/20">
            Real women. Real clarity.
          </p>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-2xl">
            <div
              className={`transition-opacity duration-500 ${
                fade ? "opacity-0" : "opacity-100"
              }`}
            >
              {/* Stars */}
              <div className="mb-4 flex gap-1">
                {[...Array(active.rating)].map(
                  (_, i) => (
                    <span
                      key={i}
                      className="text-[0.82rem] text-purple-300"
                    >
                      ★
                    </span>
                  )
                )}
              </div>

              {/* Review */}
              <p className="mb-5 text-[0.87rem] italic leading-7 text-white/72">
                “{active.review}”
              </p>

              {/* Footer */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-violet-700 text-sm font-bold text-white">
                  {active.initial}
                </div>

                <div>
                  <p className="text-[0.82rem] font-semibold text-white/85">
                    {active.name}
                  </p>

                  <p className="text-[0.66rem] uppercase tracking-[0.12em] text-white/35">
                    {active.condition} ·{" "}
                    {active.city}
                  </p>
                </div>

                <div className="ml-auto rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1">
                  <span className="text-[0.62rem] font-semibold text-purple-200/80">
                    {activeIdx + 1} /{" "}
                    {TESTIMONIALS.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust row */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {[
            "Private & confidential",
            "200+ women helped",
            "ACE & INFS certified",
            "Refund guaranteed",
          ].map((item) => (
            <span
              key={item}
              className="text-[0.62rem] text-white/20"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}