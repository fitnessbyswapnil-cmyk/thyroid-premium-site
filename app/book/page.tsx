"use client";

import { useEffect, useState, useRef } from "react";

const CASHFREE_URL = "https://payments.cashfree.com/forms/thyroid-session";

const TESTIMONIALS = [
  {
    name: "Kavitha N.",
    city: "Hyderabad",
    condition: "Hypothyroid",
    review: "He spent the full hour on my actual reports - my TSH history, my food, my sleep. I left with three specific things to try that evening. That alone was worth Rs.299.",
    initial: "K",
  },
  {
    name: "Priya R.",
    city: "Mumbai",
    condition: "Hypothyroid",
    review: "I had been to 4 doctors in 3 years. Not one explained why I could not lose weight despite medication. In 60 minutes I finally understood what was actually happening in my body.",
    initial: "P",
  },
  {
    name: "Divya M.",
    city: "Bengaluru",
    condition: "Hashimoto's",
    review: "I cried during the call because someone finally understood why nothing was working. This was the first time in years I felt truly heard about my health.",
    initial: "D",
  },
  {
    name: "Ananya S.",
    city: "Pune",
    condition: "Hypothyroid",
    review: "I was skeptical about paying Rs.299 to someone I found on Instagram. But the detail Swapnil went into about my specific case was unlike anything I experienced with any doctor.",
    initial: "A",
  },
  {
    name: "Rekha T.",
    city: "Chennai",
    condition: "Hypothyroid and PCOS",
    review: "My TSH was always in the normal range according to doctors. Swapnil showed me why that range might not be right for me personally. It changed everything.",
    initial: "R",
  },
  {
    name: "Surekha M.",
    city: "Nashik",
    condition: "Hypothyroid",
    review: "I had been bloated for 3 years. Every doctor said it was IBS. After this session I understood it was directly linked to my thyroid medication timing. Simple fix, massive relief.",
    initial: "S",
  },
  {
    name: "Meera K.",
    city: "Delhi",
    condition: "Hashimoto's",
    review: "The fact that he had already reviewed my intake form before the call made me feel like a priority patient. He knew my case before I even started talking.",
    initial: "M",
  },
  {
    name: "Pooja L.",
    city: "Ahmedabad",
    condition: "Hypothyroid",
    review: "I was eating 1200 calories and still gaining weight. Swapnil explained exactly why cutting calories was actually slowing my thyroid further. My whole perspective shifted.",
    initial: "P",
  },
  {
    name: "Nisha B.",
    city: "Kolkata",
    condition: "Hypothyroid and Fatigue",
    review: "The fatigue was the worst part. I thought it was laziness. After this session I understood it was my T3 conversion. We built a plan around fixing that first and the energy came back.",
    initial: "N",
  },
  {
    name: "Smita J.",
    city: "Jaipur",
    condition: "Hypothyroid",
    review: "Every coach before gave me the same generic diet advice. Swapnil adapted everything to my thyroid condition, my food preferences, and my daily routine.",
    initial: "S",
  },
  {
    name: "Heenal R.",
    city: "Bengaluru",
    condition: "Hypothyroid",
    review: "TSH dropped from 6.2 to 2.9 in 8 weeks. I had been managing this condition for 4 years with no real improvement. I wish I had found this program earlier.",
    initial: "H",
  },
  {
    name: "Fathima P.",
    city: "Kochi",
    condition: "Hypothyroid",
    review: "For the first time in years I feel confident in my body. My waist is 2 inches smaller and the constant bloating is gone. The session was where everything started changing.",
    initial: "F",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Secure Your Private Slot",
    body: "Complete the refundable Rs.299 booking fee to lock your consultation priority with Swapnil.",
    delay: "0.15s",
  },
  {
    num: "02",
    title: "WhatsApp Confirmation",
    body: "You will receive a personal confirmation message from Swapnil directly after payment.",
    delay: "0.25s",
  },
  {
    num: "03",
    title: "Show Up Ready",
    body: "Bring your latest thyroid reports if available. Everything else will be guided personally.",
    delay: "0.35s",
  },
];

const gText: React.CSSProperties = {
  background: "linear-gradient(130deg, #c084fc 0%, #7c3aed 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  display: "inline",
};

