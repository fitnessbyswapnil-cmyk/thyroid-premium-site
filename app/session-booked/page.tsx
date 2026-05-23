"use client";

import { useEffect, useState, useRef } from "react";

// ── CALENDLY CONFIG ────────────────────────────────────────────────────────────
const CALENDLY_URL =
  "https://calendly.com/fitnessbyswapnil/60min" +
  "?hide_gdpr_banner=1" +
  "&background_color=0d0b1a" +
  "&text_color=e2e0f0" +
  "&primary_color=7c3aed" +
  "&layout=month_view";

// ── PREPARATION TIPS ──────────────────────────────────────────────────────────
const TIPS = [
  {
    title: "Pen and paper ready",
    body: "You will receive specific, actionable insights in this session. Write them down as they come — this 60 minutes is dense with clarity.",
  },
  {
    title: "Quiet space, zero distractions",
    body: "Step away from family, work noise, and your phone. These 60 minutes belong entirely to you. You have earned this.",
  },
  {
    title: "Strong internet connection",
    body: "Use Wi-Fi where possible. A stable connection means nothing interrupts the session at the wrong moment.",
  },
  {
    title: "Bring your thyroid report if you have one",
    body: "Your most recent TSH test result — even a photo on your phone is fine. If you don't have one, that is completely okay.",
  },
  {
    title: "Know your one key question",
    body: "The single thing you most want clarity on. Swapnil will open there. Everything else will follow naturally.",
  },
  {
    title: "These 60 minutes will give you more clarity than years of trying alone",
    body: "200+ women have sat in this session. Almost every one says the same thing afterward: I wish I had done this sooner.",
  },
];

// ── GRADIENT TEXT STYLE ───────────────────────────────────────────────────────
const gPurple: React.CSSProperties = {
  background: "linear-gradient(130deg, #c084fc 0%, #7c3aed 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  display: "inline",
};

const gGreen: React.CSSProperties = {
  background: "linear-gradient(130deg, #86efac 0%, #22c55e 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  display: "inline",
};

// ── TIP ICON SVGs ─────────────────────────────────────────────────────────────
const TIP_ICONS = [
  // pen + paper
  <svg key="0" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <rect x="3" y="2" width="9" height="14" rx="1.5" stroke="#c084fc" strokeWidth="1.3"/>
    <path d="M6 6h4M6 9h4M6 12h2" stroke="#c084fc" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M12 2l2 2-5 5-2.5.5.5-2.5L12 2z" stroke="#c084fc" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  // quiet / sound off
  <svg key="1" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <path d="M4 6.5h2l3-3v11l-3-3H4V6.5z" stroke="#c084fc" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13 5l-4 8" stroke="#c084fc" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>,
  // wifi
  <svg key="2" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <path d="M2 7.5a9 9 0 0114 0" stroke="#c084fc" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M4.5 10a5.5 5.5 0 019 0" stroke="#c084fc" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M7 12.5a2.5 2.5 0 014 0" stroke="#c084fc" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="9" cy="15" r="1" fill="#c084fc"/>
  </svg>,
  // document / report
  <svg key="3" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <rect x="3.5" y="1.5" width="11" height="15" rx="1.5" stroke="#c084fc" strokeWidth="1.3"/>
    <path d="M6 6.5h6M6 9.5h6M6 12.5h4" stroke="#c084fc" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>,
  // question / thought
  <svg key="4" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <circle cx="9" cy="9" r="7" stroke="#c084fc" strokeWidth="1.3"/>
    <path d="M7 7.2C7 6.1 7.9 5.3 9 5.3s2 .8 2 1.9c0 1-1 1.6-1.7 2-.4.3-.6.6-.5 1.2" stroke="#c084fc" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="9" cy="12.8" r="0.7" fill="#c084fc"/>
  </svg>,
  // star / sparkle
  <svg key="5" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <path d="M9 2l1.8 4 4.2.6-3 3 .7 4.4L9 12l-3.7 2 .7-4.4-3-3 4.2-.6L9 2z" stroke="#c084fc" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
];

// ── DataLayer ────────────────────────────────────────────────────────────────
function pushDL(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(payload);
}

