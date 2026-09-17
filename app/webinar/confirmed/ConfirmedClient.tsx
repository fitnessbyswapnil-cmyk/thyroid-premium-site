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
      <div className={s.column}>
        <section className={s.confirmed} aria-labelledby="wb-done">
          <div className={`${s.mark} ${s.markHero}`}>
            <p>Thyroid Fat Loss Masterclass</p>
          </div>
          <h1 id="wb-done" className={s.h1}>Your seat is saved.</h1>

          <div className={`${s.card} ${s.confirmedCard}`}>
            <p>{WEBINAR_WHEN_LONG}</p>
            <p>Your joining link comes on WhatsApp.</p>
          </div>

          <div className={s.actions}>
            <a className={s.button} href={WHATSAPP_URL} target="_blank" rel="noreferrer">
              Message me on WhatsApp
            </a>
            <a className={`${s.button} ${s.secondary}`} href={googleCalendarUrl()} target="_blank" rel="noreferrer">
              Add to Google Calendar
            </a>
            <a className={`${s.button} ${s.secondary}`} href="/webinar/calendar.ics">
              Add to Apple Calendar
            </a>
          </div>

          <p className={s.confirmedNote}>
            If you have a thyroid report, keep it ready and I will show you what to look for on it. No report? Still come.
          </p>
          <p className={s.disclaimer} style={{ marginTop: 26 }}>
            Educational content only. Nothing in this class is medical advice, and it does not replace your
            doctor or endocrinologist.
          </p>
        </section>
      </div>
    </main>
  );
}
