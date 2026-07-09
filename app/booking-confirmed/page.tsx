"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { trackSchedule } from "../lib/analytics";
import { persistUserIdentity } from "../components/tracking/UserIdentityTracker";

// ── Show-up commitment page ──────────────────────────────────────────────────
// Reached after a confirmed Cal.com booking. /session-booked and /book redirect
// here with ?uid=<cal_booking_uid>&date=…&time=…&name=…
//
// This page's job is converting the booking into a COMMITMENT (booked leads
// were ghosting): confirm-on-WhatsApp, add-to-calendar, prep kit, next steps,
// social proof. PRICE-NEUTRAL: zero pricing language anywhere on this page.
//
// PII SCRUB: the query string carries the attendee's real name, so it is read
// ONCE and stripped via history.replaceState DURING FIRST RENDER — before any
// React effect (RouteTracker page_view, Schedule below) can push to the
// dataLayer — so the name never reaches Meta in page_location. The values live
// on in component state only.
//
// SCHEDULE fires on page load — guarded so it fires AT MOST once per booking,
// even on refresh / back-forward navigation:
//   • scheduleFiredRef   → once per mount
//   • sessionStorage key → once per uid, across remounts in this tab
// event_id = schedule_<uid> (shared with the Cal.com BOOKING_CREATED webhook
// CAPI) so Meta deduplicates the browser Pixel and server Schedule into one.
// No uid → never fire (we don't mint a fake Schedule id).
// THE TRACKING BLOCK BELOW IS FROZEN — do not modify with layout changes.

type BookingParams = { uid: string; name: string; date: string; time: string };

const EMPTY_PARAMS: BookingParams = { uid: "", name: "", date: "", time: "" };

// React (concurrent rendering) can run a useState initializer in a render pass
// it then DISCARDS and re-run it later — by which time the query is already
// scrubbed. The module-level stash makes the capture idempotent: the first run
// that sees a query stores it; every later run returns the stash.
let capturedParams: BookingParams | null = null;

// Runs in the useState initializer (first render, client only): capture the
// params, then immediately strip the query string from the address bar.
function captureAndScrubParams(): BookingParams {
  if (typeof window === "undefined") return EMPTY_PARAMS;
  if (window.location.search) {
    const p = new URLSearchParams(window.location.search);
    capturedParams = {
      uid: p.get("uid") || "",
      name: p.get("name") || "",
      date: p.get("date") || "",
      time: p.get("time") || "",
    };
    try {
      history.replaceState(null, "", window.location.pathname);
    } catch { /* non-critical — worst case the URL keeps its query */ }
  }
  return capturedParams ?? EMPTY_PARAMS;
}

// ── Commitment-device helpers (display/link building only — no tracking) ─────

// Coach WhatsApp number (digits only, country code included) — set
// NEXT_PUBLIC_WHATSAPP_NUMBER in Vercel. Never hardcoded here. Without it the
// button falls back to WhatsApp's share picker (wa.me without a number).
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";

function whatsappHref(name: string, date: string, time: string): string {
  const text =
    date && time
      ? `YES — confirming my Thyroid Root-Cause Session on ${date} at ${time}.${name ? ` – ${name}` : ""}`
      : `YES — confirming my Thyroid Root-Cause Session.${name ? ` – ${name}` : ""}`;
  const base = WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// Parse the display strings both booking flows produce (en-IN):
// date "Saturday, 12 July 2026" · time "10:00 am" → "YYYYMMDDTHHMMSS/…+60min".
// Combined with ctz=Asia/Kolkata the times are interpreted as IST by Google.
function gcalDates(dateStr: string, timeStr: string): string {
  const d = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  const t = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!d || !t) return "";
  const month = MONTHS[d[2].toLowerCase()];
  if (month == null) return "";
  let hour = Number(t[1]) % 12;
  if (/pm/i.test(t[3])) hour += 12;
  // UTC container used purely for calendar math (rollover-safe); rendered as
  // a floating local time that ctz pins to IST.
  const start = new Date(Date.UTC(Number(d[3]), month, Number(d[1]), hour, Number(t[2])));
  if (isNaN(start.getTime())) return "";
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, "").slice(0, 15);
  return `${fmt(start)}/${fmt(end)}`;
}

