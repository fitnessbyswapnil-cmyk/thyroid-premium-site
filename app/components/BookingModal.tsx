"use client";

/**
 * BookingModal — the new destination for EVERY site-wide CTA (owner
 * instruction: "everything should be embedded on my landing page domain
 * only"). Replaces the direct redirect to the Cashfree-hosted form, whose
 * post-payment redirect depends entirely on a Cashfree dashboard setting
 * that has repeatedly failed to fire.
 *
 * Flow: name + WhatsApp (2 fields, minimal friction) → lead written to
 * Sheets immediately (so she's captured even if she abandons at payment,
 * same principle as BookingFlow.tsx) → Cashfree JS SDK opens as an in-page
 * modal on TOP of this modal → success → /session-booked (embedded Cal.com).
 * The redirect after payment is triggered by OUR code, not a Cashfree
 * setting, so it can't silently fail to fire again.
 *
 * Same pattern as app/book/components/BookingFlow.tsx and the quiz's
 * payNow() — kept as its own contained component rather than refactoring
 * either of those proven, already-tested flows.
 */

import { useCallback, useState } from "react";
import { pushDL, trackLead, trackInitiateCheckout } from "@/app/lib/analytics";
import { persistUserIdentity } from "@/app/components/tracking/UserIdentityTracker";
import { getUtmParams, getFbclid, getVisitorId, getFbc, getFbp } from "@/lib/tracking";
import { NATIVE_BOOKING_KEY } from "@/app/book/components/BookingFlow";
import { SESSION_PRICE } from "@/app/lib/pricing";
import { CONSULTATION_FORM_URL } from "@/app/context/ScarcityProvider";

const PURPLE = "#a855f7";
const CARD = "#17181c";
const GRID = "#26242c";
const INK1 = "#f4f2f7";
const INK2 = "#b9b3c4";
const MUTED = "#8a8494";

function readAttribution() {
  if (typeof window === "undefined") return {};
  const utms = getUtmParams();
  const fbclid = getFbclid();
  const visitor_id = getVisitorId();
  return { ...utms, ...(fbclid && { fbclid }), ...(visitor_id && { visitor_id }) };
}

