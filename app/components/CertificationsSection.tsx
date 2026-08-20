"use client";

import Image from "next/image";

import { CERTIFICATIONS } from "../lib/authority";

// Certifications, extracted from AuthoritySection so they can sit directly
// after the hero (mockup order). Markup/classes moved verbatim — the
// authority-cert-* styles in globals.css carry the grid + hover behaviour.
export default function CertificationsSection() {
  return (
    <section
      className="section-pad relative bg-[var(--bg-page)]"
      aria-labelledby="certifications-heading"
    >
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-default relative z-10">
        <header className="section-header">
          <p className="section-label">Credentials</p>
          <h2 id="certifications-heading" className="section-title mx-auto" style={{ maxWidth: "22ch" }}>
            Certified to coach this, specifically.
          </h2>
        </header>

        <div className="authority-cert-grid" role="list" aria-label="Certifications">
          {CERTIFICATIONS.map((cert) => (
            <figure key={cert.id} className="authority-cert-card" role="listitem">
              {/* image area */}
              <div className="authority-cert-img-wrap">
                <Image
                  src={cert.image}
                  alt={cert.title}
                  fill
                  sizes="(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 240px"
                  className="object-contain p-3"
                  loading="lazy"
                />
                <div className="authority-cert-img-overlay" aria-hidden="true" />
              </div>

              {/* label */}
              <figcaption className="authority-cert-label">{cert.title}</figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-5 text-center text-[0.7rem] leading-relaxed text-[var(--t5)]">
          Credentials support your coaching. They are not a substitute for medical care.
        </p>
      </div>
    </section>
  );
}
