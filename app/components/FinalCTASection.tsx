"use client";

const CTA_URL = "https://swapnilumbarkarfitness.in/case-studies/#cta";

const includes = [
  "Personalized thyroid fat-loss strategy",
  "Indian nutrition plan for your metabolism",
  "Weekly progress tracking & adjustments",
  "Direct WhatsApp coaching support",
  "Symptom & energy recovery protocol",
];

const certs = ["ACE Certified", "FITR Certified", "INFS Certified", "CPR / BLS"];

export default function FinalCTASection() {
  return (
    <section className="section-pad bg-black text-white">
      <div className="container-narrow text-center">

        <p className="section-label mb-2">Start Today</p>

        <h2 className="mb-3 text-[clamp(1.75rem,1.2rem+2.5vw,2.75rem)] font-black leading-[1.05] tracking-tight">
          Ready to Finally Lose the <span className="text-gradient">Thyroid Fat?</span>
        </h2>

        <p className="mx-auto mb-6 max-w-[30ch] text-sm text-gray-400">
          Book a free 60-min strategy call. No pressure. No upsells. Just clarity.
        </p>

        <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          <div className="flex flex-col items-center gap-3 p-5 sm:flex-row sm:text-left">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-purple-500/20 ring-2 ring-purple-500/30">
              <div className="flex h-full w-full items-center justify-center text-2xl">👨‍⚕️</div>
            </div>
            <div>
              <p className="font-bold text-white">Swapnil Umbarkar</p>
              <p className="text-xs text-purple-400">Thyroid Fat Loss Specialist</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {certs.map((c) => <span key={c} className="chip">{c}</span>)}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4 text-left">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-purple-400">Your Free Call Includes</p>
          <ul className="space-y-2">
            {includes.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-gray-300">
                <span className="mt-0.5 text-purple-500 font-bold leading-none">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="cta-wrap mx-auto">
          <button id="cta-final" type="button" aria-label="Book your free thyroid fat-loss strategy call" className="cta-button" onClick={() => (window.location.href = CTA_URL)}>
            🔥 Book FREE Strategy Call
            <span className="cta-sub">60 Min · Free · Limited Spots This Month</span>
          </button>
          <p className="micro-trust">★★★★★ 200+ thyroid women transformed across India</p>
        </div>

        <p className="mt-4 text-xs text-gray-600">⚡ Only 5 spots available this month. Fills fast.</p>

      </div>
    </section>
  );
}