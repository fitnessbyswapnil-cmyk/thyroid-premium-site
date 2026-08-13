/**
 * GET /api/admin/wa-account — what Meta thinks of this WhatsApp account.
 *
 * WHY THIS EXISTS
 * The send API answers "did Meta accept this message", never "will Meta
 * deliver it". Acceptance is cheap: a restricted number, an unverified
 * business, a template with a collapsed quality score, or a messaging tier
 * already spent will all return ok with a message id and then quietly drop the
 * message. Twenty templates went out with zero replies and the owner did not
 * receive his own test send — symptoms that look like a code bug but live
 * entirely on Meta's side of the wire.
 *
 * The three things that actually gate delivery are read here, from the two
 * objects that hold them:
 *   phone number  → quality_rating, messaging_limit_tier, status
 *   WABA          → account_review_status, business verification, any ban
 *   templates     → per-template quality_score and status
 *
 * Nothing here changes state; it is a read-only health report.
 *
 * Auth: x-admin-key. Requires whatsapp_business_management on the token.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";

export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";
const DEFAULT_WABA = "864737596644382";

function token(): string | undefined {
  return process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
}

async function get(path: string, t: string): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(`${GRAPH}/${path}`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const json = await res.json();
    return { ok: res.ok, data: json };
  } catch (err) {
    return { ok: false, data: { error: err instanceof Error ? err.message : String(err) } };
  }
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const t = token();
  if (!t) return NextResponse.json({ error: "whatsapp_token_missing" }, { status: 500 });

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneId) return NextResponse.json({ error: "phone_number_id_missing" }, { status: 500 });

  const wabaId = new URL(req.url).searchParams.get("wabaId") || DEFAULT_WABA;

  const [phone, waba, templates] = await Promise.all([
    get(
      `${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name,quality_rating,` +
        `messaging_limit_tier,status,code_verification_status,name_status,platform_type,throughput`,
      t,
    ),
    get(
      `${encodeURIComponent(wabaId)}?fields=name,account_review_status,business_verification_status,` +
        `country,currency,timezone_id,messaging_limit_tier,primary_business_location,ownership_type`,
      t,
    ),
    get(
      `${encodeURIComponent(wabaId)}/message_templates?fields=name,language,status,category,quality_score,` +
        `rejected_reason&limit=100`,
      t,
    ),
  ]);

  type Tpl = {
    name: string;
    language: string;
    status: string;
    category: string;
    quality_score?: { score?: string };
    rejected_reason?: string;
  };
  const tplList = ((templates.data as { data?: Tpl[] })?.data ?? []).map((d) => ({
    name: d.name,
    language: d.language,
    status: d.status,
    category: d.category,
    // UNKNOWN simply means too few sends to score yet — only RED and YELLOW
    // indicate Meta is actively throttling or about to.
    quality: d.quality_score?.score ?? "UNKNOWN",
    ...(d.rejected_reason && d.rejected_reason !== "NONE" ? { rejectedReason: d.rejected_reason } : {}),
  }));

  const p = phone.data as Record<string, unknown>;
  const w = waba.data as Record<string, unknown>;

  // Plain-language read of the three states that stop delivery, so the caller
  // does not have to know which Meta enum means trouble.
  const warnings: string[] = [];
  const quality = String(p?.quality_rating ?? "");
  if (quality && quality !== "GREEN" && quality !== "UNKNOWN") {
    warnings.push(`Phone quality rating is ${quality} — Meta is throttling delivery to this number.`);
  }
  if (p?.status && String(p.status).toUpperCase() !== "CONNECTED") {
    warnings.push(`Phone status is ${String(p.status)} — the number is not fully live.`);
  }
  const review = String(w?.account_review_status ?? "");
  if (review && review.toUpperCase() !== "APPROVED") {
    warnings.push(`WABA account review status is ${review} — unreviewed accounts are capped hard.`);
  }
  const verification = String(w?.business_verification_status ?? "");
  if (verification && verification.toLowerCase() !== "verified") {
    warnings.push(
      `Business verification is "${verification}" — unverified businesses are limited to 250 business-initiated conversations per day and marketing templates are the first thing dropped.`,
    );
  }
  for (const tpl of tplList) {
    if (tpl.quality === "RED" || tpl.quality === "YELLOW") {
      warnings.push(`Template ${tpl.name} quality is ${tpl.quality} — recipients are blocking or reporting it.`);
    }
  }

  return NextResponse.json({
    phoneNumber: {
      id: phoneId,
      displayNumber: p?.display_phone_number ?? null,
      verifiedName: p?.verified_name ?? null,
      qualityRating: p?.quality_rating ?? null,
      messagingLimitTier: p?.messaging_limit_tier ?? null,
      status: p?.status ?? null,
      nameStatus: p?.name_status ?? null,
      ...(phone.ok ? {} : { error: p }),
    },
    waba: {
      id: wabaId,
      name: w?.name ?? null,
      accountReviewStatus: w?.account_review_status ?? null,
      businessVerificationStatus: w?.business_verification_status ?? null,
      messagingLimitTier: w?.messaging_limit_tier ?? null,
      ...(waba.ok ? {} : { error: w }),
    },
    templates: tplList,
    warnings,
    healthy: warnings.length === 0,
  });
}
