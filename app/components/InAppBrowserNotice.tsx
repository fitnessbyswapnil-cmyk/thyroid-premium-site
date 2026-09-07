"use client";

import { useEffect, useState } from "react";

/**
 * WhatsApp, Instagram and Facebook open links inside their own WebView rather
 * than the phone's browser. Two things break there, and both break silently:
 *
 *   1. UPI apps never appear. Cashfree offers GPay/PhonePe/Paytm by handing
 *      the OS an intent:// URL, and a WebView is not allowed to launch one, so
 *      she sees cards and netbanking only and assumes UPI is not supported.
 *   2. The return trip is lost. Even where the intent does fire, the WebView is
 *      often torn down while she is inside the UPI app, so Cashfree's redirect
 *      to /payment-success has nothing to come back to and she never reaches
 *      the slot picker.
 *
 * Neither produces an error. She simply cannot pay the way she pays for
 * everything else, and every ad click arrives this way because Meta's own apps
 * do the same thing.
 *
 * Android exposes an escape hatch: an intent:// URL naming Chrome as the
 * package hands the current page to the real browser. iOS has no equivalent,
 * so there the copy button plus instructions are the whole remedy.
 */
export default function InAppBrowserNotice() {
  const [inApp, setInApp] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    // FBAN/FBAV cover the Facebook and Instagram wrappers; Instagram also
    // brands its own. WhatsApp is the one that matters most here.
    const hit = /WhatsApp|FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|Snapchat/i.test(ua);
    setInApp(hit);
    setIsAndroid(/Android/i.test(ua));
  }, []);

  if (!inApp) return null;

  function openInChrome() {
    const url = window.location.href.replace(/^https?:\/\//, "");
    window.location.href =
      `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
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

      <div className="mt-3 flex flex-wrap gap-2">
        {isAndroid && (
          <button
            type="button"
            onClick={openInChrome}
            className="rounded-full px-4 py-2 text-[13px] font-bold"
            style={{ background: "#78350f", color: "#fff" }}
          >
            Open in Chrome
          </button>
        )}
        <button
          type="button"
          onClick={copyLink}
          className="rounded-full px-4 py-2 text-[13px] font-bold"
          style={{ background: "#fff", color: "#78350f", border: "1.5px solid #fcd34d" }}
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>

      {!isAndroid && (
        <p className="mt-2 text-[12px]" style={{ color: "#92400e" }}>
          Tap the &#8942; or share icon at the top, then &ldquo;Open in browser&rdquo;.
        </p>
      )}
    </div>
  );
}
