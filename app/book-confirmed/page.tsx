"use client";

import { useEffect, useState } from "react";

const CASHFREE_URL = "https://payments.cashfree.com/forms/thyroid-session";

const STEPS = [
  {
    num: "01",
    title: "Reserve Your Session",
    body: "Complete your Rs.299 payment to confirm your private slot with Swapnil.",
    delay: "0.15s",
  },
  {
    num: "02",
    title: "WhatsApp Confirmation",
    body: "Swapnil personally sends a confirmation within 2 hours of your payment.",
    delay: "0.25s",
  },
  {
    num: "03",
    title: "Show Up Ready",
    body: "Bring your most recent thyroid report if you have one. Everything else, Swapnil handles.",
    delay: "0.35s",
  },
];

const gradientText: React.CSSProperties = {
  background: "linear-gradient(130deg, #c084fc 0%, #7c3aed 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

export default function BookConfirmedPage() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "Lead", {
        content_name: "Thyroid Strategy Session Intake",
        currency: "INR",
        value: 299,
      });
    }
    return () => clearTimeout(t);
  }, []);

  function openPayment() {
    window.open(CASHFREE_URL, "_blank", "noopener,noreferrer");
  }

  return (
    <main style={{ background: "#07060f", minHeight: "100vh", position: "relative", overflow: "hidden", color: "#fff" }}>

      {/* Background glows */}
      <div aria-hidden style={{ pointerEvents: "none", position: "fixed", inset: 0, zIndex: 0 }}>
        <div style={{
          position: "absolute",
          left: "50%",
          top: 0,
          transform: "translateX(-50%)",
          width: "min(100vw, 720px)",
          height: "600px",
          background: "radial-gradient(ellipse, rgba(124,58,237,0.13) 0%, transparent 72%)",
          filter: "blur(60px)",
        }} />
        <div style={{
          position: "absolute",
          bottom: "-80px",
          left: 0,
          width: "380px",
          height: "380px",
          background: "radial-gradient(circle, rgba(109,40,217,0.09) 0%, transparent 70%)",
          filter: "blur(90px)",
        }} />
        <div style={{
          position: "absolute",
          bottom: "-80px",
          right: 0,
          width: "380px",
          height: "380px",
          background: "radial-gradient(circle, rgba(88,28,135,0.08) 0%, transparent 70%)",
          filter: "blur(90px)",
        }} />
      </div>

      {/* Content */}
      <div style={{
        position: "relative",
        zIndex: 10,
        maxWidth: "448px",
        margin: "0 auto",
        padding: "48px 20px 64px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.55s ease, transform 0.55s ease",
      }}>

        {/* 1. CONFIRMATION HERO */}
        <div style={{ marginBottom: "40px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>

          <div style={{
            marginBottom: "20px",
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, rgba(124,58,237,0.22), rgba(109,40,217,0.12))",
            border: "1px solid rgba(124,58,237,0.38)",
            boxShadow: "0 0 28px rgba(124,58,237,0.22)",
          }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
              <path d="M5.5 13L10.5 18L20.5 8" stroke="#c084fc" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <p style={{ marginBottom: "12px", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(167,139,250,0.65)" }}>
            Intake Confirmed
          </p>

          <h1 style={{ marginBottom: "16px", fontSize: "1.9rem", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.04em", color: "#fff" }}>
            Your Private Session{" "}
            <span style={gradientText}>Is Reserved.</span>
          </h1>

          <p style={{ maxWidth: "32ch", fontSize: "0.88rem", lineHeight: 1.68, color: "rgba(255,255,255,0.5)" }}>
            Swapnil will personally review your intake before you speak.
            One final step below - it takes 30 seconds.
          </p>
        </div>

        {/* 2. WHAT HAPPENS NEXT */}
        <div style={{ marginBottom: "40px", width: "100%" }}>
          <p style={{ marginBottom: "12px", textAlign: "center", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.25)" }}>
            What happens next
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {STEPS.map((s) => (
              <div key={s.num} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
                borderRadius: "16px",
                padding: "16px",
                background: "rgba(255,255,255,0.038)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.055)",
                opacity: show ? 1 : 0,
                transform: show ? "translateY(0)" : "translateY(12px)",
                transition: "opacity 0.5s ease " + s.delay + ", transform 0.5s ease " + s.delay,
              }}>
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.68rem",
                  fontWeight: 900,
                  flexShrink: 0,
                  background: "rgba(124,58,237,0.15)",
                  border: "1px solid rgba(124,58,237,0.3)",
                  color: "#c084fc",
                }}>
                  {s.num}
                </div>
                <div>
                  <p style={{ marginBottom: "2px", fontSize: "0.85rem", fontWeight: 700, lineHeight: 1, color: "rgba(255,255,255,0.88)" }}>
                    {s.title}
                  </p>
                  <p style={{ fontSize: "0.76rem", lineHeight: 1.55, color: "rgba(255,255,255,0.42)" }}>
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. PAYMENT CTA */}
        <div style={{
          marginBottom: "32px",
          width: "100%",
          borderRadius: "24px",
          padding: "20px",
          background: "linear-gradient(145deg, rgba(124,58,237,0.14), rgba(109,40,217,0.07))",
          border: "1px solid rgba(124,58,237,0.28)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.09)",
        }}>

          {/* Scarcity */}
          <div style={{ marginBottom: "16px", display: "flex", justifyContent: "center" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              borderRadius: "999px",
              padding: "6px 12px",
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#c084fc", boxShadow: "0 0 6px #c084fc", display: "inline-block" }} />
              <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#c084fc" }}>
                Only 3 Sessions Remaining This Week
              </span>
            </div>
          </div>

          {/* Value row */}
          <div style={{
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: "12px",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
                Private Thyroid Strategy Session
              </p>
              <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.38)" }}>
                60 min · 1-on-1 · With Swapnil
              </p>
            </div>
            <p style={{ fontSize: "1.15rem", fontWeight: 900, ...gradientText }}>
              Rs.299
            </p>
          </div>

          {/* CTA Button — using button + onClick to avoid <a> parser issues */}
          <button
            onClick={openPayment}
            style={{
              marginBottom: "12px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "16px",
              padding: "16px",
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              boxShadow: "0 0 0 1px rgba(124,58,237,0.5), 0 8px 32px rgba(124,58,237,0.35)",
              border: "none",
              cursor: "pointer",
              color: "#fff",
            }}
          >
            <span style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1 }}>
              Reserve My Session - Rs.299
            </span>
            <span style={{ marginTop: "4px", fontSize: "0.72rem", fontWeight: 500, color: "rgba(255,255,255,0.65)" }}>
              Private · 60 min · Written plan included
            </span>
          </button>

          <p style={{ textAlign: "center", fontSize: "0.68rem", fontWeight: 500, lineHeight: 1.5, color: "rgba(255,255,255,0.38)" }}>
            Full refund if you do not leave with complete clarity
          </p>
        </div>

        {/* 4. TESTIMONIAL */}
        <div style={{
          marginBottom: "32px",
          width: "100%",
          borderRadius: "16px",
          padding: "16px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <p style={{ marginBottom: "12px", fontSize: "0.82rem", fontWeight: 600, fontStyle: "italic", lineHeight: 1.6, color: "rgba(255,255,255,0.72)" }}>
            &ldquo;He spent the full hour on my actual reports - my TSH
            history, my food, my sleep. I left with three specific things
            to try that evening. That alone was worth Rs.299.&rdquo;
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 700,
              flexShrink: 0,
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff",
            }}>
              K
            </div>
            <div>
              <p style={{ fontSize: "0.76rem", fontWeight: 600, lineHeight: 1, color: "rgba(255,255,255,0.75)" }}>Kavitha N.</p>
              <p style={{ marginTop: "2px", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}>Hypothyroid · Hyderabad</p>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <span style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "rgba(167,139,250,0.6)" }}>&#9733;&#9733;&#9733;&#9733;&#9733;</span>
            </div>
          </div>
        </div>

        {/* 5. TRUST ROW */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "16px 16px" }}>
          {["Private and confidential", "200+ women helped", "ACE and INFS certified"].map((t) => (
            <p key={t} style={{ fontSize: "0.62rem", fontWeight: 500, color: "rgba(255,255,255,0.22)", textAlign: "center" }}>
              {t}
            </p>
          ))}
        </div>

      </div>
    </main>
  );
}