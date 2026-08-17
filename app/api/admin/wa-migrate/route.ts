/**
 * /api/admin/wa-migrate — move +91 79784 60386 onto a WABA that can pay.
 *
 * WHY THIS EXISTS
 * WABA 864737596644382 is permanently unable to hold a payment method: a credit
 * line billed to AiSensy is allocated to it, and Business Manager greys out
 * "Add payment method" with "You can't add a payment method because you're
 * using a shared credit line to pay for ads." Deleting the BSP's own onboarded
 * number did not release it. Only AiSensy or Meta support can deallocate it,
 * and neither is under our control. Meanwhile every TEMPLATE send is accepted
 * by Meta and then silently dropped, so all outbound reach is dead.
 *
 * Moving the number to a WABA that already has a working card fixes that
 * without waiting on anyone. There is no self-serve UI for a WABA-to-WABA
 * migration, so it has to be three Graph calls — which is what this is.
 *
 * WHY AS AN ENDPOINT AND NOT A CURL
 * The token that can do this is a never-expiring system user token that can
 * also deregister numbers and delete templates. It lives in Vercel and should
 * stay there. Running the calls server-side keeps it out of a terminal history
 * and out of screenshots.
 *
 *   GET                    → read-only preflight: is everything ready?
 *   POST {action:"migrate"}  → move the number to destinationWabaId
 *   POST {action:"register"} → re-register it with the 6-digit 2FA PIN
 *   POST {action:"subscribe"}→ point the WABA's webhooks at our app
 *
 * THE ORDER MATTERS AND IS NOT RECOVERABLE IF RUSHED. Migration deregisters the
 * number; it is dark until "register" succeeds, and register needs the PIN. Set
 * a PIN you have written down BEFORE migrating (WhatsApp Manager -> the number
 * -> Settings -> Two-step verification). The preflight refuses to bless a
 * migration until it is told the PIN is in hand.
 *
 * Templates do NOT migrate. Export them first with
 * GET /api/admin/templates?wabaId=<source>&full=1 and replay them into the
 * destination by POSTing each one's `components` verbatim.
 *
 * Auth: x-admin-key. Every mutating call also needs an exact confirm string,
 * so a stray POST cannot move a production number.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { splitPhone, isValidPin, sameWaba } from "@/lib/wa-migrate";

export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";

/** The WABA the number lives on today — the one the credit line has captured. */
const SOURCE_WABA = process.env.WHATSAPP_WABA_ID || "864737596644382";

function token(): string | undefined {
  return process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
}

async function graph(
  path: string,
  t: string,
  init?: { method: "POST"; body: Record<string, unknown> },
): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(`${GRAPH}/${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${t}`,
        ...(init ? { "Content-Type": "application/json" } : {}),
      },
      ...(init ? { body: JSON.stringify(init.body) } : {}),
      cache: "no-store",
    });
    return { ok: res.ok, data: await res.json() };
  } catch (err) {
    return { ok: false, data: { error: err instanceof Error ? err.message : String(err) } };
  }
}

/** Pull Meta's human-readable reason out of whichever field it used this time. */
function reason(data: unknown): string {
  const e = (data as { error?: { error_user_msg?: string; message?: string } })?.error;
  return e?.error_user_msg || e?.message || "";
}

type Num = { id?: string; display_phone_number?: string; verified_name?: string; quality_rating?: string; status?: string };

async function readNumbers(wabaId: string, t: string) {
  const r = await graph(
    `${encodeURIComponent(wabaId)}/phone_numbers?fields=display_phone_number,verified_name,quality_rating,status&limit=50`,
    t,
  );
  const list = ((r.data as { data?: Num[] })?.data ?? []).map((n) => ({
    id: n.id ?? null,
    number: n.display_phone_number ?? null,
    verifiedName: n.verified_name ?? null,
    quality: n.quality_rating ?? null,
    status: n.status ?? null,
  }));
  // An empty array from a FAILED read looks identical to a genuinely empty
  // WABA, and "the destination is empty" is exactly the fact this decision
  // rests on. Never let the caller conflate them.
  return { ok: r.ok, list, ...(r.ok ? {} : { error: r.data }) };
}

