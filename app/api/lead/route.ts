/**
 * POST /api/lead
 *
 * Receives the FULL qualifying-flow payload (all 12 answers + the silently
 * computed leadScore/band + contact + UTM/source) and forwards it server-side
 * to the Make webhook, which routes it to the Google Sheet for manual review.
 *
 * Why server-side: keeps the webhook URL out of the client bundle and lets us
 * read it from an env var. MAKE_LEAD_WEBHOOK_URL is the configured sink; the
 * constant fallback is the existing live webhook so leads are never lost if the
 * env var hasn't been set yet (it's an endpoint URL, not a secret/credential).
 *
 * The score/band are forwarded for the coach's manual review only — they never
 * gate anything. Every lead is saved; none are rejected on score.
 */
import { NextRequest, NextResponse } from "next/server";

// Existing live Make webhook (already present in the repo). Prefer the env var.
const FALLBACK_WEBHOOK_URL =
  "https://hook.us2.make.com/vafr1x6if1eehv2vxhyfw74ihh3b2nz8";

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as Record<string, unknown>;

    const url = process.env.MAKE_LEAD_WEBHOOK_URL || FALLBACK_WEBHOOK_URL;

    // Superset payload: keep the legacy keys the Make scenario already maps
    // (name/email/phone) AND include the rich qualifying data + score/band.
    const body = {
      ...payload,
      stage: "qualified_free",
      source: "book_qualifying_flow",
      submitted_at: new Date().toISOString(),
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[lead] Make webhook non-OK:", res.status, res.statusText);
      return NextResponse.json({ error: "Upstream webhook failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[lead] FAILED:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to forward lead" }, { status: 500 });
  }
}
