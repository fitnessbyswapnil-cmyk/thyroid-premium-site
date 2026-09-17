"use client";

/**
 * The registration form: a WhatsApp number and a medication radio, nothing
 * else. Rendered in the hero and, with the same fields, in the modal.
 *
 * Validation is inline, under the field, never an alert. The number is checked
 * on blur once she has typed something, and again on submit.
 */

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTurnstile, TurnstileBox, postWithBotCheck } from "@/app/components/TurnstileWidget";
import { checkIndianMobile } from "@/lib/webinar";
import { markRegistered, trackWebinarFormStart } from "./pixel";
import s from "./webinar.module.css";

const MEDICATION = ["Yes", "No", "Not sure"] as const;
const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;
const STORE_PREFIX = "webinar_attr_";

/**
 * The ad's utm_campaign={{adset.id}} and utm_content={{ad.id}}, read from this
 * visit's URL and kept for the session, so a reload or a hop to the FAQ anchor
 * does not lose them. The register route falls back to the middleware cookies.
 */
export function rememberAttribution() {
  try {
    const q = new URLSearchParams(window.location.search);
    for (const k of ATTRIBUTION_KEYS) {
      const v = q.get(k);
      if (v) sessionStorage.setItem(STORE_PREFIX + k, v.slice(0, 300));
    }
  } catch { /* storage blocked: the cookies still carry it */ }
}

function readAttribution(): Record<string, string> {
  const out: Record<string, string> = {};
  let q: URLSearchParams | null = null;
  try { q = new URLSearchParams(window.location.search); } catch { /* ignore */ }
  for (const k of ATTRIBUTION_KEYS) {
    let v = q?.get(k) ?? "";
    if (!v) { try { v = sessionStorage.getItem(STORE_PREFIX + k) ?? ""; } catch { /* ignore */ } }
    if (v) out[k] = v;
  }
  return out;
}

export default function RegisterForm({
  place,
  submitLabel,
  closed,
  head,
}: {
  /** "hero" | "modal": ids, and the Turnstile action. */
  place: "hero" | "modal";
  submitLabel: string;
  /** True once the session has started: the form is replaced by a notice. */
  closed: boolean;
  /** The hero card's top row: the date and the countdown. The modal has none. */
  head?: { when: string; countdown: string };
}) {
  const router = useRouter();
  const uid = useId();
  const phoneId = `wb-phone-${place}`;
  const errId = `${uid}-err`;
  const [phone, setPhone] = useState("");
  const [med, setMed] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [busy, setBusy] = useState(false);
  const bot = useTurnstile("webinar_register");

  useEffect(() => { rememberAttribution(); }, []);

  const cardHead = head && (
    <div className={s.cardHead}>
      <p>{head.when}</p>
      <p aria-live="off">{head.countdown}</p>
    </div>
  );

  if (closed) {
    return (
      <div className={`${s.card} ${s.closedCard}`}>
        <p>{head?.countdown || "This session has started"}</p>
        <p>Registration for this session has closed. The next date will be announced here.</p>
      </div>
    );
  }

  function validate(): string | null {
    const r = checkIndianMobile(phone);
    if (r.ok) { setPhoneErr(""); return r.phone; }
    setPhoneErr(r.error);
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setSubmitErr("");
    const digits = validate();
    if (!digits) {
      document.getElementById(phoneId)?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await postWithBotCheck(bot, "/api/webinar-register", {
        phone: digits,
        medication: med,
        attribution: readAttribution(),
        sourceUrl: window.location.href.split("#")[0],
      });
      const j = (await res.json().catch(() => null)) as
        | { ok?: boolean; eventId?: string; error?: string; message?: string }
        | null;
      if (res.status === 400 && j?.error === "invalid_phone") {
        setPhoneErr(j.message || "Enter all 10 digits of your mobile number");
        setBusy(false);
        document.getElementById(phoneId)?.focus();
        return;
      }
      if (res.status === 410) {
        setSubmitErr("Registration for this session has closed.");
        setBusy(false);
        return;
      }
      if (!res.ok || !j?.ok) throw new Error(j?.error || "failed");
      markRegistered();
      // Stay busy: the button keeps its loading state until the page changes.
      router.push(j.eventId ? `/webinar/confirmed?r=${encodeURIComponent(j.eventId)}` : "/webinar/confirmed");
    } catch {
      setSubmitErr("That did not go through. Check your connection and try again.");
      setBusy(false);
    }
  }

  const box = (
    <>
    <form className={s.form} onSubmit={submit} noValidate aria-label="Register for the free masterclass">
      <div>
        <label htmlFor={phoneId} className={s.label}>WhatsApp number</label>
        <div className={`${s.phoneRow} ${phoneErr ? s.phoneRowInvalid : ""}`}>
          <span className={s.prefix} aria-hidden="true">+91</span>
          <input
            id={phoneId}
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit mobile number"
            className={s.phoneInput}
            value={phone}
            maxLength={16}
            aria-invalid={phoneErr ? true : undefined}
            aria-describedby={phoneErr ? errId : undefined}
            onFocus={trackWebinarFormStart}
            onChange={(e) => {
              setPhone(e.target.value);
              if (phoneErr && checkIndianMobile(e.target.value).ok) setPhoneErr("");
            }}
            onBlur={() => { if (phone.trim()) validate(); }}
          />
        </div>
        {phoneErr && <p id={errId} className={s.error} role="alert">{phoneErr}</p>}
      </div>

      <fieldset className={s.radios}>
        <legend className={s.label}>Are you taking thyroid medicine?</legend>
        <div className={s.radioRow}>
          {MEDICATION.map((o) => (
            <label key={o} className={s.radio}>
              <input
                type="radio"
                name={`medication-${place}`}
                value={o}
                checked={med === o}
                onChange={() => setMed(o)}
              />
              {o}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <button type="submit" className={s.button} disabled={busy} aria-busy={busy}>
          {busy ? "Saving your seat…" : submitLabel}
        </button>
        {submitErr && <p className={s.error} role="alert">{submitErr}</p>}
      </div>

      <p className={s.note}>Your joining link comes on WhatsApp. No spam, reply stop any time.</p>
    </form>
    {/* Outside the form's gap stack: the widget is invisible for most visitors. */}
    <TurnstileBox bot={bot} hint="One quick check. Tap the box and your seat is saved." />
    </>
  );

  // The modal already sits on the card surface; only the hero draws its own.
  if (place === "modal") return box;
  return (
    <div className={s.card}>
      {cardHead}
      {box}
    </div>
  );
}
