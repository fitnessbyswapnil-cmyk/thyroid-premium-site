/**
 * One place for the session's date and time, and everything derived from it.
 *
 * The design said "Thursday 18 September". 18 September 2026 is a FRIDAY, so
 * shipping it would have put a wrong weekday in front of every registrant and
 * in the WhatsApp confirmation. Set to the Thursday before; change the two ISO
 * constants and WEBINAR_WHEN_LONG together and every surface follows —
 * the page, the countdown, both calendar buttons and the WhatsApp template.
 *
 * No imports: node --test loads this file directly.
 */
export const WEBINAR_WHEN_LONG = "Thursday 24 September, 8:00 PM IST";
/** Start time in IST, for the calendar link. */
export const WEBINAR_START_ISO = "2026-09-24T14:30:00.000Z"; // 8:00 PM IST
export const WEBINAR_END_ISO = "2026-09-24T16:00:00.000Z";   // 9:30 PM IST

const IST = "Asia/Kolkata";
/** "Thursday", derived from the start time so it can never disagree with it. */
export const WEBINAR_WEEKDAY = new Date(WEBINAR_START_ISO).toLocaleDateString("en-IN", { weekday: "long", timeZone: IST });
/** "Thursday, 8:00 PM IST": the sticky bar's line. Also derived. */
export const WEBINAR_WHEN_SHORT = `${WEBINAR_WEEKDAY}, ${new Date(WEBINAR_START_ISO).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: IST })} IST`;

export const WEBINAR_TITLE = "Thyroid Fat Loss Masterclass with Swapnil";

/**
 * The approach, named. Used in exactly three places on /webinar: the line
 * under the hero form, the line above the agenda, and the bio. Not a
 * promise of an outcome: it names the three things the class covers — the
 * right tests, the plate, the weekly movement plan — in that order.
 *
 * The page is a general thyroid fat-loss class (owner, 15-Sep-2026): a report
 * helps but is never required, so the name must not make it sound required.
 */
export const WEBINAR_METHOD = "the Test, Plate, Move method";

/**
 * The Thyroid Plate's price inside the programme, shown struck through on the
 * bonus. NULL until the owner confirms the real figure: an invented price on a
 * landing page is a false claim, so the struck line does not render at all
 * while this is null.
 */
export const THYROID_PLATE_PRICE_INR: number | null = null;

/**
 * `value` on CompleteRegistration (Pixel and CAPI). Cost per registration in
 * Ads Manager is spend ÷ count and does not use this; it only fills the
 * conversion value column. 0 until there is a real expected value per
 * registration to put here.
 */
export const WEBINAR_REGISTRATION_VALUE_INR = 0;

/** The WhatsApp Business number the confirmation template is sent from. */
export const WHATSAPP_BUSINESS_NUMBER = "917978460386";

export const WHATSAPP_CONFIRM_TEXT =
  `Hi Swapnil, I have registered for the free Thyroid Fat Loss Masterclass on ${WEBINAR_WHEN_LONG}. Please confirm my seat.`;

/** The event_id both CompleteRegistration legs carry. One per registration. */
export function registrationEventId(leadId: string): string {
  return `CompleteRegistration_${leadId}`;
}

/** Lead ids the register route mints: web_<ms>_<6 base36>. */
export function isRegistrationEventId(id: string): boolean {
  return /^CompleteRegistration_web_\d{10,}_[a-z0-9]{1,12}$/.test(id);
}

// ── Phone ─────────────────────────────────────────────────────────────────────

export type PhoneCheck = { ok: true; phone: string } | { ok: false; error: string };

/**
 * An Indian mobile number, typed however she types it: "98765 43210",
 * "+91 98765-43210", "09876543210". Returns the bare 10 digits.
 */
export function checkIndianMobile(input: string): PhoneCheck {
  let d = String(input ?? "").replace(/\D/g, "");
  if (!d) return { ok: false, error: "Enter your WhatsApp number" };
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10) return { ok: false, error: "Enter all 10 digits of your mobile number" };
  if (!/^[6-9]/.test(d)) return { ok: false, error: "A mobile number in India starts with 6, 7, 8 or 9" };
  return { ok: true, phone: d };
}

// ── Countdown ─────────────────────────────────────────────────────────────────

export type Countdown =
  | { state: "before"; days: number; hours: number; minutes: number }
  | { state: "live" }
  | { state: "ended" };

/** Computed against the fixed start time, so every visitor sees the same clock. */
export function countdownTo(nowMs: number, startIso = WEBINAR_START_ISO, endIso = WEBINAR_END_ISO): Countdown {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (nowMs >= end) return { state: "ended" };
  if (nowMs >= start) return { state: "live" };
  // Round up to the minute, so "0 minutes" never shows before it starts.
  const totalMin = Math.ceil((start - nowMs) / 60000);
  return {
    state: "before",
    days: Math.floor(totalMin / 1440),
    hours: Math.floor((totalMin % 1440) / 60),
    minutes: totalMin % 60,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function formatCountdown(c: Countdown): string {
  if (c.state === "live") return "Live now";
  if (c.state === "ended") return "This session has ended";
  if (c.days > 0) return `Starts in ${plural(c.days, "day")}, ${plural(c.hours, "hour")}`;
  if (c.hours > 0) return `Starts in ${plural(c.hours, "hour")}, ${plural(c.minutes, "minute")}`;
  return `Starts in ${plural(c.minutes, "minute")}`;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

const CAL_DETAILS =
  "If you have a thyroid report (TSH, T3, T4), keep it next to you. The joining link comes on WhatsApp.";

/** 2026-09-24T14:30:00.000Z → 20260917T143000Z */
const calStamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(): string {
  return (
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent(WEBINAR_TITLE) +
    `&dates=${calStamp(WEBINAR_START_ISO)}/${calStamp(WEBINAR_END_ISO)}` +
    "&details=" + encodeURIComponent(CAL_DETAILS)
  );
}

/** RFC 5545. Lines end CRLF; commas and semicolons in text are escaped. */
export function webinarIcs(): string {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Swapnil Umbarkar//Thyroid Masterclass//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:masterclass-${calStamp(WEBINAR_START_ISO)}@swapnilumbarkarfitness.in`,
    `DTSTAMP:${calStamp(WEBINAR_START_ISO)}`,
    `DTSTART:${calStamp(WEBINAR_START_ISO)}`,
    `DTEND:${calStamp(WEBINAR_END_ISO)}`,
    `SUMMARY:${esc(WEBINAR_TITLE)}`,
    `DESCRIPTION:${esc(CAL_DETAILS)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(WEBINAR_TITLE)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
