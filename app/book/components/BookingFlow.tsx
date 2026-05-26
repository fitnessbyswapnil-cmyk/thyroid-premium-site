"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QualificationForm } from "./QualificationForm";
import { PaymentScreen } from "./PaymentScreen";
import { pushDL, trackLead, trackInitiateCheckout, generateEventId } from "@/app/lib/analytics";
import { getUtmParams, getFbclid, getVisitorId } from "@/lib/tracking";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Step1Data = {
  name: string;
  phone: string;
  email: string;
  age: string;
  thyroidCondition: string;
  weightStruggles: string[];
  energyLevel: string;
  biggestFrustration: string;
  mainGoal: string;
};

export const NATIVE_BOOKING_KEY = "thyroid_native_booking";

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
                    ? "border-purple-400/60 bg-purple-500/20 text-purple-300"
                    : active
                    ? "border-purple-400/80 bg-purple-500/25 text-purple-200 shadow-[0_0_14px_rgba(168,85,247,0.4)]"
                    : "border-white/10 bg-white/[0.03] text-white/20"
                }`}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5 3.5-4" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span>{step.id}</span>
                )}
                {active && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-purple-500/20" />
                )}
              </div>
              <span
                className={`mt-1.5 hidden text-[0.56rem] font-semibold uppercase tracking-[0.12em] sm:block ${
                  done ? "text-purple-400/60" : active ? "text-purple-300/80" : "text-white/15"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < FLOW_STEPS.length - 1 && (
              <div
                className={`mx-2 h-px w-8 sm:w-12 transition-all duration-700 ${
                  step.id < activeStep ? "bg-purple-500/40" : "bg-white/8"
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

export default function BookingFlow() {
  const [stage, setStage] = useState<FlowStage>("qualification");
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  const handleQualificationComplete = useCallback((data: Step1Data) => {
    const newLeadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setLeadId(newLeadId);
    setStep1Data(data);

    // Browser Pixel Lead — capture returned event_id for server dedup
    const leadEventId = trackLead({ first_name: data.name.split(" ")[0], phone: data.phone });
    pushDL({ event: "native_form_completed", step: 1 });

    const attribution = readAttribution();

    // Server-side CAPI Lead (deduplicates with browser Pixel via same event_id)
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "Lead",
        event_id: leadEventId,
        source_url: "https://www.swapnilumbarkarfitness.in/book",
        user_data: {
          first_name: data.name.split(" ")[0],
          phone: data.phone,
          ...(data.email && { email: data.email }),
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

    setStage("payment");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handlePayNow = useCallback(() => {
    if (!step1Data) return;
    const payload = {
      step1: step1Data,
      startedAt: new Date().toISOString(),
      leadId: leadId ?? undefined,
      attribution: readAttribution(),
    };
    try {
      localStorage.setItem(NATIVE_BOOKING_KEY, JSON.stringify(payload));
    } catch {
      // non-critical
    }
    trackInitiateCheckout();
    pushDL({ event: "native_payment_initiated", step: 2 });
    window.location.href = "https://payments.cashfree.com/forms?code=thyroid_consultation_booking";
  }, [step1Data, leadId]);

  const activeStep = stage === "qualification" ? 1 : 2;

  return (
    <div className="mx-auto max-w-[520px]">
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
          <motion.div
            key="payment"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            <PaymentScreen name={step1Data.name} onPay={handlePayNow} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
