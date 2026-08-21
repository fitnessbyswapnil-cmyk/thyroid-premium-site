"use client";

/**
 * Booking confirmation. She has already chosen a slot and answered the
 * qualification form on Cal.com; this page confirms it and asks for the one
 * thing that actually makes the call work.
 *
 * WHY THERE IS NO PAYMENT STEP ANY MORE:
 * the consultation is free. Rs 299 was only ever a filter, and it filtered for
 * the wrong variable — willingness to spend Rs 299 says nothing about ability
 * to spend Rs 25,000. The Cal.com form's budget and decision-maker questions
 * do that job properly, and asking for her thyroid report does the seriousness
 * filtering at zero cost to booking volume: a time-waster will not go and find
 * a blood report, and a genuine sufferer has hers on her phone.
 *
 * The payment path is NOT deleted, only unrouted. /api/create-cashfree-order,
 * app/lib/pricing.ts and /session-booked are all untouched, so reinstating a
 * paid consultation is a routing change rather than a rebuild.
 */

import { useEffect, useRef, useState } from "react";
import { pushDL, trackSchedule } from "@/app/lib/analytics";
import { persistUserIdentity } from "@/app/components/tracking/UserIdentityTracker";

type Resolved = { leadId: string; name: string; phone: string; email?: string; city?: string; startTime: string };

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
  const scheduleFiredRef = useRef(false);

  useEffect(() => {
    const uid = new URLSearchParams(window.location.search).get("uid") || "";
    if (!uid) { setState("notfound"); return; }

    let cancelled = false;

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

            // ── Advanced matching payload ─────────────────────────────────
            // Meta scores every event on how many identifiers it can match to a
            // real person. Email and phone are the two heaviest, first/last name
            // and city are next, and all four are sitting in her Cal.com answers
            // — so leaving them server-side was costing match quality for free.
            //
            // Pushed BEFORE the Schedule event so a GTM tag reading these as
            // variables has them populated when it fires, not a tick later.
            const nameParts = (data.name || "").trim().split(/\s+/);
            pushDL({
              event: "booking_identity",
              user_email: (data.email || "").trim().toLowerCase() || undefined,
              user_phone: (data.phone || "").replace(/\D/g, "") || undefined,
              user_first_name: (nameParts[0] || "").toLowerCase() || undefined,
              user_last_name: (nameParts.slice(1).join(" ") || "").toLowerCase() || undefined,
              user_city: (data.city || "").trim().toLowerCase() || undefined,
              user_country: "in",
              booking_uid: uid,
            });

            // ── Schedule ──────────────────────────────────────────────────────
            // Fires here, at booking time. /booking-confirmed also fires Schedule
            // but belongs to the pay-first flow, which nothing routes to now — so
            // this is the only browser Schedule on the live funnel, and it is the
            // event the ad set optimises for.
            //
            // event_id is schedule_<uid>, identical to the one /api/cal-webhook
            // sends, so Meta collapses the two legs into a single Schedule.
            //
            // It also decouples Schedule from Cal.com's confirmation step: the
            // webhook only acts on BOOKING_CREATED, which "Requires confirmation"
            // defers until the booking is accepted, sometimes by hours.
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
                    ...(data.email && { email: data.email }),
                    ...(data.city && { city: data.city }),
                  },
                );
              }
            }

            pushDL({ event: "booking_confirmed_free" });
            return;
          }
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 1200));
      }
      if (!cancelled) setState("notfound");
    })();

    return () => { cancelled = true; };
  }, []);

  const wrap: React.CSSProperties = {
    background: "#ffffff", minHeight: "100vh", padding: "36px 18px 72px",
  };

  if (state === "loading") {
    return (
      <main style={wrap}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", paddingTop: 60 }}>
          <p style={{ color: INK2, fontSize: 16 }}>Confirming your slot…</p>
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
  const first = lead?.name ? lead.name.split(/\s+/)[0] : "";

  return (
    <main style={wrap}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <p style={{
          fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase",
          color: "#8a5d12", fontWeight: 700, textAlign: "center", marginBottom: 12,
        }}>
          Your call is booked
        </p>

        <h1 style={{
          fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(26px,6.2vw,36px)",
          lineHeight: 1.18, color: INK1, textAlign: "center", margin: "0 0 14px", fontWeight: 600,
        }}>
          {first ? `${first}, your slot is confirmed` : "Your slot is confirmed"}
        </h1>

        {slot && (
          <div style={{
            background: "#fffdeb", border: "1px solid #f2e9a8", borderRadius: 12,
            padding: "16px 18px", textAlign: "center", marginBottom: 22,
          }}>
            <p style={{ fontSize: 12.5, letterSpacing: "0.1em", textTransform: "uppercase", color: INK2, marginBottom: 6 }}>
              Your session
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, color: INK1, margin: 0 }}>{slot}</p>
            <p style={{ fontSize: 13.5, color: INK2, marginTop: 6 }}>60 minutes · Google Meet · IST</p>
          </div>
        )}

        {/* The one ask. It replaces the Rs 299 as the seriousness filter, and
            unlike a payment wall it makes the call materially better. */}
        {/* The one ask. It replaces the Rs 299 as the seriousness filter, and
            unlike a payment wall it makes the call materially better. */}
        <div style={{
          border: `1px solid ${GRID}`, borderRadius: 12, padding: "18px 20px", marginBottom: 16,
        }}>
          <p style={{ fontSize: 15.5, fontWeight: 700, color: INK1, margin: "0 0 8px" }}>
            One thing before we speak
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: INK2, margin: "0 0 10px" }}>
            Send me your latest thyroid report &mdash; TSH, T3, T4, and anything
            else you have. Reply to the WhatsApp confirmation with a photo of it.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: INK2, margin: 0 }}>
            An older report is fine. No report at all is also fine &mdash; tell me
            that on WhatsApp and we will work from your symptoms instead.
          </p>
        </div>

        {/* Preparation. Lemon wash ties it to the session card above: both are
            "this is your appointment", as against the white cards which are
            "here is information". */}
        <div style={{
          background: "#fffdeb", border: "1px solid #f2e9a8", borderRadius: 12,
          padding: "18px 20px", marginBottom: 16,
        }}>
          <p style={{ fontSize: 15.5, fontWeight: 700, color: INK1, margin: "0 0 12px" }}>
            How to get the most out of the hour
          </p>

          {[
            ["A quiet room.", "Not the car, not the office corridor, not while cooking. You will be talking about things you have not said out loud in years."],
            ["Pen and paper.", "You will want to write down your blocker and what to do about it. People who take notes act on them."],
            ["A strong connection.", "We are on video and I will share your reports on screen. Wifi if you have it."],
            ["Be on time.", "The full sixty minutes is yours only if we start on time."],
          ].map(([head, body]) => (
            <div key={head} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <span aria-hidden="true" style={{
                flex: "none", width: 6, height: 6, borderRadius: 3,
                background: "#8a5d12", marginTop: 8,
              }} />
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: INK2, margin: 0 }}>
                <strong style={{ color: INK1, fontWeight: 700 }}>{head}</strong>{" "}
                {body}
              </p>
            </div>
          ))}
        </div>

        {/* The commitment line. Stated once, plainly, with the reason — a policy
            without a reason reads as rigid; with one it reads as fair. */}
        <div style={{
          borderLeft: `3px solid ${RED}`, background: "#ffffff",
          borderRadius: "0 10px 10px 0", padding: "14px 16px", marginBottom: 16,
        }}>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: INK1, margin: 0, fontWeight: 700 }}>
            This slot will not be rescheduled.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: INK2, margin: "6px 0 0" }}>
            I hold a limited number of these each week and this one is now closed
            to everyone else. If you cannot make it, tell me on WhatsApp before
            the day so someone else can use it.
          </p>
        </div>

        <div style={{
          background: "#ffffff", border: `1px solid ${GRID}`, borderRadius: 12, padding: "16px 18px",
        }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: INK1, marginBottom: 8 }}>
            What happens on the call
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: INK2, margin: 0 }}>
            We go through your reports and your answers, and you leave knowing
            which of the three blockers is holding your fat loss &mdash; and what
            fixing it involves. A written summary follows within 24 hours,
            yours to keep either way.
          </p>
        </div>

        <p style={{ fontSize: 13, color: INK2, marginTop: 18, textAlign: "center", lineHeight: 1.5 }}>
          A calendar invite and a WhatsApp confirmation are on their way. Add it
          to your calendar now, while you are here.
        </p>
      </div>
    </main>
  );
}
