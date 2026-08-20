"use client";

/**
 * PAY-AT-END step 2. She has already chosen a slot and answered the
 * qualification form on Cal.com. This page holds that slot in front of her and
 * asks for the Rs 299 that confirms it.
 *
 * The framing is deliberate: "your slot is held, confirm it" is a different ask
 * from "pay and then we will find you a time". One protects something she
 * already has; the other asks her to buy something abstract.
 *
 * Payment path is unchanged from the rest of the funnel — /api/booking-payment
 * resolves the booking into a leadId, then the SAME /api/create-cashfree-order
 * mints thyroid_<leadId>_<timestamp> and /session-booked fires Purchase with
 * event_id Purchase_<orderId>.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CONSULTATION_FORM_URL } from "@/app/context/ScarcityProvider";
import { pushDL, trackInitiateCheckout, trackSchedule } from "@/app/lib/analytics";
import { persistUserIdentity } from "@/app/components/tracking/UserIdentityTracker";
import { getVisitorId, getFbc, getFbp } from "@/lib/tracking";
import { NATIVE_BOOKING_KEY } from "@/app/book/components/BookingFlow";
import { SESSION_PRICE } from "@/app/lib/pricing";
import { checkoutRedirectTarget } from "@/lib/checkout-target";

type Resolved = { leadId: string; name: string; phone: string; startTime: string };

const INK1 = "#241f1a";
const INK2 = "#6b6157";
const GRID = "#ede7dd";
const RED = "#e60000";

function prettySlot(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long",
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(d);
}

export default function ConfirmSessionClient() {
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");
  const [lead, setLead] = useState<Resolved | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cashfreeRef = useRef<Awaited<ReturnType<typeof import("@cashfreepayments/cashfree-js")["load"]>> | null>(null);
  const scheduleFiredRef = useRef(false);

  // Resolve the Cal.com booking into a lead, and warm the checkout SDK.
  useEffect(() => {
    const uid = new URLSearchParams(window.location.search).get("uid") || "";
    if (!uid) { setState("notfound"); return; }

    let cancelled = false;
    (async () => {
      try {
        const { load } = await import("@cashfreepayments/cashfree-js");
        const cf = await load({ mode: process.env.NODE_ENV === "production" ? "production" : "sandbox" });
        if (!cancelled) cashfreeRef.current = cf;
      } catch { /* payNow loads it on demand */ }
    })();

    // Cal.com's own webhook may still be in flight when she lands here, so retry
    // briefly rather than showing a dead end on a booking that does exist.
    (async () => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        try {
          const res = await fetch("/api/booking-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid }),
          });
          if (res.ok) {
            const data = (await res.json()) as Resolved;
            if (cancelled) return;
            setLead(data);
            setState("ready");
            persistUserIdentity({
              ...(data.name && { first_name: data.name.split(/\s+/)[0] }),
              ...(data.phone && { phone: data.phone }),
            });

            // ── Schedule ──────────────────────────────────────────────────────
            // Fired here, at booking time. /booking-confirmed also fires Schedule
            // but belongs to the pay-FIRST flow, and pay-at-end never lands on
            // it — so the live funnel had no browser Schedule at all, and the ad
            // set optimises for exactly this event.
            //
            // event_id is schedule_<uid>, identical to the one /api/cal-webhook
            // sends, so Meta collapses the two legs into a single Schedule
            // rather than counting both.
            //
            // It also decouples Schedule from Cal.com's confirmation step. The
            // webhook only acts on BOOKING_CREATED, and with "Requires
            // confirmation" switched on Cal.com defers that trigger until the
            // booking is accepted — often hours later, sometimes never. This leg
            // fires the moment she has a held slot, which is the moment the
            // campaign is trying to buy.
            //
            // Guarded per uid across remounts so a refresh cannot re-fire it.
            if (!scheduleFiredRef.current) {
              const key = `schedule_fired_${uid}`;
              let already = false;
              try { already = !!sessionStorage.getItem(key); } catch { /* storage unavailable */ }
              if (!already) {
                scheduleFiredRef.current = true;
                try { sessionStorage.setItem(key, "1"); } catch { /* non-critical */ }
                const when = new Date(data.startTime);
                const dated = !Number.isNaN(when.getTime());
                trackSchedule(
                  {
                    ...(data.name && { name: data.name }),
                    ...(dated && {
                      date: when.toLocaleDateString("en-IN", {
                        weekday: "long", day: "numeric", month: "long", year: "numeric",
                      }),
                      time: when.toLocaleTimeString("en-IN", {
                        hour: "2-digit", minute: "2-digit", hour12: true,
                      }),
                    }),
                  },
                  `schedule_${uid}`,
                  {
                    ...(data.name && { first_name: data.name.split(/\s+/)[0] }),
                    ...(data.phone && { phone: data.phone }),
                  },
                );
              }
            }

            pushDL({ event: "booking_awaiting_payment" });
            return;
          }
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 1200));
      }
      if (!cancelled) setState("notfound");
    })();

    return () => { cancelled = true; };
  }, []);

  const payNow = useCallback(async () => {
    if (busy || !lead) return;
    setBusy(true);
    setErr("");
    try {
      trackInitiateCheckout();
      pushDL({ event: "confirm_session_payment_initiated" });

      const orderRes = await fetch("/api/create-cashfree-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.leadId,
          customerPhone: lead.phone,
          customerName: lead.name,
          customerEmail: "",
          visitorId: getVisitorId(),
          fbc: getFbc(),
          fbp: getFbp(),
        }),
      });
      if (!orderRes.ok) throw new Error("order_failed");
      const { paymentSessionId, orderId, amount } = (await orderRes.json()) as {
        paymentSessionId: string; orderId: string; amount?: number;
      };

      try {
        const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        localStorage.setItem(NATIVE_BOOKING_KEY, JSON.stringify({ ...obj, orderId, amount }));
      } catch { /* non-critical */ }

      let cashfree = cashfreeRef.current;
      if (!cashfree) {
        const { load } = await import("@cashfreepayments/cashfree-js");
        cashfree = await load({ mode: process.env.NODE_ENV === "production" ? "production" : "sandbox" });
      }
      if (!cashfree) throw new Error("sdk_unavailable");

      const result = await cashfree.checkout({
        paymentSessionId,
        redirectTarget: checkoutRedirectTarget(),
      });

      if (result.error) { setErr("Payment was not completed. Please try again or use UPI."); setBusy(false); }
      else if (result.paymentDetails) {
        window.location.href = `/session-booked?orderId=${orderId}&leadId=${lead.leadId}`;
      } else { setErr("Payment not completed. Tap the button to try again."); setBusy(false); }
    } catch (e) {
      console.error("[confirm-session] embedded checkout unavailable:", e instanceof Error ? e.message : String(e));
      window.location.href = CONSULTATION_FORM_URL;
    }
  }, [busy, lead]);

  const wrap: React.CSSProperties = {
    background: "#ffffff", minHeight: "100vh", padding: "36px 18px 72px",
  };

  if (state === "loading") {
    return (
      <main style={wrap}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", paddingTop: 60 }}>
          <p style={{ color: INK2, fontSize: 16 }}>Finding your slot…</p>
        </div>
      </main>
    );
  }

  if (state === "notfound") {
    return (
      <main style={wrap}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", paddingTop: 48 }}>
          <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 27, color: INK1, marginBottom: 12 }}>
            We could not find that booking
          </h1>
          <p style={{ color: INK2, fontSize: 16, lineHeight: 1.55, marginBottom: 24 }}>
            Your slot may not have saved. Please pick a time again and we will hold it for you.
          </p>
          <a href="/book-session" style={{
            display: "inline-block", background: RED, color: "#fff", padding: "15px 26px",
            borderRadius: 6, fontWeight: 700, fontSize: 16, textDecoration: "none",
          }}>
            Pick my slot again
          </a>
        </div>
      </main>
    );
  }

  const slot = prettySlot(lead?.startTime || "");

  return (
    <main style={wrap}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <p style={{
          fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase",
          color: "#8a5d12", fontWeight: 700, textAlign: "center", marginBottom: 12,
        }}>
          One step left
        </p>

        <h1 style={{
          fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(26px,6.2vw,36px)",
          lineHeight: 1.18, color: INK1, textAlign: "center", margin: "0 0 14px", fontWeight: 600,
        }}>
          {lead?.name ? `${lead.name.split(/\s+/)[0]}, your slot is held` : "Your slot is held"}
        </h1>

        {slot && (
          <div style={{
            background: "#fffdeb", border: `1px solid #f2e9a8`, borderRadius: 12,
            padding: "16px 18px", textAlign: "center", marginBottom: 22,
          }}>
            <p style={{ fontSize: 12.5, letterSpacing: "0.1em", textTransform: "uppercase", color: INK2, marginBottom: 6 }}>
              Your session
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, color: INK1, margin: 0 }}>{slot}</p>
            <p style={{ fontSize: 13.5, color: INK2, marginTop: 6 }}>60 minutes · Google Meet · IST</p>
          </div>
        )}

        <p style={{ fontSize: 16, lineHeight: 1.55, color: INK2, textAlign: "center", margin: "0 0 24px" }}>
          Confirm it with ₹{SESSION_PRICE}. This is adjusted against your plan if
          you decide to work with me.
        </p>

        <button
          type="button" onClick={payNow} disabled={busy}
          style={{
            width: "100%", padding: "17px 20px", borderRadius: 6, border: "none",
            background: busy ? "#d98b86" : RED, color: "#fff", fontSize: 17,
            fontWeight: 700, cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Opening secure checkout…" : `Confirm My Session — ₹${SESSION_PRICE}`}
        </button>

        {err && <p style={{ color: RED, fontSize: 13.5, marginTop: 12, textAlign: "center" }}>{err}</p>}

        <p style={{ fontSize: 13, color: INK2, marginTop: 18, textAlign: "center", lineHeight: 1.5 }}>
          Slots are released if they are not confirmed, so that the time goes to
          someone who will use it.
        </p>

        <div style={{
          marginTop: 22, padding: "16px 18px", background: "#ffffff",
          border: `1px solid ${GRID}`, borderRadius: 12,
        }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: INK1, marginBottom: 6 }}>
            Why this session costs ₹{SESSION_PRICE}
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: INK2, margin: 0 }}>
            So the woman in that slot actually turns up, and so I arrive having
            read your answers properly.
          </p>
        </div>
      </div>
    </main>
  );
}
