"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { trackSchedule } from "../lib/analytics";
import { persistUserIdentity } from "../components/tracking/UserIdentityTracker";

// ── Confirmation page ───────────────────────────────────────────────────────
// Reached after a confirmed Cal.com booking. /session-booked redirects here with
// ?uid=<cal_booking_uid>&date=…&time=…&name=…&orderId=…
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

type BookingParams = { uid: string; name: string; date: string; time: string };

// Runs in the useState initializer (first render, client only): capture the
// params, then immediately strip the query string from the address bar.
function captureAndScrubParams(): BookingParams {
  if (typeof window === "undefined") {
    return { uid: "", name: "", date: "", time: "" };
  }
  const p = new URLSearchParams(window.location.search);
  const params = {
    uid: p.get("uid") || "",
    name: p.get("name") || "",
    date: p.get("date") || "",
    time: p.get("time") || "",
  };
  if (window.location.search) {
    try {
      history.replaceState(null, "", window.location.pathname);
    } catch { /* non-critical — worst case the URL keeps its query */ }
  }
  return params;
}

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
          {/* Confirmed badge */}
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

          {/* Headline */}
          <div className="rounded-[24px] border border-[#c5a24d]/15 bg-[#c5a24d]/[0.06] p-6 text-center">
            <h1 className="mb-3 text-[1.7rem] font-black leading-tight tracking-[-0.04em] text-white">
              You&apos;re all set{dispName ? `, ${dispName.split(" ")[0]}` : ""}.{" "}
              <span className="bg-gradient-to-r from-[#a855f7] to-[#c5a24d] bg-clip-text text-transparent">
                See you soon.
              </span>
            </h1>
            <p className="text-[0.82rem] leading-relaxed text-white/50">
              Swapnil will review everything you shared before you meet. Come with an open mind.
              Leave with a clear direction.
            </p>
          </div>

          {/* Session details */}
          {(dispDate || dispTime) && (
            <div className="rounded-2xl border border-[#a855f7]/8 bg-white/[0.04] p-5">
              <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/25">
                Your session details
              </p>
              <div className="grid grid-cols-2 gap-3">
                {dispDate && (
                  <div className="rounded-xl border border-[#a855f7]/7 bg-white/[0.04] p-3.5">
                    <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[#c5a24d]/65">Date</p>
                    <p className="text-[0.82rem] font-semibold leading-snug text-white/88">{dispDate}</p>
                  </div>
                )}
                {dispTime && (
                  <div className="rounded-xl border border-[#a855f7]/7 bg-white/[0.04] p-3.5">
                    <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[#c5a24d]/65">Time</p>
                    <p className="text-[0.82rem] font-semibold text-white/88">{dispTime}</p>
                    <p className="mt-0.5 text-[0.65rem] text-white/30">India Standard Time</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Google Meet notice */}
          <div className="rounded-2xl border border-[#a855f7]/20 bg-[#a855f7]/[0.07] p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg leading-none">📹</span>
              <div>
                <p className="text-[0.85rem] font-semibold text-white/90">
                  Your Google Meet link is in your email
                </p>
                <p className="mt-1 text-[0.76rem] leading-relaxed text-white/45">
                  Check your inbox for the calendar invite — it has your Google Meet link and an
                  automatic reminder. Swapnil will also reach you on WhatsApp before the session.
                </p>
              </div>
            </div>
          </div>

          {/* What to prepare */}
          <div className="rounded-2xl border border-[#a855f7]/7 bg-white/[0.04] p-5">
            <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/25">
              Before your session
            </p>
            <div className="space-y-3">
              {[
                { icon: "📄", title: "Bring your thyroid reports", body: "Your most recent TSH/T3/T4 — even a photo on your phone is fine." },
                { icon: "✏️", title: "Pen and paper ready", body: "Swapnil gives specific, actionable insights. You'll want to write them down." },
                { icon: "🔇", title: "A quiet space, zero distractions", body: "These 60 minutes belong entirely to you." },
                { icon: "❓", title: "Know your one key question", body: "The single thing you most want clarity on. Swapnil will open there." },
              ].map((tip) => (
                <div key={tip.title} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#a855f7]/20 bg-[#a855f7]/10 text-sm">
                    {tip.icon}
                  </div>
                  <div>
                    <p className="text-[0.82rem] font-semibold text-white/85">{tip.title}</p>
                    <p className="text-[0.72rem] leading-relaxed text-white/40">{tip.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust footer */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-2">
            {["Private & confidential", "200+ women helped", "ACE & INFS certified", "Full refund guaranteed"].map((item) => (
              <span key={item} className="text-[0.6rem] text-white/18">{item}</span>
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