export default function BookConfirmedPage() {
  const [show, setShow] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setActiveIdx((prev) => (prev + 1) % TESTIMONIALS.length);
        setFading(false);
      }, 500);
    }, 16000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function openPayment() {
    window.open(CASHFREE_URL, "_blank", "noopener,noreferrer");
  }

  const active = TESTIMONIALS[activeIdx];

  return (
    <main style={{
      background: "#07060f",
      minHeight: "100vh",
      position: "relative",
      overflow: "hidden",
      color: "#fff",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      {/* Glows */}
      <div aria-hidden style={{ pointerEvents: "none", position: "fixed", inset: 0, zIndex: 0 }}>
        <div style={{
          position: "absolute", left: "50%", top: 0,
          transform: "translateX(-50%)",
          width: "min(100vw, 700px)", height: "580px",
          background: "radial-gradient(ellipse, rgba(124,58,237,0.13) 0%, transparent 70%)",
          filter: "blur(70px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-60px", left: 0,
          width: "340px", height: "340px",
          background: "radial-gradient(circle, rgba(109,40,217,0.09) 0%, transparent 70%)",
          filter: "blur(90px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-60px", right: 0,
          width: "340px", height: "340px",
          background: "radial-gradient(circle, rgba(88,28,135,0.08) 0%, transparent 70%)",
          filter: "blur(90px)",
        }} />
      </div>

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: "448px", margin: "0 auto",
        padding: "48px 20px 72px",
        display: "flex", flexDirection: "column", alignItems: "center",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}>

        {/* 1. HERO */}
        <div style={{ marginBottom: "40px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>

          {/* Approved pill */}
          <div style={{
            marginBottom: "20px",
            display: "inline-flex", alignItems: "center", gap: "8px",
            borderRadius: "999px", padding: "7px 16px",
            background: "rgba(124,58,237,0.11)",
            border: "1px solid rgba(124,58,237,0.28)",
            boxShadow: "0 0 18px rgba(124,58,237,0.1)",
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
              <path d="M2 6.5L5 9.5L11 3.5" stroke="#c084fc" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: "0.63rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "#c084fc" }}>
              Application Approved
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ marginBottom: "20px", fontSize: "clamp(1.72rem, 5vw, 2.05rem)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.04em", color: "#fff" }}>
            Your Intake Has{" "}
            <span style={gText}>Been Approved.</span>
          </h1>

          {/* Status box — the psychological fix */}
          <div style={{
            width: "100%", padding: "18px 20px",
            borderRadius: "16px", textAlign: "left",
            background: "rgba(255,255,255,0.038)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <p style={{ fontSize: "0.86rem", lineHeight: 1.7, color: "rgba(255,255,255,0.7)", marginBottom: "12px" }}>
              Swapnil will personally review your thyroid case before the session.
            </p>
            <div style={{
              padding: "11px 14px", borderRadius: "10px", marginBottom: "12px",
              background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(124,58,237,0.24)",
            }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,0.92)", margin: 0 }}>
                Your consultation slot is not locked yet.
              </p>
            </div>
            <p style={{ fontSize: "0.83rem", lineHeight: 1.65, color: "rgba(255,255,255,0.5)", margin: 0 }}>
              Complete the Rs.299 booking fee below to secure your priority session.
            </p>
          </div>
        </div>

        {/* 2. STEPS */}
        <div style={{ marginBottom: "36px", width: "100%" }}>
          <p style={{ marginBottom: "12px", textAlign: "center", fontSize: "0.59rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)" }}>
            What happens next
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {STEPS.map((s) => (
              <div key={s.num} style={{
                display: "flex", alignItems: "flex-start", gap: "14px",
                borderRadius: "16px", padding: "15px",
                background: "rgba(255,255,255,0.033)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                opacity: show ? 1 : 0,
                transform: show ? "translateY(0)" : "translateY(10px)",
                transition: "opacity 0.5s ease " + s.delay + ", transform 0.5s ease " + s.delay,
              }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "10px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.66rem", fontWeight: 900, flexShrink: 0,
                  background: "rgba(124,58,237,0.13)",
                  border: "1px solid rgba(124,58,237,0.26)",
                  color: "#c084fc",
                }}>
                  {s.num}
                </div>
                <div>
                  <p style={{ marginBottom: "3px", fontSize: "0.85rem", fontWeight: 700, lineHeight: 1, color: "rgba(255,255,255,0.9)" }}>
                    {s.title}
                  </p>
                  <p style={{ fontSize: "0.75rem", lineHeight: 1.55, color: "rgba(255,255,255,0.4)" }}>
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. PAYMENT CTA */}
        <div style={{
          marginBottom: "32px", width: "100%",
          borderRadius: "24px", padding: "22px",
          background: "linear-gradient(150deg, rgba(124,58,237,0.12), rgba(109,40,217,0.055))",
          border: "1px solid rgba(124,58,237,0.22)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.07)",
        }}>

          {/* Scarcity */}
          <div style={{ marginBottom: "18px", display: "flex", justifyContent: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "7px",
              borderRadius: "999px", padding: "6px 14px",
              background: "rgba(124,58,237,0.09)",
              border: "1px solid rgba(124,58,237,0.2)",
            }}>
              <span style={{
                width: "5px", height: "5px", borderRadius: "50%",
                background: "#a78bfa", display: "inline-block",
                boxShadow: "0 0 5px rgba(167,139,250,0.7)",
              }} />
              <span style={{ fontSize: "0.63rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(167,139,250,0.82)" }}>
                Only 3 sessions remaining this week
              </span>
            </div>
          </div>

          {/* Session row */}
          <div style={{
            marginBottom: "18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderRadius: "12px", padding: "12px 14px",
            background: "rgba(255,255,255,0.038)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div>
              <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "rgba(255,255,255,0.82)" }}>
                Private Thyroid Strategy Session
              </p>
              <p style={{ fontSize: "0.7rem", marginTop: "2px", color: "rgba(255,255,255,0.36)" }}>
                60 min · 1-on-1 · With Swapnil
              </p>
            </div>
            <p style={{ fontSize: "1.2rem", fontWeight: 900, ...gText }}>
              Rs.299
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={openPayment}
            style={{
              marginBottom: "12px", width: "100%",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              borderRadius: "16px", padding: "17px 20px",
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              boxShadow: "0 0 0 1px rgba(124,58,237,0.42), 0 10px 36px rgba(124,58,237,0.3)",
              border: "none", cursor: "pointer", color: "#fff",
            }}
          >
            <span style={{ fontSize: "1.02rem", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.01em" }}>
              Secure My Private Slot - Rs.299
            </span>
            <span style={{ marginTop: "5px", fontSize: "0.72rem", fontWeight: 500, color: "rgba(255,255,255,0.58)" }}>
              Private · 60 min · Written plan included
            </span>
          </button>

          <p style={{ textAlign: "center", fontSize: "0.68rem", fontWeight: 500, color: "rgba(255,255,255,0.33)" }}>
            Full refund if you do not leave with complete clarity
          </p>
        </div>

        {/* 4. ROTATING TESTIMONIALS */}
        <div style={{ marginBottom: "32px", width: "100%" }}>
          <p style={{ marginBottom: "12px", textAlign: "center", fontSize: "0.59rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)" }}>
            Real women. Real results.
          </p>

          <div style={{
            borderRadius: "18px", padding: "20px",
            background: "rgba(255,255,255,0.028)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.045)",
            minHeight: "172px",
          }}>
            <div style={{ opacity: fading ? 0 : 1, transition: "opacity 0.45s ease" }}>

              {/* Stars */}
              <div style={{ marginBottom: "10px", display: "flex", gap: "2px" }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} style={{ fontSize: "0.7rem", color: "rgba(167,139,250,0.7)" }}>
                    &#9733;
                  </span>
                ))}
              </div>

              {/* Review */}
              <p style={{ marginBottom: "14px", fontSize: "0.83rem", lineHeight: 1.68, fontStyle: "italic", color: "rgba(255,255,255,0.7)" }}>
                &ldquo;{active.review}&rdquo;
              </p>

              {/* Client row */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", fontWeight: 700, color: "#fff",
                  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                }}>
                  {active.initial}
                </div>
                <div>
                  <p style={{ fontSize: "0.78rem", fontWeight: 600, lineHeight: 1, color: "rgba(255,255,255,0.78)" }}>
                    {active.name}
                  </p>
                  <p style={{ marginTop: "3px", fontSize: "0.63rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>
                    {active.condition} · {active.city}
                  </p>
                </div>

                {/* Progress indicators */}
                <div style={{ marginLeft: "auto", display: "flex", gap: "3px", alignItems: "center" }}>
                  {TESTIMONIALS.map((_, i) => (
                    <div key={i} style={{
                      height: "4px",
                      borderRadius: "999px",
                      width: i === activeIdx ? "14px" : "4px",
                      background: i === activeIdx ? "#7c3aed" : "rgba(255,255,255,0.1)",
                      transition: "width 0.35s ease, background 0.35s ease",
                    }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. TRUST ROW */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 18px" }}>
          {["Private and confidential", "200+ women helped", "ACE and INFS certified", "Full refund guaranteed"].map((item) => (
            <p key={item} style={{ fontSize: "0.61rem", fontWeight: 500, color: "rgba(255,255,255,0.18)", textAlign: "center" }}>
              {item}
            </p>
          ))}
        </div>

      </div>
    </main>
  );
}