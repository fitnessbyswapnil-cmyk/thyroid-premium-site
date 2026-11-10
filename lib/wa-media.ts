/**
 * lib/wa-media.ts — a WhatsApp attachment, from its media id to its bytes.
 *
 * Cloud API never puts a file in the webhook, only a media id. Getting the
 * file is two hops with the SAME bearer token: exchange the id for a
 * short-lived URL (with the file's mime type and size), then download that
 * URL, which answers 401 without the token. The id stops resolving after about
 * 30 days, and Graph then answers 404.
 *
 * Two callers, so the hops live in one place: the inbox viewer
 * (app/api/admin/media), which streams the file to his browser and keeps
 * nothing, and lib/report-save, which copies a lead's report into her Drive
 * folder while the id still works. The token never leaves the server.
 */

export const GRAPH_VERSION = "v21.0";

/** The first deploy shipped WHATSAPP_TOKEN, the brief said WHATSAPP_ACCESS_TOKEN; both are honoured (as in lib/whatsapp). */
export function whatsappToken(): string | undefined {
  return process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
}

/** Cloud API media ids are numeric. Checked before one is put into a Graph URL. */
export function isMediaId(id: string): boolean {
  return /^\d{5,}$/.test(id);
}

export type MediaMeta = { url: string; mimeType: string; fileSize: number | null };

export type MediaLookup =
  | { ok: true; meta: MediaMeta }
  | { ok: false; error: "media_lookup_failed" | "no_media_url"; status: number };

/** Hop 1: the media id for a short-lived download URL. Throws when the network fails or a 200 is not JSON. */
export async function lookupMedia(id: string, token: string, fetchImpl: typeof fetch = fetch): Promise<MediaLookup> {
  const res = await fetchImpl(`https://graph.facebook.com/${GRAPH_VERSION}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: "media_lookup_failed", status: res.status };
  const j = (await res.json()) as { url?: string; mime_type?: string; file_size?: number | string };
  if (!j.url) return { ok: false, error: "no_media_url", status: res.status };
  const size = j.file_size == null || j.file_size === "" ? NaN : Number(j.file_size);
  return {
    ok: true,
    meta: { url: j.url, mimeType: j.mime_type ?? "", fileSize: Number.isFinite(size) && size >= 0 ? size : null },
  };
}

/** Hop 2: the file itself. Same bearer, or it 401s. */
export function fetchMediaFile(url: string, token: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  return fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
}

export type MediaDownload =
  | { ok: true; bytes: Uint8Array; mimeType: string }
  | {
      ok: false;
      /** media_expired: Graph no longer has it (404/410), which is final. */
      reason: "media_expired" | "token_rejected" | "media_lookup_failed" | "media_download_failed" | "too_large";
      status?: number;
    };

/**
 * Both hops, buffered, for a copy that has to be sent on as a whole.
 *
 * Anything over `maxBytes` is refused as early as it can be: from the size
 * Graph reports, before a byte is downloaded; then from Content-Length; then by
 * counting while reading, so a file that declares neither still cannot fill
 * the worker's memory.
 */
export async function downloadMedia(
  id: string,
  token: string,
  opts: { maxBytes: number; fetchImpl?: typeof fetch },
): Promise<MediaDownload> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const found = await lookupMedia(id, token, fetchImpl);
  if (!found.ok) {
    if (found.status === 404 || found.status === 410) return { ok: false, reason: "media_expired", status: found.status };
    // Every id would fail the same way, so the caller can stop instead of trying the rest.
    if (found.status === 401 || found.status === 403) return { ok: false, reason: "token_rejected", status: found.status };
    return { ok: false, reason: "media_lookup_failed", status: found.status };
  }
  if (found.meta.fileSize !== null && found.meta.fileSize > opts.maxBytes) return { ok: false, reason: "too_large" };

  const res = await fetchMediaFile(found.meta.url, token, fetchImpl);
  if (!res.ok || !res.body) return { ok: false, reason: "media_download_failed", status: res.status };
  const declared = Number(res.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > opts.maxBytes) {
    await res.body.cancel().catch(() => {});
    return { ok: false, reason: "too_large" };
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > opts.maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, reason: "too_large" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return { ok: true, bytes, mimeType: found.meta.mimeType || res.headers.get("content-type") || "" };
}
