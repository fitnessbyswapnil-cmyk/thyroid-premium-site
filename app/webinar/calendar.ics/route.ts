/**
 * GET /webinar/calendar.ics — the masterclass as a calendar file, for the
 * "Add to Apple Calendar" button. Safari on iPhone opens a text/calendar
 * response straight into the Add Event sheet; other calendars import it too.
 *
 * Built from lib/webinar.ts at build time, so it moves with the date constants.
 */
import { webinarIcs } from "@/lib/webinar";

export const dynamic = "force-static";

export function GET() {
  return new Response(webinarIcs(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="thyroid-masterclass.ics"',
    },
  });
}
