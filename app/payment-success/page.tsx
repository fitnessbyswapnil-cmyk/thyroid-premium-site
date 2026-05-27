"use client";

import { useEffect, useRef, useState } from "react";
import { NATIVE_BOOKING_KEY } from "../book/components/BookingFlow";

type Status = "verifying" | "confirmed";

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

    function getDestUrl(): string {
      try {
        const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as { leadId?: string };
          if (stored.leadId) return `/session-booked?leadId=${stored.leadId}`;
        }
      } catch { /* non-critical */ }
      return "/session-booked";
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

    async function verifyPayment() {
      if (countdownStartedRef.current) return;

      if (!orderId) {
        // No orderId available — webhook handles backend data, just proceed
        setTimeout(startCountdown, 400);
        return;
      }

      try {
        const res = await fetch(`/api/verify-payment?orderId=${encodeURIComponent(orderId)}`);
        const data = await res.json() as { paid: boolean };

        if (data.paid) {
          startCountdown();
        } else if (verifyAttempts < 4) {
          // Retry — Cashfree may still be processing
          verifyAttempts += 1;
          setTimeout(verifyPayment, 2000);
        } else {
          // After 4 retries (~8s), proceed anyway — webhook is the reliable path
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
      if (!document.hidden) verifyPayment();
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
        {status === "verifying" ? (
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
                  // Re-read leadId at click time in case it wasn't set yet
                  try {
                    const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
                    const stored = raw ? JSON.parse(raw) as { leadId?: string } : null;
                    const dest = stored?.leadId
                      ? `/session-booked?leadId=${stored.leadId}`
                      : "/session-booked";
                    window.location.replace(dest);
                  } catch {
                    window.location.replace("/session-booked");
                  }
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
              Deep intake · Calendar booking · Zoom confirmation
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
