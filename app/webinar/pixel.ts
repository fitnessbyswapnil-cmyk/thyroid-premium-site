"use client";

/**
 * Browser pixel events for /webinar and /webinar/confirmed.
 *
 * These go straight to fbq, not through a dataLayer push, on purpose. None of
 * the three has a web GTM tag, and a dataLayer push can reach the Stape server
 * container through the GA4 forwarding tag, which would add a server leg with a
 * different id. A direct fbq call is exactly one browser leg, decided in code.
 * (Schedule and Purchase are the opposite: their browser leg IS a GTM tag, and
 * app/lib/analytics.ts forbids a direct fbq for them. Do not copy this there.)
 *
 * fbq itself is loaded by GTM's "Meta Ads PageView" tag, after hydration, so
 * every call waits for it. If it never arrives (blocked, in-app browser) the
 * browser leg is simply missing; CompleteRegistration's server leg still goes.
 *
 *   ViewContent          once per page load of /webinar             browser only
 *   WebinarFormStart     first focus on a phone field, per load     browser only
 *   WebinarGroupJoin     taps "Join the class group"                browser only
 *   WebinarCalendarAdd   taps a calendar button                     browser only
 *   WebinarKitDownload   taps "Download your Starter Kit"           browser only
 *   WebinarShare         taps "Share with a friend"                 browser only
 *   CompleteRegistration once per registration, on the thank-you    browser leg;
 *                        page, id CompleteRegistration_<leadId>     server leg in
 *                                                                   /api/webinar-register
 *
 * WebinarFormStart is a CUSTOM event, not Lead. Lead is the /decode quiz gate's
 * event (advanced matching, EMQ 9.3), and the gate sends some women on to this
 * page — a Lead on focus here would count a second Lead against the /decode ad
 * for one woman, and dilute the Lead match quality with anonymous focus events.
 * It can still be made a custom conversion and optimised on.
 */

import { claimOnce } from "@/app/components/tracking/pixel-core";
import { WEBINAR_REGISTRATION_VALUE_INR } from "@/lib/webinar";

type Fbq = (...args: unknown[]) => void;

const WAIT_MS = 15000;
const STEP_MS = 250;

function whenPixelReady(run: (fbq: Fbq) => void) {
  if (typeof window === "undefined") return;
  const started = Date.now();
  const tick = () => {
    const fbq = (window as Window & { fbq?: Fbq }).fbq;
    if (typeof fbq === "function") {
      try { run(fbq); } catch { /* tracking never breaks the page */ }
      return;
    }
    if (Date.now() - started < WAIT_MS) window.setTimeout(tick, STEP_MS);
  };
  tick();
}

const rand = () => Math.random().toString(36).slice(2, 8);

// Module-level: survives React StrictMode's double effect in dev.
let viewContentSent = false;
let formStartSent = false;

export function trackWebinarView() {
  if (viewContentSent) return;
  viewContentSent = true;
  const eventID = `ViewContent_webinar_${Date.now()}_${rand()}`;
  whenPixelReady((fbq) =>
    fbq("track", "ViewContent", { content_name: "thyroid_masterclass", content_type: "webinar" }, { eventID }),
  );
}

/**
 * The small actions on the thank-you page. Each is its own custom event, once
 * per page load per name, so a double tap is one signal. Audience and
 * diagnostic events: never an optimisation target.
 */
export type WebinarAction = "WebinarGroupJoin" | "WebinarCalendarAdd" | "WebinarKitDownload" | "WebinarShare";
const actionsSent = new Set<string>();

export function trackWebinarAction(name: WebinarAction) {
  if (actionsSent.has(name)) return;
  actionsSent.add(name);
  const eventID = `${name}_${Date.now()}_${rand()}`;
  whenPixelReady((fbq) => fbq("trackCustom", name, { content_name: "thyroid_masterclass" }, { eventID }));
}

export function trackWebinarFormStart() {
  if (formStartSent) return;
  formStartSent = true;
  const eventID = `WebinarFormStart_${Date.now()}_${rand()}`;
  whenPixelReady((fbq) => fbq("trackCustom", "WebinarFormStart", { content_name: "thyroid_masterclass" }, { eventID }));
}

function stores(): Storage[] {
  const out: Storage[] = [];
  try { out.push(window.localStorage); } catch { /* unavailable */ }
  try { out.push(window.sessionStorage); } catch { /* unavailable */ }
  return out;
}

/** The browser leg. Claimed per id, so a reload or a second tab sends nothing. */
export function trackRegistrationComplete(eventId: string) {
  // Claimed only once the pixel is actually there to send it, so a load where
  // fbq never arrived does not use up the one browser leg.
  whenPixelReady((fbq) => {
    if (!claimOnce(`meta_claimed_${eventId}`, stores())) return;
    fbq(
      "track",
      "CompleteRegistration",
      {
        value: WEBINAR_REGISTRATION_VALUE_INR,
        currency: "INR",
        content_name: "thyroid_masterclass",
        status: "registered",
      },
      { eventID: eventId },
    );
  });
}

// ── Registration state (drives the modal) ────────────────────────────────────

const REGISTERED_KEY = "webinar_registered";

export function markRegistered() {
  for (const s of stores()) {
    try { s.setItem(REGISTERED_KEY, "1"); } catch { /* ignore */ }
  }
}

export function hasRegistered(): boolean {
  return stores().some((s) => {
    try { return s.getItem(REGISTERED_KEY) === "1"; } catch { return false; }
  });
}
