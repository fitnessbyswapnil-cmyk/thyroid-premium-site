/**
 * The four stable links the WhatsApp template buttons point at:
 *   /webinar/group        → the class's WhatsApp Community invite
 *   /webinar/join         → the live class (Zoom / Meet)
 *   /webinar/replay       → the recording
 *   /webinar/starter-kit  → the Starter Kit PDF
 *
 * Approved templates carry these URLs forever; only the target changes, set in
 * lib/webinar.ts or as a Worker variable of the same name (no deploy needed).
 * Nothing set yet → back to /webinar, never an error page.
 *
 * /webinar/join also reports the click to Meta as WebinarReminderClick: it is
 * the only signal we get that a reminder worked, since the class itself runs
 * off-site. Server-side in after(), keyed per visitor per day so a second tap
 * is not a second event, and never blocking the redirect.
 */
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { resolveWebinarLink, type WebinarLink } from "@/lib/webinar";
import {
  buildUserData,
  getClientIp,
  getCookieFromReq,
  getUserAgent,
  sendCAPIEvent,
} from "@/lib/server-tracking";

/** One WebinarReminderClick per visitor per day. Failures are swallowed. */
function reportJoinClick(req: NextRequest) {
  const visitorId = getCookieFromReq(req, "_visitor_id");
  if (!visitorId) return; // nothing to key on: no event rather than a random one
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const userData = buildUserData({
    externalId: visitorId,
    clientIp: getClientIp(req),
    userAgent: getUserAgent(req),
    fbc: getCookieFromReq(req, "_fbc"),
    fbp: getCookieFromReq(req, "_fbp"),
    country: "in",
  });
  after(async () => {
    try {
      await sendCAPIEvent("WebinarReminderClick", {
        eventId: `wbjoin_${visitorId}_${day}`,
        sourceUrl: "https://www.swapnilumbarkarfitness.in/webinar/join",
        userData,
        customData: { content_name: "thyroid_masterclass" },
      });
    } catch { /* a click report never matters more than the redirect */ }
  });
}

export function redirectTo(kind: WebinarLink) {
  return function GET(req: NextRequest) {
    if (kind === "join") reportJoinClick(req);
    const target = resolveWebinarLink(kind, process.env);
    if (!target) {
      console.warn(`[webinar/${kind}] no target set; sending to /webinar`);
      return NextResponse.redirect(new URL("/webinar", req.url), 302);
    }
    const res = NextResponse.redirect(new URL(target, req.url), 302);
    // The target changes between classes: never let a phone or proxy keep it.
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
}
