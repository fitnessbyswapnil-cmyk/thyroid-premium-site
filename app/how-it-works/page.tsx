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
const PAY_URL = "https://payments.cashfree.com/forms?code=thyroid-session";

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
    title: "Secure your slot — ₹299",
    body: "One payment, fully refundable if you don't leave the call with clarity. It also gets credited against your plan if you continue.",
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

        {/* Rashmi proof video */}
        <a
          href={VIDEO_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            textDecoration: "none",
            borderRadius: 20,
            border: `1px solid rgba(168,85,247,0.35)`,
            background: `linear-gradient(160deg, rgba(168,85,247,0.14), ${CARD})`,
            padding: 22,
            marginBottom: 36,
          }}
        >
          <p style={{ fontSize: 10.5, letterSpacing: "0.14em", color: PURPLE_L, textTransform: "uppercase", fontWeight: 800, marginBottom: 8 }}>
            ▶ Watch: a real consultation, step by step
          </p>
          <p style={{ fontSize: 15.5, color: INK1, fontWeight: 700, lineHeight: 1.45, marginBottom: 8 }}>
            Rashmi — a doctor from Odisha — was doing diet, workouts and intermittent
            fasting. Still stuck.
          </p>
          <p style={{ fontSize: 13.5, color: INK2, lineHeight: 1.6, marginBottom: 12 }}>
            On her call we found the exact blocker she didn&apos;t know existed. She recorded
            how it worked so you can see it before your own.
          </p>
          <span
            style={{
              display: "inline-block",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
              background: `linear-gradient(135deg, ${PURPLE}, #7e22ce)`,
              borderRadius: 999,
              padding: "10px 18px",
            }}
          >
            Watch Rashmi&apos;s video →
          </span>
        </a>

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
          Book My Consultation · ₹299
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
