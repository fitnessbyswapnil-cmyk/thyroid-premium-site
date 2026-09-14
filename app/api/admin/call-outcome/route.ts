/**
 * POST /api/admin/call-outcome
 *   { bookingUid, attended, checks?: { [key]: boolean }, pricePitched?, occurredAt, name, email, phone }
 *
 * The post-call checklist IS the outcome. One tap records whether she joined,
 * and — when she did — which of the ten checks were done. Both land in the
 * Calls sheet, which is what show-up rate, attendance and "what you fail most
 * on calls" all read (lib/metrics).
 *
 * WHY. Recordings stopped reaching the Calls sheet after 30 Aug, so every call
 * after that had no outcome, and the old "Did she pay?" list only ever filled
 * from recordings — nothing got marked, and the show-up rate was built on
 * three calls.
 *
 * Sends NOTHING to Meta. A payment is still recorded through /api/admin/mark,
 * the one path that sends the programme sale, unchanged.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { writeCall, type CallFields } from "@/lib/crm-calls";
import { SCORECARD_KEYS, type ScorecardKey } from "@/lib/scorecard";

export const dynamic = "force-dynamic";

type Body = {
  bookingUid?: string;
  attended?: boolean;
  checks?: Partial<Record<ScorecardKey, boolean>>;
  pricePitched?: number;
  occurredAt?: string;
  name?: string;
  email?: string;
  phone?: string;
};

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const uid = String(body.bookingUid ?? "").trim();
  if (!uid) return NextResponse.json({ error: "bookingUid required" }, { status: 400 });
  if (typeof body.attended !== "boolean") return NextResponse.json({ error: "attended must be true or false" }, { status: 400 });

  const fields: CallFields = {
    bookingUid: uid,
    writtenAt: new Date().toISOString(),
    occurredAt: String(body.occurredAt ?? ""),
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
    attended: body.attended ? "Y" : "N",
    extractedBy: "checklist (marked by hand)",
  };

  if (body.attended && body.checks) {
    // Only the ten known checks, and only the ones actually answered. An
    // unanswered check is not a miss.
    const answered = SCORECARD_KEYS.filter((k) => typeof body.checks?.[k] === "boolean");
    if (answered.length) {
      const scorecard = Object.fromEntries(answered.map((k) => [k, { passed: !!body.checks![k], evidence: "marked by hand" }]));
      fields.scorecard = JSON.stringify(scorecard);
      fields.scorecardFailed = String(answered.filter((k) => !body.checks![k]).length);
    }
  }
  if (body.attended && Number.isFinite(body.pricePitched) && (body.pricePitched ?? 0) > 0) {
    fields.pricePitched = String(Math.round(body.pricePitched!));
  }

  try {
    const plan = await writeCall(fields);
    if (plan.action === "skip") {
      return NextResponse.json({ ok: false, reason: plan.skipReason ?? "row already reviewed" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, action: plan.action });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
