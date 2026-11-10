/**
 * lib/report-save.ts — her blood report, from WhatsApp into her Drive folder.
 *
 * STUB (drive-v2 contract). The report workstream implements this file; the
 * exported names and signatures below are frozen so the other workstreams can
 * build against them in parallel.
 */
export type ReportSaveInput = {
  /** WhatsApp Cloud API media id. */
  mediaId: string;
  phone: string;
  name: string;
  messageId?: string;
  mime?: string;
  filename?: string;
  /** "image" | "document" */
  kind?: string;
  /** ISO time the message arrived. */
  ts?: string;
  /** true on the automatic webhook path: only save for numbers that are funnel leads. */
  requireLead?: boolean;
};

export type ReportSaveResult =
  | { saved: true; url: string; fileId: string; created: boolean }
  | { saved: false; reason: string; hint?: string };

export async function saveReportFromWhatsApp(_input: ReportSaveInput): Promise<ReportSaveResult> {
  return { saved: false, reason: "not_implemented" };
}

/** Saved files by WhatsApp media id — for the inbox's "In Drive" link. */
export async function savedReportsFor(_mediaIds: string[]): Promise<Map<string, { url: string; savedAt: number }>> {
  return new Map();
}

/** Saved reports by phone (key = last 10 digits) — for the "Report" chip on Today. */
export async function savedReportsForPhones(
  _phones: string[],
): Promise<Map<string, { url: string; savedAt: number; count: number }>> {
  return new Map();
}
