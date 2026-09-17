"use client";

/**
 * /webinar/confirmed — where a registration lands.
 *
 * Sends the browser leg of CompleteRegistration, and only when the URL carries
 * the event id the register route minted (?r=CompleteRegistration_<leadId>).
 * That id is the one its server leg already used, so the two pair in Meta. No
 * id, or a malformed one, means no event: an arbitrary visit to this URL must
 * never count as a registration. Once per id per browser (see ../pixel.ts).
 *
 * The page stays static; the id is read in the browser.
 */

import { useEffect } from "react";
import {
  WEBINAR_WHEN_LONG,
  WHATSAPP_BUSINESS_NUMBER,
  WHATSAPP_CONFIRM_TEXT,
  googleCalendarUrl,
  isRegistrationEventId,
} from "@/lib/webinar";
import { markRegistered, trackRegistrationComplete } from "../pixel";
import s from "../webinar.module.css";

const WHATSAPP_URL = `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(WHATSAPP_CONFIRM_TEXT)}`;

export default function ConfirmedClient() {
  useEffect(() => {
    let id = "";
    try { id = new URLSearchParams(window.location.search).get("r") ?? ""; } catch { /* ignore */ }
    if (!isRegistrationEventId(id)) return;
    markRegistered();
    trackRegistrationComplete(id);
  }, []);

  return (
    <main className={s.page}>
      <section className={`${s.wrap} ${s.confirmed}`} aria-labelledby="wb-done">
        <p className={s.eyebrow}>You are registered</p>
        <h1 id="wb-done" className={s.h1}>Your seat is saved.</h1>
        <p className={s.prose} style={{ fontSize: "var(--fs-md)", lineHeight: 1.5 }}>
          <strong>{WEBINAR_WHEN_LONG}.</strong> Your joining link and reminders come on WhatsApp.
        </p>

        <ol className={s.steps}>
          <li>
            <h2 className={s.h3}>Put it in your calendar</h2>
            <div className={s.actions}>
              <a className={s.button} href={googleCalendarUrl()} target="_blank" rel="noreferrer">
                Add to Google Calendar
              </a>
              <a className={s.button} href="/webinar/calendar.ics">
                Add to Apple Calendar
              </a>
            </div>
          </li>
          <li>
            <h2 className={s.h3}>Say hello on WhatsApp</h2>
            <p className={s.prose} style={{ marginTop: 6 }}>
              Send one message so I know it is you, and so the reminders reach the right number.
            </p>
            <div className={s.actions} style={{ gridTemplateColumns: "1fr" }}>
              <a className={s.button} href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                Message me on WhatsApp
              </a>
            </div>
          </li>
          <li>
            <h2 className={s.h3}>If you have a thyroid report, keep it ready</h2>
            <p className={s.prose} style={{ marginTop: 6 }}>
              Your most recent report (TSH, T3, T4) is useful to have next to you during the class. I will show you
              what to look for on it, live. No report? Still come. I will tell you which tests to ask for.
            </p>
          </li>
        </ol>

        <p className={s.disclaimer} style={{ textAlign: "left", marginInline: 0 }}>
          Educational content only. Nothing in this class is medical advice, and it does not replace your
          doctor or endocrinologist.
        </p>
      </section>
    </main>
  );
}
