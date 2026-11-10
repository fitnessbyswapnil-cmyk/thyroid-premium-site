/**
 * lib/drive.ts — the coach's own call notes, as a Google Doc per booking.
 *
 * WHY THE SYSTEM CREATES THE DOC AND NOT HIM
 * He types notes while he is on the call: what she actually said, what he
 * concluded. Fathom records what was SAID; this is what he UNDERSTOOD, and no
 * transcript can produce it. Both feed the consultation summary — and on a call
 * he chose not to record, the notes are the only source it has.
 *
 * The obvious version — he makes a doc per client, named after her — breaks on
 * the only hard part: finding it again. Everything else in this system keys on
 * leadId, phone or email, and a name does not. "Meera K." / "Meera Kulkarni" /
 * "meera" are one woman and three lookups, and lib/booking-lead-score-sheet
 * already records that one woman is routinely spread across several rows by
 * three different writers. A name-matched doc would be a fifth surface for the
 * same drift.
 *
 * So the doc is created from the booking, with the phone in its title. Nothing
 * ever has to guess which doc belongs to which call.
 *
 * WHY AN APPS SCRIPT, AND NOT THE SERVICE ACCOUNT
 * The first version created the Doc with the service account and Google refused
 * it: "Service Accounts do not have storage quota." A file a service account
 * creates is OWNED by the service account — even inside a folder someone shared
 * with it — and service accounts no longer get any Drive storage. Google's two
 * suggested fixes, a shared drive or domain-wide delegation, both need a paid
 * Workspace domain. This business runs on a consumer @gmail.com account, so
 * neither exists.
 *
 * So the file is made by a small Apps Script web app that the owner deployed
 * from his own account with "Execute as: Me" (scripts/drive-bridge.gs). It runs
 * as him: the file is his, it counts against his quota, and it can use the
 * folder he made by hand. This module only POSTs a description of the Doc.
 *
 * Every future file this system puts in his Drive — her blood report, her
 * consultation summary — hits the same refusal, and goes through the same
 * bridge. Reading is different: the service account can still READ what is in
 * a folder shared with it, because reading needs no storage.
 *
 * No googleapis import here, deliberately: the bridge is one fetch, and the
 * Drive client is a large share of a bundle with a 3 MB ceiling.
 *
 * V2 — ONE FOLDER PER CLIENT (Nov 2026)
 * Everything about one woman lands in one folder, "<Name> · <10 digits>",
 * inside his "Client Notes": the notes Doc for each call, every report she sent
 * on WhatsApp (saved automatically as it arrives), and the consultation summary
 * PDF. The folder is found by her phone digits, never by her name, for the
 * reason above. The script finds-or-creates it under a lock.
 *
 * The notes Doc is no longer free text under headings. The parts of it the
 * summary PDF needs in rows — symptom against marker, what she already spent —
 * are TABLES in the Doc, and the blockers are a numbered list, so reading them
 * back is lookup, not parsing his typing. See notesTemplate().
 *
 * The bridge's URL and secret can come from the worker's env (the manual set-up,
 * still honoured) or from the pairing the dashboard stores in D1 when he pastes
 * the Web app URL into "Connect Google Drive" (lib/bridge-settings.ts). Pairing
 * is trust-on-first-use: the script adopts the first secret it is sent while it
 * has none, and refuses any other afterwards.
 */

/** The Drive folder everything goes into (his "Client Notes"). */
export const NOTES_FOLDER_ENV = "GOOGLE_DRIVE_NOTES_FOLDER_ID";
/** The /exec URL of the deployed Apps Script web app. */
export const BRIDGE_URL_ENV = "DRIVE_BRIDGE_URL";
/** Must equal SHARED_SECRET in the script's Script Properties. */
export const BRIDGE_SECRET_ENV = "DRIVE_BRIDGE_SECRET";

const env = (k: string) => (process.env[k] ?? "").trim();

export function notesFolderId(): string {
  return env(NOTES_FOLDER_ENV);
}

export type BridgeConfig = { url: string; secret: string; folderId: string; missing?: string[] };
export type ResolvedBridgeConfig = BridgeConfig & { missing: string[]; source: "env" | "stored" | "none" };
export type StoredPairing = { url: string; secret: string };

