/**
 * GET /api/admin/qualified-check?leadId=…  (or ?phone=… / ?email=…)
 *
 * Read-only. Answers "if this woman booked a slot right now, would the cal
 * webhook send QualifiedSchedule?" by running the webhook's own sheet lookup —
 * no Cal booking, no Meta event, nothing written.
 *
 * It exists because QualifiedSchedule had never fired, and the only other way
 * to prove the fix is to wait for a real qualified client to book.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { QUALIFIED_MIN_SCORE } from "@/lib/booking-lead-score";
import { lookupSheetScore } from "@/lib/booking-lead-score-sheet";

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const who = {
    leadId: (q.get("leadId") ?? "").trim() || undefined,
    phone: (q.get("phone") ?? "").trim() || undefined,
    email: (q.get("email") ?? "").trim() || undefined,
  };
  if (!who.leadId && !who.phone && !who.email) {
    return NextResponse.json({ error: "pass leadId, phone or email" }, { status: 400 });
  }
  try {
    const found = await lookupSheetScore(who);
    return NextResponse.json({
      found: !!found,
      score: found?.score ?? null,
      matchedBy: found?.matchedBy ?? null,
      rows: found?.rows ?? [],
      threshold: QUALIFIED_MIN_SCORE,
      wouldSendQualifiedSchedule: !!found && found.score >= QUALIFIED_MIN_SCORE,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
