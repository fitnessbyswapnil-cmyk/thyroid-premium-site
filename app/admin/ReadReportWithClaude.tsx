"use client";

/**
 * "Read report with Claude": one button that hands her report to the Claude
 * routine and shows what happens, in the kit's language.
 *   idle      → [Read report with Claude]
 *   working   → progress pill "Claude is reading, about 2 min"
 *   done      → ok pill "N values ready, check them" (onMarkers fires once)
 *   failed    → the button in its failed state, which is the retry, plus why
 *
 * It never sends anything to the client. The values go to the caller, which
 * shows them for the owner to confirm before any PDF is made.
 */
import { useEffect, useRef } from "react";
import { toMarkerRows, type MarkerRow } from "@/lib/marker-rows";
import type { Tokens } from "./tokens";
import { Button, type ButtonVariant } from "./ui/Button";
import { StatusPill } from "./ui/StatusPill";
import { useAiJob } from "./useAiJob";

export function explainAiError(error?: string): string {
  if (!error) return "";
  if (error.includes("claude_routine_not_configured")) return "Claude is not connected yet. The routine token still has to be added on the server.";
  if (error.includes("rate_limit")) return "Claude has had too many requests this hour. Try again in a few minutes.";
  if (error.includes("timeout")) return "Claude took too long. Try again, or type the values.";
  if (error.includes("not readable") || error.includes("not a lab report")) return "Claude could not read this file as a lab report. Type the values instead.";
  if (error.includes("download")) return "Claude could not download the report. WhatsApp may have deleted it; type the values instead.";
  return "Claude could not finish. Try again, or type the values.";
}

export function ReadReportWithClaude({
  t, apiKey, mediaId, mime, onMarkers, variant = "secondary",
}: {
  t: Tokens;
  apiKey: string;
  mediaId: string;
  mime?: string;
  /** Rows in lib/precall.ts's MarkerRow shape, for him to confirm. */
  onMarkers?: (rows: MarkerRow[]) => void;
  variant?: ButtonVariant;
}) {
  const { job, start, starting, startError } = useAiJob(apiKey, mediaId);
  const delivered = useRef<string | null>(null);

  useEffect(() => {
    if (job?.status === "done" && job.result && delivered.current !== job.id) {
      delivered.current = job.id;
      onMarkers?.(toMarkerRows(job.result));
    }
  }, [job, onMarkers]);

  const working = job?.status === "queued" || job?.status === "running";
  const failed = Boolean(startError) || job?.status === "failed";
  const why = explainAiError(startError || (job?.status === "failed" ? job.error : ""));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {working ? (
        <StatusPill t={t} tone="progress">Claude is reading, about 2 min</StatusPill>
      ) : (
        <Button t={t} variant={variant} size="sm" busy={starting} status={failed ? "failed" : undefined} onClick={() => void start(mime)}>
          {job?.status === "done" ? "Read again with Claude" : "Read report with Claude"}
        </Button>
      )}
      {job?.status === "done" && (
        <StatusPill t={t} tone="ok">{`${job.result?.markers.length ?? 0} values ready, check them`}</StatusPill>
      )}
      {failed && why && <span style={{ fontSize: 12, lineHeight: 1.5, color: t.clay }}>{why}</span>}
    </div>
  );
}
