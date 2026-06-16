"use client";

import { useEffect } from "react";
import { pushDL, trackViewContent } from "@/app/lib/analytics";
import QualifyingFlow from "./components/QualifyingFlow";

// ── EMQ capture (Meta CAPI attribution) ──────────────────────────────────────

function useEMQCapture() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const stored = localStorage.getItem("emq_data");
      const emq: Record<string, string> = stored ? JSON.parse(stored) : {};
      const now = String(Date.now());

      if (!emq.session_id) {
        emq.session_id = `${now}-${Math.random().toString(36).slice(2)}`;
      }

      for (const k of [
        "fbclid",
        "gclid",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
      ]) {
        const v = url.searchParams.get(k);
        if (v) {
          emq[k] = v;
          emq[`${k}_ts`] = now;
        }
      }

      emq.last_page = window.location.pathname;
      emq.last_seen = now;
      localStorage.setItem("emq_data", JSON.stringify(emq));
      pushDL({ event: "emq_captured", session_id: emq.session_id });
    } catch {
      // non-critical
    }
  }, []);
}

// ── Page ──────────────────────────────────────────────────────────────────────
// /book is now the full-screen qualifying flow (free session). Intro → 12
// one-per-screen questions (silently scored, no disqualification) → Cal.com
// calendar. The only conversion events on this path are Lead (on completion)
// and Schedule (on booking, via /booking-confirmed). No payment / Purchase /
// InitiateCheckout — the form is the qualifier now, not the ₹199 charge.

export default function BookPageClient() {
  useEMQCapture();

  useEffect(() => {
    // page_view is fired by RouteTracker in layout — only ViewContent here.
    trackViewContent("book");
  }, []);

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden py-12"
      style={{ background: "var(--bg-page)", color: "var(--t1)" }}
    >
      {/* Ambient brand tints */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(ellipse, rgba(168,85,247,0.10) 0%, transparent 70%)" }}
        />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full blur-[110px]" style={{ background: "rgba(168,85,247,0.18)" }} />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full blur-[110px]" style={{ background: "rgba(213,183,101,0.10)" }} />
      </div>

      <div className="relative z-10 w-full">
        <QualifyingFlow />
      </div>
    </main>
  );
}
