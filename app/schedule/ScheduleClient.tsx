"use client";

/**
 * SCHEDULE-FIRST funnel (replaces quiz-first as the primary CTA target).
 *
 * Three fields, then the SAME embedded Cashfree checkout the quiz result screen
 * uses. Nothing about the payment path changes: /api/create-cashfree-order mints
 * `thyroid_<leadId>_<timestamp>`, /session-booked fires Purchase with event_id
 * Purchase_<orderId>, and the Cashfree webhook stamps Paid + fires
 * booking_confirmation. The hosted Cashfree form stays a last-resort fallback
 * only (see ScarcityProvider) because FORM webhooks normalise to payment: null
 * and never stamp Paid — docs/whatsapp-automation-session-2026-08.md §2.
 *
 * Why this page exists: the quiz asked 7 questions at the point of LOWEST
 * commitment. The qualifying questions now live on the Cal.com booking form,
 * after payment, where she is already invested. Lead is still captured BEFORE
 * payment so the unpaid-lead WhatsApp recovery sequence keeps working.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CONSULTATION_FORM_URL } from "@/app/context/ScarcityProvider";
import { pushDL, trackLead, trackInitiateCheckout } from "@/app/lib/analytics";
import { persistUserIdentity } from "@/app/components/tracking/UserIdentityTracker";
import { getUtmParams, getFbclid, getVisitorId, getFbc, getFbp } from "@/lib/tracking";
import { NATIVE_BOOKING_KEY } from "@/app/book/components/BookingFlow";
import { SESSION_PRICE } from "@/app/lib/pricing";
import { checkoutRedirectTarget } from "@/lib/checkout-target";

const BG = "#ffffff";
const CARD = "#ffffff";
const GRID = "#ede7dd";
const INK1 = "#241f1a";
const INK2 = "#6b6154";
const TEAL = "#a37220";
const CORAL = "#b8322b";

const THYROID_OPTIONS = [
  "Yes, I take thyroid medicine daily",
  "Diagnosed, not on medicine right now",
  "Not diagnosed, but I suspect it",
];

type Form = { name: string; phone: string; thyroid: string };

export default function ScheduleClient() {
  const [f, setF] = useState<Form>({ name: "", phone: "", thyroid: "" });
  const [errs, setErrs] = useState<Partial<Record<keyof Form, string>>>({});
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);
  const cashfreeRef = useRef<Awaited<ReturnType<typeof import("@cashfreepayments/cashfree-js")["load"]>> | null>(null);

  // Warm the checkout SDK so the tap-to-pay feels instant.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { load } = await import("@cashfreepayments/cashfree-js");
        const cf = await load({
          mode: process.env.NODE_ENV === "production" ? "production" : "sandbox",
        });
        if (!cancelled) cashfreeRef.current = cf;
      } catch {
        /* non-critical: payNow loads it on demand */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const set = (k: keyof Form, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errs[k]) setErrs((p) => ({ ...p, [k]: undefined }));
  };

  const submit = useCallback(async () => {
    if (busy) return;

    const e: Partial<Record<keyof Form, string>> = {};
    if (!f.name.trim()) e.name = "Please enter your name";
    const digits = f.phone.replace(/\D/g, "");
    if (digits.length < 10) e.phone = "Enter a 10-digit WhatsApp number";
    if (!f.thyroid) e.thyroid = "Please choose one";
    if (Object.keys(e).length) {
      setErrs(e);
      setFormErr("Please check the highlighted fields.");
      return;
    }
    setErrs({});
    setFormErr("");
    setBusy(true);

    const firstName = f.name.trim().split(/\s+/)[0] || "";
    const lastName = f.name.trim().split(/\s+/).slice(1).join(" ");
    const phoneDigits = digits.length === 12 ? digits.slice(2) : digits;

    persistUserIdentity({
      ...(firstName && { first_name: firstName }),
      ...(phoneDigits && { phone: phoneDigits }),
    });

    // Same shared-id Lead pattern as the quiz: dataLayer + CAPI carry one id.
    const leadEventId = trackLead({
      ...(firstName && { first_name: firstName }),
      ...(lastName && { last_name: lastName }),
      phone: phoneDigits,
      email: "",
    });
    pushDL({ event: "schedule_lead_captured" });

    const utms = getUtmParams();
    const fbclid = getFbclid();
    const visitorId = getVisitorId();

    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "Lead",
        event_id: leadEventId,
        source_url: window.location.href,
        user_data: {
          first_name: firstName,
          ...(lastName && { last_name: lastName }),
          phone: phoneDigits,
          ...(visitorId && { external_id: visitorId }),
        },
      }),
    }).catch(() => {});

    const leadId = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Same sheet contract as the quiz so the dashboard, cron and WhatsApp
    // sequences read identical headers. Unasked fields post as "" rather than
    // being omitted, so the column mapping can never shift.
    fetch("/api/quiz-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        name: f.name.trim(),
        phone: phoneDigits,
        email: "",
        city: "",
        age: "",
        diagnosis: f.thyroid,
        onMedication: f.thyroid,
        struggleDuration: "",
        symptoms: "",
        biggestChallenge: "",
        triedBefore: "",
        amountSpent: "",
        goal: "",
        commitment: "",
        timing: "",
        source: "schedule_page",
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term,
        ...(fbclid && { fbclid }),
        ...(visitorId && { visitor_id: visitorId }),
      }),
    }).catch(() => {});

    // ── payment: identical to QuizFunnel.payNow ──
    try {
      trackInitiateCheckout();
      pushDL({ event: "schedule_payment_initiated" });

      const orderRes = await fetch("/api/create-cashfree-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          customerPhone: phoneDigits,
          customerName: f.name.trim(),
          customerEmail: "",
          visitorId: getVisitorId(),
          fbc: getFbc(),
          fbp: getFbp(),
        }),
      });
      if (!orderRes.ok) throw new Error("order_failed");

      const { paymentSessionId, orderId, amount } = (await orderRes.json()) as {
        paymentSessionId: string;
        orderId: string;
        amount?: number;
      };

      try {
        const raw = localStorage.getItem(NATIVE_BOOKING_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        localStorage.setItem(NATIVE_BOOKING_KEY, JSON.stringify({ ...obj, orderId, amount }));
      } catch { /* non-critical */ }

      let cashfree = cashfreeRef.current;
      if (!cashfree) {
        const { load } = await import("@cashfreepayments/cashfree-js");
        cashfree = await load({
          mode: process.env.NODE_ENV === "production" ? "production" : "sandbox",
        });
      }
      if (!cashfree) throw new Error("sdk_unavailable");

      const result = await cashfree.checkout({
        paymentSessionId,
        redirectTarget: checkoutRedirectTarget(),
      });

      if (result.error) {
        setFormErr("Payment was not completed. Please try again or use UPI.");
        setBusy(false);
      } else if (result.paymentDetails) {
        window.location.href = `/session-booked?orderId=${orderId}&leadId=${leadId}`;
      } else {
        setFormErr("Payment not completed. Tap the button to try again.");
        setBusy(false);
      }
    } catch (err) {
      console.error(
        "[schedule-payment] embedded checkout unavailable, falling back to hosted form:",
        err instanceof Error ? err.message : String(err),
      );
      window.location.href = CONSULTATION_FORM_URL;
    }
  }, [f, busy]);

  const field: React.CSSProperties = {
    width: "100%", padding: "14px 16px", borderRadius: 10, border: `1px solid ${GRID}`,
    fontSize: 16, color: INK1, background: "#fff", outline: "none",
  };
  const labelCss: React.CSSProperties = {
    display: "block", fontSize: 14, fontWeight: 600, color: INK1, marginBottom: 7,
  };

  return (
    <main style={{ background: BG, minHeight: "100vh", padding: "28px 18px 64px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <p style={{
          fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase",
          color: TEAL, fontWeight: 700, textAlign: "center", marginBottom: 12,
        }}>
          For women 30+ with hypothyroidism
        </p>

        <h1 style={{
          fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(27px,6.6vw,38px)",
          lineHeight: 1.16, color: INK1, textAlign: "center", margin: "0 0 14px", fontWeight: 600,
        }}>
          Schedule your 1-1 thyroid fat loss session
        </h1>

        <p style={{
          fontSize: 16, lineHeight: 1.55, color: INK2, textAlign: "center", margin: "0 0 26px",
        }}>
          60 minutes, one to one with Swapnil. We find what is actually blocking
          your fat loss and what to do about it.
        </p>

        <div style={{
          background: CARD, border: `1px solid ${GRID}`, borderRadius: 16,
          padding: "24px 22px 26px",
        }}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelCss} htmlFor="sch-name">Your name</label>
            <input
              id="sch-name" style={{ ...field, borderColor: errs.name ? CORAL : GRID }}
              value={f.name} onChange={(ev) => set("name", ev.target.value)}
              placeholder="First name" autoComplete="given-name"
            />
            {errs.name && <p style={{ color: CORAL, fontSize: 13, marginTop: 6 }}>{errs.name}</p>}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelCss} htmlFor="sch-phone">WhatsApp number</label>
            <input
              id="sch-phone" style={{ ...field, borderColor: errs.phone ? CORAL : GRID }}
              value={f.phone} onChange={(ev) => set("phone", ev.target.value)}
              placeholder="10-digit mobile" inputMode="numeric" autoComplete="tel"
            />
            {errs.phone && <p style={{ color: CORAL, fontSize: 13, marginTop: 6 }}>{errs.phone}</p>}
            <p style={{ fontSize: 12.5, color: INK2, marginTop: 6 }}>
              Your session details and reminders come here.
            </p>
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={labelCss} htmlFor="sch-thyroid">Your thyroid status</label>
            <select
              id="sch-thyroid" style={{ ...field, borderColor: errs.thyroid ? CORAL : GRID }}
              value={f.thyroid} onChange={(ev) => set("thyroid", ev.target.value)}
            >
              <option value="">Select one</option>
              {THYROID_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {errs.thyroid && <p style={{ color: CORAL, fontSize: 13, marginTop: 6 }}>{errs.thyroid}</p>}
          </div>

          <button
            type="button" onClick={submit} disabled={busy}
            style={{
              width: "100%", padding: "17px 20px", borderRadius: 999, border: "none",
              background: busy ? "#d8a49e" : CORAL, color: "#fff", fontSize: 17,
              fontWeight: 700, cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Opening secure checkout…" : `Schedule My Session — ₹${SESSION_PRICE}`}
          </button>

          {formErr && (
            <p style={{ color: CORAL, fontSize: 13.5, marginTop: 12, textAlign: "center" }}>{formErr}</p>
          )}

          <p style={{ fontSize: 13, color: INK2, marginTop: 16, textAlign: "center", lineHeight: 1.5 }}>
            You pick your slot on the next screen.
          </p>
        </div>

        <div style={{
          marginTop: 18, padding: "16px 18px", background: "#fdf6e4",
          border: `1px solid ${GRID}`, borderRadius: 12,
        }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: INK1, marginBottom: 6 }}>
            Why this session costs ₹{SESSION_PRICE}
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: INK2, margin: 0 }}>
            So the woman in that slot actually turns up, and so I arrive having
            read your answers properly. It is adjusted against your plan if you
            decide to work with me.
          </p>
        </div>
      </div>
    </main>
  );
}
