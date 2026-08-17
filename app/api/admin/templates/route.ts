/**
 * /api/admin/templates — list and create WhatsApp templates via the Graph API.
 *
 * WHY THIS EXISTS
 * Templates are scoped to a WhatsApp Business Account, and this business has
 * FOUR WABAs, three of them named identically ("Heal Thyroid With Swapnil").
 * WhatsApp Manager offers no way to tell them apart by name, so a template was
 * created in the wrong account and every send failed with the misleading
 * (#132001) "Template name does not exist in the translation". Creating and
 * listing by explicit WABA ID removes the guesswork — and removes a flaky
 * browser session from a job that is really two HTTPS calls.
 *
 *   GET  ?wabaId=<id>            → templates in that WABA (name, language, status)
 *   POST { wabaId, name?, ... }  → create a template, defaults to blocker_video
 *
 * The production WABA (the one holding +91 79784 60386, payment_reminder,
 * welcome_lead and booking_confirmation) is 864737596644382.
 *
 * Auth: x-admin-key. Requires WHATSAPP_TOKEN with whatsapp_business_management.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";

export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";

/** The account that actually sends — see the header comment. */
// Env-driven so a WABA migration needs only a Vercel variable change, not a
// code deploy. Falls back to the original WABA until WHATSAPP_WABA_ID is set.
const DEFAULT_WABA = process.env.WHATSAPP_WABA_ID || "864737596644382";

/** Canonical blocker_video content, already approved once and verified
 *  character-for-character. Kept here so re-creating it can never drift. */
const BLOCKER_VIDEO_BODY = `Hi {{1}}, Swapnil here 👋

Rashmi was eating less, doing cardio, even intermittent fasting — and her weight still wouldn't move.

On her 1-on-1 consultation call we found the EXACT blocker keeping her weight stuck. She had no idea it existed.

Watch how her call worked, step by step — and see how we'd find YOUR blocker (₹2,000 call, today ₹299):

https://www.swapnilumbarkarfitness.in/how-it-works`;

const BUTTON_TEXT = "Find My Blocker";
const BUTTON_URL = "https://www.swapnilumbarkarfitness.in/how-it-works";

function token(): string | undefined {
  return process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const t = token();
  if (!t) return NextResponse.json({ error: "whatsapp_token_missing" }, { status: 500 });

  const url = new URL(req.url);
  const wabaId = url.searchParams.get("wabaId") || DEFAULT_WABA;
  // ?full=1 also returns each template's components — the body text and any
  // buttons. Needed to answer "what does this message actually say to her",
  // e.g. whether a template hands out a booking link before payment.
  const full = url.searchParams.get("full") === "1";
  try {
    const res = await fetch(
      `${GRAPH}/${encodeURIComponent(wabaId)}/message_templates?fields=name,language,status,category,components&limit=100`,
      { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" },
    );
    const json = (await res.json()) as {
      data?: { name: string; language: string; status: string; category: string; components?: unknown }[];
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      return NextResponse.json({ error: json.error?.message ?? `HTTP ${res.status}` }, { status: 502 });
    }
    const templates = (json.data ?? []).map((d) => ({
      name: d.name,
      language: d.language,
      status: d.status,
      category: d.category,
      ...(full ? { components: d.components } : {}),
    }));
    return NextResponse.json({ wabaId, count: templates.length, templates });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const t = token();
  if (!t) return NextResponse.json({ error: "whatsapp_token_missing" }, { status: 500 });

  let body: {
    wabaId?: string;
    name?: string;
    language?: string;
    category?: string;
    bodyText?: string;
    sample?: string;
    buttonText?: string;
    buttonUrl?: string;
    /** Raw Meta components, passed through verbatim. Used to REPLAY a template
     *  exported from another WABA (GET ?full=1) during a WABA migration —
     *  templates do not migrate with a phone number, so all of them have to be
     *  recreated, and rebuilding them from bodyText/buttonText would silently
     *  drop headers, footers and multi-button layouts. */
    components?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const wabaId = String(body.wabaId ?? DEFAULT_WABA);
  const name = String(body.name ?? "blocker_video").trim();
  if (!/^[a-z0-9_]{3,60}$/.test(name)) {
    return NextResponse.json({ error: "bad_name", hint: "lowercase snake_case" }, { status: 400 });
  }
  // "en" — matching payment_reminder, which is what the sender uses by default.
  const language = String(body.language ?? "en");
  const category = String(body.category ?? "MARKETING").toUpperCase();
  const bodyText = String(body.bodyText ?? BLOCKER_VIDEO_BODY);
  const sample = String(body.sample ?? "Priya");
  const buttonText = String(body.buttonText ?? BUTTON_TEXT);
  const buttonUrl = String(body.buttonUrl ?? BUTTON_URL);

  // Replay path: exact components supplied (a migration restore). Everything
  // below is skipped so nothing is reinterpreted or lost in translation.
  const replay = Array.isArray(body.components) ? (body.components as Record<string, unknown>[]) : null;

  const components: Record<string, unknown>[] = replay ?? [
    {
      type: "BODY",
      text: bodyText,
      // Meta rejects a template with placeholders and no example values.
      ...(bodyText.includes("{{1}}") ? { example: { body_text: [[sample]] } } : {}),
    },
  ];
  // Only when BUILDING. On a replay the exported components already carry
  // their own buttons, and appending the default would duplicate them.
  if (!replay && buttonText && buttonUrl) {
    components.push({
      type: "BUTTONS",
      buttons: [{ type: "URL", text: buttonText, url: buttonUrl }],
    });
  }

  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(wabaId)}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, language, category, components }),
    });
    const json = (await res.json()) as {
      id?: string;
      status?: string;
      category?: string;
      error?: { message?: string; error_user_msg?: string };
    };
    if (!res.ok || json.error) {
      return NextResponse.json(
        { error: json.error?.error_user_msg || json.error?.message || `HTTP ${res.status}`, wabaId, name },
        { status: 502 },
      );
    }
    console.log(`[templates] created ${name} (${language}) in WABA ${wabaId} → ${json.status}`);
    return NextResponse.json({ ok: true, wabaId, name, language, id: json.id, status: json.status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