export default function BookingModal({
  open,
  onClose,
  location,
}: {
  open: boolean;
  onClose: () => void;
  location: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errs, setErrs] = useState<{ name?: boolean; phone?: boolean }>({});

  const submit = useCallback(async () => {
    const trimmedName = name.trim();
    const phoneDigits = phone.replace(/\D/g, "").slice(-10);
    const nextErrs = { name: trimmedName.length < 2, phone: phoneDigits.length !== 10 };
    setErrs(nextErrs);
    if (nextErrs.name || nextErrs.phone) return;

    setLoading(true);
    setError("");

    const leadId = `cta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const firstName = trimmedName.split(" ")[0];
    const lastName = trimmedName.split(" ").slice(1).join(" ");
    const attribution = readAttribution();

    persistUserIdentity({
      first_name: firstName,
      ...(lastName && { last_name: lastName }),
      phone: phoneDigits,
    });

    const leadEventId = trackLead({
      first_name: firstName,
      ...(lastName && { last_name: lastName }),
      phone: phoneDigits,
    });
    pushDL({ event: "cta_modal_submitted", location });

    // Server-side CAPI Lead — mirrors BookingFlow.handleQualificationComplete
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
          phone: phoneDigits,
          ...(attribution.visitor_id && { external_id: attribution.visitor_id }),
        },
      }),
    }).catch(() => {});

    // Write the lead row immediately — captured even if she abandons at payment.
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        step1: { name: trimmedName, phone: phoneDigits },
        attribution,
      }),
    }).catch(() => {});

    try {
      localStorage.setItem(
        NATIVE_BOOKING_KEY,
        JSON.stringify({
          step1: { name: trimmedName, phone: phoneDigits, email: "" },
          startedAt: new Date().toISOString(),
          leadId,
          attribution,
        }),
      );
    } catch { /* non-critical */ }

    trackInitiateCheckout();
    pushDL({ event: "cta_payment_initiated", location });

    try {
      const orderRes = await fetch("/api/create-cashfree-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          customerPhone: phoneDigits,
          customerName: trimmedName,
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
        const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        localStorage.setItem(NATIVE_BOOKING_KEY, JSON.stringify({ ...obj, orderId, amount }));
      } catch { /* non-critical */ }

      const { load } = await import("@cashfreepayments/cashfree-js");
      const cashfree = await load({
        mode: process.env.NODE_ENV === "production" ? "production" : "sandbox",
      });
      if (!cashfree) throw new Error("sdk_unavailable");

      const result = await cashfree.checkout({ paymentSessionId, redirectTarget: "_modal" });

      if (result.error) {
        setError("Payment was not completed. Please try again or use UPI.");
        setLoading(false);
      } else if (result.paymentDetails) {
        window.location.href = `/session-booked?orderId=${orderId}&leadId=${leadId}`;
        // loading stays true — page is navigating away
      } else {
        setError("Payment not completed. Tap the button to try again.");
        setLoading(false);
      }
    } catch (err) {
      // Pay button must never dead-end — hosted form is the fallback.
      console.error("[BookingModal] embedded checkout unavailable, falling back to hosted form:", err instanceof Error ? err.message : String(err));
      window.location.href = CONSULTATION_FORM_URL;
    }
  }, [name, phone, location]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(5,4,6,0.72)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: CARD,
          borderTop: `1px solid ${GRID}`,
          borderLeft: `1px solid ${GRID}`,
          borderRight: `1px solid ${GRID}`,
          borderRadius: "20px 20px 0 0",
          padding: "22px 20px calc(22px + env(safe-area-inset-bottom))",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
          animation: "bm-rise 280ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <style>{`@keyframes bm-rise { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } } @media (min-width: 640px) { [role="dialog"] { align-items: center !important; } }`}</style>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ height: 4, width: 36, borderRadius: 999, background: GRID, margin: "0 auto 14px" }} />
        </div>

        <p
          id="booking-modal-title"
          style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 20, fontWeight: 700, color: INK1, marginBottom: 4, textAlign: "center" }}
        >
          Book Your Thyroid Consultation
        </p>
        <p style={{ fontSize: 13, color: MUTED, textAlign: "center", marginBottom: 20 }}>
          ₹{SESSION_PRICE} · 60-min private 1-on-1 · Fully adjusted against your plan
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              background: "#0f1012",
              border: `1px solid ${errs.name ? "#f87171" : GRID}`,
              color: INK1,
              fontSize: 15,
              outline: "none",
            }}
          />
          <input
            type="tel"
            inputMode="numeric"
            placeholder="WhatsApp number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              background: "#0f1012",
              border: `1px solid ${errs.phone ? "#f87171" : GRID}`,
              color: INK1,
              fontSize: 15,
              outline: "none",
            }}
          />
          {(errs.name || errs.phone) && (
            <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>
              Enter your name and a valid 10-digit WhatsApp number.
            </p>
          )}
          {error && <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "16px 0",
              borderRadius: 14,
              background: `linear-gradient(180deg, #b673fa 0%, ${PURPLE} 40%, #8b2fe0 100%)`,
              border: "none",
              color: "#fff",
              fontSize: 15,
              fontWeight: 800,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.75 : 1,
              boxShadow: "0 14px 36px -8px rgba(168,85,247,0.45)",
            }}
          >
            {loading ? "Opening secure checkout…" : `Pay ₹${SESSION_PRICE} & Book My Call`}
          </button>

          <p style={{ fontSize: 11, color: MUTED, textAlign: "center", margin: "2px 0 0" }}>
            UPI, cards, net banking — secure checkout opens right here.
          </p>

          {!loading && (
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "none", color: MUTED, fontSize: 12, marginTop: 6, cursor: "pointer", textDecoration: "underline" }}
            >
              Not now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
