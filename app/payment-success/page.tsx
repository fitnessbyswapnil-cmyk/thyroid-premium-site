"use client";

import { useEffect, useRef, useState } from "react";
import { NATIVE_BOOKING_KEY } from "../book/components/BookingFlow";

type Status = "verifying" | "confirmed" | "notpaid";

const COUNTDOWN_S = 3;

export default function PaymentSuccessPage() {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<Status>("verifying");
  const [countdown, setCountdown] = useState(COUNTDOWN_S);
  const redirectedRef = useRef(false);
  const countdownStartedRef = useRef(false);

  // entrance fade — separate effect so it's not tangled with redirect logic
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // ── Helpers ───────────────────────────────────────────────────────────────

    // Carries BOTH leadId and order_id through to /session-booked. The order_id
    // is what lets that page fire the Meta Purchase (event_id Purchase_<orderId>,
    // deduped with the Cashfree webhook) — drop it and the sale never reaches
    // Meta, so ad optimisation goes blind.
    function getDestUrl(): string {
      const params = new URLSearchParams();
      const p = new URLSearchParams(window.location.search);

      try {
        const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as { leadId?: string };
          if (stored.leadId) params.set("leadId", stored.leadId);
        }
      } catch { /* non-critical */ }
      // Cashfree's return_url carries leadId too — fallback when storage is
      // empty (in-app browsers can drop it across the redirect round trip).
      if (!params.get("leadId") && p.get("leadId")) params.set("leadId", p.get("leadId")!);

      const oid = p.get("order_id") || p.get("orderId") || p.get("payment_ref") || "";
      if (oid) params.set("order_id", oid);

      const qs = params.toString();
      return qs ? `/session-booked?${qs}` : "/session-booked";
    }

    function go() {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      window.location.replace(getDestUrl());
    }

    function startCountdown() {
      if (countdownStartedRef.current) return;
      countdownStartedRef.current = true;
      setStatus("confirmed");
      let c = COUNTDOWN_S;
      setCountdown(c);
      const tick = setInterval(() => {
        c -= 1;
        setCountdown(c);
        if (c <= 0) {
          clearInterval(tick);
          go();
        }
      }, 1000);
    }

    // ── Payment verification ──────────────────────────────────────────────────

    // Cashfree payment links don't include order_id in return URL by default.
    // The param will be present once the Cashfree dashboard return URL is
    // configured as: /payment-success?order_id={order_id}
    const p = new URLSearchParams(window.location.search);
    const orderId = p.get("order_id") || p.get("payment_ref") || "";

    let verifyAttempts = 0;

    // Cashfree order statuses that mean "checkout ended without payment".
    // ACTIVE = order still open (she cancelled / abandoned the hosted page).
    // Mobile checkout full-page-redirects to Cashfree ("_self" for UPI app
    // intent), and Cashfree sends cancels to this same return_url — so an
    // unpaid terminal status must NOT fall through to the booking page.
    const UNPAID_FINAL = ["ACTIVE", "EXPIRED", "TERMINATED", "TERMINATION_REQUESTED"];

    async function verifyPayment() {
      if (countdownStartedRef.current) return;

      if (!orderId) {
        // No orderId available — webhook handles backend data, just proceed
        setTimeout(startCountdown, 400);
        return;
      }

      try {
        const res = await fetch(`/api/verify-payment?orderId=${encodeURIComponent(orderId)}`);
        const data = await res.json() as { paid: boolean; status?: string };

        if (data.paid) {
          startCountdown();
        } else if (verifyAttempts < 4) {
          // Retry — Cashfree may still be processing
          verifyAttempts += 1;
          setTimeout(verifyPayment, 2000);
        } else if (data.status && UNPAID_FINAL.includes(data.status)) {
          // Cashfree affirmatively says no payment — offer a retry, don't
          // fake a confirmation. (A slow UPI that settles later is still
          // safe: the webhook WhatsApps her the booking link.)
          setStatus("notpaid");
        } else {
          // Status unknown (API hiccup) — proceed, webhook is the reliable path
          startCountdown();
        }
      } catch {
        // Network error — proceed, don't leave the user stuck
        startCountdown();
      }
    }

    verifyPayment();

    // Mobile UPI safety: user returns from UPI app via visibilitychange
    function onVisibilityChange() {
      if (!document.hidden) {
        verifyAttempts = 0; // fresh round — payment may have settled meanwhile
        verifyPayment();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    // bfcache safety: prevent back-button return to this page after booking
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) go();
    }
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      style={{
        background: "#07060f",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glows */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translateX(-50%)",
            width: "min(100vw, 600px)",
            height: "500px",
            background: "radial-gradient(ellipse, rgba(34,197,94,0.10) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "45%",
            transform: "translateX(-50%)",
            width: "min(100vw, 400px)",
            height: "300px",
            background: "radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          textAlign: "center",
          padding: "40px 24px",
          maxWidth: "400px",
          width: "100%",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(18px)",
          transition: "opacity 0.55s ease, transform 0.55s ease",
        }}
      >
        {status === "notpaid" ? (
          <>
            {/* Amber alert circle */}
            <div style={{ marginBottom: "24px", display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: "rgba(245,158,11,0.10)",
                  border: "1px solid rgba(245,158,11,0.28)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.6rem",
                }}
              >
                ⚠️
              </div>
            </div>

            <h1
              style={{
                fontSize: "clamp(1.35rem, 4vw, 1.55rem)",
                fontWeight: 900,
                lineHeight: 1.15,
                letterSpacing: "-0.035em",
                color: "rgba(255,255,255,0.95)",
                margin: "0 0 12px",
              }}
            >
              Payment not completed.
            </h1>

            <p
              style={{
                fontSize: "0.88rem",
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.65,
                margin: "0 0 26px",
              }}
            >
              Your consultation spot is still reserved for a few more minutes.
              Tap below to try again with GPay, PhonePe, Paytm or card.
            </p>

            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) window.history.back();
                else window.location.href = "/assessment";
              }}
              style={{
                width: "100%",
                padding: "18px 20px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                border: "none",
                color: "#fff",
                fontSize: "1.02rem",
                fontWeight: 800,
                letterSpacing: "-0.015em",
                cursor: "pointer",
                boxShadow: "0 8px 32px rgba(124,58,237,0.38)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              Try Payment Again →
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "14px 20px",
                borderRadius: "16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.75)",
                fontSize: "0.88rem",
                fontWeight: 700,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              I already paid — check again
            </button>

            <p
              style={{
                marginTop: "14px",
                fontSize: "0.66rem",
                color: "rgba(255,255,255,0.20)",
                lineHeight: 1.5,
              }}
            >
              If money left your account, don&apos;t worry — your booking link
              arrives on WhatsApp automatically once the payment settles.
            </p>
          </>
        ) : status === "verifying" ? (
          <>
            {/* Spinner */}
            <div style={{ marginBottom: "24px", display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.08)",
                  borderTopColor: "rgba(134,239,172,0.7)",
                  animation: "ps-spin 0.9s linear infinite",
                }}
              />
            </div>
            <p
              style={{
                fontSize: "0.95rem",
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Confirming your payment…
            </p>
          </>
        ) : (
          <>
            {/* Checkmark circle */}
            <div style={{ marginBottom: "24px", display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.28)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 40px rgba(34,197,94,0.15)",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
                  <path
                    d="M5 14l6.5 6.5L23 7"
                    stroke="rgba(134,239,172,0.92)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Status badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                borderRadius: "999px",
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.22)",
                padding: "5px 14px",
                marginBottom: "22px",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "rgba(134,239,172,0.9)",
                  boxShadow: "0 0 8px rgba(52,211,153,0.8)",
                }}
              />
              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.18em",
                  color: "rgba(134,239,172,0.85)",
                }}
              >
                Payment Confirmed
              </span>
            </div>

            <h1
              style={{
                fontSize: "clamp(1.4rem, 4vw, 1.65rem)",
                fontWeight: 900,
                lineHeight: 1.15,
                letterSpacing: "-0.035em",
                color: "rgba(255,255,255,0.95)",
                margin: "0 0 12px",
              }}
            >
              Your slot is secured.
            </h1>

            <p
              style={{
                fontSize: "0.88rem",
                color: "rgba(255,255,255,0.42)",
                lineHeight: 1.65,
                margin: "0 0 30px",
              }}
            >
              Continuing to your private session booking
              {countdown > 0 ? ` in ${countdown}s…` : "…"}
            </p>

            {/* Progress bar */}
            <div
              style={{
                height: "3px",
                borderRadius: "2px",
                background: "rgba(255,255,255,0.06)",
                marginBottom: "28px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: "100%",
                  background: "linear-gradient(90deg, #22c55e, #4ade80)",
                  borderRadius: "2px",
                  transformOrigin: "left",
                  animation: `ps-bar ${COUNTDOWN_S * 1000}ms linear forwards`,
                }}
              />
            </div>

            {/* Manual fallback CTA */}
            <button
              type="button"
              onClick={() => {
                if (!redirectedRef.current) {
                  redirectedRef.current = true;
                  // Same leadId + order_id resolution as the automatic redirect,
                  // re-read at click time in case storage populated late.
                  const params = new URLSearchParams();
                  const sp = new URLSearchParams(window.location.search);
                  try {
                    const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
                    const stored = raw ? JSON.parse(raw) as { leadId?: string } : null;
                    if (stored?.leadId) params.set("leadId", stored.leadId);
                  } catch { /* non-critical */ }
                  if (!params.get("leadId") && sp.get("leadId")) params.set("leadId", sp.get("leadId")!);
                  const oid = sp.get("order_id") || sp.get("orderId") || sp.get("payment_ref") || "";
                  if (oid) params.set("order_id", oid);
                  const qs = params.toString();
                  window.location.replace(qs ? `/session-booked?${qs}` : "/session-booked");
                }
              }}
              style={{
                width: "100%",
                padding: "18px 20px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                border: "none",
                color: "#fff",
                fontSize: "1.02rem",
                fontWeight: 800,
                letterSpacing: "-0.015em",
                cursor: "pointer",
                boxShadow: "0 8px 32px rgba(124,58,237,0.38)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              Continue To Session Booking →
            </button>

            <p
              style={{
                marginTop: "14px",
                fontSize: "0.66rem",
                color: "rgba(255,255,255,0.20)",
                lineHeight: 1.5,
              }}
            >
              Deep intake · Calendar booking · Google Meet confirmation
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes ps-bar {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes ps-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
