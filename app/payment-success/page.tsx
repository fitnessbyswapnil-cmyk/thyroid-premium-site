"use client";

import { useEffect, useRef, useState } from "react";

// Cashfree dashboard → Payment Link settings → Return URL must be:
//   https://www.swapnilumbarkarfitness.in/payment-success

const DEST = "/session-booked";
const DELAY_MS = 4000;

export default function PaymentSuccessPage() {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(Math.ceil(DELAY_MS / 1000));
  const redirectedRef = useRef(false);

  function go() {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    // replace() so the back button doesn't return here after the session-booked flow
    window.location.replace(DEST);
  }

  // entrance fade
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const start = Date.now();

    // live countdown
    const tick = setInterval(() => {
      const remaining = DELAY_MS - (Date.now() - start);
      setCountdown(Math.max(0, Math.ceil(remaining / 1000)));
    }, 250);

    // primary auto-redirect
    const timer = setTimeout(go, DELAY_MS);

    // Mobile UPI safety:
    // After a UPI payment, the UPI app sends the user back to the browser.
    // The browser restores this page from the background (document was hidden
    // while the user was inside the UPI app). visibilitychange fires immediately
    // when the tab becomes visible again — we skip the remaining countdown and
    // redirect right away so the user isn't stuck waiting.
    function onVisibilityChange() {
      if (!document.hidden) go();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    // bfcache safety: if the browser restores this page from cache on back-nav,
    // pageshow fires with persisted=true. Redirect immediately so the user can't
    // land back here after completing the booking flow.
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) go();
    }
    window.addEventListener("pageshow", onPageShow);

    return () => {
      clearInterval(tick);
      clearTimeout(timer);
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
      <div
        aria-hidden
        style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
      >
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
            Payment Successful
          </span>
        </div>

        {/* Headline */}
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

        {/* Countdown sub-text */}
        <p
          style={{
            fontSize: "0.88rem",
            color: "rgba(255,255,255,0.42)",
            lineHeight: 1.65,
            margin: "0 0 30px",
          }}
        >
          Redirecting you to your private session booking
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
              animation: `ps-bar ${DELAY_MS}ms linear forwards`,
            }}
          />
        </div>

        {/* Manual fallback CTA */}
        <button
          type="button"
          onClick={go}
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
      </div>

      <style>{`
        @keyframes ps-bar {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
      `}</style>
    </main>
  );
}
