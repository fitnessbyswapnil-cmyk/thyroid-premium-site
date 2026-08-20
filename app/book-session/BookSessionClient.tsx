"use client";

/**
 * PAY-AT-END step 1. The Cal.com embed, inline on our own domain, so she picks
 * a slot and answers the qualification questions BEFORE any payment is asked.
 *
 * On bookingSuccessful we take the Cal.com booking uid and hand her to
 * /confirm-session?uid=..., which resolves the booking into a lead and opens
 * the embedded Cashfree checkout. The uid is the canonical booking id and is
 * the same value /api/cal-webhook uses for its Schedule event_id, so nothing
 * about tracking dedup changes.
 */

import { useEffect, useRef } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { pushDL } from "@/app/lib/analytics";
import { SESSION_PRICE } from "@/app/lib/pricing";

const INK1 = "#241f1a";
const INK2 = "#6b6157";

export default function BookSessionClient() {
  // Idempotency: Cal.com can emit bookingSuccessful more than once per booking.
  const redirected = useRef(false);

  useEffect(() => {
    (async () => {
      const cal = await getCalApi({ namespace: "60min" });
      cal("on", {
        action: "bookingSuccessful",
        callback: (e: unknown) => {
          if (redirected.current) return;
          // Defensive extraction — the payload shape varies by Cal.com version.
          const detail = (e as { detail?: { data?: Record<string, unknown> } })?.detail?.data ?? {};
          const booking = (detail.booking ?? detail) as Record<string, unknown>;
          const uid =
            (typeof booking.uid === "string" && booking.uid) ||
            (typeof detail.uid === "string" && detail.uid) ||
            "";
          redirected.current = true;
          pushDL({ event: "slot_selected_awaiting_payment" });
          window.location.href = uid
            ? `/confirm-session?uid=${encodeURIComponent(uid)}`
            : "/confirm-session";
        },
      });
    })();
  }, []);

  return (
    <main style={{ background: "#ffffff", minHeight: "100vh", padding: "28px 16px 56px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <p style={{
          fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase",
          color: "#8a5d12", fontWeight: 700, textAlign: "center", marginBottom: 12,
        }}>
          For women 30+ with hypothyroidism
        </p>

        <h1 style={{
          fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(26px,6vw,38px)",
          lineHeight: 1.16, color: INK1, textAlign: "center", margin: "0 0 12px", fontWeight: 600,
        }}>
          Pick your 1-1 thyroid session
        </h1>

        <p style={{
          fontSize: 16, lineHeight: 1.55, color: INK2, textAlign: "center",
          margin: "0 auto 24px", maxWidth: "52ch",
        }}>
          Choose a time and answer a few questions so I can read your situation
          before we speak. You confirm the slot with ₹{SESSION_PRICE} on the next
          screen.
        </p>

        <div style={{ borderRadius: 14, overflow: "hidden" }}>
          <Cal
            namespace="60min"
            calLink="swapnilumbarkarfitness/60min"
            style={{ width: "100%", height: "100%", overflow: "scroll" }}
            config={{ layout: "month_view" }}
          />
        </div>
      </div>
    </main>
  );
}
