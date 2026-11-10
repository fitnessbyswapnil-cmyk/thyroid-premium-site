"use client";

/**
 * useMediaPass(apiKey): a short-lived pass for attachment URLs, refreshed ten
 * minutes before it expires. mediaSrc() builds the URL from it. The admin key
 * never goes into a URL; see lib/media-pass.ts.
 *
 * Client-only on purpose: it must not import lib/media-pass.ts, which pulls in
 * node:crypto. The server sends `ttl`, so the refresh timer does not depend on
 * this device's clock agreeing with the worker's.
 */
import { useEffect, useState } from "react";

export type MediaPass = { exp: number; sig: string };

const REFRESH_EARLY_S = 10 * 60;
const RETRY_MS = 60_000;

export function mediaSrc(mediaId: string, pass: MediaPass): string {
  return `/api/admin/media?id=${encodeURIComponent(mediaId)}&exp=${pass.exp}&sig=${encodeURIComponent(pass.sig)}`;
}

export function useMediaPass(apiKey: string): { pass: MediaPass | null; failed: boolean } {
  const [pass, setPass] = useState<MediaPass | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // No key yet: nothing to fetch. The return below hides any pass left over
    // from a previous key, so no state is set synchronously here.
    if (!apiKey) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/media-pass", { method: "POST", headers: { "x-admin-key": apiKey } });
        if (!res.ok) throw new Error(`media-pass ${res.status}`);
        const j = (await res.json()) as { exp: number; sig: string; ttl?: number };
        if (cancelled) return;
        setPass({ exp: j.exp, sig: j.sig });
        setFailed(false);
        const ttl = typeof j.ttl === "number" ? j.ttl : 3600;
        timer = setTimeout(load, Math.max(30, ttl - REFRESH_EARLY_S) * 1000);
      } catch {
        if (cancelled) return;
        setFailed(true);
        timer = setTimeout(load, RETRY_MS);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [apiKey]);

  return apiKey ? { pass, failed } : { pass: null, failed: false };
}
