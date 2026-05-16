const items = [
  { value: "200+", label: "Women Coached" },
  { value: "4.9★", label: "Client Rating" },
  { value: "90 Days", label: "Transformation Path" },
] as const;

export default function SocialProof() {
  return (
    <section
      aria-label="Trust indicators"
      className="relative overflow-hidden border-y border-white/[0.04] bg-[var(--bg-section)] py-5 md:py-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-30%] h-16 w-48 -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.05] blur-[60px]" />
      </div>

      <div className="container-default relative z-10">
        <div className="trust-bar mx-auto">
          {items.map((item, i) => (
            <div key={item.label} className="trust-bar-item">
              <span className="trust-bar-value">{item.value}</span>
              <span className="trust-bar-label">{item.label}</span>
              {i < items.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-1/2 hidden h-7 w-px -translate-y-1/2 bg-white/[0.06] sm:block"
                />
              ) : null}
            </div>
          ))}
        </div>

        <p className="mx-auto mt-3 max-w-[36ch] text-center text-pretty text-[0.72rem] leading-relaxed text-[var(--t4)] sm:text-xs">
          Expert-led thyroid coaching for Indian women — not another generic
          diet plan.
        </p>
      </div>
    </section>
  );
}
