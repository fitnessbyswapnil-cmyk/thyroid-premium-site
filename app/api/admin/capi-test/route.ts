/**
 * GET /api/admin/capi-test?code=TEST12345
 *
 * Sends ONE event to Meta's Conversions API carrying a Test Events code, so it
 * shows up only in Events Manager → Test Events and never counts toward ads or
 * reporting. It proves this host can reach Meta with the live pixel id and
 * token — the check that matters after moving hosts — without waiting for a
 * real lead or payment.
 *
 * Refuses any code not shaped like TEST<digits>: without a test code the same
 * call would be a real, counted conversion. Admin-key protected.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { buildUserData, getClientIp, sendCAPIEvent } from "@/lib/server-tracking";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const code = (req.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^TEST\d{3,}$/.test(code)) {
    return NextResponse.json({ error: "code must look like TEST12345" }, { status: 400 });
  }

  const eventId = `capitest_${Date.now()}`;
  const result = await sendCAPIEvent("PageView", {
    eventId,
    sourceUrl: "https://www.swapnilumbarkarfitness.in/decode",
    userData: buildUserData({
      clientIp: getClientIp(req),
      userAgent: req.headers.get("user-agent") ?? "capi-test",
      externalId: eventId,
    }),
    testCode: code,
  });

  return NextResponse.json(
    { eventName: "PageView", eventId, testCode: code, ...result },
    { status: result.success ? 200 : 502 },
  );
}