// ── Preflight ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const t = token();
  if (!t) return NextResponse.json({ error: "whatsapp_token_missing" }, { status: 500 });

  const url = new URL(req.url);
  const destinationWabaId = url.searchParams.get("destinationWabaId") || "";
  const sourceWabaId = url.searchParams.get("sourceWabaId") || SOURCE_WABA;

  if (!destinationWabaId) {
    return NextResponse.json({ error: "destinationWabaId_required" }, { status: 400 });
  }
  if (sameWaba(sourceWabaId, destinationWabaId)) {
    return NextResponse.json({ error: "destination_same_as_source" }, { status: 400 });
  }

  const [source, dest, destApps, templates] = await Promise.all([
    readNumbers(sourceWabaId, t),
    readNumbers(destinationWabaId, t),
    graph(`${encodeURIComponent(destinationWabaId)}/subscribed_apps`, t),
    graph(`${encodeURIComponent(sourceWabaId)}/message_templates?fields=name,language,status&limit=100`, t),
  ]);

  type Tpl = { name: string; language: string; status: string };
  const tplList = ((templates.data as { data?: Tpl[] })?.data ?? []).map((d) => ({
    name: d.name,
    language: d.language,
    status: d.status,
  }));

  type SubApp = { whatsapp_business_api_data?: { id?: string; name?: string } };
  const destSubApps = ((destApps.data as { data?: SubApp[] })?.data ?? []).map((s) => ({
    id: s.whatsapp_business_api_data?.id ?? null,
    name: s.whatsapp_business_api_data?.name ?? null,
  }));

  // Blockers stop the migration; cautions are things that will need doing
  // afterwards and are cheap to forget in the middle of a stressful change.
  const blockers: string[] = [];
  const cautions: string[] = [];

  if (!source.ok) {
    blockers.push(
      `Cannot read the source WABA ${sourceWabaId}'s phone numbers, so the number to move cannot be confirmed. ${reason(source.error)}`.trim(),
    );
  } else if (!source.list.length) {
    blockers.push(`Source WABA ${sourceWabaId} reports no phone numbers at all — nothing to migrate.`);
  }
  if (!dest.ok) {
    blockers.push(
      `Cannot read the destination WABA ${destinationWabaId}. The token's app is probably not added to it in Business Settings, and migration will fail the same way. ${reason(dest.error)}`.trim(),
    );
  }
  if (dest.ok && !destSubApps.length) {
    cautions.push(
      "No app is subscribed to the destination WABA's webhooks. Inbound messages — and therefore the whole auto-reply system — will go nowhere until you run action:\"subscribe\" after migrating.",
    );
  }
  if (tplList.length) {
    cautions.push(
      `${tplList.length} templates (${tplList.map((x) => x.name).join(", ")}) do NOT migrate with the number. Export them first: GET /api/admin/templates?wabaId=${sourceWabaId}&full=1 — then POST each one's components into the destination.`,
    );
  }
  cautions.push(
    "Migration DEREGISTERS the number. It cannot send or receive until action:\"register\" succeeds, and that needs the 6-digit two-step verification PIN. Set a PIN you have written down BEFORE migrating.",
  );
  cautions.push(
    `After a successful migration, set WHATSAPP_WABA_ID=${destinationWabaId} in Vercel and redeploy, or every admin route keeps reading the old account.`,
  );

  return NextResponse.json({
    sourceWabaId,
    destinationWabaId,
    sourceNumbers: source.list,
    sourceNumbersReadOk: source.ok,
    destinationNumbers: dest.list,
    destinationNumbersReadOk: dest.ok,
    destinationSubscribedApps: destSubApps,
    templatesOnSource: tplList,
    blockers,
    cautions,
    readyToMigrate: blockers.length === 0,
    nextStep: blockers.length
      ? "Clear the blockers above first."
      : `POST here with {"action":"migrate","destinationWabaId":"${destinationWabaId}","phoneNumber":"+91 79784 60386","cc":"91","confirm":"MIGRATE"}`,
  });
}

