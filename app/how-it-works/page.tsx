/**
 * /how-it-works — the shareable "what happens on your consultation" page.
 *
 * Built to be LINKED FROM WHATSAPP: a stalled lead taps this from a personal
 * follow-up message, sees the call explained step by step with Rashmi's video
 * as proof, and ends at the ₹299 payment button. Lives on our own domain
 * (never a third-party link) so the Pixel sees every visitor and the page
 * carries the site's trust, not someone else's branding.
 *
 * Server component, no client JS — it must load instantly on a phone.
 */
import type { Metadata } from "next";

const VIDEO_URL = "https://youtu.be/Iad2NE9w7eg";
// YouTube's own thumbnail CDN — hqdefault exists for every video. Loaded by
// the visitor's browser, so it works regardless of where this page is served.
const VIDEO_THUMB = "https://i.ytimg.com/vi/Iad2NE9w7eg/hqdefault.jpg";
const PAY_URL = "https://payments.cashfree.com/forms?code=thyroid-session";
// Price anchor: the call's actual price vs what she pays today.
const ACTUAL_PRICE = "₹2,000";
const OFFER_PRICE = "₹299";

export const metadata: Metadata = {
  title: "How Your Thyroid Consultation Works · Swapnil Umbarkar",
  description:
    "Step by step: what happens on your 60-minute private thyroid consultation, and how we find the exact blocker keeping your weight stuck.",
};

const BG = "#07060f";
const CARD = "rgba(255,255,255,0.03)";
const GRID = "rgba(255,255,255,0.09)";
const INK1 = "rgba(255,255,255,0.92)";
const INK2 = "rgba(255,255,255,0.60)";
const MUTED = "rgba(255,255,255,0.38)";
const PURPLE = "#a855f7";
const PURPLE_L = "#c084fc";
const GOOD = "#34d399";

const STEPS = [
  {
    n: "01",
    title: "Secure your slot — ₹2,000 call, today ₹299",
    body: "The consultation's actual price is ₹2,000 — you get it at ₹299, fully refundable if you don't leave with clarity. Credited against your plan if you continue.",
  },
  {
    n: "02",
    title: "I read your case before we speak",
    body: "Your assessment answers and reports reach me first. We don't spend your call collecting history — I arrive already knowing your pattern.",
  },
  {
    n: "03",
    title: "Pick your time",
    body: "Your booking link arrives on WhatsApp the moment payment lands. Choose any private slot; the Google Meet link comes instantly.",
  },
  {
    n: "04",
    title: "The 60-minute call — we find your blocker",
    body: "Diet, workouts, fasting — if the weight still won't move, something specific is blocking your metabolism. We locate it, in order of what to fix first.",
  },
  {
    n: "05",
    title: "Your written summary, yours to keep",
    body: "After the call you get the full breakdown on WhatsApp — your blockers, the sequence to fix them, and exactly what reversing them involves.",
  },
] as const;

