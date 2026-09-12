"use client";

import { useState } from "react";

/**
 * The section that answers "ghar mein kaise samjhaun?".
 *
 * This exists because of a pattern in the recorded calls, not because a page
 * looked short: a woman is convinced on the call and then has to re-explain it
 * to a husband or a son who was not on it, from memory, a day later. She loses
 * the argument — not because the case is weak but because the version that
 * reaches the decision-maker is a paraphrase of a paraphrase.
 *
 * So the page hands her the words. Written in FIRST PERSON, as she would say
 * them, and short enough to be read on a phone in one screen. Every line is a
 * fact already on this page: the price, the length, who takes the call, what
 * she leaves with, and the refund term from docs/business-handover.md.
 *
 * The buttons are deliberate. "Copy" is the one that works everywhere. The
 * WhatsApp one opens a share sheet in a NEW tab, so the page she is on is
 * still there when she comes back — this section must not become an exit.
 *
 * Nothing here may drift from the page's own copy: if the price, the duration
 * or the guarantee changes, this changes with it.
 */
const LINES = [
  "It is a ₹299 call, 60 minutes, one to one with the coach himself — not an assistant.",
  "He reads my actual blood report line by line and tells me what is blocking my weight.",
  "I get it written down before the call ends, so I can act on it from that day.",
  "If I finish the call without knowing my blocker, the ₹299 comes back.",
  "If a full programme is the right next step, he shows me what it is and what it costs. I decide after.",
];

const SHARE_TEXT = `${LINES.join("\n\n")}\n\nhttps://www.swapnilumbarkarfitness.in/decode`;

export default function ShareWithFamily() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_TEXT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard is blocked in some in-app browsers (Instagram's especially,
      // which is where a good share of this traffic arrives). Failing silently
      // would look broken, so fall back to selecting the text she can copy by
      // hand instead of pretending it worked.
      const el = document.getElementById("share-with-family-text");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  return (
    <section className="bg-[var(--bg-page)]" aria-labelledby="share-heading">
      <div className="mx-auto w-full max-w-[760px] px-4 py-10 md:px-6 md:py-14">
        <header className="mb-7 text-center">
          <p className="section-label">If you decide with family</p>
          <h2 id="share-heading" className="section-title mx-auto text-balance">
            Send this to whoever you talk it over with
          </h2>
          <p className="mx-auto mt-3 max-w-[46ch] text-[14.5px] leading-[1.6] text-[var(--t3)]">
            Most women here decide with a husband, a son or a daughter. Here it
            is in five lines, so you are not explaining it from memory.
          </p>
        </header>

        <div
          className="rounded-2xl px-5 py-5 md:px-7 md:py-6"
          style={{
            background: "var(--accent-wash)",
            border: "1px solid var(--accent-yellow)",
          }}
        >
          <ul
            id="share-with-family-text"
            className="m-0 flex list-none flex-col gap-3 p-0"
          >
            {LINES.map((line) => (
              <li
                key={line}
                className="relative pl-6 text-[14.5px] leading-[1.6] text-[#14110f]"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-[0.52em] h-2 w-2 rounded-full"
                  style={{ background: "#c8102e" }}
                />
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={copy}
              className="rounded-xl px-4 py-3 text-[14px] font-bold"
              style={{
                background: "#14110f",
                color: "#ffffff",
                border: "1px solid #14110f",
              }}
            >
              {copied ? "Copied" : "Copy these lines"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl px-4 py-3 text-center text-[14px] font-bold"
              style={{
                background: "transparent",
                color: "#14110f",
                border: "1px solid #14110f",
                textDecoration: "none",
              }}
            >
              Send on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
