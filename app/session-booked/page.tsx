"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Cal, { getCalApi } from "@calcom/embed-react";
import { CAL_UI_CONFIG } from "@/lib/cal-theme";
import { trackPurchase } from "../lib/analytics";
import { SESSION_PRICE } from "../lib/pricing";
import { persistUserIdentity } from "../components/tracking/UserIdentityTracker";
import { NATIVE_BOOKING_KEY } from "../book/components/BookingFlow";
import type { Step1Data } from "../book/components/BookingFlow";
import { CONSULTATION_FORM_URL } from "../context/ScarcityProvider";

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
                    ? "border-[#96661a]/60 bg-[#96661a]/20 text-[#96661a]"
                    : active
                    ? "border-[#96661a]/80 bg-[#96661a]/25 text-[#96661a] shadow-[0_0_14px_rgba(163, 114, 32,0.4)]"
                    : "border-[#96661a]/10 bg-white text-[#9c9384]"
                }`}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5 3.5-4" stroke="#96661a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span>{step.id}</span>
                )}
                {active && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#96661a]/20" />
                )}
              </div>
              <span
                className={`mt-1.5 hidden text-[0.56rem] font-semibold uppercase tracking-[0.12em] sm:block ${
                  done ? "text-[#96661a]/60" : active ? "text-[#96661a]/80" : "text-[#c9c0af]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 h-px w-8 sm:w-12 transition-all duration-700 ${
                  step.id < activeStep ? "bg-[#96661a]/40" : "bg-[#96661a]/30"
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

// Normalise an Indian mobile number to E.164 (+91XXXXXXXXXX). Handles bare
// 10-digit input, 91-prefixed 12-digit input, and passes anything else
// through untouched rather than corrupting an unusual format.
function toIndianE164(p: string): string {
  const d = p.replace(/\D/g, "");
  const ten = d.length === 12 && d.startsWith("91") ? d.slice(2) : d;
  return ten.length === 10 ? `+91${ten}` : p;
}

function CalcomStep({
  onBooked,
  prefillName = "",
  prefillEmail = "",
  prefillPhone = "",
  leadId = "",
  orderId = "",
}: {
  onBooked: (date: string, time: string, uid: string) => void;
  prefillName?: string;
  prefillEmail?: string;
  prefillPhone?: string;
  leadId?: string;
  orderId?: string;
}) {
  // Idempotency: redirect fires AT MOST once per mount, even if Cal.com emits
  // bookingSuccessful more than once.
  const bookedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cal = await getCalApi({ namespace: "60min" });
      if (cancelled) return;

      // Premium, on-brand styling. month_view = calendar with date picker and
      // time slots side-by-side (the wide container gives it room). cal-brand
      // (plum-rose) drives the selected day + chosen slot highlight.
      cal("ui", CAL_UI_CONFIG);

      cal("on", {
        action: "bookingSuccessful",
        callback: (e: unknown) => {
          // Real booking only (never fires on page load), and at most once per mount.
          if (bookedRef.current) return;
          bookedRef.current = true;

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
          // Cal.com booking uid — the canonical booking id, IDENTICAL in the
          // BOOKING_CREATED webhook. The /booking-confirmed page keys the
          // Schedule event_id on it (schedule_<uid>) so the browser Pixel and
          // the Cal.com webhook CAPI deduplicate to a single Schedule.
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

          // Hand off to the parent — which writes the booking and redirects to
          // /booking-confirmed (where Schedule fires on page load). Schedule is
          // NOT fired here.
          onBooked(dateStr, timeStr, uid);
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [onBooked]);

  return (
    <div className="mx-auto w-full">
      {/* Heading — Fraunces display (site --font-display), Inter subline */}
      <div className="mb-5 text-center">
        <h2
          className="text-[length:clamp(1.5rem,1.2rem+1.4vw,2rem)] leading-[1.12] tracking-[-0.01em] text-[#241f1a]"
          style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 600 }}
        >
          Choose a time that works for you
        </h2>
        <p className="mx-auto mt-2.5 max-w-[42ch] text-[0.85rem] leading-relaxed text-[#6b6157]">
          Swapnil personally reviews your intake before the call. Pick any open slot below.
        </p>
      </div>

      {/* Elevated dark card wrapping the embed — blends into the dark page */}
      <div
        className="overflow-hidden rounded-[24px] p-2 sm:p-3"
        style={{
          background: "var(--bg-elevated)",
          boxShadow:
            "0 24px 70px rgba(36, 31, 26,0.14), inset 0 0 0 1px rgba(163, 114, 32,0.09)",
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
            // Cal.com smsReminderNumber / attendeePhoneNumber prefill (WhatsApp).
            // Explicit +91: a bare 10-digit number makes Cal.com GUESS the
            // country for its flag selector; E.164 makes India deterministic.
            ...(prefillPhone ? { attendeePhoneNumber: toIndianE164(prefillPhone), smsReminderNumber: toIndianE164(prefillPhone) } : {}),
            // Additive metadata only — ties the booking (and the BOOKING_CREATED
            // webhook) back to the lead/payment. Does NOT affect the event_id
            // (still schedule_<uid>) or the bookingSuccessful handling.
            ...((leadId || orderId)
              ? { metadata: { ...(leadId ? { leadId } : {}), ...(orderId ? { orderId } : {}) } }
              : {}),
          }}
        />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SessionBooked() {
  const [show, setShow] = useState(false);
  // Entitlement to see the calendar, decided by the server. Anyone could open
  // this URL and book a free consultation while the embed rendered
  // unconditionally — the page even claimed "Payment received". "checking"
  // holds the calendar back until /api/booking-access answers.
  const [access, setAccess] = useState<"checking" | "granted" | "denied">("checking");
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  // leadId + orderId thread into the Cal.com embed as metadata so the
  // BOOKING_CREATED webhook can tie a booking back to the right lead/payment.
  const [leadId, setLeadId] = useState("");
  const [orderId, setOrderId] = useState("");
  const submittedRef = useRef(false);     // guards the booking redirect (once)
  const purchaseFiredRef = useRef(false); // guards the page-load Purchase (once)

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

  // ── Entitlement check ────────────────────────────────────────────────────────
  // Runs once on mount against every identifier we hold: the order id from the
  // URL or the localStorage bridge, and the lead id. The server decides; this
  // only renders the answer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = new URLSearchParams(window.location.search);
      let oid = p.get("order_id") || p.get("orderId") || "";
      let lid = p.get("leadId") || "";
      try {
        const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as { orderId?: string; leadId?: string };
          if (!oid && stored.orderId) oid = stored.orderId;
          if (!lid && stored.leadId) lid = stored.leadId;
        }
      } catch { /* non-critical */ }

      if (!oid && !lid) {
        if (!cancelled) setAccess("denied");
        return;
      }

      try {
        const qs = new URLSearchParams();
        if (oid) qs.set("orderId", oid);
        if (lid) qs.set("leadId", lid);
        const res = await fetch(`/api/booking-access?${qs.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as { allowed?: boolean };
        if (!cancelled) setAccess(json.allowed ? "granted" : "denied");
      } catch {
        // The route itself is unreachable. She holds an order id, so she came
        // through checkout — never strand a paying customer on a network blip.
        if (!cancelled) setAccess(oid ? "granted" : "denied");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Purchase fires HERE, on /session-booked page load ────────────────────────
  // This page is reached only after a SUCCESSFUL Cashfree payment (the SDK
  // success callback redirects here with ?orderId=…). Guarded so Purchase fires
  // AT MOST once per order, even on refresh / back-forward navigation:
  //   • purchaseFiredRef       → once per mount
  //   • sessionStorage key     → once per order id, across remounts in this tab
  // event_id = Purchase_<orderId> (shared with /api/events AND the Cashfree
  // webhook) so Meta deduplicates the browser Pixel, direct CAPI, and the
  // payment-webhook CAPI into a SINGLE Purchase. value = the REAL charged amount
  // (read dynamically from storage; never hardcoded), falling back to SESSION_PRICE.
  useEffect(() => {
    if (purchaseFiredRef.current) return;

    // Resolve the order id from URL first, then from stored booking.
    const p = new URLSearchParams(window.location.search);
    let oid = p.get("order_id") || p.get("orderId") || "";
    let amount: number | undefined;
    let lead: Step1Data | null = step1Data;

    try {
      const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as { step1?: Step1Data; orderId?: string; amount?: number };
        if (!oid && stored.orderId) oid = stored.orderId;
        if (typeof stored.amount === "number") amount = stored.amount;
        if (!lead && stored.step1) lead = stored.step1;
      }
    } catch { /* non-critical */ }

    // No order id → never mint a fake Purchase.
    if (!oid) return;

    // Once-per-order guard across remounts in this tab.
    const sessionKey = `purchase_fired_${oid}`;
    try {
      if (sessionStorage.getItem(sessionKey)) {
        purchaseFiredRef.current = true;
        return;
      }
    } catch { /* sessionStorage unavailable — fall through, ref still guards mount */ }

    purchaseFiredRef.current = true;
    try { sessionStorage.setItem(sessionKey, "1"); } catch { /* non-critical */ }

    const value = amount ?? SESSION_PRICE;

    // Browser Pixel Purchase — event_id Purchase_<orderId>, real charged amount.
    const purchaseEventId = trackPurchase(
      lead
        ? { first_name: lead.name.split(" ")[0], phone: lead.phone, ...(lead.email && { email: lead.email }) }
        : undefined,
      `Purchase_${oid}`,
      oid,
      value,
    );

    // Server-side CAPI Purchase — runs in parallel, non-blocking.
    // value/currency MUST live in custom_data: /api/events forwards custom_data
    // to CAPI and ignores any top-level value/currency. Shares the same event_id
    // so it dedupes with the webhook + browser Pixel Purchase.
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "Purchase",
        event_id: purchaseEventId,
        source_url: window.location.href,
        custom_data: {
          value,
          currency: "INR",
          order_id: oid,
        },
        user_data: {
          ...(lead?.phone && { phone: lead.phone }),
          ...(lead?.name && { first_name: lead.name.split(" ")[0] }),
          ...(lead?.name && lead.name.split(" ").slice(1).join(" ") && { last_name: lead.name.split(" ").slice(1).join(" ") }),
          ...(lead?.email && { email: lead.email }),
        },
      }),
      keepalive: true,
    }).catch(() => {});
  }, [step1Data]);

  // On a confirmed Cal.com booking: persist the booking server-side, then
  // redirect to /booking-confirmed (which fires Schedule on load). Schedule is
  // NOT fired here.
  const handleBooked = useCallback((date: string, time: string, uid: string) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const storedRaw = localStorage.getItem(NATIVE_BOOKING_KEY);
    const stored = storedRaw ? JSON.parse(storedRaw) as {
      step1?: Step1Data;
      startedAt?: string;
      leadId?: string;
      orderId?: string;
      attribution?: Record<string, string>;
    } : null;

    const resolvedOrderId = stored?.orderId || orderId || "";

    // Persist the unified booking payload — keepalive so it survives the
    // imminent navigation.
    try {
      fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step1: stored?.step1 || step1Data,
          step3: { bookingDate: date, bookingTime: time, bookingStatus: "booked" },
          leadId: stored?.leadId || leadId,
          attribution: stored?.attribution,
          submittedAt: new Date().toISOString(),
        }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* non-critical */ }

    // Clear localStorage now that the booking is captured.
    try { localStorage.removeItem(NATIVE_BOOKING_KEY); } catch { /* non-critical */ }

    // Redirect to the confirmation page — Schedule fires there on load,
    // keyed schedule_<uid> so it dedupes with the Cal.com webhook CAPI.
    const params = new URLSearchParams();
    if (uid) params.set("uid", uid);
    if (resolvedOrderId) params.set("orderId", resolvedOrderId);
    if (date) params.set("date", date);
    if (time) params.set("time", time);
    const name = (stored?.step1?.name || step1Data?.name || "");
    if (name) params.set("name", name);

    window.location.href = `/booking-confirmed?${params.toString()}`;
  }, [step1Data, leadId, orderId]);

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--bg-page)", color: "var(--t1)" }}
    >
      {/* Ambient brand tints (plum-rose) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(ellipse, rgba(163, 114, 32,0.10) 0%, transparent 70%)" }}
        />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full blur-[110px]" style={{ background: "rgba(163, 114, 32,0.09)" }} />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full blur-[110px]" style={{ background: "rgba(184,147,74,0.08)" }} />
      </div>

      <div
        className="relative z-10 mx-auto max-w-[920px] px-5 pb-20 pt-12 transition-all duration-700"
        style={{
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(18px)",
        }}
      >
        <ProgressStepper activeStep={3} />

        {access === "checking" && (
          <div className="py-20 text-center">
            <div
              className="mx-auto mb-4 h-10 w-10 rounded-full border-2"
              style={{
                borderColor: "#ddd4c6",
                borderTopColor: "rgba(163, 114, 32,0.85)",
                animation: "sb-spin 0.9s linear infinite",
              }}
            />
            <p className="text-[0.9rem]" style={{ color: "#6b6157" }}>
              Confirming your payment…
            </p>
            <style>{`@keyframes sb-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* No payment on record — the calendar is never rendered, so the URL
            alone cannot buy a consultation. She still gets a way forward
            rather than a dead end. */}
        {access === "denied" && (
          <div
            className="mx-auto max-w-[520px] rounded-2xl border p-7 text-center"
            style={{ borderColor: "rgba(245,158,11,0.30)", background: "rgba(245,158,11,0.06)" }}
          >
            <p className="mb-3 text-[1.6rem]">🔒</p>
            <h2 className="mb-3 text-[1.15rem] font-bold" style={{ color: "var(--t1)" }}>
              Your slot isn&apos;t confirmed yet
            </h2>
            <p className="mb-6 text-[0.86rem] leading-relaxed" style={{ color: "#423b33" }}>
              Consultation times are held only after the ₹299 is paid — it keeps the
              calendar honest for the women waiting. Fully refundable if you don&apos;t
              leave the call with clarity, and credited against your plan.
            </p>
            <a
              href={CONSULTATION_FORM_URL}
              className="block rounded-2xl px-5 py-4 text-[1rem] font-extrabold no-underline"
              style={{
                color: "#ffffff",
                background: "linear-gradient(135deg, #96661a, #8a5d12)",
                boxShadow: "0 12px 36px rgba(163, 114, 32,0.35)",
              }}
            >
              Pay ₹299 &amp; Pick My Time →
            </a>
            <p className="mt-4 text-[0.72rem]" style={{ color: "#857c6d" }}>
              Already paid? Open the booking link from your WhatsApp confirmation,
              or reply there and we&apos;ll sort it out immediately.
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {access === "granted" && (
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
              style={{ borderColor: "rgba(160,124,51,0.45)", background: "rgba(160,124,51,0.08)" }}
            >
              <div className="mb-1.5 flex items-center justify-center gap-2">
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                  style={{ borderColor: "rgba(163, 114, 32,0.45)", background: "rgba(163, 114, 32,0.12)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l3 3 7-7" stroke="#96661a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-[0.9rem] font-bold" style={{ color: "var(--t1)" }}>
                  Payment received — your consultation is confirmed{step1Data?.name ? `, ${step1Data.name.split(" ")[0]}` : ""}.
                </p>
              </div>
              <p className="text-[0.78rem]" style={{ color: "#96661a" }}>
                Last step: pick your call time below.
              </p>
              <p className="mt-1.5 text-[0.72rem]" style={{ color: "#6b6157" }}>
                After booking, send your latest thyroid reports (TSH, T3, T4) on WhatsApp — Swapnil reviews them personally before your call.
              </p>
            </div>

            <CalcomStep
              onBooked={handleBooked}
              prefillName={step1Data?.name || ""}
              prefillEmail={step1Data?.email || ""}
              prefillPhone={step1Data?.phone || ""}
              leadId={leadId}
              orderId={orderId}
            />
          </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
