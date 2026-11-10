/**
 * lib/admin-actions.ts — PURE. The small decisions behind the Drive buttons on
 * Today and in the inbox: which row offers which button, what each reply from
 * the summary route means for the row it came from, the wa.me fallback for a
 * shut window, and the checks on the Web app URL he pastes into "Connect
 * Google Drive".
 *
 * WHY THESE ARE HERE AND NOT IN THE COMPONENTS
 * The repo has no component tests, and every rule below fails quietly when it
 * is guessed wrong: a Summary button on a woman who never had a call, a "Send
 * to her" offered into a window WhatsApp will refuse, a URL that pastes fine
 * and pairs nothing, a reply shape read as success. Kept pure so node --test
 * holds them; the components only render what these return.
 *
 * Imported by client components and by routes, so nothing here touches IO.
 */
import type { ActionKind } from "./journey.ts";
import { draftWaLink, firstName } from "./draft-message.ts";
import { bridgeHint, notesTemplate, type BridgeError } from "./drive.ts";

// ── Which buttons a row shows ───────────────────────────────────────────────

/**
 * Queue kinds whose call has already happened, so a summary is something he
 * can make. Typed against lib/journey's ActionKind: a kind renamed there fails
 * the type check here instead of silently losing its button. A kind ADDED
 * there gets no Summary until it is added here on purpose, because a summary
 * needs a call to summarise.
 */
export const POST_CALL_KINDS: ReadonlySet<ActionKind> = new Set<ActionKind>([
  "mark_call",
  "send_price",
  "follow_up",
  "agreed_unpaid",
]);

export type RowSpec = { type: "call" } | { type: "queue"; kind: string };
export type RowToolSet = {
  notes: boolean;
  summary: boolean;
  drive: boolean;
  /**
   * "always": a call row says "No report yet" out loud, because before a call
   * that absence is the thing to notice. "when_saved": a queue row shows the
   * chip only when there is a report, so twenty rows do not repeat a blank.
   */
  report: "always" | "when_saved";
};

export function rowTools(row: RowSpec): RowToolSet {
  if (row.type === "call") return { notes: true, summary: true, drive: true, report: "always" };
  return {
    notes: true,
    summary: (POST_CALL_KINDS as ReadonlySet<string>).has(row.kind),
    drive: false,
    report: "when_saved",
  };
}

/** The report fields /api/admin/today adds to each call and queue item. */
export type SavedReport = { url: string; count: number } | null | undefined;

/** The chip for a row, or null when the row shows none (`mode` from rowTools). */
export function reportChip(
  report: SavedReport,
  mode: RowToolSet["report"] = "always",
): { url: string; label: string; note: string } | null {
  if (!report || !report.url) return mode === "always" ? { url: "", label: "No report yet", note: "" } : null;
  // The link opens the newest; the count says there are older ones beside it.
  return { url: report.url, label: "Report in Drive", note: report.count > 1 ? `${report.count} saved` : "" };
}

/**
 * Only her images and documents can be in Drive: those are what the report
 * saver copies. Audio, video and anything we sent ourselves never are, so they
 * get neither a lookup nor a "Save to Drive" button.
 */
export function canSaveToDrive(m: { direction?: string; mediaId?: string; mediaType?: string }): boolean {
  return m.direction === "in" && Boolean(m.mediaId) && (m.mediaType === "image" || m.mediaType === "document");
}

// ── The summary, from tap to sent ───────────────────────────────────────────

/** Whatever /api/admin/summary answered. Read defensively: a 502 may be an HTML page. */
export type SummaryReply = {
  pdfUrl?: unknown;
  notesUrl?: unknown;
  warnings?: unknown;
  windowOpen?: unknown;
  sent?: unknown;
  error?: unknown;
  missing?: unknown;
  hint?: unknown;
  waText?: unknown;
};