// ── PAGE COMPONENT ─────────────────────────────────────────────────────────────
export default function SessionBooked() {
  const [show, setShow] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<{
    name?: string;
    date?: string;
    time?: string;
  }>({});
  const confirmRef = useRef<HTMLDivElement>(null);

  // Entrance animation — Purchase fires via GTM tag on /session-booked page path
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Load Calendly script
  useEffect(() => {
    if (document.querySelector('script[src*="calendly"]')) return;
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Listen for Calendly booking completion
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== "object") return;
      const { event, payload } = e.data;
      if (event === "calendly.event_scheduled") {
        const name =
          payload?.invitee?.name || "";
        const startTime: string =
          payload?.event?.start_time || "";
        let dateStr = "";
        let timeStr = "";
        if (startTime) {
          const d = new Date(startTime);
          dateStr = d.toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          timeStr = d.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
        }
        setBookingDetails({ name, date: dateStr, time: timeStr });
        setBooked(true);
        pushDL({ event: "calendly_booked", value: 299, currency: "INR", content_name: "Thyroid Strategy Session Booked" });
        setTimeout(() => {
          confirmRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 400);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <main
      style={{
        background: "#07060f",
        minHeight: "100vh",
        color: "#fff",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── BACKGROUND GLOWS ───────────────────────────────────────────── */}
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
            width: "min(100vw, 700px)",
            height: "480px",
            background: booked
              ? "radial-gradient(ellipse, rgba(34,197,94,0.1) 0%, transparent 70%)"
              : "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)",
            filter: "blur(70px)",
            transition: "background 1s ease",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            left: 0,
            width: "340px",
            height: "340px",
            background:
              "radial-gradient(circle, rgba(109,40,217,0.08) 0%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            right: 0,
            width: "340px",
            height: "340px",
            background:
              "radial-gradient(circle, rgba(88,28,135,0.07) 0%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />
      </div>

      {/* ── PAGE CONTENT ───────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "660px",
          margin: "0 auto",
          padding: "48px 20px 80px",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(18px)",
          transition: "opacity 0.55s ease, transform 0.55s ease",
        }}
      >

        {/* ── HEADER ───────────────────────────────────────────────────── */}
        <div
          style={{
            marginBottom: "32px",
            textAlign: "center",
          }}
        >
          {/* Status icon */}
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: booked
                ? "rgba(34,197,94,0.13)"
                : "rgba(34,197,94,0.13)",
              border: booked
                ? "1.5px solid rgba(34,197,94,0.45)"
                : "1.5px solid rgba(34,197,94,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              transition: "all 0.5s ease",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M5 13L9 17L19 7"
                stroke="rgba(134,239,172,0.85)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Badge */}
          <div
            style={{
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: "999px",
              background: booked
                ? "rgba(34,197,94,0.1)"
                : "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.25)",
              marginBottom: "14px",
            }}
          >
            <span
              style={{
                fontSize: "0.62rem",
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.16em",
                color: "rgba(134,239,172,0.85)",
              }}
            >
              Payment Confirmed
            </span>
          </div>

          {/* Headline — changes when booked */}
          {booked ? (
            <h1
              style={{
                fontSize: "clamp(1.55rem, 4vw, 1.9rem)",
                fontWeight: 900,
                lineHeight: 1.12,
                letterSpacing: "-0.035em",
                marginBottom: "12px",
                color: "#fff",
              }}
            >
              Your Session Is{" "}
              <span style={gGreen}>Confirmed.</span>
            </h1>
          ) : (
            <h1
              style={{
                fontSize: "clamp(1.55rem, 4vw, 1.9rem)",
                fontWeight: 900,
                lineHeight: 1.12,
                letterSpacing: "-0.035em",
                marginBottom: "12px",
                color: "#fff",
              }}
            >
              One Step Left.{" "}
              <span style={gPurple}>Choose Your Session Time.</span>
            </h1>
          )}

          <p
            style={{
              fontSize: "0.88rem",
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.5)",
              maxWidth: "38ch",
              margin: "0 auto",
            }}
          >
            {booked
              ? "Swapnil will review your intake before you speak. Check your email for the calendar invite."
              : "Swapnil will review your intake personally before you speak. Pick any available time below."}
          </p>
        </div>

        {/* ── CALENDLY EMBED ────────────────────────────────────────────── */}
        <div
          style={{
            borderRadius: "20px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.07)",
            marginBottom: "32px",
            minHeight: "700px",
            background: "rgba(13,11,26,0.6)",
          }}
        >
          <div
            className="calendly-inline-widget"
            data-url={CALENDLY_URL}
            style={{ minWidth: "100%", height: "700px" }}
          />
        </div>

        {/* ── POST-BOOKING CONFIRMATION (shows after scheduling) ────────── */}
        {booked && (
          <div
            ref={confirmRef}
            style={{
              marginBottom: "32px",
              opacity: booked ? 1 : 0,
              transform: booked ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.6s ease, transform 0.6s ease",
            }}
          >

            {/* Session summary card */}
            <div
              style={{
                borderRadius: "20px",
                padding: "24px",
                marginBottom: "24px",
                background:
                  "linear-gradient(150deg, rgba(34,197,94,0.1), rgba(22,163,74,0.04))",
                border: "1px solid rgba(34,197,94,0.22)",
                boxShadow:
                  "0 24px 56px rgba(0,0,0,0.45), inset 0 1px 0 rgba(134,239,172,0.08)",
              }}
            >
              {/* Confirmed header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "rgba(34,197,94,0.15)",
                    border: "1px solid rgba(34,197,94,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M3 8l3 3 7-7"
                      stroke="rgba(134,239,172,0.85)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.92rem",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.9)",
                      lineHeight: 1,
                    }}
                  >
                    60 Minute Thyroid Fat Loss Strategy Session
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "0.73rem",
                      color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    With Swapnil Umbarkar · Private · 1-on-1
                  </p>
                </div>
              </div>

              {/* Date + Time side by side */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: bookingDetails.name ? "16px" : "0",
                }}
              >
                {bookingDetails.date && (
                  <div
                    style={{
                      borderRadius: "12px",
                      padding: "14px 16px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 4px",
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.15em",
                        color: "rgba(134,239,172,0.65)",
                      }}
                    >
                      Date
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.84rem",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.88)",
                        lineHeight: 1.3,
                      }}
                    >
                      {bookingDetails.date}
                    </p>
                  </div>
                )}
                {bookingDetails.time && (
                  <div
                    style={{
                      borderRadius: "12px",
                      padding: "14px 16px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 4px",
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.15em",
                        color: "rgba(134,239,172,0.65)",
                      }}
                    >
                      Time
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.84rem",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.88)",
                        lineHeight: 1.3,
                      }}
                    >
                      {bookingDetails.time}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: "0.68rem",
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      India Standard Time
                    </p>
                  </div>
                )}
              </div>

              {/* WhatsApp coming notice */}
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "rgba(124,58,237,0.1)",
                  border: "1px solid rgba(124,58,237,0.22)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.78rem",
                    lineHeight: 1.55,
                    color: "rgba(192,132,252,0.85)",
                  }}
                >
                  You will receive a WhatsApp confirmation with your
                  Zoom link within a few minutes.
                </p>
              </div>
            </div>

            {/* ── PREPARATION TIPS ─────────────────────────────────────── */}
            <div
              style={{
                borderRadius: "20px",
                padding: "24px",
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.045)",
              }}
            >
              {/* Section header */}
              <div
                style={{
                  marginBottom: "20px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.2em",
                    color: "rgba(255,255,255,0.2)",
                  }}
                >
                  Before your session
                </p>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1.05rem",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    color: "rgba(255,255,255,0.9)",
                    lineHeight: 1.2,
                  }}
                >
                  6 Things to Do Before You Show Up
                </h2>
              </div>

              {/* Tips list */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: "14px",
                }}
              >
                {TIPS.map((tip, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "14px",
                      padding: "14px 16px",
                      borderRadius: "14px",
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.055)",
                    }}
                  >
                    {/* Icon circle */}
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "10px",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(124,58,237,0.12)",
                        border: "1px solid rgba(124,58,237,0.24)",
                      }}
                    >
                      {TIP_ICONS[i]}
                    </div>

                    {/* Text */}
                    <div>
                      <p
                        style={{
                          margin: "0 0 3px",
                          fontSize: "0.84rem",
                          fontWeight: 700,
                          lineHeight: 1,
                          color: "rgba(255,255,255,0.88)",
                        }}
                      >
                        {tip.title}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.74rem",
                          lineHeight: 1.55,
                          color: "rgba(255,255,255,0.42)",
                        }}
                      >
                        {tip.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Closing statement */}
              <div
                style={{
                  marginTop: "20px",
                  padding: "16px 18px",
                  borderRadius: "14px",
                  background:
                    "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(109,40,217,0.06))",
                  border: "1px solid rgba(124,58,237,0.2)",
                  textAlign: "center" as const,
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.9)",
                    lineHeight: 1.4,
                  }}
                >
                  This session is designed to give you more clarity
                  than years of trying alone.
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.4)",
                    lineHeight: 1.5,
                  }}
                >
                  Swapnil will have reviewed your intake before you
                  speak. Come with an open mind.
                  Leave with a clear direction.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── TRUST / REASSURANCE FOOTER ───────────────────────────────── */}
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "14px",
            background: "rgba(255,255,255,0.022)",
            border: "1px solid rgba(255,255,255,0.055)",
            textAlign: "center" as const,
            marginBottom: "32px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.38)",
            }}
          >
            You will receive a WhatsApp confirmation with your Zoom
            link after booking.
            <br />
            Full refund if you do not leave with complete clarity.
          </p>
        </div>

        {/* ── TRUST ROW ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap" as const,
            justifyContent: "center",
            gap: "6px 18px",
          }}
        >
          {[
            "Private and confidential",
            "200+ women helped",
            "ACE and INFS certified",
            "Full refund guaranteed",
          ].map((item) => (
            <p
              key={item}
              style={{
                margin: 0,
                fontSize: "0.6rem",
                fontWeight: 500,
                color: "rgba(255,255,255,0.17)",
                textAlign: "center" as const,
              }}
            >
              {item}
            </p>
          ))}
        </div>

      </div>
    </main>
  );
}