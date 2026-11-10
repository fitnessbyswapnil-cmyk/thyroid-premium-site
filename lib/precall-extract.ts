/**
 * lib/precall-extract.ts — SERVER ONLY (reads ANTHROPIC_API_KEY and the
 * WhatsApp token). Her newest saved blood report, read by Claude into marker
 * rows that PRE-FILL the editable form on her card. He checks every row
 * against the report, fixes what is wrong, and only then generates the PDF.
 *
 * THIS IS THE SEAM lib/precall.ts LEAVES OPEN
 * The composer takes MarkerRow[] from anywhere and does not know this file
 * exists. The rows this reader returns go to the dashboard, never straight
 * into a PDF: they come back to /api/admin/precall as typed rows, after his
 * eyes. And the AI only transcribes values. Every sentence on the PDF is the
 * fixed library text in lib/precall-markers.ts; nothing Claude writes is
 * printed except the marker names, values, ranges and flags it copied.
 *
 * WHERE THE BYTES COME FROM
 * D1 drive_files (lib/report-save newestReportFor) gives her newest saved
 * report's WhatsApp media id, and lib/wa-media downloads it in the usual two
 * hops. The Drive bridge only ever writes, and its protocol does not change
 * for this. WhatsApp keeps a file about 30 days: past that the reader says so
 * and hands back the Drive link, so he can open it and type the values.
 *
 * THE KEY
 * ANTHROPIC_API_KEY on the worker, set by the owner himself. This file reads
 * it, hands it to the SDK and does nothing else with it: it is never logged,
 * never returned, never put in an error. Without it the answer is 412
 * no_ai_key before anything else is touched (no D1 read, no download).
 *
 * THE CALL
 * claude-opus-5-5 with adaptive thinking, structured output (a zod schema
 * through the SDK's parse helper, as lib/call-extract.ts does it), the photo
 * as an image block or the PDF as a document block. Server-side fallbacks are
 * on ("default"), so a policy decline on the requested model is retried on
 * the server's fallback model inside the same call; `model` in the reply
 * names whichever model actually read it. What comes back is kept only when
 * it is a marker the PDF can use: one the library knows, or any other result
 * the report itself flags. An unreadable file is an empty list, never a guess.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { digits10, MAX_FILE_BYTES } from "./drive.ts";
import { cleanMarkerRows, noEmDash, type MarkerRow } from "./precall.ts";
import { libraryEntry, normalizeMarkerName } from "./precall-markers.ts";
import { newestReportFor, type NewestReport } from "./report-save.ts";
import { downloadMedia, whatsappToken, type MediaDownload } from "./wa-media.ts";

/** Pinned here so a change is one line, and the reply names it. */
export const REPORT_MODEL = "claude-opus-5-5";
/** Claude takes an image up to 5 MB; a PDF is bounded by the request and by what the bridge would ever have saved. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = MAX_FILE_BYTES;
/** More rows than this is not a form he will check line by line. */
export const MAX_READ_ROWS = 24;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const PDF_TYPE = "application/pdf";

export const ReportReadSchema = z.object({
  /** What the file is: the reply says so when it is not a report at all. */
  document: z.enum(["blood_report", "not_a_report", "unreadable"]),
  results: z.array(
    z.object({
      marker: z.string(),
      value: z.string(),
      unit: z.string(),
      range: z.string(),
      flag: z.string(),
    }),
  ),
});
export type ReportRead = z.infer<typeof ReportReadSchema>;

