/**
 * One place for the session's date and time.
 *
 * The design said "Thursday 18 September". 18 September 2026 is a FRIDAY, so
 * shipping it would have put a wrong weekday in front of every registrant and
 * in the WhatsApp confirmation. Set to the Thursday before; change these three
 * constants together and every surface follows.
 */
export const WEBINAR_WHEN_SHORT = "Thursday 17 Sept · 8 PM IST";
export const WEBINAR_WHEN_LONG = "Thursday 17 September, 8:00 PM IST";
/** Start time in IST, for the calendar link. */
export const WEBINAR_START_ISO = "2026-09-17T14:30:00.000Z"; // 8:00 PM IST
export const WEBINAR_END_ISO = "2026-09-17T16:00:00.000Z";   // 9:30 PM IST
