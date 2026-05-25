"use client";

import Image from "next/image";
import { Fragment } from "react";

import { CERTIFICATIONS, COACH_IMAGE, COACH_NAME } from "../lib/authority";
import SectionCta from "./SectionCta";

const stats = [
  { num: "200+", label: "Women Coached" },
  { num: "10–15 kg", label: "Avg. Fat Loss" },
  { num: "93%", label: "Energy Improved" },
];

const trustPoints = [
  "Specialized in thyroid-friendly fat loss",
  "Personalized accountability & weekly guidance",
  "Built for busy Indian women with hypothyroidism",
];

export default function AuthoritySection() {
  return (
    <section
      className="section-pad relative bg-[var(--bg-page)] text-white"
      aria-labelledby="authority-heading"
    >
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-10">
          {/* 1. Coach portrait */}
          <div className="coach-portrait-wrap shrink-0 lg:sticky lg:top-24">
            <div className="coach-portrait-glow" aria-hidden="true" />
            <article className="glass-card relative overflow-hidden rounded-[var(--r-xl)] border border-[var(--p-border)]">
              <div className="relative aspect-[3/4] w-full bg-[var(--s2)]">
                <Image
                  src={COACH_IMAGE}
                  alt={`${COACH_NAME}, thyroid fat-loss coach`}
                  fill
                  sizes="(max-width: 640px) 68vw, 228px"
                  className="object-cover object-top"
                  priority={false}
                />
                <div
                  className="absolute inset-0"
                  aria-hidden="true"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(15,16,18,0.55) 0%, transparent 42%)",
                  }}
                />
              </div>
              <div className="border-t border-white/[0.06] px-3 py-2.5 text-center">
                <p className="text-sm font-bold tracking-[-0.02em] text-[var(--t1)]">
                  {COACH_NAME}
                </p>
                <p className="mt-0.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-[var(--p400)]">
                  Thyroid Fat-Loss Specialist
                </p>
              </div>
            </article>
          </div>

          {/* 2–5. Trust content */}
          <div className="min-w-0 flex-1 text-center lg:text-left">
            <p className="section-label">Meet Your Coach</p>
            <h2
              id="authority-heading"
              className="section-title mx-auto lg:mx-0"
              style={{ maxWidth: "22ch" }}
            >
              Trusted Guidance for{" "}
              <span className="text-gradient">Thyroid Fat Loss</span>
            </h2>
            <p className="section-lead mx-auto text-pretty lg:mx-0">
              Helping hypothyroid women transform sustainably — with
              evidence-based coaching, real Indian nutrition, and the
              accountability generic programs never provide.
            </p>

            <ul className="mx-auto mt-5 max-w-md space-y-2 text-left lg:mx-0">
              {trustPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2 text-[length:var(--text-sm)] leading-snug text-[var(--t2)]"
                >
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--p400)]"
                    aria-hidden="true"
                  />
                  {point}
                </li>
              ))}
            </ul>

            <div className="stat-row mx-auto mt-6 lg:mx-0">
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

            <div className="mt-7">
              <p className="mb-3 text-center text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--t4)] lg:text-left">
                Curated credentials
              </p>
              <div
                className="cert-strip -mx-1 px-1 lg:mx-0 lg:px-0"
                aria-label="Coach certifications"
              >
                {CERTIFICATIONS.map((cert) => (
                  <figure key={cert.id} className="cert-card">
                    <div className="cert-card-image">
                      <Image
                        src={cert.image}
                        alt={cert.title}
                        fill
                        sizes="(max-width: 768px) 38vw, 160px"
                        className="object-contain p-1.5"
                        loading="lazy"
                      />
                    </div>
                    <figcaption className="cert-card-label">
                      {cert.short}
                    </figcaption>
                  </figure>
                ))}
              </div>
              <p className="mt-3 text-center text-[0.72rem] leading-relaxed text-[var(--t5)] lg:text-left">
                Credentials support your coaching — they are not a substitute
                for medical care.
              </p>
            </div>

            <SectionCta
              className="mx-auto max-w-sm lg:mx-0 lg:items-start"
              buttonClassName="w-full"
              label="Apply For Private Coaching"
              sublabel="₹299 consultation · Limited weekly intake"
              trust="Applications closing soon · Select clients only"
              ariaLabel="Apply for private thyroid coaching"
              location="authority"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