/** The env config, plus the names of whatever is missing — so the error can say which. */
export function bridgeConfig(): BridgeConfig & { missing: string[] } {
  const cfg = { url: env(BRIDGE_URL_ENV), secret: env(BRIDGE_SECRET_ENV), folderId: notesFolderId() };
  const missing = [
    !cfg.folderId && NOTES_FOLDER_ENV,
    !cfg.url && BRIDGE_URL_ENV,
    !cfg.secret && BRIDGE_SECRET_ENV,
  ].filter((x): x is string => Boolean(x));
  return { ...cfg, missing };
}

/**
 * Env first (the manual set-up keeps working exactly as before), then the
 * pairing the dashboard stored. `load` is injected so this module never imports
 * D1 — routes call liveBridgeConfig() in lib/bridge-settings.ts, which passes it.
 */
export async function resolveBridgeConfig(
  load?: () => Promise<StoredPairing | null>,
): Promise<ResolvedBridgeConfig> {
  const fromEnv = bridgeConfig();
  if (fromEnv.url && fromEnv.secret) return { ...fromEnv, source: "env" };
  let stored: StoredPairing | null = null;
  if (load) {
    try {
      stored = await load();
    } catch {
      stored = null;
    }
  }
  if (stored?.url && stored.secret) {
    const folderId = fromEnv.folderId;
    return { url: stored.url, secret: stored.secret, folderId, missing: folderId ? [] : [NOTES_FOLDER_ENV], source: "stored" };
  }
  return { ...fromEnv, source: "none" };
}

export const digits10 = (s: string) => String(s ?? "").replace(/\D/g, "").slice(-10);

/** Her name as it goes into titles: no path characters, no line breaks, at most 40 characters. */
export function clientName(name: string): string {
  return (name || "").trim().replace(/[\\/\r\n]+/g, " ").replace(/\s+/g, " ").slice(0, 40) || "Unnamed";
}

/** IST, the coach's clock — the date he will look for when scanning the folder. */
export function istDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "undated";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * The title is the key. Date first so the folder sorts chronologically, phone
 * last so a lookup never depends on how her name was spelled that day.
 */
export function notesTitle(input: { name: string; phone: string; when: string }): string {
  return `${istDate(input.when)} · ${clientName(input.name)} · ${digits10(input.phone) || "nophone"}`;
}

/** Her folder inside "Client Notes". Found by the digits; the name is for his eyes. */
export function clientFolderName(input: { name: string; phone: string }): string {
  return `${clientName(input.name)} · ${digits10(input.phone) || "nophone"}`;
}

/** Which part of the notes a section is. The summary PDF reads by key, never by heading. */
export type NotesKey = "words" | "symptoms" | "blockers" | "spent" | "price" | "nextStep" | "proof" | "objection";
export type NotesSectionKind = "text" | "list" | "table";
export type NotesSection = {
  key: NotesKey;
  heading: string;
  hint: string;
  kind: NotesSectionKind;
  /** table: the header row. */
  columns?: string[];
  /** table: how many empty rows to start with. */
  rows?: number;
  /** list: how many numbered slots to start with. */
  slots?: number;
};
export type NotesTemplate = { heading: string; preface: string; sections: NotesSection[] };

export const SYMPTOM_COLUMNS = ["What she feels", "Marker", "Her value (range)", "Flag"];
export const SPENT_COLUMNS = ["What she tried", "How long", "Money (₹)"];

/**
 * The note he opens on the call. The structure is the system's; the words are his.
 *
 * The sections are what the consultation summary PDF is built from, in the
 * order the call runs, so by the end of the call the summary is already
 * drafted. Rows the PDF lays out as rows are tables here, so nothing has to
 * parse what he typed.
 *
 * Plain text, not HTML: the script writes these with DocumentApp, which sets
 * text rather than parsing markup. Escaping here would put a literal "&lt;" in
 * front of him.
 */