const SYSTEM = `You transcribe one blood test report for a thyroid fat-loss coach in India. He checks every row you return against the report before anything is shown to his client, and he never uses a value you did not copy from the page.

Copy, never infer:
- Only results printed on this report. Never estimate, calculate, convert units, round, or fill anything in from memory or from typical ranges.
- marker: the test name exactly as printed, for example "TSH" or "Vitamin D, 25-Hydroxy".
- value: the result exactly as printed, keeping any < or > sign, without the unit.
- unit: the unit printed with that result, or "" when none is printed.
- range: the reference range or interval printed for that result, copied as printed, or "" when none is printed.
- flag: the flag the report itself prints beside that result (for example H, L, High, Low, * or Abnormal), or "" when it prints none. Never decide a flag yourself by comparing the value with the range.

Which results to include:
- Every thyroid test (TSH, T3, T4, free or total, thyroid antibodies), vitamin D, vitamin B12, ferritin and iron, HbA1c and fasting glucose, and the lipid profile (cholesterol, LDL, HDL, triglycerides).
- Any other result only when the report itself flags it as high or low.
- One row per result. Skip headings, methods, comments, interpretation tables and anything that is not a measured result. If the same result is printed twice, return it once.
- When a value cannot be read with confidence, leave that row out.

document: "blood_report" for a lab report; "not_a_report" when the file is something else; "unreadable" when it is a report but too blurred, cropped or dark to read. For the last two, results is an empty list.`;

export type ReportFile = { bytes: Uint8Array; mimeType: string };

type ReportBlock = Anthropic.Beta.Messages.BetaImageBlockParam | Anthropic.Beta.Messages.BetaRequestDocumentBlock;

const baseMime = (m: string) => String(m ?? "").split(";")[0].trim().toLowerCase();

const base64 = (bytes: Uint8Array) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");

/** Her file as Claude reads it: a photo as an image block, a PDF as a document block, anything else null. */
export function reportBlock(file: ReportFile): ReportBlock | null {
  const mime = baseMime(file.mimeType);
  if (mime === PDF_TYPE) {
    return { type: "document", source: { type: "base64", media_type: PDF_TYPE, data: base64(file.bytes) } };
  }
  if (IMAGE_TYPES.has(mime)) {
    return {
      type: "image",
      source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64(file.bytes) },
    };
  }
  return null;
}

/** The whole request, built in one place so the tests can see exactly what is sent. */
export function readerParams(block: ReportBlock) {
  return {
    model: REPORT_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    system: SYSTEM,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "medium" as const, format: betaZodOutputFormat(ReportReadSchema) },
    messages: [
      {
        role: "user" as const,
        // The file first, then the ask, as the API recommends for documents.
        content: [block, { type: "text" as const, text: "Transcribe the results printed on this report." }],
      },
    ],
  } satisfies Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
}

/** All this file needs of the SDK client, so the tests can stand in for it with no network. */
export type ReaderClient = {
  beta: {
    messages: {
      parse(params: ReturnType<typeof readerParams>): PromiseLike<{ parsed_output: unknown; stop_reason: string | null; model: string }>;
    };
  };
};

export class ReaderError extends Error {
  code: "unsupported_report" | "refused" | "no_output";
  constructor(code: ReaderError["code"], detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "ReaderError";
    this.code = code;
  }
}

/** One call to Claude. Throws ReaderError, or whatever the SDK threw. */
export async function readReport(file: ReportFile, client: ReaderClient): Promise<{ read: ReportRead; model: string }> {
  const block = reportBlock(file);
  if (!block) throw new ReaderError("unsupported_report", baseMime(file.mimeType));
  const res = await client.beta.messages.parse(readerParams(block));
  if (res.stop_reason === "refusal") throw new ReaderError("refused");
  // The SDK has already validated against the schema; this holds a stand-in
  // client, or a future SDK, to the same shape.
  const parsed = ReportReadSchema.safeParse(res.parsed_output);
  if (!parsed.success) throw new ReaderError("no_output", res.stop_reason ?? "");
  return { read: parsed.data, model: res.model || REPORT_MODEL };
}

/**
 * What Claude copied, as rows for the form: value and unit joined the way he
 * would type them, cleaned exactly like typed rows (half rows dropped), then
 * only what the PDF can use, each result once.
 */
