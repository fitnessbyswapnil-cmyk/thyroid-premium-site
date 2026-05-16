"use client";

import { Fragment } from "react";
import CtaButton from "./CtaButton";

const stats = [
  { num: "200+", label: "Clients" },
  { num: "10–15kg", label: "Fat Loss" },
  { num: "93%", label: "Energy Improved" },
];

const pillars = [
  {
    icon: "🧬",
    title: "Lab-Guided Protocol",
    desc: "Built around your biomarkers and symptoms.",
  },
  {
    icon: "🍱",
    title: "Indian Nutrition",
    desc: "Real meals adapted for thyroid fat loss.",
  },
  {
    icon: "📊",
    title: "Weekly Tracking",
    desc: "Progress adjusted week-by-week.",
  },
  {
    icon: "💬",
    title: "WhatsApp Support",
    desc: "Direct accountability and guidance.",
  },
];

export default function AuthoritySection() {
  return (
    <section className="section-pad bg-[var(--bg-page)] text-white">
      <div className="container-default">
        <div className="mb-7 text-center">
          <p className="section-label">
            Why This Works
          </p>

          <h2 className="section-title mx-auto max-w-[20ch]">
            Not Another Diet.{" "}
            <span className="text-gradient">
              A Thyroid System.
            </span>
          </h2>
        </div>

        <div className="stat-row mx-auto mb-7">
          {stats.map((s, i) => (
            <Fragment key={s.label}>
              <div className="stat-chip">
                <span className="stat-num">{s.num}</span>
                <span className="stat-label">
                  {s.label}
                </span>
              </div>

              {i < stats.length - 1 && (
                <div className="stat-divider" aria-hidden="true" />
              )}
            </Fragment>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="glass-card-sm flex gap-3 rounded-2xl p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/[0.08] text-lg">
                {p.icon}
              </div>

              <div>
                <p className="mb-1 text-sm font-bold text-white">
                  {p.title}
                </p>

                <p className="text-xs leading-relaxed text-[var(--t3)]">
                  {p.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 text-center">
          <CtaButton
            variant="secondary"
            label="Apply For Private Coaching"
            sublabel="₹299 consultation · Limited weekly intake"
            ariaLabel="Apply for private thyroid coaching"
          />

          <p className="mt-2 text-xs text-[var(--t4)]">
            Applications closing soon · Select clients only
          </p>
        </div>
      </div>
    </section>
  );
}