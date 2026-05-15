"use client";

const logos = ["ACE Certified", "FITR Certified", "INFS Certified", "200+ Clients", "4.9★ Rating"];

export default function SocialProof() {
  return (
    <section className="border-y border-white/[0.07] bg-white/[0.02] py-3">
      <div className="container-default">
        <div className="scrollbar-hide flex items-center justify-center gap-6 overflow-x-auto px-1">
          {logos.map((item, i) => (
            <span key={i} className="shrink-0 text-[11px] font-medium uppercase tracking-widest text-gray-500">
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}