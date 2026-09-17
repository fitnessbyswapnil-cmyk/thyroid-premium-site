import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WEBINAR_START_ISO,
  WEBINAR_END_ISO,
  WEBINAR_WHEN_LONG,
  WEBINAR_WHEN_SHORT,
  checkIndianMobile,
  countdownTo,
  formatCountdown,
  googleCalendarUrl,
  isRegistrationEventId,
  registrationEventId,
  webinarIcs,
} from "./webinar.ts";

test("a 9-digit number is refused with a message, not silently padded", () => {
  const r = checkIndianMobile("987654321");
  assert.equal(r.ok, false);
  assert.ok(!r.ok && /10 digits/.test(r.error));
});

test("the ways she types a real number all come back as 10 digits", () => {
  for (const typed of ["9876543210", "98765 43210", "+91 98765-43210", "919876543210", "09876543210"]) {
    assert.deepEqual(checkIndianMobile(typed), { ok: true, phone: "9876543210" }, typed);
  }
});

test("empty, too long, and landline-looking numbers are refused", () => {
  assert.equal(checkIndianMobile("").ok, false);
  assert.equal(checkIndianMobile("98765432101").ok, false);
  assert.equal(checkIndianMobile("5876543210").ok, false);
});

test("the countdown is computed from the fixed start, the same for everyone", () => {
  const start = Date.parse(WEBINAR_START_ISO);
  const c = countdownTo(start - (26 * 60 + 5) * 60000);
  assert.deepEqual(c, { state: "before", days: 1, hours: 2, minutes: 5 });
  assert.equal(formatCountdown(c), "Starts in 1 day, 2 hours");
  assert.equal(formatCountdown(countdownTo(start - 90 * 60000)), "Starts in 1 hour, 30 minutes");
  assert.equal(formatCountdown(countdownTo(start - 30 * 1000)), "Starts in 1 minute");
  assert.deepEqual(countdownTo(start), { state: "live" });
  assert.deepEqual(countdownTo(Date.parse(WEBINAR_END_ISO)), { state: "ended" });
});

test("the display string and the ISO start agree on day and time in IST", () => {
  const d = new Date(WEBINAR_START_ISO);
  const weekday = d.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });
  const day = d.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  assert.ok(WEBINAR_WHEN_LONG.startsWith(`${weekday} ${day} `), WEBINAR_WHEN_LONG);
  assert.ok(WEBINAR_WHEN_LONG.includes(time), `${WEBINAR_WHEN_LONG} vs ${time}`);
  assert.equal(WEBINAR_WHEN_SHORT, `${weekday}, ${time} IST`);
});

test("both calendar buttons carry the real start and end", () => {
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  assert.ok(googleCalendarUrl().includes(`dates=${stamp(WEBINAR_START_ISO)}/${stamp(WEBINAR_END_ISO)}`));
  const ics = webinarIcs();
  assert.ok(ics.includes(`DTSTART:${stamp(WEBINAR_START_ISO)}\r\n`));
  assert.ok(ics.includes(`DTEND:${stamp(WEBINAR_END_ISO)}\r\n`));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
});

test("the thank-you page only accepts an id the register route could have minted", () => {
  const id = registrationEventId("web_1789243000630_7lc1ia");
  assert.equal(id, "CompleteRegistration_web_1789243000630_7lc1ia");
  assert.equal(isRegistrationEventId(id), true);
  assert.equal(isRegistrationEventId("CompleteRegistration_anything"), false);
  assert.equal(isRegistrationEventId(""), false);
  assert.equal(isRegistrationEventId(id + "<script>"), false);
});