function gcalHref(dateStr: string, timeStr: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Private Thyroid Root-Cause Session with Swapnil",
    details:
      "Your Google Meet link is in your confirmation email. Keep your thyroid reports handy.",
    ctz: "Asia/Kolkata",
  });
  const dates = gcalDates(dateStr, timeStr);
  if (dates) params.set("dates", dates);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const NEXT_STEPS = [
  { n: "1", title: "Send YES on WhatsApp", body: "Locks your slot in 5 seconds." },
  { n: "2", title: "Read your Prep Kit", body: "10 minutes that transform the call." },
  { n: "3", title: "Join 5 min early with your reports", body: "Google Meet link is in your email." },
] as const;

// Re-homed from the merged consultation section (PR #31) — verbatim.
const QUOTES = [
  {
    quote: "More clarity about my thyroid in 60 minutes than 3 years of trying to figure it out alone. I finally understand why nothing was working.",
    name: "Priya M.",
    city: "Pune",
    condition: "Hashimoto's",
  },
  {
    quote: "He had already studied my intake before we even spoke. Within 10 minutes he pinpointed exactly where my energy was leaking. I left with a real plan.",
    name: "Rekha S.",
    city: "Mumbai",
    condition: "Hypothyroidism",
  },
] as const;

function BookingConfirmedInner() {
  const [show, setShow] = useState(false);
  const [{ uid, name, date, time }] = useState(captureAndScrubParams);
  // The prerendered HTML has no params, so displaying them on the hydration
  // render would mismatch — show them only after mount (`show` flips in the
  // first effect, same as the entrance transition).
  const dispName = show ? name : "";
  const dispDate = show ? date : "";
  const dispTime = show ? time : "";
  const scheduleFiredRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);

    // Keep identity hydrated for the Schedule advanced-matching signals.
    try {
      if (name) persistUserIdentity({ first_name: name.split(" ")[0] });
    } catch { /* non-critical */ }

    // ── Schedule on load ──────────────────────────────────────────────────────
    if (!scheduleFiredRef.current && uid) {
      const sessionKey = `schedule_fired_${uid}`;
      let alreadyFired = false;
      try { alreadyFired = !!sessionStorage.getItem(sessionKey); } catch { /* unavailable */ }

      if (!alreadyFired) {
        scheduleFiredRef.current = true;
        try { sessionStorage.setItem(sessionKey, "1"); } catch { /* non-critical */ }

        trackSchedule(
          { name, date, time },
          `schedule_${uid}`,
          name ? { first_name: name.split(" ")[0] } : undefined,
        );
      } else {
        scheduleFiredRef.current = true;
      }
    }

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- params are captured once at mount
  }, []);

  const firstName = dispName ? dispName.split(" ")[0] : "";

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--bg-page)", color: "#f3f4f7" }}
    >
      {/* Ambient brand tints — champagne gold on confirm */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(ellipse, rgba(213,183,101,0.14) 0%, transparent 70%)" }}
        />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full blur-[110px]" style={{ background: "rgba(168,85,247,0.22)" }} />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full blur-[110px]" style={{ background: "rgba(213,183,101,0.12)" }} />
      </div>

      <div
        className="relative z-10 mx-auto max-w-[560px] px-5 pb-20 pt-12 transition-all duration-700"
        style={{
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(18px)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5"
        >
          {/* ── 1. Confirmation header ── */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c5a24d]/25 bg-[#c5a24d]/10 px-4 py-2 shadow-[0_0_24px_rgba(52,211,153,0.12)]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6.5l2.5 2.5 5.5-5.5" stroke="#a855f7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-[#a855f7]">
                Session Confirmed
              </span>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#c5a24d]/15 bg-[#c5a24d]/[0.06] p-6 text-center">
            <h1 className="mb-3 text-[1.7rem] font-black leading-tight tracking-[-0.04em] text-white">
              {firstName ? (
                <>You&apos;re booked, {firstName} <span aria-hidden>✓</span></>
              ) : (
                <>Your session is booked <span aria-hidden>✓</span></>
              )}
            </h1>

            {(dispDate || dispTime) ? (
              <div className="mx-auto grid max-w-[380px] grid-cols-2 gap-3 text-left">
                {dispDate && (
                  <div className="rounded-xl border border-[#a855f7]/10 bg-white/[0.05] p-3.5">
                    <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[#d5b765]">Date</p>
                    <p className="text-[0.85rem] font-semibold leading-snug text-white/92">{dispDate}</p>
                  </div>
                )}
                {dispTime && (
                  <div className="rounded-xl border border-[#a855f7]/10 bg-white/[0.05] p-3.5">
                    <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[#d5b765]">Time</p>
                    <p className="text-[0.85rem] font-semibold text-white/92">{dispTime}</p>
                    <p className="mt-0.5 text-[0.65rem] text-white/45">India Standard Time</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[0.82rem] leading-relaxed text-white/60">
                Your session details and Google Meet link are in your confirmation email.
              </p>
            )}
          </div>

          {/* ── 2. Lock your slot — the commitment device ── */}
          <div className="rounded-[24px] border border-[#a855f7]/25 bg-[#a855f7]/[0.08] p-6 text-center">
            <p className="mb-1 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#c793ff]">
              Lock your slot
            </p>
            <p className="mx-auto mb-5 max-w-[38ch] text-[0.95rem] font-semibold leading-[1.6] text-white/92">
              One last step — confirm you&apos;re coming. Slots are limited and
              reserved exclusively for you.
            </p>

            <a
              href={whatsappHref(dispName, dispDate, dispTime)}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-button w-full"
            >
              <span className="cta-label">Confirm on WhatsApp — send YES</span>
            </a>

            <a
              href={gcalHref(dispDate, dispTime)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost mx-auto mt-3 flex w-full items-center justify-center"
            >
              <span className="cta-label">Add to Google Calendar</span>
            </a>
          </div>

          {/* ── 3. Prepare for your session ── */}
          <div className="rounded-[24px] border border-[#a855f7]/10 bg-white/[0.04] p-6 text-center">
            <p className="mb-1 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/55">
              Prepare for your session
            </p>
            <a
              href="/prep-kit.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost mx-auto mt-3 flex w-full items-center justify-center"
            >
              <span className="cta-label">Open My Prep Kit (PDF)</span>
            </a>
            <p className="mt-3 text-[0.78rem] leading-relaxed text-white/60">
              10 minutes of prep = a far better call. Keep your reports handy —
              no reports? No problem.
            </p>
          </div>

          {/* ── 4. What happens next ── */}
          <div className="rounded-[24px] border border-[#a855f7]/10 bg-white/[0.04] p-5">
            <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/55">
              What happens next
            </p>
            <div className="space-y-3">
              {NEXT_STEPS.map((s) => (
                <div key={s.n} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#a855f7]/25 bg-[#a855f7]/10 text-[0.8rem] font-black text-[#c793ff]">
                    {s.n}
                  </div>
                  <div>
                    <p className="text-[0.85rem] font-semibold text-white/90">{s.title}</p>
                    <p className="text-[0.74rem] leading-relaxed text-white/55">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 5. Social proof at the moment of anticipation ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {QUOTES.map((q) => (
              <div
                key={q.name}
                className="rounded-[16px] border border-[#a855f7]/15 bg-[#a855f7]/[0.05] px-5 py-[18px] text-left"
              >
                <div className="mb-2.5 flex gap-1" aria-hidden>
                  {[0, 1, 2, 3, 4].map((j) => (
                    <svg key={j} viewBox="0 0 12 12" fill="#a855f7" width="11" height="11">
                      <path d="M6 1l1.27 2.572L10 4.07l-2 1.947.472 2.752L6 7.5 3.528 8.769 4 6.017 2 4.07l2.73-.498z" />
                    </svg>
                  ))}
                </div>
                <p className="mb-2.5 text-[0.8rem] italic leading-[1.65] text-white/65">
                  &ldquo;{q.quote}&rdquo;
                </p>
                <span className="text-[0.7rem] font-semibold tracking-[0.03em] text-[#c793ff]">
                  — {q.name}, {q.city}&nbsp;&nbsp;·&nbsp;&nbsp;{q.condition}
                </span>
              </div>
            ))}
          </div>

          {/* Trust footer */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-2">
            {["Private & confidential", "200+ women helped", "ACE & INFS certified"].map((item) => (
              <span key={item} className="text-[0.65rem] text-white/55">{item}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}

export default function BookingConfirmed() {
  return (
    <Suspense fallback={null}>
      <BookingConfirmedInner />
    </Suspense>
  );
}
