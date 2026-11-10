/**
 * lib/report-save.ts — her blood report, from WhatsApp into her Drive folder.
 *
 * The owner, Nov 2026: "if they given blood report then with whatsapp api
 * automation report should be downloaded to one of my drive folder".
 *
 * WHY THE MOMENT IT ARRIVES
 * Cloud API hands the webhook a media id, never the file, and the id stops
 * resolving after about 30 days. The inbox fetched the file on demand, so a
 * report was only ever as durable as Meta's copy, while the call it was sent
 * for can be weeks later. So the webhook copies it, inside after(), into her
 * folder ("<Name> · <10 digits>", lib/drive) beside his notes Doc and her
 * summary PDF. The write goes through his Apps Script, like every file this
 * system puts in his Drive (lib/drive says why the service account cannot).
 *
 * WHOSE REPORTS
 * On the automatic path, funnel leads only: a number on the Leads sheet. The
 * WhatsApp number is public and the coaching app's clients use it too, so
 * "anyone who sends an image" would turn a stranger's photo into a folder in
 * his Drive. The check reads two columns, Name and Phone, the way the payment
 * webhook and the Cal.com score lookup do, never the whole grid: this runs in
 * the webhook's after(), which Cloudflare stops 30 s after the response, and
 * whole-sheet reads take 3-9 s on the worker and are what trips the 10 ms CPU
 * limit. "Save to Drive" (he pressed it) skips the check; the backfill makes
 * one read for every candidate.
 *
 * ONCE
 * D1 drive_files (migrations/0005) holds one row per media id. Already there:
 * its link comes back and nothing is downloaded. The script also dedupes on
 * `wa:<mediaId>` in the file's description, so a save whose D1 write was lost
 * still never lands in her folder twice.
 *
 * PRIVACY
 * D1 gets the SHA-256 of "p:" + her digits, never the number, and never the
 * file: the bytes go from Meta to his Drive and nowhere else. Nothing here
 * logs her number.
 *
 * NEVER THROWS
 * Every outcome is a result. The webhook must answer Meta 200, and storing her
 * message must never depend on Drive.
 */
import { getLedgerDb, type D1Database } from "./ledger.ts";
import { hashKey } from "./journey-store.ts";
import { liveBridgeConfig } from "./bridge-settings.ts";
import {
  BridgeError, MAX_FILE_BYTES, bridgeHint, digits10, istDate, saveClientFile, type ResolvedBridgeConfig,
} from "./drive.ts";
import { downloadMedia, isMediaId, whatsappToken } from "./wa-media.ts";
import type { WaMessage } from "./wa-messages.ts";

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

/** Everything that leaves the process, so the tests can stand in for each. */
export type ReportSaveDeps = {
  /** The two Graph hops and the bridge. */
  fetchImpl: typeof fetch;
  /** D1, or null off Cloudflare (then nothing is remembered, and the script's dedupe still holds). */
  db: () => Promise<D1Database | null>;
  /** Funnel leads: last 10 digits to the newest name on her rows ("" when none). */
  leads: () => Promise<Map<string, string>>;
  config: () => Promise<ResolvedBridgeConfig>;
  token: () => string | undefined;
  now: () => number;
};

const DEFAULT_DEPS: ReportSaveDeps = {
  // Wrapped: Workers throw "Illegal invocation" when fetch is called as a method of another object.
  fetchImpl: (input, init) => fetch(input, init),
  db: getLedgerDb,
  leads: () => readFunnelLeads(),
  config: liveBridgeConfig,
  token: whatsappToken,
  now: () => Date.now(),
};

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

// ── Names ───────────────────────────────────────────────────────────────────

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
};

const baseMime = (m: string | undefined) => String(m ?? "").split(";")[0].trim().toLowerCase();

/**
 * "Report · <IST date she sent it> · <her file's name, or photo><extension>".
 *
 * WhatsApp photos carry no name, so they are "photo". The extension follows
 * the file's real type, so "scan.jpeg" sent as a JPEG is "scan.jpg" and a PDF
 * she named "TSH" still opens as one. The name is capped so the extension
 * survives the bridge's 120-character limit. No date when the time is unknown:
 * "undated" rather than filed under a day she did not send it (lib/drive).
 */
