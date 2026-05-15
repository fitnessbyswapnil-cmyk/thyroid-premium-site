"use client";

const items = [
  { value: "200+", label: "Women Transformed" },
  { value: "4.9★", label: "Average Rating" },
  { value: "90", label: "Day Program" },
  { value: "ACE", label: "Certified Coach" },
  { value: "INFS", label: "Nutrition Certified" },
];

export default function SocialProof() {
  return (
    <section
      aria-label="Trust indicators"
      className="relative border-y border-white/[0.05] bg-white/[0.02] py-2.5 md:py-3"
    >
      <div className="container-default">
        <div className="scrollbar-hide flex items-center justify-between overflow-x-auto">
          {items.map((item, i) => (
            <div
              key={item.label}
              className={`flex min-w-[88px] shrink-0 flex-col items-center px-3 py-1.5 ${
                i !== items.length - 1
                  ? "border-r border-white/[0.05]"
                  : ""
              }`}
            >
              <span className="text-sm font-black tracking-tight text-purple-300 md:text-base">
                {item.value}
              </span>

              <span className="mt-0.5 whitespace-nowrap text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--t4)] md:text-[10px]">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}