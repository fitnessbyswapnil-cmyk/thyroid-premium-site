"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QualificationForm } from "./QualificationForm";
import { PaymentScreen } from "./PaymentScreen";
import { pushDL, trackLead, trackInitiateCheckout } from "@/app/lib/analytics";
import { persistUserIdentity } from "@/app/components/tracking/UserIdentityTracker";
import { CONSULTATION_FORM_URL } from "@/app/context/ScarcityProvider";
import { getUtmParams, getFbclid, getVisitorId, getFbc, getFbp } from "@/lib/tracking";
import { checkoutRedirectTarget } from "@/lib/checkout-target";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Step1Data = {
    name: string;
    phone: string;
    email: string;
    thyroidCondition: string;
    thyroidDuration: string;
    mainGoal: string;
};

export const NATIVE_BOOKING_KEY = "thyroid_native_booking";

// ── Make webhook URL ──────────────────────────────────────────────────────────

const MAKE_WEBHOOK_URL =
    "https://hook.us2.make.com/vafr1x6if1eehv2vxhyfw74ihh3b2nz8";

// ── Webhook POST helper ───────────────────────────────────────────────────────
// Fires exactly once per submission (guarded by ref in caller).
// On failure: logs the error but never blocks the user from reaching payment.

async function postToMakeWebhook(data: Step1Data): Promise<void> {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Basic validation — name and valid email must be present
  if (!data.name.trim() || !EMAIL_RE.test(data.email.trim())) {
        console.warn("[webhook] Skipped: name or email invalid", {
                name: data.name,
                email: data.email,
        });
        return;
  }

  const payload = {
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        q1: data.thyroidCondition,
        q2: data.thyroidDuration,
        q3: data.mainGoal,
        stage: "qualified_unpaid",
        submitted_at: new Date().toISOString(),
        source: "landing_page",
  };

  try {
        const res = await fetch(MAKE_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
        });

      if (!res.ok) {
              console.error(
                        "[webhook] Non-OK response:",
                        res.status,
                        res.statusText
                      );
      }
  } catch (err) {
        console.error(
                "[webhook] POST failed (user continues to payment):",
                err instanceof Error ? err.message : String(err)
              );
  }
}

function readAttribution() {
    if (typeof window === "undefined") return {};
    const utms = getUtmParams();
    const fbclid = getFbclid();
    const visitor_id = getVisitorId();
    return { ...utms, ...(fbclid && { fbclid }), ...(visitor_id && { visitor_id }) };
}

// ── ProgressStepper ───────────────────────────────────────────────────────────

const FLOW_STEPS = [
  { id: 1, label: "Your Profile" },
  { id: 2, label: "Secure Slot" },
  { id: 3, label: "Deep Intake" },
  { id: 4, label: "Book Session" },
  ];

function ProgressStepper({ activeStep }: { activeStep: number }) {
    return (
          <div className="mb-8 flex items-center justify-center gap-0">
            {FLOW_STEPS.map((step, i) => {
                    const done = step.id < activeStep;
                    const active = step.id === activeStep;
                    const upcoming = step.id > activeStep;
                    return (
                                <div key={step.id} className="flex items-center">
                                            <div className="flex flex-col items-center">
                                                          <div
                                                                            className={`relative flex h-7 w-7 items-center justify-center rounded-full border text-[0.6rem] font-bold transition-all duration-500 ${
                                                                                                done
                                                                                                  ? "border-[#0b8f80] bg-[#0b8f80]/15 text-[#085e54]"
                                                                                                  : active
                                                                                                  ? "border-[#0b8f80] bg-[#0b8f80]/15 text-[#085e54] shadow-[0_0_14px_rgba(11,143,128,0.4)]"
                                                                                                  : "border-[#e0d7c6] bg-white text-[#9c9384]"
                                                                            }`}
                                                                          >
                                                            {done ? (
                                                                                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                                                                                  <path d="M2 5l2.5 2.5 3.5-4" stroke="#0b8f80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                                                </svg>
                                                                                            ) : (
                                                                                              <span>{step.id}</span>
                                                                          )}
                                                            {active && (
                                                                                              <span className="absolute inset-0 animate-ping rounded-full bg-[#0b8f80]/15" />
                                                                                            )}
                                                          </div>
                                                          <span
                                                                            className={`mt-1.5 hidden text-[0.56rem] font-semibold uppercase tracking-[0.12em] sm:block ${
                                                                                                done ? "text-[#0a6b60]" : active ? "text-[#0a6b60]" : "text-[#9c9384]"
                                                                            }`}
                                                                          >
                                                            {step.label}
                                                          </span>
                                            </div>
                                  {i < FLOW_STEPS.length - 1 && (
                                                <div
                                                                  className={`mx-2 h-px w-8 sm:w-12 transition-all duration-700 ${
                                                                                      step.id < activeStep ? "bg-[#0b8f80]/40" : "bg-[#e0d7c6]"
                                                                  }`}
                                                                />
                                              )}
                                </div>
                              );
          })}
          </div>
        );
}