export function notesTemplate(input: { name: string; phone: string; when: string }): NotesTemplate {
  const when = new Date(input.when);
  const whenLabel = Number.isFinite(when.getTime())
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata", weekday: "short", day: "numeric",
        month: "short", hour: "numeric", minute: "2-digit",
      }).format(when) + " IST"
    : "—";
  return {
    heading: (input.name || "").trim() || "Unnamed",
    preface: `${digits10(input.phone) || "no phone"} · ${whenLabel}`,
    sections: [
      { key: "words", kind: "text", heading: "Her words", hint: "The one line to quote back to her, exactly as she said it." },
      {
        key: "symptoms", kind: "table", heading: "Symptoms matched to her report",
        hint: "One symptom per row. Marker values only from her actual report, never from memory. Flag: low, high, borderline or above range.",
        columns: SYMPTOM_COLUMNS, rows: 5,
      },
      { key: "blockers", kind: "list", heading: "Blockers", hint: "All of them, most important first. Every one goes on her PDF.", slots: 6 },
      {
        key: "spent", kind: "table", heading: "Already spent",
        hint: "What she tried, how long, how much. Her numbers, not estimates.",
        columns: SPENT_COLUMNS, rows: 4,
      },
      { key: "price", kind: "text", heading: "Price quoted", hint: "The figure you said on the call, like 20000. Leave it blank if price never came up, and the PDF shows no price." },
      { key: "nextStep", kind: "text", heading: "Next step", hint: "One action and one deadline, like: Reply START on WhatsApp by Friday 8pm." },
      { key: "proof", kind: "text", heading: "Proof to show", hint: "First name of one published client from the website's results. Leave blank for the first card." },
      { key: "objection", kind: "text", heading: "Objection", hint: "What she said, and what you think it really was. Private: never on her PDF." },
    ],
  };
}

export type NotesDoc = { id: string; url: string; title: string; created: boolean };

/**
 * A failure the dashboard can name. `code` decides the hint shown under the
 * row; `detail` is whatever the script said, for the case nobody predicted.
 */
export class BridgeError extends Error {
  code: string;
  detail: string;
  constructor(code: string, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "BridgeError";
    this.code = code;
    this.detail = detail;
  }
}

type BridgeReply = { ok?: boolean; error?: string; detail?: unknown } & Record<string, unknown>;
export type BridgeCallOptions = { fetchImpl?: typeof fetch; timeoutMs?: number };

/**
 * One POST to the script. Every action shares this envelope:
 *   request  { ...payload, action, secret, folderId }
 *   reply    { ok: true, ... }  or  { ok: false, error: <code>, detail? }
 * The envelope fields are written last so a payload can never override them.
 */
export async function callBridge<T extends Record<string, unknown> = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown>,
  cfg: BridgeConfig,
  opts: BridgeCallOptions = {},
): Promise<T> {
  const missing = cfg.missing ?? [];
  if (missing.length) throw new BridgeError("not_configured", missing.join(", "));
  const fetchImpl = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(cfg.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, action, secret: cfg.secret, folderId: cfg.folderId }),
      // Apps Script answers a POST with a 302 to a googleusercontent.com URL
      // that holds the reply. Following it is the whole protocol.
      redirect: "follow",
      // A cold script takes a few seconds; one that takes 25 has hung.
      signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new BridgeError("timeout");
    throw new BridgeError("unreachable", err instanceof Error ? err.message : String(err));
  }

  const raw = await res.text();
  let j: BridgeReply;
  try {
    j = JSON.parse(raw) as BridgeReply;
  } catch {
    // A sign-in page or a Google error page: the deployment exists but is not
    // a web app anyone can call.
    throw new BridgeError("not_json", `HTTP ${res.status} ${raw.replace(/\s+/g, " ").slice(0, 120)}`);
  }
  if (!j || !j.ok) throw new BridgeError((j && j.error) || `http_${res.status}`, j && j.detail != null ? String(j.detail) : "");
  return j as T;
}

const docUrl = (id: string) => `https://docs.google.com/document/d/${id}/edit`;
const fileUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;
const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

