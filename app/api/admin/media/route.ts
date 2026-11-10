/**
 * GET /api/admin/media?id=<whatsapp-media-id>
 *
 * Streams a WhatsApp attachment back to the inbox. Auth: x-admin-key, or the
 * same key as `?k=` — an <img src> cannot send headers, so the query form
 * exists for image tags and new-tab links.
 *
 * Cloud API never delivers bytes in the webhook, only a media id. Fetching one
 * is two hops (lib/wa-media): exchange the id for a short-lived URL, then
 * download that URL with the same bearer token (it 401s without it). Both hops
 * happen on the server so the access token never reaches the browser.
 *
 * This route stores nothing, and media ids expire after roughly 30 days, so an
 * old attachment eventually stops opening here. The one exception is made on
 * purpose and elsewhere: a funnel lead's report is copied into her folder in
 * the coach's own Drive as it arrives (lib/report-save), because he asked for
 * exactly that, and /privacy says so. Everything else only passes through.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { fetchMediaFile, isMediaId, lookupMedia, whatsappToken } from "@/lib/wa-media";

export const dynamic = "force-dynamic";

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
  if (!isMediaId(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  const token = whatsappToken();
  if (!token) return NextResponse.json({ error: "whatsapp_not_configured" }, { status: 503 });

  try {
    const found = await lookupMedia(id, token);
    if (!found.ok) {
      if (found.error === "no_media_url") return NextResponse.json({ error: "no_media_url" }, { status: 502 });
      // 404 here almost always means the id aged out past ~30 days.
      return NextResponse.json(
        { error: "media_lookup_failed", status: found.status },
        { status: found.status === 404 ? 410 : 502 },
      );
    }

    const fileRes = await fetchMediaFile(found.meta.url, token);
    if (!fileRes.ok || !fileRes.body) {
      return NextResponse.json({ error: "media_download_failed", status: fileRes.status }, { status: 502 });
    }

    const mime = found.meta.mimeType || fileRes.headers.get("content-type") || "application/octet-stream";
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
