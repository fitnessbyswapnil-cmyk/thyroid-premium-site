"use client";

const items = [
  {
    value: "200+",
    label: "Indian Women Transformed",
  },
  {
    value: "4.9★",
    label: "Average Client Rating",
  },
  {
    value: "90 Days",
    label: "Sustainable Fat Loss System",
  },
];

export default function SocialProof() {
  return (
    <section
      aria-label="Trust indicators"
      className="relative overflow-hidden border-y border-white/[0.04] bg-white/[0.015] py-4 md:py-5"
    >

      {/* Softer ambient depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-20%] h-20 w-56 -translate-x-1/2 rounded-full bg-purple-500/[0.035] blur-[55px]" />
      </div>

      <div className="container-default relative z-10">

        {/* Luxury trust row */}
        <div className="flex items-center justify-center">

          <div className="flex w-full max-w-[760px] items-center justify-between rounded-[1.4rem] border border-white/[0.045] bg-white/[0.018] px-2 py-2 backdrop-blur-md">

            {items.map((item, i) => (
              <div
                key={item.label}
                className="flex flex-1 flex-col items-center justify-center px-2 py-2 text-center"
              >

                {/* Metric */}
                <span className="text-[15px] font-bold tracking-[-0.03em] text-white md:text-[17px]">
                  {item.value}
                </span>

                {/* Label */}
                <span className="mt-1 max-w-[14ch] text-[10px] font-medium leading-relaxed tracking-[0.04em] text-[var(--t3)] md:text-[11px]">
                  {item.label}
                </span>

                {/* Soft divider */}
                {i !== items.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="absolute right-0 top-1/2 hidden h-8 w-px -translate-y-1/2 bg-white/[0.04] md:block"
                  />
                )}
              </div>
            ))}
          </div>

        </div>

        {/* Emotional trust line */}
        <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--t4)] md:text-xs">
          Trusted by hypothyroid women across India who were tired of failed diets and low energy.
        </p>

      </div>
    </section>
  );
}