/**
 * Return the notes doc for this booking, making it only if it is not there.
 *
 * Idempotent on the title, inside the script and under a lock: pressing the
 * button twice, or on two devices at once, must not leave him with two
 * half-written notes for one call. A doc he trashed on purpose is skipped, so
 * it comes back fresh instead of resurrecting from the bin.
 *
 * `cfg` and `fetchImpl` exist for the tests; routes pass liveBridgeConfig().
 */
export async function ensureNotesDoc(
  input: { name: string; phone: string; when: string },
  cfg: BridgeConfig = bridgeConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<NotesDoc> {
  const title = notesTitle(input);
  const j = await callBridge<{ id?: string; url?: string; created?: boolean }>(
    "ensureDoc",
    { title, phone: digits10(input.phone), name: clientName(input.name), ...notesTemplate(input) },
    cfg,
    { fetchImpl },
  );
  if (!j.id) throw new BridgeError("no_id");
  return { id: j.id, url: j.url || docUrl(j.id), title, created: Boolean(j.created) };
}

/** One H2 section of a notes Doc exactly as the script read it — no interpretation. */
export type RawNotesSection = { heading: string; paragraphs: string[]; listItems: string[]; tables: string[][][] };
export type NotesPart = { text: string; items: string[]; rows: string[][] };
export type NotesContent = {
  id: string;
  url: string;
  title: string;
  updatedAt: string;
  /** By key. A key is absent when he deleted that heading from the Doc. */
  sections: Partial<Record<NotesKey, NotesPart>>;
};

const norm = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Map what the script read back onto the template's keys.
 *
 * Headings are matched case- and space-insensitively. The hint line is
 * dropped. A table's first row is dropped when it is the header; rows with
 * every cell empty are dropped. A list section he typed as plain lines
 * instead of list items still yields items, one per non-empty line.
 */
export function parseNotes(raw: RawNotesSection[], template: NotesTemplate): Partial<Record<NotesKey, NotesPart>> {
  const out: Partial<Record<NotesKey, NotesPart>> = {};
  for (const sec of template.sections) {
    const found = raw.find((r) => norm(r.heading) === norm(sec.heading));
    if (!found) continue;
    const hint = norm(sec.hint);
    const lines = (found.paragraphs ?? []).map((p) => String(p ?? "").trim()).filter((p) => p && norm(p) !== hint);
    let items = (found.listItems ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
    if (sec.kind === "list" && !items.length) items = lines.slice();
    let rows: string[][] = [];
    const table = (found.tables ?? [])[0];
    if (table && table.length) {
      const header = (sec.columns ?? []).map(norm).join("|");
      const first = (table[0] ?? []).map(norm).join("|");
      const body = header && first === header ? table.slice(1) : table;
      rows = body
        .map((r) => (r ?? []).map((c) => String(c ?? "").trim()))
        .filter((r) => r.some(Boolean));
    }
    out[sec.key] = { text: sec.kind === "list" && !found.listItems?.length ? "" : lines.join("\n"), items, rows };
  }
  return out;
}

/**
 * Read back the newest notes Doc in her folder (or the one named `title`).
 * Null when she has no notes Doc yet — the caller says "press Notes first".
 */
export async function readNotesDoc(
  input: { name: string; phone: string; title?: string; when?: string },
  cfg: BridgeConfig,
  opts: BridgeCallOptions = {},
): Promise<NotesContent | null> {
  let j: { id?: string; url?: string; title?: string; updatedAt?: string; sections?: RawNotesSection[] };
  try {
    j = await callBridge("readDoc", { phone: digits10(input.phone), name: clientName(input.name), title: input.title ?? "" }, cfg, opts);
  } catch (err) {
    if (err instanceof BridgeError && err.code === "doc_not_found") return null;
    throw err;
  }
  if (!j.id) throw new BridgeError("no_id");
  const template = notesTemplate({ name: input.name, phone: input.phone, when: input.when ?? "" });
  return {
    id: j.id,
    url: j.url || docUrl(j.id),
    title: j.title ?? "",
    updatedAt: j.updatedAt ?? "",
    sections: parseNotes(j.sections ?? [], template),
  };
}

/** Largest file the bridge is sent. Apps Script takes ~50 MB; base64 adds a third. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/**
 * Put one file into her folder. Idempotent on `dedupeKey` (the script keeps it
 * in the file's description): the same WhatsApp media, or the same day's
 * summary, never lands twice. `replace` trashes the earlier file with that key
 * and writes the new one — how a regenerated summary supersedes the old.
 */
export async function saveClientFile(
  input: { name: string; phone: string; fileName: string; mimeType: string; base64: string; dedupeKey: string; replace?: boolean },
  cfg: BridgeConfig,
  opts: BridgeCallOptions = {},
): Promise<{ id: string; url: string; created: boolean }> {
  if (Math.floor((input.base64.length * 3) / 4) > MAX_FILE_BYTES) throw new BridgeError("too_large", String(input.base64.length));
  const j = await callBridge<{ id?: string; url?: string; created?: boolean }>(
    "saveFile",
    {
      phone: digits10(input.phone),
      name: clientName(input.name),
      fileName: input.fileName.replace(/[\\/\r\n]+/g, " ").slice(0, 120),
      mimeType: input.mimeType || "application/octet-stream",
      base64: input.base64,
      dedupeKey: input.dedupeKey,
      replace: Boolean(input.replace),
    },
    cfg,
    { timeoutMs: 60_000, ...opts },
  );
  if (!j.id) throw new BridgeError("no_id");
  return { id: j.id, url: j.url || fileUrl(j.id), created: Boolean(j.created) };
}

/** Her folder, made if she has none yet. */
export async function clientFolder(
  input: { name: string; phone: string },
  cfg: BridgeConfig,
  opts: BridgeCallOptions = {},
): Promise<{ id: string; url: string; created: boolean }> {
  const j = await callBridge<{ id?: string; url?: string; created?: boolean }>(
    "clientFolder",
    { phone: digits10(input.phone), name: clientName(input.name) },
    cfg,
    opts,
  );
  if (!j.id) throw new BridgeError("no_id");
  return { id: j.id, url: j.url || folderUrl(j.id), created: Boolean(j.created) };
}

/**
 * Hand a freshly deployed script its secret. The script adopts it only while
 * it has none (trust on first use) and answers already_paired otherwise. It
 * also proves the folder is reachable, so a wrong folder fails here and not on
 * a live call.
 */
export async function pairBridge(
  input: { url: string; secret: string; folderId: string },
  opts: BridgeCallOptions = {},
): Promise<{ paired: boolean }> {
  const j = await callBridge<{ paired?: boolean }>("pair", {}, { url: input.url, secret: input.secret, folderId: input.folderId, missing: [] }, opts);
  return { paired: Boolean(j.paired) };
}

/** What to tell him for each failure — the fix, not the stack trace. */
export function bridgeHint(err: BridgeError): string {
  switch (err.code) {
    case "not_configured":
      return err.detail.includes(BRIDGE_URL_ENV) || err.detail.includes(BRIDGE_SECRET_ENV)
        ? "Google Drive is not connected yet. Use “Connect Google Drive” at the top of Today."
        : `Not set on the worker: ${err.detail}`;
    case "unauthorized":
      return "The script's key does not match this site. Use “Connect Google Drive” again with the current Web app URL.";
    case "script_not_configured":
      return "The script is deployed but not paired yet. Use “Connect Google Drive” and paste its Web app URL.";
    case "already_paired":
      return "That script is already paired with another key. In the Apps Script open Project Settings → Script Properties, delete SHARED_SECRET, then connect again.";
    case "folder_not_found":
      return `${NOTES_FOLDER_ENV} is wrong, or that folder is not in the account that deployed the script`;
    case "doc_not_found":
      return "She has no notes Doc yet. Press Notes first and fill it in.";
    case "too_large":
      return "That file is over 20 MB, too large to copy to Drive automatically.";
    case "not_json":
      return "The script answered with a web page, not JSON. Redeploy it as a Web app with “Who has access: Anyone”.";
    case "timeout":
      return "Google took too long to answer. Press it again.";
    case "unreachable":
      return `Could not reach the script: ${err.detail}`;
    case "script_error":
      return `The script failed: ${err.detail}`;
    default:
      return err.detail ? `${err.code}: ${err.detail}` : err.code;
  }
}
