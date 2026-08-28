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

import { useEffect, useRef, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { pushDL, trackCalcomView, trackViewContent } from "@/app/lib/analytics";
import { getFbc, getFbclid, getFbp, getVisitorId } from "@/lib/tracking";
import { CAL_UI_CONFIG } from "@/lib/cal-theme";

const INK1 = "#241f1a";
const INK2 = "#6b6157";

export default function BookSessionClient() {
  // Idempotency: Cal.com can emit bookingSuccessful more than once per booking.
  const redirected = useRef(false);

  // Booking metadata → rides inside Cal.com's BOOKING_CREATED webhook, which is
  // the only way the server Schedule CAPI can carry HER first-party signals
  // (the webhook request itself is Cal's server calling ours — no cookies).
  //
  // This existed on the old /book page (QualifyingFlow) and was lost when the
  // funnel moved to this page: the live embed sent NO metadata, so every real
  // booking reached Meta with no fbc/fbp/visitor_id — un-attributable to the
  // ad click that produced it. That is why Ads Manager showed 0 results while
  // Cal.com showed real bookings.
  //
  // Computed in an effect, and the embed below only mounts once it is ready:
  // the Cal component snapshots its config when IT mounts, so the metadata has
  // to exist first — and lib/tracking's helpers touch localStorage, which this
  // prerendered page must not do during render. If the _fbc cookie is missing
  // but an fbclid is on record, fbc is reconstructed in Meta's documented
  // fb.1.<ts>.<fbclid> format — Safari regularly drops the cookie while the
  // middleware's _fbclid_raw survives.
  const [calMetadata, setCalMetadata] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    const m: Record<string, string> = {};
    try {
      const visitorId = getVisitorId();
      const fbp = getFbp();
      const fbclid = getFbclid();
      const fbc = getFbc() || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : "");
      if (visitorId) m.visitor_id = visitorId;
      if (fbc) m.fbc = fbc;
      if (fbp) m.fbp = fbp;
    } catch { /* storage blocked — book without signals rather than not at all */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cookie/storage reads are client-only; one deliberate pre-embed tick
    setCalMetadata(m);
  }, []);

  // Standard Meta ViewContent, fired once on arrival at the offer page.
  //
  // It used to live on /book with a deliberate note that it must NOT fire on
  // the homepage, so the ViewContent audience stays qualified. /book now
  // redirects here, which left the event firing on no route at all. Same
  // intent, correct route.
  const viewContentFired = useRef(false);
  useEffect(() => {
    if (viewContentFired.current) return;
    viewContentFired.current = true;
    trackViewContent("book_session");
  }, []);

  // Fired once, when the booker is genuinely on screen AND has rendered.
  //
  // Three conditions, and the third is the one that matters. The wrapper is
  // zero-height until Cal.com's iframe mounts, so visibility alone never
  // satisfies an IntersectionObserver. Watching for the iframe alone is not
  // enough either: at the instant it is appended the wrapper is still ~0px,
  // and every change after that happens INSIDE a cross-origin iframe where a
  // MutationObserver cannot see it — so the observer fires once, too early,
  // and never again.
  //
  // ResizeObserver is the right primitive: the wrapper gaining real height IS
  // the booker becoming visible. If Cal.com never loads, the wrapper never
  // grows and nothing fires, which is correct — a "booker viewed" count that
  // includes broken embeds is worse than no count at all.
  const calcomViewed = useRef(false);
  const bookerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bookerRef.current;
    if (!el) return;

    let inView = false;
    let io: IntersectionObserver | null = null;
    let ro: ResizeObserver | null = null;

    const fireIfReady = () => {
      if (calcomViewed.current) return;
      if (!inView) return;
      if (!el.querySelector("iframe")) return;
      if (el.getBoundingClientRect().height < 40) return;
      calcomViewed.current = true;
      trackCalcomView("book_session");
      io?.disconnect();
      ro?.disconnect();
    };

    io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        fireIfReady();
      },
      { threshold: 0 },
    );
    io.observe(el);

    ro = new ResizeObserver(fireIfReady);
    ro.observe(el);

    return () => {
      io?.disconnect();
      ro?.disconnect();
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
          {calMetadata !== null && (
            <Cal
              namespace="60min"
              calLink="swapnilumbarkarfitness/60min"
              style={{ width: "100%", height: "100%", overflow: "scroll" }}
              config={{ layout: "month_view", ...(Object.keys(calMetadata).length ? { metadata: calMetadata } : {}) }}
            />
          )}
        </div>
      </div>
    </main>
  );
}
