"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Cal, { getCalApi } from "@calcom/embed-react";
import { trackPurchase, trackSchedule } from "../lib/analytics";
import { SESSION_PRICE } from "../lib/pricing";
import { persistUserIdentity } from "../components/tracking/UserIdentityTracker";
import { NATIVE_BOOKING_KEY } from "../book/components/BookingFlow";
import type { Step1Data } from "../book/components/BookingFlow";

// ── Types ─────────────────────────────────────────────────────────────────────


type FlowStage = "booking" | "confirmation";

// ── Progress Stepper ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Your Profile" },
  { id: 2, label: "Secure Slot" },
  { id: 3, label: "Pick Time" },
  { id: 4, label: "Confirmed" },
];

function ProgressStepper({ activeStep }: { activeStep: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {STEPS.map((step, i) => {
        const done = step.id < activeStep;
        const active = step.id === activeStep;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`relative flex h-7 w-7 items-center justify-center rounded-full border text-[0.6rem] font-bold transition-all duration-500 ${
                  done
                    ? "border-[#a855f7]/60 bg-[#a855f7]/20 text-[#a855f7]"
                    : active
                    ? "border-[#a855f7]/80 bg-[#a855f7]/25 text-[#a855f7] shadow-[0_0_14px_rgba(168,85,247,0.4)]"
                    : "border-[#a855f7]/10 bg-white/[0.04] text-white/20"
                }`}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5 3.5-4" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span>{step.id}</span>
                )}
                {active && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#a855f7]/20" />
                )}
              </div>
              <span
                className={`mt-1.5 hidden text-[0.56rem] font-semibold uppercase tracking-[0.12em] sm:block ${
                  done ? "text-[#a855f7]/60" : active ? "text-[#a855f7]/80" : "text-white/15"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 h-px w-8 sm:w-12 transition-all duration-700 ${
                  step.id < activeStep ? "bg-[#a855f7]/40" : "bg-[#a855f7]/30"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Cal.com Step (Step 3) ────────────────────────────────────────────────────

function CalcomStep({
  onBooked,
  prefillName = "",
  prefillEmail = "",
  leadId = "",
  orderId = "",
}: {
  onBooked: (date: string, time: string) => void;
  prefillName?: string;
  prefillEmail?: string;
  leadId?: string;
  orderId?: string;
}) {
  const [booked, setBooked] = useState(false);
  // Idempotency: Schedule fires AT MOST once per mount, even if Cal.com emits
  // bookingSuccessful more than once.
  const scheduleFiredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cal = await getCalApi({ namespace: "60min" });
      if (cancelled) return;

      // Premium, on-brand styling. month_view = calendar on top, time slots
      // directly below. cal-brand (plum-rose) drives the selected day + chosen
      // slot highlight.
      cal("ui", {
        theme: "dark",
        layout: "month_view",
        hideEventTypeDetails: false,
        cssVarsPerTheme: {
          light: { "cal-brand": "#a855f7" },
          dark: { "cal-brand": "#a855f7" },
        },
      });

      cal("on", {
        action: "bookingSuccessful",
        callback: (e: unknown) => {
          // Real booking only (never fires on page load), and at most once per mount.
          if (scheduleFiredRef.current) return;
          scheduleFiredRef.current = true;

          const data =
            ((e as { detail?: { data?: Record<string, any> } })?.detail?.data) || {};
          // Defensive extraction — Cal.com payload shape varies by version
          const startTime: string =
            data?.booking?.startTime ||
            data?.startTime ||
            data?.date ||
            data?.booking?.start ||
            data?.confirmedEvent?.startTime ||
            "";
          const name: string =
            data?.booking?.attendees?.[0]?.name ||
            data?.attendees?.[0]?.name ||
            data?.booking?.responses?.name?.value ||
            data?.responses?.name?.value ||
            data?.booking?.name ||
            prefillName ||
            "";
          const email: string =
            data?.booking?.attendees?.[0]?.email ||
            data?.attendees?.[0]?.email ||
            data?.booking?.responses?.email?.value ||
            data?.responses?.email?.value ||
            prefillEmail ||
            "";
          // Cal.com booking uid — the canonical booking id, IDENTICAL in the
          // BOOKING_CREATED webhook. Keying event_id on it lets the server CAPI
          // Schedule deduplicate against this browser Schedule.
          const uid: string =
            data?.uid ||
            data?.booking?.uid ||
            data?.confirmedEvent?.uid ||
            "";

          let dateStr = "";
          let timeStr = "";
          if (startTime) {
            const dt = new Date(startTime);
            if (!isNaN(dt.getTime())) {
              dateStr = dt.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              timeStr = dt.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });
            }
          }

          setBooked(true);
          onBooked(dateStr, timeStr);

          // Browser Pixel Schedule. event_id = schedule_<uid> (shared with the
          // Cal.com webhook). Booking name/email passed for advanced matching.
          trackSchedule(
            { name, date: dateStr, time: timeStr },
            uid ? `schedule_${uid}` : undefined,
            {
              ...(email && { email }),
              ...(name && { first_name: name.split(" ")[0] }),
            },
          );
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [onBooked, prefillName, prefillEmail]);

  return (
    <div className="mx-auto w-full max-w-[640px]">
      {/* Heading — Fraunces display (site --font-display), Inter subline */}
      <div className="mb-5 text-center">
        <h2
          className="text-[length:clamp(1.5rem,1.2rem+1.4vw,2rem)] leading-[1.12] tracking-[-0.01em] text-white"
          style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 600 }}
        >
          {booked ? "Your session is confirmed." : "Choose a time that works for you"}
        </h2>
        <p className="mx-auto mt-2.5 max-w-[42ch] text-[0.85rem] leading-relaxed text-white/55">
          {booked
            ? "Swapnil reviews your full intake before you speak — check your email for the calendar invite."
            : "Swapnil personally reviews your intake before the call. Pick any open slot below."}
        </p>
      </div>

      {/* Elevated dark card wrapping the embed — blends into the dark page */}
      <div
        className="overflow-hidden rounded-[24px] p-2 sm:p-3"
        style={{
          background: "var(--bg-elevated)",
          boxShadow:
            "0 24px 70px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(168,85,247,0.22)",
        }}
      >
        <Cal
          namespace="60min"
          calLink="swapnilumbarkarfitness/60min"
          style={{ width: "100%", height: "100%", minHeight: "640px", overflow: "scroll" }}
          config={{
            layout: "month_view",
            ...(prefillName ? { name: prefillName } : {}),
            ...(prefillEmail ? { email: prefillEmail } : {}),
            // Additive metadata only — ties the booking (and the BOOKING_CREATED
            // webhook) back to the lead/payment. Does NOT affect the event_id
            // (still schedule_<uid>) or the bookingSuccessful tracking.
            ...((leadId || orderId)
              ? { metadata: { ...(leadId ? { leadId } : {}), ...(orderId ? { orderId } : {}) } }
              : {}),
          }}
        />
      </div>
    </div>
  );
}

// ── Confirmation (Step 4) ─────────────────────────────────────────────────────

function ConfirmationStep({
  name,
  date,
  time,
}: {
  name: string;
  date: string;
  time: string;
}) {
  return (
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
          You&apos;re all set{name ? `, ${name.split(" ")[0]}` : ""}.{" "}
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
      {(date || time) && (
        <div className="rounded-2xl border border-[#a855f7]/8 bg-white/[0.04] p-5">
          <p className="mb-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/25">
            Your session details
          </p>
          <div className="grid grid-cols-2 gap-3">
            {date && (
              <div className="rounded-xl border border-[#a855f7]/7 bg-white/[0.04] p-3.5">
                <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[#c5a24d]/65">Date</p>
                <p className="text-[0.82rem] font-semibold leading-snug text-white/88">{date}</p>
              </div>
            )}
            {time && (
              <div className="rounded-xl border border-[#a855f7]/7 bg-white/[0.04] p-3.5">
                <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[#c5a24d]/65">Time</p>
                <p className="text-[0.82rem] font-semibold text-white/88">{time}</p>
                <p className="mt-0.5 text-[0.65rem] text-white/30">India Standard Time</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp notice */}
      <div className="rounded-2xl border border-[#a855f7]/20 bg-[#a855f7]/[0.07] p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg leading-none">💬</span>
          <div>
            <p className="text-[0.85rem] font-semibold text-white/90">
              Expect a WhatsApp message from Swapnil
            </p>
            <p className="mt-1 text-[0.76rem] leading-relaxed text-white/45">
              You&apos;ll receive your Google Meet link and a reminder message before your session.
              Keep an eye on WhatsApp.
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
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SessionBooked() {
  const [show, setShow] = useState(false);
  // Land straight on the calendar after payment — the second-round questions no
  // longer block booking (they move to the post-booking confirmation, optional).
  const [stage, setStage] = useState<FlowStage>("booking");
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  // leadId + orderId are threaded into the Cal.com embed as metadata so the
  // BOOKING_CREATED webhook can tie a booking back to the right lead/payment.
  const [leadId, setLeadId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  // Entrance animation + detect native flow
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);

    const p = new URLSearchParams(window.location.search);
    const urlLeadId = p.get("leadId") || "";
    const urlOrderId = p.get("order_id") || p.get("orderId") || "";
    if (urlLeadId) setLeadId(urlLeadId);
    if (urlOrderId) setOrderId(urlOrderId);

    // Primary: localStorage has the full step1 payload
    let foundInStorage = false;
    try {
      const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as { step1: Step1Data; startedAt: string; leadId?: string; orderId?: string };
        if (stored.leadId) setLeadId(stored.leadId);
        if (stored.orderId) setOrderId(stored.orderId);
        if (stored.step1) {
          setStep1Data(stored.step1);
          foundInStorage = true;
          persistUserIdentity({ first_name: stored.step1.name, phone: stored.step1.phone });
        }
      }
    } catch { /* non-critical */ }

    // Fallback: localStorage empty but leadId is in URL (different browser/device).
    // Fetch the name/phone from the API so the greeting still works.
    if (!foundInStorage && urlLeadId) {
      fetch(`/api/leads/${encodeURIComponent(urlLeadId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { name?: string; phone?: string; email?: string } | null) => {
          if (data?.name) {
            setStep1Data({
              name: data.name,
              phone: data.phone ?? "",
              email: data.email ?? "",
              thyroidCondition: "",
              thyroidDuration: "",
              mainGoal: "",
            });
            persistUserIdentity({
              first_name: data.name.split(" ")[0],
              ...(data.phone && { phone: data.phone }),
              ...(data.email && { email: data.email }),
            });
          }
        })
        .catch(() => { /* non-critical */ });
    }

    // Capture any identity params passed in the URL
    try {
      const email = p.get("email") || p.get("customer_email") || "";
      const phone = p.get("phone") || p.get("customer_phone") || p.get("mobile") || "";
      const first_name = p.get("name") || p.get("customer_name") || p.get("first_name") || "";
      if (email || phone || first_name) persistUserIdentity({ ...(email && { email }), ...(phone && { phone }), ...(first_name && { first_name }) });
    } catch { /* non-critical */ }

    return () => clearTimeout(t);
  }, []);

  const handleBooked = useCallback(async (date: string, time: string) => {
    setBookingDate(date);
    setBookingTime(time);
    setStage("confirmation");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (submittedRef.current) return;
    submittedRef.current = true;

    // Read the stored booking so we can reuse the SAME Purchase id the Cashfree
    // webhook used (`Purchase_${orderId}`) — that's what lets Meta dedup the
    // browser Pixel, /api/events, and the payment webhook into one Purchase.
    const storedRaw = localStorage.getItem(NATIVE_BOOKING_KEY);
    const stored = storedRaw ? JSON.parse(storedRaw) as {
      step1: Step1Data;
      startedAt?: string;
      leadId?: string;
      orderId?: string;
      attribution?: Record<string, string>;
    } : null;

    // Purchase fires ONLY for a real payment (orderId present). A booking with no
    // orderId (e.g. a direct /session-booked visit that never paid) still fires
    // Schedule below, but NOT Purchase — we never mint a fake Purchase id.
    const lead = step1Data;
    if (stored?.orderId) {
      const purchaseEventId = trackPurchase(
        lead
          ? { first_name: lead.name.split(" ")[0], phone: lead.phone, ...(lead.email && { email: lead.email }) }
          : undefined,
        `Purchase_${stored.orderId}`,
        stored.orderId,
      );

      // Server-side CAPI Purchase — runs in parallel, non-blocking.
      // value/currency MUST live in custom_data: /api/events forwards custom_data
      // to CAPI and ignores any top-level value/currency. 199 = the ₹199 session
      // price (matches the webhook's dynamic payment_amount); shares the same
      // event_id so it dedupes with the webhook + browser Pixel Purchase.
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "Purchase",
          event_id: purchaseEventId,
          source_url: "https://www.swapnilumbarkarfitness.in/session-booked",
          custom_data: {
            value: SESSION_PRICE,
            currency: "INR",
            order_id: stored.orderId,
          },
          user_data: {
            ...(lead?.phone && { phone: lead.phone }),
            ...(lead?.name && { first_name: lead.name.split(" ")[0] }),
            ...(lead?.name && lead.name.split(" ").slice(1).join(" ") && { last_name: lead.name.split(" ").slice(1).join(" ") }),
            ...(lead?.email && { email: lead.email }),
          },
        }),
      }).catch(() => {});
    }

    // Submit unified payload
    try {
      setSubmitting(true);

      await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step1: stored?.step1 || step1Data,
          step3: { bookingDate: date, bookingTime: time, bookingStatus: "booked" },
          leadId: stored?.leadId,
          attribution: stored?.attribution,
          submittedAt: new Date().toISOString(),
        }),
      });

      // Clear localStorage after successful submission
      localStorage.removeItem(NATIVE_BOOKING_KEY);
    } catch {
      // silent — don't interrupt user experience
    } finally {
      setSubmitting(false);
    }
  }, [step1Data]);

  const activeStepNum = stage === "booking" ? 3 : 4;

  // Cal.com renders for EVERYONE — direct visits and no-context/cross-device
  // included. No Cal.com path remains.
  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--bg-page)", color: "#f3f4f7" }}
    >
      {/* Ambient brand tints (champagne gold on confirm, plum-rose otherwise) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full blur-[120px] transition-all duration-[1500ms]"
          style={{
            background:
              stage === "confirmation"
                ? "radial-gradient(ellipse, rgba(213,183,101,0.14) 0%, transparent 70%)"
                : "radial-gradient(ellipse, rgba(168,85,247,0.10) 0%, transparent 70%)",
          }}
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
        <ProgressStepper activeStep={activeStepNum} />

        <AnimatePresence mode="wait">
          {stage === "booking" && (
            <motion.div
              key="booking"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Payment-received confirmation — unmistakable, then the calendar. */}
              <div
                className="mb-6 rounded-2xl border p-4 text-center"
                style={{ borderColor: "rgba(213,183,101,0.45)", background: "rgba(213,183,101,0.08)" }}
              >
                <div className="mb-1.5 flex items-center justify-center gap-2">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                    style={{ borderColor: "rgba(168,85,247,0.45)", background: "rgba(168,85,247,0.12)" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7l3 3 7-7" stroke="#a855f7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-[0.9rem] font-bold" style={{ color: "#f3f4f7" }}>
                    Payment received — you&apos;re confirmed{step1Data?.name ? `, ${step1Data.name.split(" ")[0]}` : ""}.
                  </p>
                </div>
                <p className="text-[0.78rem]" style={{ color: "#a855f7" }}>
                  Last step: pick your call time below.
                </p>
              </div>

              <CalcomStep
                onBooked={handleBooked}
                prefillName={step1Data?.name || ""}
                prefillEmail={step1Data?.email || ""}
                leadId={leadId}
                orderId={orderId}
              />
            </motion.div>
          )}

          {stage === "confirmation" && (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              <ConfirmationStep
                name={step1Data?.name || ""}
                date={bookingDate}
                time={bookingTime}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {submitting && (
          <p className="mt-4 text-center text-[0.65rem] text-white/20">
            Saving your profile…
          </p>
        )}
      </div>
    </main>
  );
}
