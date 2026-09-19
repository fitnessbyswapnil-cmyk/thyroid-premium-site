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
                ? "The joining link is posted in the class group one hour before we start."
                : "Your joining link comes on WhatsApp one hour before we start."}
            </p>
          </div>

          {/* Numbered, because she is being asked to do three small things and
              the order matters: the group carries the link, the calendar keeps
              Thursday free, the rest is preparation. */}
          <ol className={s.steps}>
            {links.group && (
              <li>
                <h2 className={s.itemHead}>Join the class group</h2>
                <p className={s.lead}>
                  Your joining link, the reminders and the replay are posted there. Only I post, so it stays quiet.
                </p>
                {/* Her face-recognition cue. On Thursday a message arrives from a
                    number she has never saved; the same photo she saw on the ad
                    and the landing page is what makes her open it. */}
                <div className={`${s.host} ${s.hostPlain}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/webinar/coach-sm.webp" alt="" width={52} height={52} decoding="async" />
                  <p>Swapnil Umbarkar. I take the class myself, and I am the one who posts in the group.</p>
                </div>
                <div className={s.actions} style={{ gridTemplateColumns: "1fr" }}>
                  <a className={s.button} href="/webinar/group" target="_blank" rel="noreferrer"
                    onClick={() => trackWebinarAction("WebinarGroupJoin")}>
                    Join the class group
                  </a>
                </div>
              </li>
            )}

            <li>
              <h2 className={s.itemHead}>Block Thursday evening</h2>
              <p className={s.lead}>Ninety minutes, 8:00 PM. Put it in your calendar before something else takes the slot.</p>
              <div className={s.actions}>
                <a className={`${s.button} ${s.secondary}`} href={googleCalendarUrl()} target="_blank" rel="noreferrer"
                  onClick={() => trackWebinarAction("WebinarCalendarAdd")}>
                  Google Calendar
                </a>
                <a className={`${s.button} ${s.secondary}`} href="/webinar/calendar.ics"
                  onClick={() => trackWebinarAction("WebinarCalendarAdd")}>
                  Apple Calendar
                </a>
              </div>
            </li>

            <li>
              <h2 className={s.itemHead}>Three minutes of preparation</h2>
              <div className={s.rows} style={{ marginTop: 14 }}>
                <p>Find your last thyroid report and keep it next to you. No report? Still come.</p>
                <p>Note today&rsquo;s weight, so you have a starting point.</p>
                <p>Keep a notebook and pen. You will want to write the plate down.</p>
                <p>Join from somewhere quiet. I answer questions at the end.</p>
              </div>
            </li>

            {links.starterKit && (
              <li>
                <h2 className={s.itemHead}>Your Starter Kit</h2>
                <p className={s.lead}>Yours now, before the class.</p>
                <div className={s.actions} style={{ gridTemplateColumns: "1fr" }}>
                  <a className={`${s.button} ${s.secondary}`} href="/webinar/starter-kit" target="_blank" rel="noreferrer"
                    onClick={() => trackWebinarAction("WebinarKitDownload")}>
                    Download the Starter Kit
                  </a>
                </div>
              </li>
            )}
          </ol>

          {regId && <EmailBlock eventId={regId} />}

          <div style={{ marginTop: 32 }}>
            <h2 className={s.itemHead}>Know someone who needs this?</h2>
            <p className={s.lead}>
              Most women stick to it when someone at home is doing it with them. Sending it costs you one tap.
            </p>
            <div className={s.actions} style={{ marginTop: 14 }}>
              <a className={`${s.button} ${s.secondary}`} href={SHARE_URL} target="_blank" rel="noreferrer"
                onClick={() => trackWebinarAction("WebinarShare")}>
                Share with a friend or sister
              </a>
              {messageButton(true)}
            </div>
          </div>

          <p className={s.disclaimer}>
            Educational content only. Nothing in this class is medical advice, and it does not replace your
            doctor or endocrinologist.
          </p>
        </section>
      </div>
    </main>
  );
}
