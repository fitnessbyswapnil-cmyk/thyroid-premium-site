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
 */

/** The Drive folder the notes go into (his "Client Notes"). */
export const NOTES_FOLDER_ENV = "GOOGLE_DRIVE_NOTES_FOLDER_ID";
/** The /exec URL of the deployed Apps Script web app. */
export const BRIDGE_URL_ENV = "DRIVE_BRIDGE_URL";
/** Must equal SHARED_SECRET in the script's Script Properties. */
export const BRIDGE_SECRET_ENV = "DRIVE_BRIDGE_SECRET";

const env = (k: string) => (process.env[k] ?? "").trim();

export function notesFolderId(): string {
  return env(NOTES_FOLDER_ENV);
}

export type BridgeConfig = { url: string; secret: string; folderId: string };

/** The config, plus the names of whatever is missing — so the error can say which. */
export function bridgeConfig(): BridgeConfig & { missing: string[] } {
  const cfg = { url: env(BRIDGE_URL_ENV), secret: env(BRIDGE_SECRET_ENV), folderId: notesFolderId() };
  const missing = [
    !cfg.folderId && NOTES_FOLDER_ENV,
    !cfg.url && BRIDGE_URL_ENV,
    !cfg.secret && BRIDGE_SECRET_ENV,
  ].filter((x): x is string => Boolean(x));
  return { ...cfg, missing };
}

const digits10 = (s: string) => String(s ?? "").replace(/\D/g, "").slice(-10);

/** IST, the coach's clock — the date he will look for when scanning the folder. */
function istDate(iso: string): string {
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
  const who = (input.name || "").trim().replace(/[\\/\r\n]+/g, " ").slice(0, 40) || "Unnamed";
  return `${istDate(input.when)} · ${who} · ${digits10(input.phone) || "nophone"}`;
}

export type NotesSection = { heading: string; hint: string };
export type NotesTemplate = { heading: string; preface: string; sections: NotesSection[] };

/**
 * The note he opens on the call. Headings only — the words are his.
 *
 * They are the sections the consultation summary is built from, in the order
 * the call runs, so by the end of the call the summary is already drafted and
 * nothing has to be remembered afterwards.
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
      { heading: "Her words", hint: "The line to quote back to her. Keep it verbatim." },
      { heading: "Symptoms", hint: "" },
      { heading: "Markers", hint: "Only what her report actually shows. No value goes in here from memory." },
      { heading: "Blockers", hint: "All of them, numbered." },
      { heading: "Already spent", hint: "What she tried, how long, how much. Her numbers, not estimates." },
      { heading: "Objection", hint: "What she said, and underneath it what you think it really was." },
      { heading: "Next step", hint: "An amount, a clock time and a named action." },
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

type BridgeReply = { ok?: boolean; id?: string; url?: string; created?: boolean; error?: string; detail?: string };

/**
 * Return the notes doc for this booking, making it only if it is not there.
 *
 * Idempotent on the title, inside the script and under a lock: pressing the
 * button twice, or on two devices at once, must not leave him with two
 * half-written notes for one call. A doc he trashed on purpose is skipped, so
 * it comes back fresh instead of resurrecting from the bin.
 *
 * `cfg` and `fetchImpl` exist for the tests; production passes neither.
 */
export async function ensureNotesDoc(
  input: { name: string; phone: string; when: string },
  cfg: BridgeConfig & { missing?: string[] } = bridgeConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<NotesDoc> {
  const missing = cfg.missing ?? [];
  if (missing.length) throw new BridgeError("not_configured", missing.join(", "));

  const title = notesTitle(input);
  let res: Response;
  try {
    res = await fetchImpl(cfg.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "ensureDoc",
        secret: cfg.secret,
        folderId: cfg.folderId,
        title,
        ...notesTemplate(input),
      }),
      // Apps Script answers a POST with a 302 to a googleusercontent.com URL
      // that holds the reply. Following it is the whole protocol.
      redirect: "follow",
      // A cold script takes a few seconds; one that takes 25 has hung.
      signal: AbortSignal.timeout(25_000),
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
  if (!j.ok) throw new BridgeError(j.error || `http_${res.status}`, j.detail ?? "");
  if (!j.id) throw new BridgeError("no_id");
  return {
    id: j.id,
    url: j.url || `https://docs.google.com/document/d/${j.id}/edit`,
    title,
    created: Boolean(j.created),
  };
}

/** What to tell him for each failure — the fix, not the stack trace. */
export function bridgeHint(err: BridgeError): string {
  switch (err.code) {
    case "not_configured":
      return `Not set on the worker: ${err.detail}`;
    case "unauthorized":
      return `${BRIDGE_SECRET_ENV} on the worker does not match SHARED_SECRET in the Apps Script`;
    case "script_not_configured":
      return "Set SHARED_SECRET under Project Settings → Script Properties in the Apps Script";
    case "folder_not_found":
      return `${NOTES_FOLDER_ENV} is wrong, or that folder is not in the account that deployed the script`;
    case "not_json":
      return "The script answered with a web page, not JSON — redeploy it as a Web app with “Who has access: Anyone”";
    case "timeout":
      return "Google took more than 25 seconds — press Notes again";
    case "unreachable":
      return `Could not reach the script: ${err.detail}`;
    default:
      return err.detail ? `${err.code}: ${err.detail}` : err.code;
  }
}