// ── BookingFlow ───────────────────────────────────────────────────────────────

type FlowStage = "qualification" | "payment";

export default function BookingFlow({
    onQualificationComplete,
}: {
    onQualificationComplete?: () => void;
}) {
    const [stage, setStage] = useState<FlowStage>("qualification");
    const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
    const [leadId, setLeadId] = useState<string | null>(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentError, setPaymentError] = useState("");
  
    // Double-fire guard: webhook fires at most once per component mount
    const webhookFiredRef = useRef(false);
  
    // Ref-callback pattern: fires when payment section mounts (post AnimatePresence exit),
    // guaranteeing the scroll target is in the DOM and always scrolls DOWNWARD.
    const [step2El, setStep2El] = useState<HTMLDivElement | null>(null);
    const [pendingScroll, setPendingScroll] = useState(false);
  
    useEffect(() => {
          if (pendingScroll && step2El) {
                  step2El.scrollIntoView({ behavior: "smooth", block: "start" });
                  setPendingScroll(false);
          }
    }, [pendingScroll, step2El]);
  
    const handleQualificationComplete = useCallback((data: Step1Data) => {
          const newLeadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          setLeadId(newLeadId);
          setStep1Data(data);

          const firstName = data.name.split(" ")[0];
          const lastName = data.name.split(" ").slice(1).join(" ");

          // Persist identity at the EARLIEST capture so every later event
          // (InitiateCheckout, Purchase, Schedule) AND later page loads hydrate
          // advanced matching (em/ph/fn/ln) from localStorage.
          persistUserIdentity({
                  email: data.email,
                  phone: data.phone,
                  first_name: firstName,
                  ...(lastName && { last_name: lastName }),
          });

          // Browser Pixel Lead — capture returned event_id for server dedup
          const leadEventId = trackLead({
                  first_name: firstName,
                  ...(lastName && { last_name: lastName }),
                  phone: data.phone,
                  email: data.email,
          });
          pushDL({ event: "native_form_completed", step: 1 });
      
          const attribution = readAttribution();
      
          // Server-side CAPI Lead (deduplicates with browser Pixel via same event_id)
          fetch("/api/events", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                            event_name: "Lead",
                            event_id: leadEventId,
                            source_url: window.location.href,
                            user_data: {
                                        first_name: firstName,
                                        ...(lastName && { last_name: lastName }),
                                        phone: data.phone,
                                        email: data.email,
                                        ...(attribution.visitor_id && { external_id: attribution.visitor_id }),
                            },
                  }),
          }).catch(() => {});
      
          // Write initial lead row to Sheets immediately (pre-payment)
          fetch("/api/leads", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ leadId: newLeadId, step1: data, attribution }),
          }).catch(() => {});
      
          // ── Make webhook POST (fires once, never blocks user) ─────────────────
          if (!webhookFiredRef.current) {
                  webhookFiredRef.current = true;
                  postToMakeWebhook(data);
          }
      
          setStage("payment");
          onQualificationComplete?.();
          // Request scroll — fires when step2El ref callback populates (payment section mounts)
          setPendingScroll(true);
    }, [onQualificationComplete]);
  
    const handlePayNow = useCallback(async () => {
          if (!step1Data || !leadId) return;
          setPaymentLoading(true);
          setPaymentError("");
      
          // Persist lead data now — needed by /payment-success → /session-booked bridge
          // even if the user leaves via UPI app redirect
          const attribution = readAttribution();
          try {
                  localStorage.setItem(
                            NATIVE_BOOKING_KEY,
                            JSON.stringify({
                                        step1: step1Data,
                                        startedAt: new Date().toISOString(),
                                        leadId,
                                        attribution,
                            }),
                          );
          } catch { /* non-critical */ }
      
          trackInitiateCheckout();
          pushDL({ event: "native_payment_initiated", step: 2 });

          // EMBEDDED checkout — Cashfree SDK modal on this page, details prefilled
          // from step 1, visitor_id/fbc/fbp riding as order_tags for the webhook's
          // Purchase CAPI. Falls back to the hosted form if the API/SDK can't start.
          try {
                  const orderRes = await fetch("/api/create-cashfree-order", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                        leadId,
                                        customerPhone: step1Data.phone,
                                        customerName: step1Data.name,
                                        customerEmail: step1Data.email,
                                        visitorId: getVisitorId(),
                                        fbc: getFbc(),
                                        fbp: getFbp(),
                            }),
                  });
                  if (!orderRes.ok) throw new Error("order_failed");

                  const { paymentSessionId, orderId, amount } = await orderRes.json() as {
                            paymentSessionId: string;
                            orderId: string;
                            amount?: number;
                  };

                  // Persist orderId + real charged amount so /session-booked fires
                  // Purchase with event_id Purchase_<orderId> (dedups with webhook).
                  try {
                            const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
                            const obj = raw ? JSON.parse(raw) : {};
                            localStorage.setItem(NATIVE_BOOKING_KEY, JSON.stringify({ ...obj, orderId, amount }));
                  } catch { /* non-critical */ }

                  const { load } = await import("@cashfreepayments/cashfree-js");
                  const cashfree = await load({
                            mode: process.env.NODE_ENV === "production" ? "production" : "sandbox",
                  });
                  if (!cashfree) throw new Error("sdk_unavailable");

                  // Mobile → "_self": full-page Cashfree checkout with native
                  // GPay/PhonePe/Paytm app-launch buttons (UPI intent doesn't
                  // fire from the iframe modal). Desktop → "_modal" with QR.
                  const result = await cashfree.checkout({
                            paymentSessionId,
                            redirectTarget: checkoutRedirectTarget(),
                  });

                  if (result.error) {
                            setPaymentError("Payment was not completed. Please try again or use UPI.");
                            setPaymentLoading(false);
                  } else if (result.paymentDetails) {
                            window.location.href = `/session-booked?orderId=${orderId}&leadId=${leadId}`;
                            // loading stays true — navigating away
                  } else {
                            setPaymentError("Payment not completed. Tap the button to try again.");
                            setPaymentLoading(false);
                  }
          } catch (err) {
                  console.error("[payment] embedded checkout unavailable, falling back to hosted form:", err instanceof Error ? err.message : String(err));
                  window.location.href = CONSULTATION_FORM_URL;
          }
    }, [step1Data, leadId]);
  
    // Mobile pays via full-page redirect ("_self") — if she cancels on the
    // Cashfree page and comes back, bfcache restores this page with the CTA
    // stuck on the loading state. Re-arm it so she can retry.
    useEffect(() => {
          const onPageShow = (e: PageTransitionEvent) => {
                  if (e.persisted) {
                            setPaymentLoading(false);
                            setPaymentError("");
                  }
          };
          window.addEventListener("pageshow", onPageShow);
          return () => window.removeEventListener("pageshow", onPageShow);
    }, []);

    const activeStep = stage === "qualification" ? 1 : 2;
  
    return (
          <div id="secure-spot-section" className="mx-auto max-w-[520px]">
                <ProgressStepper activeStep={activeStep} />
          
                <AnimatePresence mode="wait">
                  {stage === "qualification" && (
                      <motion.div
                                    key="qualification"
                                    initial={{ opacity: 0, y: 18 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -18 }}
                                    transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                                  >
                                  <QualificationForm onComplete={handleQualificationComplete} />
                      </motion.div>
                    )}
                
                  {stage === "payment" && step1Data && (
                      // ref callback: fires when payment section mounts → triggers downward scroll
                      <motion.div
                                    key="payment"
                                    ref={setStep2El}
                                    initial={{ opacity: 0, y: 18 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -18 }}
                                    transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                                  >
                                  <PaymentScreen
                                                  name={step1Data.name}
                                                  onPay={handlePayNow}
                                                  loading={paymentLoading}
                                                  error={paymentError}
                                                />
                      </motion.div>
                    )}
                </AnimatePresence>
          </div>
        );
}
