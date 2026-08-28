/**
 * GET /api/admin/media?id=<whatsapp-media-id>
 *
 * Streams a WhatsApp attachment back to the inbox. Auth: x-admin-key, or the
 * same key as `?k=` — an <img src> cannot send headers, so the query form
 * exists for image tags and new-tab links.
 *
 * Cloud API never delivers bytes in the webhook, only a media id. Fetching one
 * is two hops: exchange the id for a short-lived URL, then download that URL
 * with the same bearer token (it 401s without it). Both hops happen here so the
 * access token never reaches the browser.
 *
 * Nothing is stored. Media ids expire after roughly 30 days, so an old report
 * eventually stops opening — the alternative is copying every client's medical
 * document into our own storage, which is a materially bigger promise to make
 * about health data than passing bytes through.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";

export const dynamic = "force-dynamic";

const GRAPH_VERSION = "v21.0";
const readToken = () => process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

/** Query-key fallback for <img> and target=_blank, which cannot set headers. */
function authorized(req: NextRequest): boolean {
  if (checkAdminKey(req)) return true;
  const expected = process.env.ADMIN_DASH_KEY;
  const given = req.nextUrl.searchParams.get("k");
  return !!expected && !!given && given === expected;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!/^\d{5,}$/.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  const token = readToken();
  if (!token) return NextResponse.json({ error: "whatsapp_not_configured" }, { status: 503 });

  try {
    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!metaRes.ok) {
      // 404 here almost always means the id aged out past ~30 days.
      return NextResponse.json(
        { error: "media_lookup_failed", status: metaRes.status },
        { status: metaRes.status === 404 ? 410 : 502 },
      );
    }
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return NextResponse.json({ error: "no_media_url" }, { status: 502 });

    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!fileRes.ok || !fileRes.body) {
      return NextResponse.json({ error: "media_download_failed", status: fileRes.status }, { status: 502 });
    }

    const mime = meta.mime_type || fileRes.headers.get("content-type") || "application/octet-stream";
    return new NextResponse(fileRes.body, {
      headers: {
        "Content-Type": mime,
        // Client medical documents: cached in her browser only, never on a CDN.
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    console.error("[admin/media] failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "media_error" }, { status: 502 });
  }
}
