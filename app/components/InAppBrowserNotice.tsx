"use client";

import { useEffect, useState } from "react";

/**
 * WhatsApp, Instagram and Facebook open links inside their own WebView rather
 * than the phone's browser, and every ad click arrives that way because Meta's
 * apps do it too. Two things break there, both silently:
 *
 *   1. UPI apps never appear. Cashfree offers GPay/PhonePe/Paytm by handing the
 *      OS an intent:// URL, and a WebView may not launch one, so she sees cards
 *      and netbanking and concludes UPI is not supported.
 *   2. The return trip is lost. Where the intent does fire, the WebView is often
 *      torn down while she is inside the UPI app, so Cashfree's redirect to
 *      /payment-success has nothing to come back to and she never reaches the
 *      slot picker.
 *
 * User-agent sniffing catches the wrappers we know about, and it will miss new
 * ones — a miss is invisible and costs a sale, so the escape hatch is offered
 * on every phone, not only on a positive match. A detected wrapper gets the
 * full warning; everyone else gets one quiet line, which is also the line that
 * helps when apps are missing for some reason we never anticipated.
 *
 * The UPI ID route is the belt to that braces: entering a VPA asks her UPI app
 * for approval instead of launching it, so it works even where intents cannot.
 * It requires UPI Collect to be enabled on the Cashfree account.
 */
export default function InAppBrowserNotice() {
  const [inApp, setInApp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    setInApp(/WhatsApp|FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Twitter|Snapchat|MicroMessenger|GSA\//i.test(ua));
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(ua));
    setIsAndroid(/Android/i.test(ua));
  }, []);

  if (!isMobile) return null;

  function openInBrowser() {
    if (isAndroid) {
      const bare = window.location.href.replace(/^https?:\/\//, "");
      window.location.href = `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`;
    } else {
      void copyLink();
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const Actions = (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={openInBrowser}
        className="rounded-full px-4 py-2 text-[13px] font-bold"
        style={{ background: "#78350f", color: "#fff" }}
      >
        {isAndroid ? "Open in Chrome" : "Copy link for Safari"}
      </button>
      <button
        type="button"
        onClick={copyLink}
        className="rounded-full px-4 py-2 text-[13px] font-bold"
        style={{ background: "#fff", color: "#78350f", border: "1.5px solid #fcd34d" }}
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );

  const UpiHint = (
    <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "#92400e" }}>
      <strong>Or pay without switching apps:</strong> choose UPI on the payment
      page and enter your UPI ID (for example <em>98xxxxxxxx@ybl</em>). The
      request appears inside GPay or PhonePe for you to approve.
    </p>
  );

  // Known wrapper — she cannot pay by UPI here, so say so plainly.
  if (inApp) {
    return (
      <div
        className="mx-auto mb-5 w-full max-w-[560px] rounded-2xl p-4"
        style={{ background: "#fffbeb", border: "1.5px solid #fcd34d" }}
        role="status"
      >
        <p className="text-[14px] font-bold leading-snug" style={{ color: "#78350f" }}>
          To pay with GPay, PhonePe or Paytm, open this page in your browser
        </p>
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "#92400e" }}>
          You are inside an in-app browser, which cannot open UPI apps.
        </p>
        {Actions}
        {UpiHint}
        {!isAndroid && (
          <p className="mt-2 text-[12px]" style={{ color: "#92400e" }}>
            Or tap the share icon at the top, then &ldquo;Open in browser&rdquo;.
          </p>
        )}
      </div>
    );
  }

  // Not detected — she may still be in a wrapper we do not recognise. One quiet
  // line, expandable, so it costs nothing when everything is working.
  return (
    <div className="mx-auto mb-4 w-full max-w-[560px] text-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[13px] font-semibold underline"
        style={{ color: "var(--t3)" }}
      >
        Not seeing GPay or PhonePe?
      </button>
      {open && (
        <div
          className="mt-2 rounded-2xl p-4 text-left"
          style={{ background: "#fffbeb", border: "1.5px solid #fcd34d" }}
        >
          <p className="text-[13px] leading-relaxed" style={{ color: "#92400e" }}>
            If you opened this from WhatsApp or Instagram, UPI apps cannot start
            from there. Open the page in your browser instead.
          </p>
          {Actions}
          {UpiHint}
        </div>
      )}
    </div>
  );
}
