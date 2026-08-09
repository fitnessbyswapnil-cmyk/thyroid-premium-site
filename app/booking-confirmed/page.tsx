"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { trackSchedule } from "../lib/analytics";
import { persistUserIdentity } from "../components/tracking/UserIdentityTracker";

// ── Show-up commitment page ──────────────────────────────────────────────────
// Reached after a confirmed Cal.com booking. /session-booked and /book redirect
// here with ?uid=<cal_booking_uid>&date=…&time=…&name=…
//
// This page's job is converting the booking into a COMMITMENT. She has PAID —
// so no extra hoops (the old send-YES step and Prep Kit PDF are gone per
// owner instruction). Just: calendar button, a short before-your-call list
// (quiet place, pen & paper, stable internet, reports on WhatsApp), a clear
// no-rescheduling line, social proof. PRICE-NEUTRAL: zero pricing language.
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

// One-tap "send my reports" link — the strongest pre-call commitment device.
// Message text is plain ASCII (non-ASCII corrupts in wa.me prefills).
function reportsHref(name: string, date: string): string {
  const text = `Hi Swapnil! Sharing my thyroid reports before our call${date ? ` on ${date}` : ""}.${name ? ` - ${name}` : ""}`;
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

// Short, practical, zero-hoop checklist (owner instruction): quiet place,
// pen & paper, stable internet — plus the reports ask, which is the single
// strongest predictor of a productive (and closeable) call.
const BEFORE_CALL = [
  { n: "1", title: "Be in a quiet place, 5 minutes early", body: "Your Google Meet link is in your email." },
  { n: "2", title: "Keep a pen and paper ready", body: "You'll want to note down what we find." },
  { n: "3", title: "Stable internet connection", body: "WiFi or strong 4G/5G — video works best." },
  { n: "4", title: "Send your thyroid reports on WhatsApp", body: "TSH, T3, T4 if you have them. No reports? Come anyway." },
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

          {/* ── 2. Calendar + reports — the two actions that matter ── */}
          <div className="rounded-[24px] border border-[#a855f7]/25 bg-[#a855f7]/[0.08] p-6 text-center">
            <a
              href={gcalHref(dispDate, dispTime)}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-button w-full"
            >
              <span className="cta-label">Add to Google Calendar</span>
            </a>

            <a
              href={reportsHref(dispName, dispDate)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost mx-auto mt-3 flex w-full items-center justify-center"
            >
              <span className="cta-label">Send My Reports on WhatsApp</span>
            </a>

            <p className="mx-auto mt-4 max-w-[40ch] text-[0.74rem] leading-relaxed text-white/55">
              Swapnil personally reviews your reports and answers before the
              call, so the 60 minutes start on YOUR case — not the basics.
            </p>
          </div>

          {/* ── 3. Before your call — short and practical ── */}
          <div className="rounded-[24px] border border-[#a855f7]/10 bg-white/[0.04] p-5">
            <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/55">
              Before your call
            </p>
            <div className="space-y-3">
              {BEFORE_CALL.map((s) => (
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
            <p className="mt-4 rounded-xl border border-[#d5b765]/20 bg-[#d5b765]/[0.06] px-4 py-3 text-center text-[0.74rem] leading-relaxed text-[#d5b765]">
              This slot is reserved exclusively for you — rescheduling is not
              possible, so please plan to attend.
            </p>
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
