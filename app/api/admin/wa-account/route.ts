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

  const [phone, waba, templates, tokenInfo, subscribed, numbers] = await Promise.all([
    get(
      `${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name,quality_rating,` +
        `messaging_limit_tier,status,code_verification_status,name_status,platform_type,throughput`,
      t,
    ),
    // primary_funding_id answers "what pays for this WABA" — the field that
    // proves whether a BSP credit line is still the funding source.
    get(
      `${encodeURIComponent(wabaId)}?fields=name,account_review_status,business_verification_status,` +
        `country,currency,timezone_id,messaging_limit_tier,primary_business_location,ownership_type,` +
        `primary_funding_id`,
      t,
    ),
    get(
      `${encodeURIComponent(wabaId)}/message_templates?fields=name,language,status,category,quality_score,` +
        `rejected_reason&limit=100`,
      t,
    ),
    // Which Meta app minted the sending token, and does it expire? If this
    // reports a BSP's app, detaching the BSP would kill sending.
    get(`debug_token?input_token=${encodeURIComponent(t)}`, t),
    // Every app receiving this WABA's webhooks. More than one = a BSP app is
    // still attached alongside ours.
    get(`${encodeURIComponent(wabaId)}/subscribed_apps`, t),
    // All numbers on the WABA — confirms which numbers share this asset.
    get(
      `${encodeURIComponent(wabaId)}/phone_numbers?fields=display_phone_number,verified_name,` +
        `quality_rating,messaging_limit_tier,status&limit=50`,
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

  // ── BSP-entanglement report ────────────────────────────────────────────
  // Answers the three questions the Business-Manager UI cannot: who minted
  // the sending token, what funds the WABA, and which apps still receive its
  // webhooks. These decide whether detaching a BSP is safe.
  const dbg = (tokenInfo.data as { data?: Record<string, unknown> })?.data ?? {};
  const scopes = Array.isArray(dbg.scopes) ? (dbg.scopes as string[]) : [];
  const expiresAt = typeof dbg.expires_at === "number" ? dbg.expires_at : 0;
  const tokenIdentity = {
    appId: dbg.app_id ?? null,
    appName: dbg.application ?? null,
    type: dbg.type ?? null,
    isValid: dbg.is_valid ?? null,
    // 0 = never expires (system user tokens). Anything else is a future outage.
    expiresAt: expiresAt === 0 ? "never" : new Date(expiresAt * 1000).toISOString(),
    scopes,
    hasWhatsappManagement: scopes.includes("whatsapp_business_management"),
    hasBusinessManagement: scopes.includes("business_management"),
    ...(tokenInfo.ok ? {} : { error: tokenInfo.data }),
  };

  type SubApp = { whatsapp_business_api_data?: { id?: string; name?: string; link?: string } };
  const subApps = ((subscribed.data as { data?: SubApp[] })?.data ?? []).map((s) => ({
    id: s.whatsapp_business_api_data?.id ?? null,
    name: s.whatsapp_business_api_data?.name ?? null,
  }));

  type Num = {
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    messaging_limit_tier?: string;
    status?: string;
  };
  const numberList = ((numbers.data as { data?: Num[] })?.data ?? []).map((n) => ({
    number: n.display_phone_number ?? null,
    verifiedName: n.verified_name ?? null,
    quality: n.quality_rating ?? null,
    tier: n.messaging_limit_tier ?? null,
    status: n.status ?? null,
  }));

  const fundingId = w?.primary_funding_id ?? null;
  if (!waba.ok) {
    // Meta gates WABA-level fields (currency, primary_funding_id, review
    // status) behind BSP access — a normal business app gets code 10 here.
    // That is a permission ceiling, NOT evidence that funding is missing, so
    // it must not be reported as a delivery problem.
    warnings.push(
      "WABA-level fields (currency, funding source, review status) could not be read: Meta restricts them to Business Solution Provider apps. This is a permission limit, not a fault — check funding in Business Manager → Billing instead.",
    );
  } else if (!fundingId) {
    warnings.push(
      "WABA returned no primary_funding_id — nothing is funding this account, so template sends will fail.",
    );
  }
  if (expiresAt !== 0 && expiresAt * 1000 < Date.now() + 14 * 86400_000) {
    warnings.push("The WhatsApp sending token expires within 14 days — replace it with a non-expiring system user token.");
  }
  if (subApps.length > 1) {
    warnings.push(
      `${subApps.length} apps receive this WABA's webhooks (${subApps.map((a) => a.name ?? a.id).join(", ")}) — a BSP app may still be attached alongside your own.`,
    );
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
      currency: w?.currency ?? null,
      ownershipType: w?.ownership_type ?? null,
      primaryFundingId: fundingId,
      accountReviewStatus: w?.account_review_status ?? null,
      businessVerificationStatus: w?.business_verification_status ?? null,
      messagingLimitTier: w?.messaging_limit_tier ?? null,
      ...(waba.ok ? {} : { error: w }),
    },
    numbersOnThisWaba: numberList,
    tokenIdentity,
    subscribedApps: subApps.length ? subApps : { note: "none returned", raw: subscribed.data },
    templates: tplList,
    warnings,
    healthy: warnings.length === 0,
  });
}
