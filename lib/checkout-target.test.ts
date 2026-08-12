import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRedirectTarget } from "./checkout-target.ts";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
// Chrome for Android with "Desktop site" ticked: desktop UA, ~980px layout,
// but still a touchscreen.
const ANDROID_DESKTOP_MODE =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const IPAD_MASQUERADING =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

test("a phone gets the app-intent path", () => {
  assert.equal(
    pickRedirectTarget({ userAgent: ANDROID, coarsePointer: true, viewportWidth: 412 }),
    "_self",
  );
  assert.equal(
    pickRedirectTarget({ userAgent: IPHONE, coarsePointer: true, viewportWidth: 390 }),
    "_self",
  );
});

// The exact case in the buyer's screenshots: Cashfree served the desktop
// checkout (QR + "Pay by UPI ID") because the browser claimed to be a desktop.
// The touchscreen is what gives her away, so she keeps the app buttons.
test("a phone with Desktop site enabled still gets the app-intent path", () => {
  assert.equal(
    pickRedirectTarget({
      userAgent: ANDROID_DESKTOP_MODE,
      coarsePointer: true,
      viewportWidth: 980,
    }),
    "_self",
  );
});

test("iPadOS masquerading as a Mac is not treated as desktop", () => {
  assert.equal(
    pickRedirectTarget({ userAgent: IPAD_MASQUERADING, coarsePointer: true, viewportWidth: 1024 }),
    "_self",
  );
});

test("a real desktop keeps the in-page modal", () => {
  assert.equal(
    pickRedirectTarget({ userAgent: DESKTOP, coarsePointer: false, viewportWidth: 1440 }),
    "_modal",
  );
});

test("a narrow desktop window falls back to the redirect rather than risk the modal", () => {
  assert.equal(
    pickRedirectTarget({ userAgent: DESKTOP, coarsePointer: false, viewportWidth: 800 }),
    "_self",
  );
});

test("a touch laptop errs towards the redirect", () => {
  assert.equal(
    pickRedirectTarget({ userAgent: DESKTOP, coarsePointer: true, viewportWidth: 1440 }),
    "_self",
  );
});

test("missing signals default to the redirect, never the modal", () => {
  assert.equal(
    pickRedirectTarget({ userAgent: "", coarsePointer: false, viewportWidth: 0 }),
    "_self",
  );
});
