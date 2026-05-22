"use client";

import { useEffect, useState } from "react";

const CALENDLY_URL = "https://calendly.com/fitnessbyswapnil/60min";

export default function SessionBooked() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setTimeout(() => setShow(true), 80);

    // Fire Meta Pixel Purchase event
    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "Purchase", {
        value: 299,
        currency: "INR",
        content_name: "Thyroid Strategy Session",
      });
    }

    // Load Calendly widget script
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  return (
    <main style={{
      background: "#07060f",
      minHeight: "100vh",
      color: "#fff",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>

      {/* Background glow */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
      }}>
        <div style={{
          position: "absolute", left: "50%", top: 0,
          transform: "translateX(-50%)",
          width: "600px", height: "400px",
          background: "radial-gradient(ellipse, rgba(34,197,94,0.08) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
      </div>

      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: "560px", margin: "0 auto",
        padding: "48px 20px 80px",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>

        {/* Payment confirmed badge */}
        <div style={{
          marginBottom: "32px", textAlign: "center",
        }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: "rgba(34,197,94,0.12)",
            border: "1.5px solid rgba(34,197,94,0.4)",
            display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24"
              fill="none" aria-hidden>
              <path d="M5 13L9 17L19 7"
                stroke="rgba(34,197,94,0.85)"
                strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round"/>
            </svg>
          </div>

          <div style={{
            display: "inline-block",
            padding: "4px 14px",
            borderRadius: "999px",
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.25)",
            marginBottom: "12px",
          }}>
            <span style={{
              fontSize: "0.62rem", fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "rgba(134,239,172,0.85)",
            }}>
              Payment Confirmed
            </span>
          </div>

          <h1 style={{
            fontSize: "clamp(1.5rem, 4vw, 1.8rem)",
            fontWeight: 900, lineHeight: 1.15,
            letterSpacing: "-0.03em",
            marginBottom: "12px",
          }}>
            One Step Left.{" "}
            <span style={{
              background: "linear-gradient(130deg, #c084fc, #7c3aed)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Choose Your Session Time.
            </span>
          </h1>

          <p style={{
            fontSize: "0.88rem", lineHeight: 1.65,
            color: "rgba(255,255,255,0.5)",
            maxWidth: "34ch", margin: "0 auto",
          }}>
            Swapnil will review your intake personally
            before you speak. Pick any available time below.
          </p>
        </div>

        {/* Calendly inline embed */}
        <div style={{
          borderRadius: "20px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          marginBottom: "24px",
          minHeight: "630px",
        }}>
          <div
            className="calendly-inline-widget"
            data-url={CALENDLY_URL + "?hide_gdpr_banner=1&background_color=07060f&text_color=ffffff&primary_color=7c3aed"}
            style={{ minWidth: "100%", height: "630px" }}
          />
        </div>

        {/* WhatsApp reassurance */}
        <div style={{
          textAlign: "center",
          padding: "14px",
          borderRadius: "12px",
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <p style={{
            margin: 0, fontSize: "0.75rem",
            color: "rgba(255,255,255,0.4)",
            lineHeight: 1.6,
          }}>
            You will receive a WhatsApp confirmation
            with your Zoom link after booking.
            Full refund if you don't leave with clarity.
          </p>
        </div>

      </div>
    </main>
  );
}