"use client";

import { useState } from "react";
import { CheckIcon } from "./QuizIcons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// India mobile: 10 digits, starts 6–9 (after stripping spaces / +91 / leading 0).
const PHONE_RE = /^[6-9]\d{9}$/;

export type CaptureData = { name: string; email: string; whatsapp: string };

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "");
}

export function LeadCaptureCard({
  onSubmit,
  submitting,
  serverError,
}: {
  onSubmit: (data: CaptureData) => void;
  submitting: boolean;
  serverError?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);

  const phoneNorm = normalizePhone(whatsapp);
  const errors = {
    name: name.trim().length < 2 ? "Please enter your name." : "",
    email: !EMAIL_RE.test(email.trim()) ? "Enter a valid email address." : "",
    whatsapp: !PHONE_RE.test(phoneNorm) ? "Enter a valid 10-digit Indian mobile." : "",
    consent: !consent ? "Please tick the box so we can send your report." : "",
  };
  const valid = !errors.name && !errors.email && !errors.whatsapp && !errors.consent;

  const handleSubmit = () => {
    setTouched(true);
    if (!valid || submitting) return;
    onSubmit({ name: name.trim(), email: email.trim().toLowerCase(), whatsapp: phoneNorm });
  };

  const fieldClass = (err: string) =>
    `w-full rounded-2xl border bg-white/[0.04] px-5 py-4 text-[0.95rem] text-white placeholder-white/25 outline-none transition-all duration-200 focus:bg-white/[0.06] ${
      touched && err
        ? "border-red-400/50 focus:border-red-400/60"
        : "border-white/10 focus:border-[var(--gold)]/55 focus:shadow-[0_0_0_3px_rgba(201,162,75,0.14)]"
    }`;

  return (
    <div>
      <h2 className="quiz-display text-[1.6rem] leading-[1.15] text-[var(--ivory)] sm:text-[1.9rem]">
        Your Blocker Score is ready.
      </h2>
      <p className="mt-2 text-[0.88rem] leading-relaxed text-white/55">
        Where should we send your full personalised report?
      </p>

      <div className="mt-6 space-y-3.5">
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            className={fieldClass(errors.name)}
            style={{ WebkitTapHighlightColor: "transparent" }}
          />
          {touched && errors.name && <FieldError>{errors.name}</FieldError>}
        </div>

        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            inputMode="email"
            className={fieldClass(errors.email)}
            style={{ WebkitTapHighlightColor: "transparent" }}
          />
          {touched && errors.email && <FieldError>{errors.email}</FieldError>}
        </div>

        <div>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 select-none text-[0.95rem] text-white/35">
              +91
            </span>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="98765 43210"
              autoComplete="tel"
              inputMode="numeric"
              className={`${fieldClass(errors.whatsapp)} pl-14`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            />
          </div>
          {touched && errors.whatsapp && <FieldError>{errors.whatsapp}</FieldError>}
        </div>
      </div>

      {/* Consent (DPDP) */}
      <button
        type="button"
        onClick={() => setConsent((c) => !c)}
        className="mt-5 flex w-full items-start gap-3 text-left"
        aria-pressed={consent}
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${
            consent ? "border-[var(--gold)] text-[var(--onyx)]" : "border-white/25"
          }`}
          style={consent ? { background: "var(--gold)" } : undefined}
        >
          {consent && <CheckIcon size={12} />}
        </span>
        <span className="text-[0.76rem] leading-relaxed text-white/55">
          I agree to receive my report and follow-up messages on email & WhatsApp.
        </span>
      </button>
      {touched && errors.consent && <FieldError>{errors.consent}</FieldError>}

      {serverError && (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-[0.8rem] text-red-200">
          {serverError}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className={`quiz-cta mt-6 flex w-full items-center justify-center gap-2 rounded-full py-4 text-[0.98rem] font-bold tracking-[-0.01em] active:scale-[0.99] ${
          submitting ? "cursor-wait opacity-80" : ""
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {submitting ? "Calculating your score…" : "Reveal My Blocker Score →"}
      </button>

      <p className="mt-4 text-center text-[0.68rem] text-white/30">
        Private &amp; confidential · Never shared · Takes seconds
      </p>
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 px-1 text-[0.72rem] text-red-300/90">{children}</p>;
}
