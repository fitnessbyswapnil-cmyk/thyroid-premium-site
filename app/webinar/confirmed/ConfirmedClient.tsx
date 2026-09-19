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
 *
 * Buttons, in order of what matters most to show-up:
 *   1. Join the class group    only when a Community link is set
 *   2. Download the Starter Kit only when the kit is set
 *   3. Google / Apple Calendar
 *   4. Message me on WhatsApp  opens a chat with the API number
 *   5. Share with a friend     a WhatsApp share of /webinar, tagged
 *                               utm_medium=whatsapp_share
 * 1 and 2 can be switched on by a Worker variable without a deploy, so the
 * page asks /webinar/links whether they are set before showing them.
 */

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  WEBINAR_WHEN_LONG,
  WHATSAPP_BUSINESS_NUMBER,
  WHATSAPP_CONFIRM_TEXT,
  googleCalendarUrl,
  isRegistrationEventId,
} from "@/lib/webinar";
import { markRegistered, trackRegistrationComplete, trackWebinarAction } from "../pixel";
import { useTurnstile, TurnstileBox, postWithBotCheck } from "@/app/components/TurnstileWidget";
import { checkEmail } from "@/lib/webinar";
import s from "../webinar.module.css";

const WHATSAPP_URL = `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(WHATSAPP_CONFIRM_TEXT)}`;
const SHARE_URL = `https://wa.me/?text=${encodeURIComponent(
  `I have registered for a free Thyroid Fat Loss Masterclass on ${WEBINAR_WHEN_LONG}. You can join too: https://www.swapnilumbarkarfitness.in/webinar?utm_medium=whatsapp_share`,
)}`;

/**
 * Her email, asked AFTER she has registered, so it costs no registrations.
 * Optional in every sense: skipping it changes nothing, and a failure here
 * leaves the rest of the page working.
 *
 * It deliberately promises nothing about sending: there is no email sender on
 * this site yet. It says what the address is for, and no more.
 */
function EmailBlock({ eventId }: { eventId: string }) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const bot = useTurnstile("webinar_email");
  const inputId = useId();

  if (done) {
    return <p className={s.confirmedNote}>Saved. The recording goes to that address once it is ready.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const checked = checkEmail(email);
    if (!checked.ok) { setErr(checked.error); return; }
    setErr("");
    setBusy(true);
    try {
      const res = await postWithBotCheck(bot, "/api/webinar-email", { eventId, email: checked.email });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.status === 400 && j?.message) { setErr(j.message); setBusy(false); return; }
      if (!res.ok || !j?.ok) throw new Error("failed");
      setDone(true);
    } catch {
      setErr("That did not save. You can skip this — your seat is already confirmed.");
      setBusy(false);
    }
  }

  return (
    <form className={`${s.card} ${s.confirmedCard}`} onSubmit={submit} noValidate style={{ marginTop: 28 }}>
      <label htmlFor={inputId} className={s.label}>Where should the recording go? (optional)</label>
      <div className={`${s.phoneRow} ${err ? s.phoneRowInvalid : ""}`} style={{ marginTop: 8 }}>
        <input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          className={s.phoneInput}
          placeholder="you@gmail.com"
          value={email}
          maxLength={120}
          aria-invalid={err ? true : undefined}
          onChange={(e) => { setEmail(e.target.value); if (err) setErr(""); }}
        />
      </div>
      {err && <p className={s.error} role="alert">{err}</p>}
      <button type="submit" className={`${s.button} ${s.secondary}`} disabled={busy} aria-busy={busy} style={{ marginTop: 12 }}>
        {busy ? "Saving…" : "Save my email"}
      </button>
      <TurnstileBox bot={bot} hint="One quick check." />
    </form>
  );
}

/** The id never changes for the life of the page, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};
function readRegId(): string {
  try {
    const id = new URLSearchParams(window.location.search).get("r") ?? "";
    return isRegistrationEventId(id) ? id : "";
  } catch {
    return "";
  }
}

export default function ConfirmedClient() {
  // Her registration id, read from the URL. useSyncExternalStore rather than
  // state set inside an effect: the id never changes after load, and this is
  // the shape React provides for a value that is client-only (the server
  // snapshot is "", so the static HTML and the first client render agree).
  const regId = useSyncExternalStore(subscribeNever, readRegId, () => "");

  useEffect(() => {
    let id = "";
    try { id = new URLSearchParams(window.location.search).get("r") ?? ""; } catch { /* ignore */ }
    if (!isRegistrationEventId(id)) return;
    markRegistered();
    trackRegistrationComplete(id);
  }, []);

  // Clicks are tracked, not the redirects themselves: /webinar/group and
  // /webinar/starter-kit are also opened from WhatsApp, where no page runs.
  const messageButton = (secondary: boolean) => (
    <a className={`${s.button} ${secondary ? s.secondary : ""}`} href={WHATSAPP_URL} target="_blank" rel="noreferrer">
      Message me on WhatsApp
    </a>
  );

  const [links, setLinks] = useState({ group: false, starterKit: false });
  useEffect(() => {
    let live = true;
    fetch("/webinar/links", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j) setLinks({ group: !!j.group, starterKit: !!j.starterKit }); })
      .catch(() => { /* buttons stay hidden */ });
    return () => { live = false; };
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
            <p>
              {links.group
                ? "Reminders and your joining link are posted in the class group."
                : "Your joining link comes on WhatsApp."}
            </p>
          </div>

          <div className={s.actions}>
            {!links.group && !links.starterKit && messageButton(false)}
            {links.group && (
              <a className={s.button} href="/webinar/group" target="_blank" rel="noreferrer"
                onClick={() => trackWebinarAction("WebinarGroupJoin")}>
                Join the class group on WhatsApp
              </a>
            )}
            {links.starterKit && (
              <a className={`${s.button} ${links.group ? s.secondary : ""}`} href="/webinar/starter-kit" target="_blank" rel="noreferrer"
                onClick={() => trackWebinarAction("WebinarKitDownload")}>
                Download your Starter Kit
              </a>
            )}
            <a className={`${s.button} ${s.secondary}`} href={googleCalendarUrl()} target="_blank" rel="noreferrer"
              onClick={() => trackWebinarAction("WebinarCalendarAdd")}>
              Add to Google Calendar
            </a>
            <a className={`${s.button} ${s.secondary}`} href="/webinar/calendar.ics"
              onClick={() => trackWebinarAction("WebinarCalendarAdd")}>
              Add to Apple Calendar
            </a>
            {(links.group || links.starterKit) && messageButton(true)}
            <a className={`${s.button} ${s.secondary}`} href={SHARE_URL} target="_blank" rel="noreferrer"
              onClick={() => trackWebinarAction("WebinarShare")}>
              Share with a friend or sister
            </a>
          </div>

          {regId && <EmailBlock eventId={regId} />}

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