export default function HowItWorks() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: INK1,
        fontFamily: "var(--font-body), Inter, system-ui, sans-serif",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Header */}
        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            letterSpacing: "0.16em",
            color: PURPLE_L,
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          Private 1-on-1 · 60 minutes · with Swapnil
        </p>
        <h1
          style={{
            fontSize: "clamp(1.6rem,5vw,2.1rem)",
            fontFamily: "var(--font-display), Georgia, serif",
            fontWeight: 800,
            lineHeight: 1.2,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          How your thyroid consultation works
        </h1>
        <p style={{ textAlign: "center", fontSize: 14.5, color: INK2, lineHeight: 1.65, marginBottom: 34 }}>
          You&apos;ve done the diets, the workouts, maybe the fasting — and the weight still
          won&apos;t move. That means something specific is blocking it.{" "}
          <span style={{ color: INK1, fontWeight: 600 }}>This call finds it.</span>
        </p>

        {/* Rashmi proof video — thumbnail-led so it reads as a video, not a link */}
        <a
          href={VIDEO_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            textDecoration: "none",
            borderRadius: 20,
            overflow: "hidden",
            border: `1px solid rgba(168,85,247,0.35)`,
            background: `linear-gradient(160deg, rgba(168,85,247,0.14), ${CARD})`,
            marginBottom: 14,
          }}
        >
          <div style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- remote CDN thumb, next/image would need domain config for zero gain here */}
            <img
              src={VIDEO_THUMB}
              alt="Rashmi's 1-on-1 thyroid consultation — screen recording"
              style={{ display: "block", width: "100%", aspectRatio: "16/9", objectFit: "cover" }}
            />
            {/* play button overlay */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                background: "rgba(7,6,15,0.25)",
              }}
            >
              <span
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(168,85,247,0.92)",
                  boxShadow: "0 8px 40px rgba(0,0,0,0.55)",
                  color: "#fff",
                  fontSize: 24,
                  paddingLeft: 5,
                }}
              >
                ▶
              </span>
            </span>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: 10,
                fontSize: 10,
                letterSpacing: "0.12em",
                fontWeight: 800,
                textTransform: "uppercase",
                color: "#fff",
                background: "rgba(7,6,15,0.72)",
                borderRadius: 999,
                padding: "5px 10px",
              }}
            >
              ▶ Real consultation · 1:47
            </span>
          </div>
          <div style={{ padding: "16px 18px 18px" }}>
            <p style={{ fontSize: 15, color: INK1, fontWeight: 700, lineHeight: 1.45, marginBottom: 4 }}>
              Rashmi — a doctor from Odisha — was doing diet, workouts and fasting. Still stuck.
            </p>
            <p style={{ fontSize: 13, color: INK2, lineHeight: 1.6 }}>
              On her call we found the exact blocker she didn&apos;t know existed. Watch how, step by step.
            </p>
          </div>
        </a>

        {/* CTA immediately after the proof */}
        <a
          href={PAY_URL}
          style={{
            display: "block",
            textAlign: "center",
            textDecoration: "none",
            padding: "16px 20px",
            borderRadius: 16,
            background: `linear-gradient(135deg, ${PURPLE}, #7e22ce)`,
            color: "#fff",
            fontSize: 15.5,
            fontWeight: 800,
            boxShadow: "0 14px 40px rgba(168,85,247,0.35)",
            marginBottom: 6,
          }}
        >
          Find My Blocker — <s style={{ opacity: 0.55, fontWeight: 600 }}>{ACTUAL_PRICE}</s> {OFFER_PRICE}
        </a>
        <p style={{ textAlign: "center", fontSize: 11, color: MUTED, marginBottom: 36 }}>
          Actual call price {ACTUAL_PRICE} · today {OFFER_PRICE} · fully refundable if no clarity
        </p>

        {/* ── The Three Locks — FOMO diagram ─────────────────────────────────
            Mirrors the deck used on real consultations (Rashmi's video shows
            it live). Deliberately names the locks but NOT how to test or open
            them — the diagnosis is what the ₹299 buys. Minimal text. */}
        <div style={{ marginBottom: 40 }}>
          <p
            style={{
              textAlign: "center",
              fontSize: 10.5,
              letterSpacing: "0.16em",
              color: PURPLE_L,
              textTransform: "uppercase",
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Why your fat loss isn&apos;t happening
          </p>
          <h2
            style={{
              textAlign: "center",
              fontSize: "clamp(1.25rem,4vw,1.5rem)",
              fontFamily: "var(--font-display), Georgia, serif",
              fontWeight: 800,
              marginBottom: 18,
            }}
          >
            You&apos;re doing everything right. That&apos;s the clue.
          </h2>

          {/* What she's already doing — all ticked, none of it working */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 4 }}>
            {[
              { e: "🥗", t: "Eating clean & salads" },
              { e: "⏱️", t: "Intermittent fasting" },
              { e: "🏃‍♀️", t: "Hours of cardio" },
              { e: "📉", t: "Cutting calories" },
            ].map((c) => (
              <div
                key={c.t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 12,
                  border: `1px solid ${GRID}`,
                  background: CARD,
                  padding: "11px 12px",
                }}
              >
                <span style={{ fontSize: 15 }}>{c.e}</span>
                <span style={{ fontSize: 12.5, color: INK1, fontWeight: 600, flex: 1 }}>{c.t}</span>
                <span style={{ fontSize: 12, color: GOOD, fontWeight: 800 }}>✓</span>
              </div>
            ))}
          </div>

          {/* down connector into the result */}
          <svg viewBox="0 0 300 40" style={{ display: "block", width: "100%", height: 40 }} aria-hidden>
            <path d="M75 4 C 75 26, 150 14, 150 36" stroke={PURPLE} strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.55" />
            <path d="M225 4 C 225 26, 150 14, 150 36" stroke={PURPLE} strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.55" />
          </svg>

          <div
            style={{
              margin: "0 auto 18px",
              width: "fit-content",
              borderRadius: 14,
              background: "#000",
              border: "1px solid rgba(248,113,113,0.45)",
              boxShadow: "0 0 30px rgba(248,113,113,0.12)",
              padding: "12px 28px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 9.5, letterSpacing: "0.14em", color: MUTED, fontWeight: 800, marginBottom: 2 }}>
              THE RESULT
            </p>
            <p style={{ fontSize: 19, fontWeight: 800, fontFamily: "var(--font-display), Georgia, serif", color: INK1 }}>
              Scale still stuck&nbsp;❌
            </p>
          </div>

          <p style={{ textAlign: "center", fontSize: 14, color: INK2, lineHeight: 1.6, marginBottom: 18 }}>
            Effort was never the problem.{" "}
            <span style={{ color: INK1, fontWeight: 700 }}>Three hidden locks are — any one stalls you.</span>
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              { n: "01", t: "Slow Thyroid", s: "you burn less, all day" },
              { n: "02", t: "Hidden Deficiency", s: "no fuel to burn with" },
              { n: "03", t: "Storage Mode", s: "body refuses to release fat" },
            ].map((l) => (
              <div
                key={l.n}
                style={{
                  borderRadius: 14,
                  border: `1px solid rgba(168,85,247,0.30)`,
                  background: CARD,
                  padding: "14px 10px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: 16, marginBottom: 6 }}>🔒</p>
                <p style={{ fontSize: 9.5, letterSpacing: "0.12em", color: MUTED, fontWeight: 800, marginBottom: 3 }}>
                  LOCK {l.n}
                </p>
                <p style={{ fontSize: 12.5, fontWeight: 800, color: INK1, lineHeight: 1.25, marginBottom: 4 }}>{l.t}</p>
                <p style={{ fontSize: 10.5, color: INK2, lineHeight: 1.4 }}>{l.s}</p>
              </div>
            ))}
          </div>

          {/* converging connectors */}
          <svg viewBox="0 0 300 46" style={{ display: "block", width: "100%", height: 46 }} aria-hidden>
            <path d="M50 4 C 50 30, 150 18, 150 42" stroke={PURPLE} strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.55" />
            <path d="M150 4 L 150 42" stroke={PURPLE} strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.55" />
            <path d="M250 4 C 250 30, 150 18, 150 42" stroke={PURPLE} strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.55" />
          </svg>
          <p style={{ textAlign: "center", fontSize: 10.5, color: MUTED, fontStyle: "italic", margin: "-6px 0 6px" }}>
            each lock makes the other two worse
          </p>

          <p style={{ textAlign: "center", fontSize: 13.5, color: INK2, lineHeight: 1.65, marginTop: 12 }}>
            Most women have at least two locks —{" "}
            <span style={{ color: INK1, fontWeight: 700 }}>and can&apos;t feel which ones.</span>
            <br />
            Your reports + 60 minutes ={" "}
            <span style={{ color: PURPLE_L, fontWeight: 700 }}>
              🔓 your locks, named, in the order to open them.
            </span>
          </p>
        </div>

        {/* Steps diagram */}
        <div style={{ position: "relative", marginBottom: 36 }}>
          {/* vertical connector line */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 19,
              top: 24,
              bottom: 24,
              width: 2,
              background: `linear-gradient(${PURPLE}, rgba(168,85,247,0.05))`,
            }}
          />
          <div style={{ display: "grid", gap: 14 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ display: "flex", gap: 16, position: "relative" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    color: PURPLE_L,
                    background: BG,
                    border: `1.5px solid rgba(168,85,247,0.5)`,
                    boxShadow: "0 0 18px rgba(168,85,247,0.25)",
                  }}
                >
                  {s.n}
                </div>
                <div
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    border: `1px solid ${GRID}`,
                    background: CARD,
                    padding: "14px 16px",
                  }}
                >
                  <p style={{ fontSize: 15, fontWeight: 700, color: INK1, marginBottom: 4 }}>{s.title}</p>
                  <p style={{ fontSize: 13, color: INK2, lineHeight: 1.6 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk reversal */}
        <p
          style={{
            fontSize: 13,
            color: INK2,
            lineHeight: 1.6,
            fontStyle: "italic",
            borderLeft: `2px solid ${PURPLE}`,
            paddingLeft: 14,
            marginBottom: 28,
          }}
        >
          &ldquo;If you finish the call and still don&apos;t know what&apos;s blocking you, tell me
          and I&apos;ll refund the ₹299 — and you keep the written summary.&rdquo;
        </p>

        {/* CTA */}
        <a
          href={PAY_URL}
          style={{
            display: "block",
            textAlign: "center",
            textDecoration: "none",
            padding: "18px 20px",
            borderRadius: 16,
            background: `linear-gradient(135deg, ${PURPLE}, #7e22ce)`,
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            boxShadow: "0 14px 40px rgba(168,85,247,0.35)",
            marginBottom: 12,
          }}
        >
          Book My Consultation — <s style={{ opacity: 0.55, fontWeight: 600 }}>{ACTUAL_PRICE}</s> {OFFER_PRICE}
        </a>
        <p style={{ textAlign: "center", fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
          <span style={{ color: GOOD }}>✓</span> GPay · PhonePe · Paytm · Cards &nbsp;·&nbsp;
          <span style={{ color: GOOD }}>✓</span> Full refund if no clarity &nbsp;·&nbsp;
          <span style={{ color: GOOD }}>✓</span> 200+ women guided
        </p>
      </div>
    </main>
  );
}
