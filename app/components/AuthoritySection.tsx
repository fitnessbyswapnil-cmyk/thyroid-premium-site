"use client";

import { Fragment } from "react";

import SectionCta from "./SectionCta";
import SectionHeader from "./SectionHeader";

const stats = [
  { num: "200+", label: "Women Coached" },
  { num: "10–15 kg", label: "Avg. Fat Loss" },
  { num: "93%", label: "Energy Improved" },
];

const pillars = [
  {
    icon: "🎯",
    title: "Personalized Coaching",
    desc: "A plan built around your thyroid, schedule, and lifestyle.",
  },
  {
    icon: "🍱",
    title: "Real Indian Nutrition",
    desc: "Home meals adapted for sustainable thyroid fat loss.",
  },
  {
    icon: "📊",
    title: "Weekly Accountability",
    desc: "Progress reviewed and adjusted every week.",
  },
  {
    icon: "💬",
    title: "Direct WhatsApp Support",
    desc: "Daily guidance when you need clarity or motivation.",
  },
];

export default function AuthoritySection() {
  return (
    <section className="section-pad relative bg-[var(--bg-page)] text-white">
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        <SectionHeader
          label="Why This Works"
          title={
            <>
              Not Another Diet.{" "}
              <span className="text-gradient">A Thyroid System.</span>
            </>
          }
          lead="Premium coaching designed for hypothyroid women who need structure, not another generic meal plan."
          titleMaxCh="20ch"
        />

        <div className="stat-row mx-auto mb-7">
          {stats.map((s, i) => (
            <Fragment key={s.label}>
              <div className="stat-chip">
                <span className="stat-num">{s.num}</span>
                <span className="stat-label">{s.label}</span>
              </div>
              {i < stats.length - 1 ? (
                <div className="stat-divider" aria-hidden="true" />
              ) : null}
            </Fragment>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pillars.map((p) => (
            <article
              key={p.title}
              className="glass-card-sm flex gap-3 rounded-[var(--r-xl)] p-4"
            >
              <div className="icon-ring">{p.icon}</div>
              <div>
                <p className="mb-1 text-sm font-bold text-[var(--t1)]">{p.title}</p>
                <p className="text-xs leading-relaxed text-[var(--t3)]">{p.desc}</p>
              </div>
            </article>
          ))}
        </div>

        <SectionCta
          className="mx-auto max-w-sm"
          buttonClassName="w-full"
          label="Apply For Private Coaching"
          sublabel="₹299 consultation · Limited weekly intake"
          trust="Applications closing soon · Select clients only"
          ariaLabel="Apply for private thyroid coaching"
        />
      </div>
    </section>
  );
}