export function reportFileName(input: { ts?: string; filename?: string; mime?: string }): string {
  const original = String(input.filename ?? "").replace(/[\\/\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  const m = /^(.*?)(\.[A-Za-z0-9]{1,5})?$/.exec(original);
  const stem = (m?.[1] ?? original).trim().slice(0, 80) || "photo";
  const ext = MIME_EXT[baseMime(input.mime)] ?? (m?.[2] ?? "").toLowerCase();
  return `Report · ${istDate(input.ts ?? "")} · ${stem}${ext}`;
}

const MEDIA_KINDS = new Set(["image", "document", "audio", "video", "sticker"]);

function mediaKind(kind: string | undefined, mime: string): string {
  const k = String(kind ?? "").trim().toLowerCase();
  if (MEDIA_KINDS.has(k)) return k;
  return mime.startsWith("image/") ? "image" : "document";
}

// ── Funnel leads ────────────────────────────────────────────────────────────

/** The sheet hands numbers back as "9876543210.0"; read the way lib/lead-sheet's matcher does. */
const sheetPhone10 = (v: string) => String(v ?? "").replace(/\.0$/, "").replace(/\D/g, "").slice(-10);

/**
 * PURE. The Leads sheet's Name and Phone columns (header at index 0) to a map
 * of last 10 digits to her newest non-empty name. One woman is routinely
 * several rows, written by the quiz, the payment webhook and the Cal.com
 * scenario; the newest row carries the freshest details (as lib/metrics).
 */
export function leadsFromColumns(names: string[], phones: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 1; i < phones.length; i++) {
    const phone = sheetPhone10(phones[i]);
    if (phone.length !== 10) continue;
    out.set(phone, String(names[i] ?? "").trim() || out.get(phone) || "");
  }
  return out;
}

/**
 * Every funnel lead's number and name, from two columns of the Leads sheet.
 * Every writer (quiz, webinar, booking, payment) puts the phone in the column
 * the payment webhook matches on, and the name in the one the welcome email
 * reads, so both come from lib/lead-sheet rather than from a header search.
 * Imported lazily: lib/lead-sheet and the admin Sheets client load googleapis,
 * which the unit tests never need.
 */
export async function readFunnelLeads(): Promise<Map<string, string>> {
  const [{ getSheetsClient }, { LEAD_COLUMNS, MATCH_COLUMNS, SHEET_NAME, colLetter }] = await Promise.all([
    import("@/app/api/admin/_lib"),
    import("@/lib/lead-sheet"),
  ]);
  const nameAt = LEAD_COLUMNS.find((c) => c.key === "name")?.pin;
  if (nameAt == null) throw new Error("lib/lead-sheet no longer pins the Name column");
  const wanted = [nameAt, MATCH_COLUMNS.phone];
  const { sheets, sheetId } = await getSheetsClient();
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    majorDimension: "COLUMNS",
    ranges: wanted.map((i) => `${SHEET_NAME}!${colLetter(i)}:${colLetter(i)}`),
  });
  // valueRanges come back in the order the ranges were asked for.
  const [names, phones] = wanted.map((_, k) =>
    ((res.data.valueRanges?.[k]?.values?.[0] as unknown[] | undefined) ?? []).map((v) => String(v ?? "")),
  );
  return leadsFromColumns(names, phones);
}

// ── D1 ──────────────────────────────────────────────────────────────────────

