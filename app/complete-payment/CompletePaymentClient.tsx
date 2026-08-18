"use client";

/**
 * CompletePaymentClient — the interactive half of /complete-payment.
 * Split from page.tsx so the server component there can export metadata
 * (this file can't, once marked "use client").
 *
 * Resume entry point for someone who already completed the quiz and never
 * paid — reached from the payment_reminder WhatsApp nudge. She should never
 * have to retake the quiz to get here.
 *
 * Reuses the SAME tracked pipeline the live quiz result screen uses
 * (QuizFunnel.tsx payNow): /api/create-cashfree-order with her EXISTING
 * leadId, then the Cashfree JS SDK checkout, then redirect to
 * /session-booked?orderId=...&leadId=... so Purchase/booking_confirmation
 * fire exactly as they already do for the primary flow. No guarded file is
 * touched or duplicated — this is a second front door onto the same backend.
 *
 * Deliberately NOT using the payments.cashfree.com/forms hosted-form
 * fallback as the primary path here: lib/cashfree-payload.ts normalizes FORM
 * webhooks to payment:null ("shape unconfirmed"), so a payment through that
 * link is invisible to Paid status, booking_confirmation, and the Purchase
 * event. It's kept only as the last-resort fallback below, matching the same
 * graceful-degradation choice QuizFunnel already makes when the order API or
 * SDK can't start.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CONSULTATION_FORM_URL } from "@/app/context/ScarcityProvider";
import { pushDL, trackInitiateCheckout } from "@/app/lib/analytics";
import { persistUserIdentity } from "@/app/components/tracking/UserIdentityTracker";
import { getVisitorId, getFbc, getFbp } from "@/lib/tracking";
import { NATIVE_BOOKING_KEY } from "@/app/book/components/BookingFlow";
import { SESSION_PRICE } from "@/app/lib/pricing";
import { checkoutRedirectTarget } from "@/lib/checkout-target";

type Lead = { leadId: string; name: string; phone: string; email: string; paid?: boolean; booked?: boolean };
// "already_paid" is the double-payment guard: she reached a pay link but the
// sheet already shows her as paid (possibly from a different entry point, or
// a different row carrying the same phone). Charging her again would be the
// worst outcome this page could produce, so it never offers the button.
type Status = "loading" | "ready" | "already_paid" | "not_found" | "error";

export default function CompletePaymentClient() {
  const [status, setStatus] = useState<Status>("loading");
  const [lead, setLead] = useState<Lead | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const cashfreeRef = useRef<Awaited<ReturnType<typeof import("@cashfreepayments/cashfree-js").load>> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const leadId = params.get("leadId") || "";
    if (!leadId) {
      setStatus("error");
      return;
    }

    fetch(`/api/leads/${encodeURIComponent(leadId)}`)
      .then((res) => {
        if (res.status === 404) {
          setStatus("not_found");
          return null;
        }
        if (!res.ok) throw new Error("fetch_failed");
        return res.json() as Promise<Lead>;
      })
      .then((data) => {
        if (!data) return;
        setLead({ ...data, leadId });

        const firstName = (data.name || "").trim().split(/\s+/)[0];
        persistUserIdentity({
          ...(firstName && { first_name: firstName }),
          ...(data.phone && { phone: data.phone }),
          ...(data.email && { email: data.email }),
        });

        // She already paid — send her to book, never to pay again. This is the
        // whole point of the guard: with a site checkout AND a WhatsApp button
        // both live, the same woman can reach a pay link twice, and a second
        // charge is far worse than a redundant booking prompt.
        if (data.paid) {
          setStatus("already_paid");
          return;
        }

        setStatus("ready");
        // Warm the SDK while she reads the screen, same as the quiz result page.
        import("@cashfreepayments/cashfree-js")
          .then(({ load }) => load({ mode: process.env.NODE_ENV === "production" ? "production" : "sandbox" }))
          .then((cf) => {
            cashfreeRef.current = cf;
          })
          .catch(() => {});
      })
      .catch(() => setStatus("error"));
  }, []);

  const payNow = useCallback(async () => {
    if (!lead || payLoading) return;
    setPayLoading(true);
    setPayError("");
    pushDL({ event: "cta_click", location: "complete_payment_resume", button_label: "Pay & Book My Call" });
    trackInitiateCheckout();
    pushDL({ event: "quiz_payment_initiated" });

    try {
      const orderRes = await fetch("/api/create-cashfree-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.leadId,
          customerPhone: lead.phone,
          customerName: lead.name,
          customerEmail: lead.email,
          visitorId: getVisitorId(),
          fbc: getFbc(),
          fbp: getFbp(),
        }),
      });
      if (!orderRes.ok) throw new Error("order_failed");

      const { paymentSessionId, orderId, amount } = (await orderRes.json()) as {
        paymentSessionId: string;
        orderId: string;
        amount?: number;
      };

      try {
        localStorage.setItem(
          NATIVE_BOOKING_KEY,
          JSON.stringify({
            step1: {
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              thyroidCondition: "",
              thyroidDuration: "",
              mainGoal: "",
            },
            startedAt: new Date().toISOString(),
            leadId: lead.leadId,
            orderId,
            amount,
          }),
        );
      } catch {
        /* non-critical */
      }

      let cashfree = cashfreeRef.current;
      if (!cashfree) {
        const { load } = await import("@cashfreepayments/cashfree-js");
        cashfree = await load({ mode: process.env.NODE_ENV === "production" ? "production" : "sandbox" });
      }
      if (!cashfree) throw new Error("sdk_unavailable");

      const result = await cashfree.checkout({ paymentSessionId, redirectTarget: checkoutRedirectTarget() });

      if (result.error) {
        setPayError("Payment was not completed. Please try again or use UPI.");
        setPayLoading(false);
      } else if (result.paymentDetails) {
        window.location.href = `/session-booked?orderId=${orderId}&leadId=${lead.leadId}`;
        // loading stays true — navigating away
      } else {
        setPayError("Payment not completed. Tap the button to try again.");
        setPayLoading(false);
      }
    } catch (err) {
      console.error(
        "[complete-payment] embedded checkout unavailable, falling back to hosted form:",
        err instanceof Error ? err.message : String(err),
      );
      window.location.href = CONSULTATION_FORM_URL;
    }
  }, [lead, payLoading]);

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--t1)] antialiased">
      <div className="container-narrow flex min-h-screen flex-col items-center justify-center py-16 text-center">
        {status === "loading" && (
          <p className="text-[0.95rem] text-[var(--t3)]">Loading your session…</p>
        )}

        {status === "error" && (
          <div className="glass-card-sm max-w-[420px] p-8">
            <p className="text-[1.05rem] font-bold">This link isn&apos;t working right now.</p>
            <p className="mt-2 text-[0.9rem] text-[var(--t3)]">
              You can complete your booking directly instead.
            </p>
            <a href={CONSULTATION_FORM_URL} className="cta-button mt-6 inline-flex w-auto px-8">
              Continue to payment
            </a>
          </div>
        )}

        {status === "already_paid" && lead && (
          <div className="glass-card-sm max-w-[420px] p-8">
            <p className="section-label">
              {lead.name ? `${lead.name.trim().split(/\s+/)[0]}, you're already paid` : "You're already paid"}
            </p>
            <h1 className="section-title mt-2 text-[1.4rem]">
              {lead.booked ? "Your call is booked" : "Just pick your call time"}
            </h1>
            <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--t3)]">
              {lead.booked
                ? "Nothing left to do. Check your WhatsApp for the confirmation and calendar invite."
                : "We have your payment. The only step left is choosing a time that suits you."}
            </p>
            {!lead.booked && (
              <a
                href={`/session-booked?leadId=${encodeURIComponent(lead.leadId)}`}
                className="cta-button mt-6 inline-flex w-auto px-8"
              >
                Pick My Call Time
              </a>
            )}
          </div>
        )}

        {status === "not_found" && (
          <div className="glass-card-sm max-w-[420px] p-8">
            <p className="text-[1.05rem] font-bold">We couldn&apos;t find that session.</p>
            <p className="mt-2 text-[0.9rem] text-[var(--t3)]">
              Take the 60-second quiz to get your Thyroid Score and continue from there.
            </p>
            <a href="/assessment" className="cta-button mt-6 inline-flex w-auto px-8">
              Find My Thyroid Blocker
            </a>
          </div>
        )}

        {status === "ready" && lead && (
          <div className="glass-card-sm max-w-[420px] p-8">
            <p className="section-label">Welcome back{lead.name ? `, ${lead.name.trim().split(/\s+/)[0]}` : ""}</p>
            <h1 className="section-title mt-2 text-[1.4rem]">
              Complete your ₹{SESSION_PRICE} consultation booking
            </h1>
            <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--t3)]">
              You already answered the quiz — no need to do it again. Reserve your slot to lock in
              your private call.
            </p>
            <div className="cta-wrap mt-6">
              <button onClick={payNow} disabled={payLoading} className="cta-button">
                {payLoading ? "Opening secure checkout…" : `Pay ₹${SESSION_PRICE} & Book My Call`}
              </button>
            </div>
            {payError && <p className="mt-3 text-[0.85rem] text-[var(--coral)]">{payError}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
