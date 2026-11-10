"use client";

/**
 * useAiJob(apiKey, mediaId): start and follow a "read this report" job run by
 * the Claude routine (lib/ai-jobs.ts). It resumes a job already in flight for
 * the same report, polls every 5 s while Claude works, and gives up after 15
 * minutes. start() ignores a second call while one is in flight, so a double
 * tap can never fire the routine twice.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarkersResult } from "@/lib/ai-jobs";

export type AiJobView = {
  id: string;
  kind: string;
  status: "queued" | "running" | "done" | "failed";
  result?: MarkersResult;
  error?: string;
  sessionUrl?: string;
  createdAt?: number;
};

const POLL_MS = 5000;
const GIVE_UP_MS = 15 * 60 * 1000;

export function useAiJob(apiKey: string, mediaId: string) {
  const [job, setJob] = useState<AiJobView | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    if (!apiKey || !mediaId) return;
    let cancelled = false;
    fetch(`/api/admin/ai-jobs?mediaId=${encodeURIComponent(mediaId)}`, { headers: { "x-admin-key": apiKey } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.job) setJob(j.job as AiJobView); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiKey, mediaId]);

  const jobId = job?.id ?? "";
  const working = job?.status === "queued" || job?.status === "running";
  const startedAt = job?.createdAt ?? 0;
  useEffect(() => {
    if (!apiKey || !jobId || !working) return;
    const began = startedAt || Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - began > GIVE_UP_MS) {
        setJob((j) => (j && j.id === jobId ? { ...j, status: "failed", error: "timeout" } : j));
        return;
      }
      try {
        const r = await fetch(`/api/admin/ai-jobs?id=${encodeURIComponent(jobId)}`, { headers: { "x-admin-key": apiKey } });
        if (r.ok) {
          const j = await r.json();
          if (j?.job) setJob(j.job as AiJobView);
        }
      } catch {
        /* the next tick retries */
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [apiKey, jobId, working, startedAt]);

  const start = useCallback(async (mime?: string) => {
    if (inFlight.current || !apiKey || !mediaId) return;
    inFlight.current = true;
    setStarting(true);
    setStartError("");
    try {
      const r = await fetch("/api/admin/ai-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": apiKey },
        body: JSON.stringify({ kind: "report_markers", mediaId, mime }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.job) setJob(j.job as AiJobView);
      else setStartError(j?.detail ? `fire_failed: ${j.detail}` : j?.error || `http_${r.status}`);
    } catch {
      setStartError("network");
    } finally {
      inFlight.current = false;
      setStarting(false);
    }
  }, [apiKey, mediaId]);

  return { job, start, starting, startError };
}