/** Same schema as migrations/0005_drive_files.sql (a test holds the two together). */
export const DRIVE_FILES_DDL = [
  `CREATE TABLE IF NOT EXISTS drive_files (
    media_id   TEXT PRIMARY KEY,
    phone_key  TEXT NOT NULL,
    kind       TEXT NOT NULL,
    file_id    TEXT NOT NULL,
    url        TEXT NOT NULL,
    saved_at   INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_drive_files_phone ON drive_files (phone_key)",
];

/** D1 caps bound parameters per query at 100. */
const IN_CHUNK = 50;

const ready = new WeakSet<D1Database>();

/**
 * Once per isolate (per binding), so the feature works before the migration
 * is applied. A failure is not remembered: the next call tries again.
 */
async function ensureTable(db: D1Database): Promise<void> {
  if (ready.has(db)) return;
  await db.batch(DRIVE_FILES_DDL.map((sql) => db.prepare(sql)));
  ready.add(db);
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const params = (n: number) => Array.from({ length: n }, (_, i) => `?${i + 1}`).join(", ");

async function savedFile(db: D1Database, mediaId: string): Promise<{ file_id: string; url: string } | null> {
  await ensureTable(db);
  return db
    .prepare("SELECT file_id, url FROM drive_files WHERE media_id = ?1 AND url <> ''")
    .bind(mediaId)
    .first<{ file_id: string; url: string }>();
}

async function recordSaved(
  db: D1Database,
  row: { mediaId: string; phoneKey: string; kind: string; fileId: string; url: string; at: number },
): Promise<void> {
  await ensureTable(db);
  await db
    .prepare(
      `INSERT INTO drive_files (media_id, phone_key, kind, file_id, url, saved_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(media_id) DO UPDATE SET phone_key = ?2, kind = ?3, file_id = ?4, url = ?5, saved_at = ?6`,
    )
    .bind(row.mediaId, row.phoneKey, row.kind, row.fileId, row.url, row.at)
    .run();
}

/** A media id that can never be saved, so the backfill stops spending a call on it. Never downgrades a saved row. */
async function recordSkip(db: D1Database, row: { mediaId: string; phoneKey: string; reason: string; at: number }): Promise<void> {
  await ensureTable(db);
  await db
    .prepare(
      `INSERT INTO drive_files (media_id, phone_key, kind, file_id, url, saved_at) VALUES (?1, ?2, ?3, '', '', ?4)
       ON CONFLICT(media_id) DO UPDATE SET kind = ?3, saved_at = ?4 WHERE drive_files.url = ''`,
    )
    .bind(row.mediaId, row.phoneKey, `skip:${row.reason}`, row.at)
    .run();
}

/** Media ids with any row, saved or skipped: what the backfill has finished with. */
async function finishedMediaIds(db: D1Database, mediaIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = [...new Set(mediaIds.filter(Boolean))];
  if (!ids.length) return out;
  await ensureTable(db);
  for (const part of chunks(ids, IN_CHUNK)) {
    const res = await db
      .prepare(`SELECT media_id FROM drive_files WHERE media_id IN (${params(part.length)})`)
      .bind(...part)
      .all<{ media_id: string }>();
    for (const r of res.results) out.add(r.media_id);
  }
  return out;
}

const logged = (what: string) => (err: unknown) => {
  console.error(`[report-save] ${what} failed:`, errText(err));
  return null;
};

// ── Save one ────────────────────────────────────────────────────────────────

/** Final for this media id: recorded, so the backfill does not retry it. */
const PERMANENT = new Set(["media_expired", "too_large"]);

const HINTS: Record<string, string> = {
  bad_input: "A WhatsApp media id and her 10-digit number are needed.",
  not_a_lead: "Her number is not on the Leads sheet, so this was not saved automatically. “Save to Drive” keeps it.",
  whatsapp_not_configured: "WHATSAPP_TOKEN is not set on the worker, so the file cannot be fetched from WhatsApp.",
  token_rejected: "WhatsApp refused the access token. Check it at /api/admin/wa-token-check.",
  media_expired: "WhatsApp no longer has this file. It keeps them for about 30 days, so ask her to send it again.",
  media_lookup_failed: "WhatsApp would not look the file up. Press it again.",
  media_download_failed: "The file did not download from WhatsApp. Press it again.",
};

/** Meta's status is worth showing only where the hint cannot already say what went wrong. */
const SHOW_STATUS = new Set(["media_lookup_failed", "media_download_failed"]);

function failed(reason: string, status?: number): ReportSaveResult {
  if (reason === "too_large") return { saved: false, reason, hint: bridgeHint(new BridgeError("too_large")) };
  const hint = HINTS[reason] ?? reason;
  return { saved: false, reason, hint: status && SHOW_STATUS.has(reason) ? `${hint} (HTTP ${status})` : hint };
}

/**
 * Her report into her Drive folder. `deps` exists for the tests; every caller
 * in the app passes only the input.
 */
export async function saveReportFromWhatsApp(
  input: ReportSaveInput,
  deps: Partial<ReportSaveDeps> = {},
): Promise<ReportSaveResult> {
  const d: ReportSaveDeps = { ...DEFAULT_DEPS, ...deps };
  try {
    return await saveOne(input, d);
  } catch (err) {
    logged("save")(err);
    return { saved: false, reason: "error", hint: `Saving failed: ${errText(err)}` };
  }
}

async function saveOne(input: ReportSaveInput, d: ReportSaveDeps): Promise<ReportSaveResult> {
  const mediaId = String(input.mediaId ?? "").trim();
  const phone = digits10(input.phone);
  if (!isMediaId(mediaId) || phone.length !== 10) return failed("bad_input");

  const cfg = await d.config();
  if (cfg.missing.length) {
    return { saved: false, reason: "not_configured", hint: bridgeHint(new BridgeError("not_configured", cfg.missing.join(", "))) };
  }

  // Already in her folder: hand back the link and download nothing. Webhook
  // redeliveries and a second press of the button both end here.
  const db = await d.db();
  if (db) {
    const prior = await savedFile(db, mediaId).catch(logged("D1 read"));
    if (prior) return { saved: true, url: prior.url, fileId: prior.file_id, created: false };
  }

  let name = input.name;
  if (input.requireLead) {
    let leads: Map<string, string>;
    try {
      leads = await d.leads();
    } catch (err) {
      // Unconfirmed is not a lead. The backfill retries it once the sheet answers.
      logged("Leads sheet read")(err);
      return { saved: false, reason: "lead_check_failed", hint: `Could not read the Leads sheet: ${errText(err)}` };
    }
    if (!leads.has(phone)) return failed("not_a_lead");
    // The name she typed into the funnel, over her WhatsApp profile name: when
    // this save creates her folder, it should read as his notes and her summary will.
    name = leads.get(phone) || input.name;
  }

  const token = d.token();
  if (!token) return failed("whatsapp_not_configured");

  const at = d.now();
  const phoneKey = await hashKey(`p:${phone}`);
  const got = await downloadMedia(mediaId, token, { maxBytes: MAX_FILE_BYTES, fetchImpl: d.fetchImpl });
  if (!got.ok) {
    if (db && PERMANENT.has(got.reason)) await recordSkip(db, { mediaId, phoneKey, reason: got.reason, at }).catch(logged("D1 write"));
    return failed(got.reason, got.status);
  }

  const mimeType = baseMime(got.mimeType) || baseMime(input.mime) || "application/octet-stream";
  let file: { id: string; url: string; created: boolean };
  try {
    file = await saveClientFile(
      {
        name,
        phone,
        fileName: reportFileName({ ts: input.ts, filename: input.filename, mime: mimeType }),
        mimeType,
        // A view of the downloaded bytes, not a copy: a report can be 20 MB.
        base64: Buffer.from(got.bytes.buffer, got.bytes.byteOffset, got.bytes.byteLength).toString("base64"),
        dedupeKey: `wa:${mediaId}`,
      },
      cfg,
      { fetchImpl: d.fetchImpl },
    );
  } catch (err) {
    if (!(err instanceof BridgeError)) throw err;
    if (db && err.code === "too_large") await recordSkip(db, { mediaId, phoneKey, reason: err.code, at }).catch(logged("D1 write"));
    return { saved: false, reason: err.code, hint: bridgeHint(err) };
  }

  // The file is in her folder whatever happens next. A lost row costs one
  // repeat download later, never a second file.
  if (db) {
    await recordSaved(db, { mediaId, phoneKey, kind: mediaKind(input.kind, mimeType), fileId: file.id, url: file.url, at })
      .catch(logged("D1 write"));
  }
  return { saved: true, url: file.url, fileId: file.id, created: file.created };
}

// ── Read back ───────────────────────────────────────────────────────────────

type DbDeps = { db?: () => Promise<D1Database | null> };

/** Saved files by WhatsApp media id — for the inbox's "In Drive" link. */
export async function savedReportsFor(
  mediaIds: string[],
  deps: DbDeps = {},
): Promise<Map<string, { url: string; savedAt: number }>> {
  const out = new Map<string, { url: string; savedAt: number }>();
  const ids = [...new Set(mediaIds.map((s) => String(s ?? "").trim()).filter(Boolean))];
  if (!ids.length) return out;
  try {
    const db = await (deps.db ?? getLedgerDb)();
    if (!db) return out;
    await ensureTable(db);
    for (const part of chunks(ids, IN_CHUNK)) {
      const res = await db
        .prepare(`SELECT media_id, url, saved_at FROM drive_files WHERE url <> '' AND media_id IN (${params(part.length)})`)
        .bind(...part)
        .all<{ media_id: string; url: string; saved_at: number }>();
      for (const r of res.results) out.set(r.media_id, { url: r.url, savedAt: Number(r.saved_at) });
    }
  } catch (err) {
    logged("D1 read")(err);
  }
  return out;
}

/** Saved reports by phone (key = last 10 digits) — for the "Report" chip on Today. */
export async function savedReportsForPhones(
  phones: string[],
  deps: DbDeps = {},
): Promise<Map<string, { url: string; savedAt: number; count: number }>> {
  const out = new Map<string, { url: string; savedAt: number; count: number }>();
  const unique = [...new Set(phones.map(digits10).filter((p) => p.length === 10))];
  if (!unique.length) return out;
  try {
    const db = await (deps.db ?? getLedgerDb)();
    if (!db) return out;
    const byKey = new Map<string, string>();
    for (const p of unique) byKey.set(await hashKey(`p:${p}`), p);
    await ensureTable(db);
    for (const part of chunks([...byKey.keys()], IN_CHUNK)) {
      const res = await db
        .prepare(`SELECT phone_key, url, saved_at FROM drive_files WHERE url <> '' AND phone_key IN (${params(part.length)})`)
        .bind(...part)
        .all<{ phone_key: string; url: string; saved_at: number }>();
      for (const r of res.results) {
        const phone = byKey.get(r.phone_key);
        if (!phone) continue;
        const savedAt = Number(r.saved_at);
        const prev = out.get(phone);
        // The chip opens her newest report and says how many there are.
        if (!prev) out.set(phone, { url: r.url, savedAt, count: 1 });
        else out.set(phone, savedAt >= prev.savedAt ? { url: r.url, savedAt, count: prev.count + 1 } : { ...prev, count: prev.count + 1 });
      }
    }
  } catch (err) {
    logged("D1 read")(err);
  }
  return out;
}

/** Her newest saved report and the WhatsApp media id it was copied from. */
export type NewestReport = { mediaId: string; url: string; savedAt: number; count: number };

/**
 * Her newest saved report, by the time it was saved, with the media id it came
 * from: the pre-call reader (lib/precall-extract) fetches the bytes from
 * WhatsApp with it, since the bridge only ever writes to his Drive. `count`
 * is how many she has saved, so the card can say this was only the newest.
 * Null when she has none, or off Cloudflare. A D1 failure THROWS, unlike the
 * chip readers above: "she sent no report" and "the lookup broke" must not
 * read the same to him.
 */
export async function newestReportFor(phone: string, deps: DbDeps = {}): Promise<NewestReport | null> {
  const p = digits10(phone);
  if (p.length !== 10) return null;
  const db = await (deps.db ?? getLedgerDb)();
  if (!db) return null;
  await ensureTable(db);
  const res = await db
    .prepare("SELECT media_id, url, saved_at FROM drive_files WHERE url <> '' AND phone_key = ?1 ORDER BY saved_at DESC, media_id DESC")
    .bind(await hashKey(`p:${p}`))
    .all<{ media_id: string; url: string; saved_at: number }>();
  const top = res.results[0];
  return top ? { mediaId: top.media_id, url: top.url, savedAt: Number(top.saved_at), count: res.results.length } : null;
}

// ── Backfill ────────────────────────────────────────────────────────────────

/** Media ids expire after about 30 days; older than this there is nothing left to fetch. */
export const BACKFILL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Workers Free allows 50 subrequests per invocation and one save costs about 5. */
export const BACKFILL_BATCH = 8;
/** Stop starting saves after this long; the rest wait for the next press. */
export const BACKFILL_BUDGET_MS = 40_000;

const REPORT_KINDS = new Set(["image", "document"]);

/** The bridge or the token is broken: every later save in the batch would fail the same way. */
const STOP = new Set([
  "not_configured", "whatsapp_not_configured", "token_rejected", "unauthorized", "script_not_configured",
  "already_paired", "folder_not_found", "not_json", "unreachable", "timeout",
]);

export type BackfillMessage = Pick<
  WaMessage,
  "ts" | "phone" | "direction" | "messageId" | "name" | "mediaId" | "mediaType" | "mediaMime" | "mediaName"
>;
export type BackfillItem = Required<
  Pick<ReportSaveInput, "mediaId" | "phone" | "name" | "messageId" | "mime" | "filename" | "kind" | "ts">
>;

/** PURE. Inbound images and documents inside the window, one per media id, oldest first. */
export function inboundReports(messages: BackfillMessage[], now: number, windowMs = BACKFILL_WINDOW_MS): BackfillItem[] {
  const from = now - windowMs;
  const seen = new Set<string>();
  const rows: { at: number; item: BackfillItem }[] = [];
  for (const m of messages) {
    const mediaId = String(m.mediaId ?? "").trim();
    const at = Date.parse(String(m.ts ?? ""));
    if (m.direction !== "in" || !mediaId || !REPORT_KINDS.has(String(m.mediaType ?? "").toLowerCase())) continue;
    if (!Number.isFinite(at) || at < from) continue;
    // A webhook Meta redelivered is logged twice with the same media id.
    if (seen.has(mediaId)) continue;
    seen.add(mediaId);
    rows.push({
      at,
      item: {
        mediaId, phone: m.phone, name: m.name, messageId: m.messageId,
        mime: m.mediaMime, filename: m.mediaName, kind: String(m.mediaType).toLowerCase(), ts: m.ts,
      },
    });
  }
  return rows.sort((a, b) => a.at - b.at).map((r) => r.item);
}

/**
 * PURE. The next batch: funnel leads only, nothing already in drive_files,
 * oldest first (the closest to expiring), at most `cap`. `eligible` counts the
 * whole queue, so the caller can say how many are left.
 */
export function planBackfill(input: {
  messages: BackfillMessage[];
  leads: { has(phone10: string): boolean };
  /** Media ids with a drive_files row, saved or skipped. */
  finished: { has(mediaId: string): boolean };
  now: number;
  windowMs?: number;
  cap?: number;
}): { batch: BackfillItem[]; eligible: number } {
  const queue = inboundReports(input.messages, input.now, input.windowMs).filter(
    (r) => input.leads.has(digits10(r.phone)) && !input.finished.has(r.mediaId),
  );
  return { batch: queue.slice(0, input.cap ?? BACKFILL_BATCH), eligible: queue.length };
}

export type BackfillResult = { saved: number; skipped: number; remaining: number; error?: string; hint?: string };
export type BackfillDeps = ReportSaveDeps & { messages: () => Promise<BackfillMessage[]> };

/**
 * One press of the backfill: the next batch saved, in order. `skipped` counts
 * the ones tried that did not save. `remaining` is what is still to do after
 * this call; a report WhatsApp no longer has, or one over 20 MB, is recorded
 * as finished, so the count reaches 0 instead of retrying it forever.
 */
export async function backfillReports(deps: Partial<BackfillDeps> = {}): Promise<BackfillResult> {
  const d: BackfillDeps = {
    ...DEFAULT_DEPS,
    messages: async () => (await import("@/lib/wa-messages")).readMessages(),
    ...deps,
  };
  const nothing = (error: string, hint: string): BackfillResult => ({ saved: 0, skipped: 0, remaining: 0, error, hint });
  try {
    const cfg = await d.config();
    if (cfg.missing.length) return nothing("not_configured", bridgeHint(new BridgeError("not_configured", cfg.missing.join(", "))));
    // Without D1 nothing is remembered between presses, so the same batch would come back every time.
    const db = await d.db();
    if (!db) return nothing("no_ledger", "The backfill keeps its place in D1, which only the Cloudflare worker has.");

    const started = d.now();
    const [messages, leads] = await Promise.all([d.messages(), d.leads()]);
    const finished = await finishedMediaIds(db, inboundReports(messages, started).map((r) => r.mediaId));
    const plan = planBackfill({ messages, leads, finished, now: started });

    // One read of the sheet and the config for the whole batch, not one per save.
    const each: ReportSaveDeps = { ...d, config: async () => cfg, db: async () => db, leads: async () => leads };
    let saved = 0;
    let skipped = 0;
    let settled = 0;
    let hint: string | undefined;
    for (const item of plan.batch) {
      if (d.now() - started > BACKFILL_BUDGET_MS) break;
      const r = await saveReportFromWhatsApp({ ...item, requireLead: true }, each);
      if (r.saved) {
        saved++;
        settled++;
        continue;
      }
      skipped++;
      if (PERMANENT.has(r.reason)) settled++;
      hint = r.hint;
      if (STOP.has(r.reason)) break;
    }
    return { saved, skipped, remaining: plan.eligible - settled, ...(hint ? { hint } : {}) };
  } catch (err) {
    return nothing("backfill_failed", errText(err));
  }
}
