"use client";

import { useEffect } from "react";
import { setCookie } from "@/lib/tracking";

// Captures email/phone/name from any form inputs on the page and persists them
// as first-party cookies so GTM/CAPI can read them server-side even without
// a dataLayer push (e.g., early exits before form submission).
export function InputCookieCapture() {
  useEffect(() => {
    function handleInput() {
      const email =
        (document.querySelector("input[type='email']") as HTMLInputElement)
          ?.value || "";
      const phone =
        (document.querySelector("input[type='tel']") as HTMLInputElement)
          ?.value || "";
      const name =
        (document.querySelector("input[type='text']") as HTMLInputElement)
          ?.value || "";

      if (email || phone) {
        if (email) setCookie("user_email", email);
        if (phone) setCookie("user_phone", phone);
        if (name) setCookie("user_name", name);
      }
    }

    document.addEventListener("input", handleInput);
    return () => document.removeEventListener("input", handleInput);
  }, []);

  return null;
}