export type SummaryReady = {
  phase: "ready";
  pdfUrl: string;
  notesUrl: string;
  warnings: string[];
  /** Her 24-hour window, as the server measured it when the PDF was made. */
  windowOpen: boolean;
  /** ISO time it went to her on WhatsApp; "" until then. */
  sentAt: string;
  /** The server's own words for the wa.me fallback, once it has offered some. */
  waText: string;
  sendError: string;
};
export type SummaryView =
  | SummaryReady
  | { phase: "fill_notes"; missing: string[]; notesUrl: string; hint: string }
  | { phase: "error"; code: string; hint: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/**
 * The route may name a missing part by its key ("blockers") or by its heading
 * ("Blockers"). He only ever sees the heading — the words written in his Doc.
 * A Map, not an object: a key like "constructor" must not find Object's.
 */
const HEADING_BY_KEY = new Map<string, string>(
  notesTemplate({ name: "", phone: "", when: "" }).sections.map((s) => [s.key, s.heading]),
);

export function missingLabels(missing: string[]): string[] {
  const out: string[] = [];
  for (const m of missing) {
    const label = HEADING_BY_KEY.get(m) ?? m;
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

function sentAtOf(sent: unknown, nowIso: string): string {
  if (sent === true) return nowIso;
  const s = str(sent);
  return s && Number.isFinite(Date.parse(s)) ? s : "";
}

/** What a reply to the Summary button means for the row it came from. */
export function summaryFromReply(status: number, body: SummaryReply | null | undefined, nowIso: string): SummaryView {
  const b = body ?? {};
  const code = str(b.error);
  const hint = str(b.hint);
  if (status >= 200 && status < 300) {
    const pdfUrl = str(b.pdfUrl);
    // A 200 with nothing to open is a failure, however it is labelled.
    if (!pdfUrl) return { phase: "error", code: code || "no_pdf", hint: hint || "The summary came back without a file. Press Summary again." };
    return {
      phase: "ready",
      pdfUrl,
      notesUrl: str(b.notesUrl),
      warnings: strs(b.warnings),
      windowOpen: b.windowOpen === true,
      sentAt: sentAtOf(b.sent, nowIso),
      waText: "",
      sendError: "",
    };
  }
  if (status === 422) {
    return {
      phase: "fill_notes",
      missing: missingLabels(strs(b.missing)),
      notesUrl: str(b.notesUrl),
      hint: hint || (code === "doc_not_found" ? "She has no notes Doc yet. Press Notes first and fill it in." : ""),
    };
  }
  return { phase: "error", code: code || `http_${status}`, hint: hint || code || `The summary failed (HTTP ${status}). Press Summary again.` };
}

/**
 * What a reply to "Send to her" does to a row already showing a ready summary.
 * The PDF exists whatever happens to the send, so the row never loses its
 * Open link: a failed send adds a line, and a shut window swaps the button for
 * the phone fallback, carrying the server's words for it when it gave some.
 */
export function afterSend(prev: SummaryReady, status: number, body: SummaryReply | null | undefined, nowIso: string): SummaryReady {
  const b = body ?? {};
  if (status === 409 && str(b.error) === "window_closed") {
    return { ...prev, windowOpen: false, waText: str(b.waText) || prev.waText, sendError: "" };
  }
  const next = summaryFromReply(status, b, nowIso);
  if (next.phase === "ready") {
    if (next.sentAt) return { ...next, waText: prev.waText, sendError: "" };
    // Asked to send, answered 200, sent nothing. Say so, and offer the phone.
    return { ...next, windowOpen: false, waText: prev.waText, sendError: str(b.hint) || "WhatsApp did not send it. Send it from your phone." };
  }
  if (next.phase === "fill_notes") {
    return { ...prev, sendError: next.missing.length ? `Fill these in her notes first: ${next.missing.join(", ")}` : next.hint };
  }
  return { ...prev, sendError: next.hint };
}

/**
 * The words the wa.me fallback opens with when the server offered none. Short
 * and plain: he attaches the PDF in the next message, so this only has to say
 * what is coming. Her name comes from the booking; nothing else is filled in.
 */
export function summaryShareText(name: string): string {
  return `Hi ${firstName(name)}, here is your consultation summary from our call. Sending the PDF now.`;
}

/** "" when the row has no usable number — the caller then shows no link at all. */
export function summaryWaLink(phone: string, name: string, serverText = ""): string {
  return draftWaLink(phone, serverText.trim() || summaryShareText(name));
}

/** "14:07" on the coach's clock. "" for anything that is not a time. */
export function istClock(iso: string): string {
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return "";
  return t.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
}

// ── Connect Google Drive ────────────────────────────────────────────────────

/** Exactly the Web app URL a consumer-Gmail deployment hands out. */
export const APPS_SCRIPT_EXEC_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

export function isAppsScriptExecUrl(url: string): boolean {
  return APPS_SCRIPT_EXEC_RE.test(String(url ?? "").trim());
}

/**
 * Why a pasted URL will not pair, in words he can act on — or null when it
 * will. The two likely mistakes on a phone get their own answer: the /dev test
 * URL, and the editor's own address copied out of the address bar.
 */
export function appsScriptUrlProblem(url: string): string | null {
  const u = String(url ?? "").trim();
  if (!u) return "Paste the Web app URL first.";
  if (APPS_SCRIPT_EXEC_RE.test(u)) return null;
  if (/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/dev\/?$/.test(u)) {
    return "That is the test URL. Use the Web app URL, the one that ends in /exec.";
  }
  if (/^https:\/\/script\.google\.com\/(home|d)\//.test(u)) {
    return "That is the editor's address. Copy the Web app URL from Deploy → Manage deployments instead.";
  }
  return "That is not a Web app URL. It starts with https://script.google.com/macros/s/ and ends in /exec.";
}

/**
 * The secret the worker hands the script on first contact: 32 random bytes as
 * hex. He never sees or types it. `fill` is injectable for the tests only.
 */
export function newBridgeSecret(fill: (bytes: Uint8Array) => void = (b) => { crypto.getRandomValues(b); }): string {
  const bytes = new Uint8Array(32);
  fill(bytes);
  return Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * A `pair` never answers unauthorized, script_not_configured or unknown_action
 * from the current script: those come only from an older copy, which checks
 * the secret before it reads the action. bridgeHint's own words for them
 * ("use Connect Google Drive again") would send him round in a circle from
 * the very card he just used, so pairing says what is actually wrong.
 */
const OLD_SCRIPT_CODES = new Set(["unauthorized", "script_not_configured", "unknown_action"]);
export const OLD_SCRIPT_HINT =
  "That Web app runs an older copy of the script. Press Copy script, paste it over Code.gs, Save, then Deploy → Manage deployments → pencil → Version: New version → Deploy, and press Connect again.";

export function connectHint(err: BridgeError): string {
  return OLD_SCRIPT_CODES.has(err.code) ? OLD_SCRIPT_HINT : bridgeHint(err);
}

/** GET /api/admin/drive-setup. */
export type DriveStatus = { connected: boolean; source: "env" | "stored" | "none"; folderConfigured: boolean; version: string };

/**
 * Failures the card itself fixes. The status read says "connected" as long as
 * a pairing is stored, but a redeployed or re-keyed script refuses that
 * pairing, and every hint for that tells him to use the card. So the card
 * comes back when a button meets one of these. Not for the env set-up: the
 * card cannot change the worker's settings, and its Connect refuses there.
 */
const RECONNECT_CODES = new Set(["unauthorized", "script_not_configured", "not_json"]);

export function showConnectCard(status: DriveStatus | null, lastBridgeError: string): boolean {
  // Unknown is not "disconnected": a failed status read must not nag.
  if (!status) return false;
  if (!status.connected) return true;
  return status.source === "stored" && RECONNECT_CODES.has(lastBridgeError);
}