export function rowsFromRead(read: ReportRead): { rows: MarkerRow[]; leftOut: number } {
  const raw = read.results.map((r) => {
    const value = noEmDash(String(r.value ?? "").trim());
    const unit = noEmDash(String(r.unit ?? "").trim());
    const joined = unit && !value.toLowerCase().includes(unit.toLowerCase()) ? `${value} ${unit}` : value;
    return { marker: r.marker, value: value ? joined : "", range: r.range, flag: r.flag };
  });
  const { rows } = cleanMarkerRows(raw);
  const seen = new Set<string>();
  const usable = rows.filter((r) => {
    if (!libraryEntry(r.marker) && !r.flag) return false;
    const key = `${normalizeMarkerName(r.marker)}|${r.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { rows: usable.slice(0, MAX_READ_ROWS), leftOut: Math.max(0, usable.length - MAX_READ_ROWS) };
}

// ── The whole read, from her number to rows ─────────────────────────────────

/** Everything that leaves the process, so the tests can stand in for each. */
export type ExtractDeps = {
  apiKey: () => string | undefined;
  newest: (phone: string) => Promise<NewestReport | null>;
  token: () => string | undefined;
  download: (mediaId: string, token: string) => Promise<MediaDownload>;
  client: (apiKey: string) => Promise<ReaderClient>;
};

const DEFAULT_DEPS: ExtractDeps = {
  apiKey: () => (process.env.ANTHROPIC_API_KEY ?? "").trim() || undefined,
  newest: (phone) => newestReportFor(phone),
  token: whatsappToken,
  // Wrapped: Workers throw "Illegal invocation" when fetch is called as a method of another object.
  download: (mediaId, token) => downloadMedia(mediaId, token, { maxBytes: MAX_PDF_BYTES, fetchImpl: (i, init) => fetch(i, init) }),
  // Loaded only when a read actually happens, so nothing else pays for it.
  client: async (apiKey) => {
    const { default: Sdk } = await import("@anthropic-ai/sdk");
    return new Sdk({ apiKey, timeout: 120_000, maxRetries: 1 });
  },
};

export type ExtractOutcome = { status: number; body: Record<string, unknown> };

const KIND_WORDS: Record<string, string> = {
  "image/heic": "an iPhone HEIC photo",
  "image/heif": "an iPhone HEIF photo",
  "application/msword": "a Word file",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "a Word file",
  "application/vnd.ms-excel": "an Excel file",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "an Excel file",
  "text/plain": "a text file",
};

const fail = (status: number, error: string, hint: string, extra: Record<string, unknown> = {}): ExtractOutcome => ({
  status,
  body: { error, hint, ...extra },
});

/** Why a call to Claude failed, in words he can act on. Status codes only: the SDK's messages never reach him. */
function aiHint(err: unknown): string {
  if (err instanceof ReaderError) {
    return err.code === "refused"
      ? "The AI would not read this file. Type the values from her report instead."
      : "The AI answered without a readable result. Press it again, or type the values.";
  }
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 401 || status === 403) return "The AI key on the worker was refused. Check ANTHROPIC_API_KEY, or type the values.";
  if (status === 429) return "The AI is busy right now. Wait a minute and press it again.";
  if (typeof status === "number" && status >= 500) return "The AI service is having trouble. Press it again in a minute.";
  if (err instanceof Error && /timeout|timed out/i.test(err.name)) return "The AI took too long to read the report. Press it again.";
  return "The AI could not read her report. Press it again, or type the values.";
}

/**
 * Her newest saved report, read into rows. Every outcome is a status and a
 * body for the route to send as is; nothing here throws.
 */
export async function extractPrecallMarkers(input: { phone: string }, over: Partial<ExtractDeps> = {}): Promise<ExtractOutcome> {
  const d: ExtractDeps = { ...DEFAULT_DEPS, ...over };
  const phone = digits10(input.phone);
  if (phone.length !== 10) return fail(400, "need_phone", "Her phone number is how her saved report is found, and this card has none.");

  const apiKey = d.apiKey();
  if (!apiKey) return fail(412, "no_ai_key", "Add the AI key");

  let report: NewestReport | null;
  try {
    report = await d.newest(phone);
  } catch (err) {
    console.error("[precall/extract] D1 read failed:", err instanceof Error ? err.message : String(err));
    return fail(502, "report_lookup_failed", "Her saved reports could not be looked up just now. Press it again.");
  }
  if (!report) {
    return fail(404, "no_report", "No report from her is saved yet. Reports she sends on WhatsApp are saved to her folder; until one is, type the values.");
  }
  const reportUrl = report.url;
  const extra = { reportUrl, reportCount: report.count };

  const token = d.token();
  if (!token) return fail(503, "whatsapp_not_configured", "WHATSAPP_TOKEN is not set on the worker, so her report cannot be fetched. Open it in Drive and type the values.", extra);

  let got: MediaDownload;
  try {
    got = await d.download(report.mediaId, token);
  } catch (err) {
    console.error("[precall/extract] download failed:", err instanceof Error ? err.message : String(err));
    return fail(502, "report_fetch_failed", "Her report did not download from WhatsApp. Press it again.", extra);
  }
  if (!got.ok) {
    if (got.reason === "media_expired") {
      return fail(404, "no_report", "WhatsApp no longer has the file she sent (it keeps them about 30 days). Open her report in Drive and type the values.", { ...extra, reason: "media_expired" });
    }
    if (got.reason === "too_large") return fail(413, "report_too_large", "Her report is too large for the reader. Open it in Drive and type the values.", extra);
    if (got.reason === "token_rejected") return fail(502, "report_fetch_failed", "WhatsApp refused the access token, so her report could not be fetched. Check it at /api/admin/wa-token-check.", extra);
    return fail(502, "report_fetch_failed", `Her report did not download from WhatsApp${got.status ? ` (HTTP ${got.status})` : ""}. Press it again.`, extra);
  }

  const file: ReportFile = { bytes: got.bytes, mimeType: baseMime(got.mimeType) };
  if (!reportBlock(file)) {
    const kind = KIND_WORDS[file.mimeType] ?? (file.mimeType ? `a ${file.mimeType} file` : "a file of unknown type");
    return fail(415, "unsupported_report", `Her newest report is ${kind}, which the reader cannot open. Open it in Drive and type the values.`, extra);
  }
  if (file.mimeType !== PDF_TYPE && file.bytes.byteLength > MAX_IMAGE_BYTES) {
    return fail(413, "report_too_large", "Her report photo is over 5 MB, too large for the reader. Open it in Drive and type the values.", extra);
  }

  let result: { read: ReportRead; model: string };
  try {
    result = await readReport(file, await d.client(apiKey));
  } catch (err) {
    const status = (err as { status?: unknown } | null)?.status;
    console.error("[precall/extract] AI read failed:", err instanceof ReaderError ? err.code : err instanceof Error ? err.name : "error", typeof status === "number" ? status : "");
    return fail(502, "ai_failed", aiHint(err), extra);
  }

  const { rows, leftOut } = rowsFromRead(result.read);
  const warnings: string[] = [];
  if (report.count > 1) warnings.push(`She has ${report.count} reports saved; this read only the newest. Check the others in her folder.`);
  if (leftOut) warnings.push(`${leftOut} more results were left out. Add any that matter by hand.`);
  const hint = rows.length
    ? "Check every value against her report before you generate."
    : result.read.document === "not_a_report"
      ? "Her newest saved file does not look like a blood report. Type the values instead."
      : result.read.document === "unreadable"
        ? "Her report is too blurred or cropped to read. Type the values instead."
        : "No thyroid, vitamin, sugar or lipid values were found on her report. Type them instead.";
  return {
    status: 200,
    body: { markers: rows, source: "ai", model: result.model, document: result.read.document, hint, warnings, ...extra },
  };
}
