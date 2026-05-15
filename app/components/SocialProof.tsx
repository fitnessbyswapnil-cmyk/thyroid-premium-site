"use client";

const items = [
  { value: "200+",  label: "Women Transformed" },
  { value: "4.9★",  label: "Average Rating" },
  { value: "90",    label: "Day Program" },
  { value: "ACE",   label: "Certified Coach" },
  { value: "INFS",  label: "Nutrition Certified" },
];

export default function SocialProof() {
  return (
    <section
      aria-label="Trust indicators"
      className="relative border-y border-white/[0.06] bg-white/[0.015] py-3 md:py-4"
    >
      {/* Horizontal scroll on very small screens; flex-wrap on wider */}
      <div className="container-default">
        <div className="scrollbar-hide flex items-center justify-between gap-0 overflow-x-auto">
          {items.map((item, i) => (
            <div
              key={item.label}
              className={`flex shrink-0 flex-col items-center px-3 md:px-5 ${
                i < items.length - 1
                  ? "border-r border-white/[0.07]"
                  : ""
              }`}
            >
              <span className="text-[length:var(--text-sm)] font-extrabold leading-tight text-purple-400 md:text-[length:var(--text-base)]">
                {item.value}
              </span>
              <span className="mt-0.5 whitespace-nowrap text-[10px] font-medium uppercase tracking-widest text-gray-600 md:text-[11px]">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}