// ── Mutations ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const t = token();
  if (!t) return NextResponse.json({ error: "whatsapp_token_missing" }, { status: 500 });

  let body: {
    action?: string;
    destinationWabaId?: string;
    sourceWabaId?: string;
    phoneNumber?: string;
    cc?: string;
    phoneNumberId?: string;
    pin?: string;
    wabaId?: string;
    confirm?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const action = String(body.action ?? "");

  // ── migrate ──────────────────────────────────────────────────────────────
  if (action === "migrate") {
    if (body.confirm !== "MIGRATE") {
      return NextResponse.json(
        { error: "confirm_required", hint: 'send "confirm":"MIGRATE" — this moves a live production number' },
        { status: 400 },
      );
    }
    const destinationWabaId = String(body.destinationWabaId ?? "");
    const sourceWabaId = String(body.sourceWabaId ?? SOURCE_WABA);
    if (!destinationWabaId) return NextResponse.json({ error: "destinationWabaId_required" }, { status: 400 });
    if (sameWaba(sourceWabaId, destinationWabaId)) {
      return NextResponse.json({ error: "destination_same_as_source" }, { status: 400 });
    }

    const split = splitPhone(String(body.phoneNumber ?? ""), String(body.cc ?? "91"));
    if ("error" in split) return NextResponse.json({ error: "bad_phone", detail: split.error }, { status: 400 });

    const res = await graph(`${encodeURIComponent(destinationWabaId)}/phone_numbers`, t, {
      method: "POST",
      body: { cc: split.cc, phone_number: split.national, migrate_phone_number: true },
    });
    const data = res.data as { id?: string; success?: boolean };
    if (!res.ok || !data?.id) {
      console.error(`[wa-migrate] migrate FAILED -> WABA ${destinationWabaId}: ${reason(res.data) || "unknown"}`);
      return NextResponse.json(
        {
          error: reason(res.data) || "migration_failed",
          raw: res.data,
          note: "Nothing has moved. The number is still on the source WABA and still working.",
        },
        { status: 502 },
      );
    }
    console.log(`[wa-migrate] migrated +${split.cc}****${split.national.slice(-4)} -> WABA ${destinationWabaId}`);
    return NextResponse.json({
      ok: true,
      phoneNumberId: data.id,
      destinationWabaId,
      warning:
        "The number is now DEREGISTERED and cannot send or receive. Run action:\"register\" with the 6-digit PIN immediately.",
      nextStep: `POST {"action":"register","phoneNumberId":"${data.id}","pin":"<6 digits>","confirm":"REGISTER"}`,
    });
  }

  // ── register ─────────────────────────────────────────────────────────────
  if (action === "register") {
    if (body.confirm !== "REGISTER") {
      return NextResponse.json({ error: "confirm_required", hint: 'send "confirm":"REGISTER"' }, { status: 400 });
    }
    const phoneNumberId = String(body.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? "");
    if (!phoneNumberId) return NextResponse.json({ error: "phoneNumberId_required" }, { status: 400 });
    const pin = String(body.pin ?? "");
    // Checked before sending: a malformed attempt still burns one against
    // Meta's rate limit, and too many lock the number out for hours.
    if (!isValidPin(pin)) {
      return NextResponse.json(
        { error: "bad_pin", hint: "the two-step verification PIN is exactly 6 digits" },
        { status: 400 },
      );
    }

    const res = await graph(`${encodeURIComponent(phoneNumberId)}/register`, t, {
      method: "POST",
      body: { messaging_product: "whatsapp", pin },
    });
    // The PIN is never logged, here or on failure.
    if (!res.ok || !(res.data as { success?: boolean })?.success) {
      console.error(`[wa-migrate] register FAILED for ${phoneNumberId}: ${reason(res.data) || "unknown"}`);
      return NextResponse.json({ error: reason(res.data) || "register_failed", raw: res.data }, { status: 502 });
    }
    console.log(`[wa-migrate] registered ${phoneNumberId}`);
    return NextResponse.json({
      ok: true,
      phoneNumberId,
      nextStep: 'POST {"action":"subscribe","wabaId":"<destination>","confirm":"SUBSCRIBE"} so inbound messages reach the webhook.',
    });
  }

  // ── subscribe ────────────────────────────────────────────────────────────
  if (action === "subscribe") {
    if (body.confirm !== "SUBSCRIBE") {
      return NextResponse.json({ error: "confirm_required", hint: 'send "confirm":"SUBSCRIBE"' }, { status: 400 });
    }
    const wabaId = String(body.wabaId ?? "");
    if (!wabaId) return NextResponse.json({ error: "wabaId_required" }, { status: 400 });

    const res = await graph(`${encodeURIComponent(wabaId)}/subscribed_apps`, t, { method: "POST", body: {} });
    if (!res.ok || !(res.data as { success?: boolean })?.success) {
      return NextResponse.json({ error: reason(res.data) || "subscribe_failed", raw: res.data }, { status: 502 });
    }
    console.log(`[wa-migrate] app subscribed to WABA ${wabaId} webhooks`);
    return NextResponse.json({ ok: true, wabaId });
  }

  return NextResponse.json(
    { error: "unknown_action", hint: 'action must be "migrate", "register" or "subscribe"' },
    { status: 400 },
  );
}
