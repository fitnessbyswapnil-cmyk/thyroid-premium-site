/**
 * POST /api/lead
 *
 * The authoritative lead-capture endpoint for the qualifying flow. It computes
 * the lead score/tier server-side and writes the FULL row (contact + all answers
 * + UTMs + score + tier) straight to the Leads Google Sheet via the service
 * account — update-or-append by email, idempotent.
 *
 * WHY DIRECT (not the old Make webhook): the previous webhook had detached from
 * its scenario and was silently dropping every lead. Lead capture is the single
 * most important event in the business, so it must not depend on an external
 * webhook that can quietly disconnect. Make still owns what it's good at — the
 * Cal.com "mark Booked" step (matches by email E) and the lifecycle emails — both
 * of which just READ the row this route now writes reliably.
 *
 * FAIL LOUD: a write failure is logged AND (if ALERT_WEBHOOK_URL is set) posted
 * to an alert webhook, and returns 500 — never a silent success.
 */
import { NextRequest, NextResponse } from "next/server";
import { scoreLead, type Answers } from "@/lib/lead-scoring";
import { writeLeadRow, type LeadFields } from "@/lib/lead-sheet";

type LeadPayload = {
  leadId?: string;
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  profession?: string;
  answers?: Answers;
  // attribution (spread at top level by QualifyingFlow)
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  visitor_id?: string;
  [key: string]: unknown;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function arr(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  return typeof v === "string" ? v : "";
}

async function notifyFailure(message: string, detail: unknown) {
  console.error(`[lead] ${message}`, detail);
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 Lead capture failed: ${message}`,
        detail: String(detail),
        at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("[lead] alert webhook also failed", e);
  }
}

export async function POST(req: NextRequest) {
  let payload: LeadPayload;
  try {
    payload = (await req.json()) as LeadPayload;
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const a: Answers = payload.answers ?? {};
  const { score, tier } = scoreLead(a);

  const fields: LeadFields = {
    timestamp: new Date().toISOString(),
    leadId: str(payload.leadId),
    name: str(payload.name) || str(a.name),
    phone: str(payload.phone) || str(a.whatsapp),
    email: str(payload.email) || str(a.email),
    city: str(payload.city) || str(a.city),
    age: "",
    goal: str(a.goal),
    challenge: str(a.challenge),
    diagnosis: str(a.diagnosis),
    medication: str(a.medication),
    duration: str(a.duration),
    profession: str(payload.profession) || str(a.profession),
    tried: arr(a.tried),
    spent: str(a.spent),
    commitment: a.commitment != null ? String(a.commitment) : "",
    timing: str(a.timing),
    investment: str(a.investment),
    decisionMaker: str(a.decisionMaker),
    utm_source: str(payload.utm_source),
    utm_medium: str(payload.utm_medium),
    utm_campaign: str(payload.utm_campaign),
    utm_content: str(payload.utm_content),
    utm_term: str(payload.utm_term),
    fbclid: str(payload.fbclid),
    visitor_id: str(payload.visitor_id),
    leadScore: String(score),
    leadTier: tier,
    status: "lead_captured",
  };

  if (!fields.email && !fields.phone) {
    // Nothing to key or contact on — don't write a junk row, but surface it.
    await notifyFailure("lead payload had no email or phone", { leadId: fields.leadId });
    return NextResponse.json({ error: "Missing email/phone" }, { status: 400 });
  }

  try {
    const result = await writeLeadRow(fields);
    console.log(
      `[lead] ${result.action} ok leadId=${fields.leadId || "(none)"} score=${score} tier=${tier}` +
        (result.addedHeaders.length ? ` addedHeaders=[${result.addedHeaders.join(",")}]` : ""),
    );
    return NextResponse.json({ ok: true, action: result.action, score, tier });
  } catch (err) {
    await notifyFailure("Google Sheets write failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }
}
