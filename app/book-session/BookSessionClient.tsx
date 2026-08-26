"use client";

/**
 * PAY-AT-END step 1. The Cal.com embed, inline on our own domain, so she picks
 * a slot and answers the qualification questions BEFORE any payment is asked.
 *
 * On bookingSuccessful we take the Cal.com booking uid and hand her to
 * /confirm-session?uid=..., which resolves the booking into a lead and confirms
 * it. There is no payment step: the call is free. The uid is the canonical id and is
 * the same value /api/cal-webhook uses for its Schedule event_id, so nothing
 * about tracking dedup changes.
 */

import { useEffect, useRef } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { pushDL, trackCalcomView } from "@/app/lib/analytics";
import { CAL_UI_CONFIG } from "@/lib/cal-theme";

const INK1 = "#241f1a";
const INK2 = "#6b6157";

export default function BookSessionClient() {
  // Idempotency: Cal.com can emit bookingSuccessful more than once per booking.
  const redirected = useRef(false);

  // Fired once, when the booker is genuinely on screen AND has mounted.
  //
  // Two conditions, deliberately. The wrapper has ZERO height until Cal.com's
  // iframe mounts inside it, and a zero-area element can never satisfy an
  // IntersectionObserver threshold — so watching visibility alone means the
  // event never fires. Watching the iframe alone is no better: it would count
  // people who left before scrolling to it.
  //
  // So: IntersectionObserver tracks whether the wrapper is in view, a
  // MutationObserver tracks whether the iframe has arrived, and the event
  // fires on the first moment both are true. If Cal.com fails to load, no
  // iframe ever appears and nothing fires — which is correct. A "booker
  // viewed" count that includes broken embeds is worse than no count.
  const calcomViewed = useRef(false);
  const bookerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bookerRef.current;
    if (!el) return;

    let inView = false;

    const fireIfReady = () => {
      if (calcomViewed.current) return;
      if (!inView) return;
      if (!el.querySelector("iframe")) return;
      if (el.getBoundingClientRect().height < 40) return;
      calcomViewed.current = true;
      trackCalcomView("book_session");
      io.disconnect();
      mo.disconnect();
    };

    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        fireIfReady();
      },
      { threshold: 0 },
    );
    io.observe(el);

    const mo = new MutationObserver(fireIfReady);
    mo.observe(el, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const cal = await getCalApi({ namespace: "60min" });

      // Theme the booker to the site palette so it does not read as a
      // third-party widget dropped onto the page.
      cal("ui", CAL_UI_CONFIG);

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
          before we speak. The call is free — the questions are how I arrive
          already knowing your case.
        </p>

        <div ref={bookerRef} style={{ borderRadius: 14, overflow: "hidden" }}>
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
