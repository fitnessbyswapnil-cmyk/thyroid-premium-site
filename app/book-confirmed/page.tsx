"use client";

import { useEffect, useRef, useState } from "react";
import { persistUserIdentity } from "../components/tracking/UserIdentityTracker";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CASHFREE_URL = "https://payments.cashfree.com/forms?code=thyroid-session";
const REDIRECT_DELAY_MS = 2000;

// ── IDENTITY RESOLUTION ───────────────────────────────────────────────────────
// Priority chain:
//   1. URL query params (Tally redirect, or Make.com-appended fields)
//   2. Existing localStorage (persisted earlier in the funnel)
//   3. Future: token-based server lookup → /api/identity?token=<token>
//      When Make.com passes a signed token, add a fetch here before persistUserIdentity().
function extractParamsIdentity(): {
  email?: string;
  phone?: string;
  first_name?: string;
} {
  const p = new URLSearchParams(window.location.search);
  const identity: { email?: string; phone?: string; first_name?: string } = {};
  const email = p.get("email") || p.get("e") || "";
  const phone = p.get("phone") || p.get("mobile") || p.get("ph") || "";
  const first_name =
    p.get("first_name") || p.get("name") || p.get("fname") || "";
  if (email) identity.email = email;
  if (phone) identity.phone = phone;
  if (first_name) identity.first_name = first_name;
  return identity;
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function BookConfirmedPage() {
  const [countdown, setCountdown] = useState(
    Math.ceil(REDIRECT_DELAY_MS / 1000)
  );
  // Prevents double-redirect in React 18 StrictMode and across effect re-runs
  const redirected = useRef(false);

  useEffect(() => {
    // 1. Capture identity from URL params (may be empty — that's fine)
    const paramsIdentity = extractParamsIdentity();

    // 2. Persist: merges with any existing stored identity, sets window.user_identity,
    //    and pushes meta_userdata_ready to dataLayer — all handled by persistUserIdentity
    persistUserIdentity(paramsIdentity);

    // 3. Countdown display (Date.now()-based to stay accurate across tab sleep)
    const startTime = Date.now();
    const tick = setInterval(() => {
      const remaining = REDIRECT_DELAY_MS - (Date.now() - startTime);
      setCountdown(Math.max(0, Math.ceil(remaining / 1000)));
    }, 250);

    // 4. Auto-redirect
    const timer = setTimeout(() => {
      if (redirected.current) return;
      redirected.current = true;
      window.location.href = CASHFREE_URL;
    }, REDIRECT_DELAY_MS);

    return () => {
      clearInterval(tick);
      clearTimeout(timer);
    };
  }, []);

  return (
    <main
      style={{
        background: "#07060f",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translateX(-50%)",
            width: "min(100vw, 600px)",
            height: "500px",
            background:
              "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)",
            filter: "blur(80px)",
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
          maxWidth: "380px",
          width: "100%",
        }}
      >
        {/* Animated spinner */}
        <div
          style={{
            marginBottom: "28px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              border: "2.5px solid rgba(124,58,237,0.15)",
              borderTopColor: "#7c3aed",
              animation: "bc-spin 0.85s linear infinite",
            }}
          />
        </div>

        {/* Lock icon */}
        <div
          style={{
            marginBottom: "18px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "rgba(124,58,237,0.1)",
              border: "1px solid rgba(124,58,237,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              aria-hidden
            >
              <rect
                x="3"
                y="8"
                width="12"
                height="9"
                rx="2"
                stroke="rgba(167,139,250,0.75)"
                strokeWidth="1.4"
              />
              <path
                d="M6 8V5.5a3 3 0 016 0V8"
                stroke="rgba(167,139,250,0.75)"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: "1.08rem",
            fontWeight: 700,
            color: "rgba(255,255,255,0.9)",
            margin: "0 0 10px",
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
          }}
        >
          Redirecting to secure payment…
        </h1>

        {/* Subtext with live countdown */}
        <p
          style={{
            fontSize: "0.78rem",
            color: "rgba(255,255,255,0.3)",
            margin: "0 0 28px",
            lineHeight: 1.6,
          }}
        >
          Taking you to the payment page in {countdown}s.
          <br />
          Rs.299 · Private Thyroid Strategy Session
        </p>

        {/* Progress bar */}
        <div
          style={{
            height: "3px",
            borderRadius: "2px",
            background: "rgba(255,255,255,0.07)",
            marginBottom: "24px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "100%",
              background: "linear-gradient(90deg, #7c3aed, #c084fc)",
              borderRadius: "2px",
              transformOrigin: "left",
              animation: `bc-progress ${REDIRECT_DELAY_MS}ms linear forwards`,
            }}
          />
        </div>

        {/* Manual fallback */}
        <a
          href={CASHFREE_URL}
          style={{
            fontSize: "0.72rem",
            color: "rgba(167,139,250,0.5)",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          Click here if not redirected automatically
        </a>
      </div>

      <style>{`
        @keyframes bc-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes bc-progress {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
      `}</style>
    </main>
  );
}
