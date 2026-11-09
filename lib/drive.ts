/**
 * lib/drive.ts — the coach's own call notes, as a Google Doc per booking.
 *
 * WHY THE SYSTEM CREATES THE DOC AND NOT HIM
 * He types notes while he is on the call: what she actually said, what he
 * concluded. Fathom records what was SAID; this is what he UNDERSTOOD, and no
 * transcript can produce it. Both feed the consultation summary.
 *
 * The obvious version — he makes a doc per client, named after her — breaks on
 * the only hard part: finding it again. Everything else in this system keys on
 * leadId, phone or email, and a name does not. "Meera K." / "Meera Kulkarni" /
 * "meera" are one woman and three lookups, and lib/booking-lead-score-sheet
 * already records that one woman is routinely spread across several rows by
 * three different writers. A name-matched doc would be a fifth surface for the
 * same drift.
 *
 * So the doc is created HERE, from the booking, with the phone in its title.
 * Nothing ever has to guess which doc belongs to which call.
 *
 * SCOPE is drive.file, deliberately: it reaches only files this app created or
 * that were explicitly shared with it. The service account cannot read the rest
 * of his Drive, which matters because the next thing in this folder is medical.
 *
 * NO DOCS API. A Doc is created by POSTing HTML and asking Drive to convert it
 * (`mimeType: application/vnd.google-apps.document`), so the headings he types
 * under are real Doc headings without a second API, a second scope, or a second
 * thing to go wrong.
 *
 * googleClientOptions is not optional — see AGENTS.md. Without it Google's
 * responses arrive still gzipped on Workers and every call fails.
 */
import { google } from "googleapis";
import { googleClientOptions } from "./google-fetch.ts";

/** The Drive folder the owner shared with the service account (Editor). */
export const NOTES_FOLDER_ENV = "GOOGLE_DRIVE_NOTES_FOLDER_ID";

export function notesFolderId(): string {
  return (process.env[NOTES_FOLDER_ENV] ?? "").trim();
}

export async function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Missing Google service account env vars");
  const auth = new google.auth.GoogleAuth({
    clientOptions: googleClientOptions,
    credentials: { client_email: email, private_key: key },
    // Least privilege: only files this app made or was handed.
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
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

/** Drive query strings are single-quoted; an apostrophe in a name would end one. */
const escapeQuery = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/**
 * The note he opens on the call. Headings only — the words are his.
 *
 * They are the sections the consultation summary is built from, in the order
 * the call runs, so by the end of the call the summary is already drafted and
 * nothing has to be remembered afterwards.
 */
export function notesTemplateHtml(input: { name: string; phone: string; when: string }): string {
  const when = new Date(input.when);
  const whenLabel = Number.isFinite(when.getTime())
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata", weekday: "short", day: "numeric",
        month: "short", hour: "numeric", minute: "2-digit",
      }).format(when)
    : "—";
  const esc = (s: string) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><body>
<h1>${esc(input.name || "Unnamed")}</h1>
<p>${esc(digits10(input.phone))} &middot; ${esc(whenLabel)} IST</p>
<h2>Her words</h2>
<p>The line to quote back to her. Keep it verbatim.</p>
<h2>Symptoms</h2>
<p></p>
<h2>Markers</h2>
<p>Only what her report actually shows. No value goes in here from memory.</p>
<h2>Blockers</h2>
<p>All of them, numbered.</p>
<h2>Already spent</h2>
<p>What she tried, how long, how much. Her numbers, not estimates.</p>
<h2>Objection</h2>
<p>What she said, and underneath it what you think it really was.</p>
<h2>Next step</h2>
<p>An amount, a clock time and a named action.</p>
</body></html>`;
}

export type NotesDoc = { id: string; url: string; title: string; created: boolean };

/**
 * Return the notes doc for this booking, making it only if it is not there.
 *
 * Idempotent on the title rather than on stored state: pressing the button
 * twice, or on two devices, must not leave him with two half-written notes for
 * one call. `trashed = false` so a doc he deleted on purpose comes back fresh
 * instead of resurrecting from the bin.
 */
export async function ensureNotesDoc(input: {
  name: string;
  phone: string;
  when: string;
}): Promise<NotesDoc> {
  const folder = notesFolderId();
  if (!folder) throw new Error(`${NOTES_FOLDER_ENV} is not set`);

  const drive = await getDriveClient();
  const title = notesTitle(input);

  const found = await drive.files.list({
    q: `name = '${escapeQuery(title)}' and '${escapeQuery(folder)}' in parents and trashed = false`,
    fields: "files(id,name,webViewLink)",
    pageSize: 1,
  });
  const hit = found.data.files?.[0];
  if (hit?.id) {
    return {
      id: hit.id,
      url: hit.webViewLink ?? `https://docs.google.com/document/d/${hit.id}/edit`,
      title,
      created: false,
    };
  }

  const made = await drive.files.create({
    requestBody: {
      name: title,
      parents: [folder],
      mimeType: "application/vnd.google-apps.document",
    },
    media: { mimeType: "text/html", body: notesTemplateHtml(input) },
    fields: "id,webViewLink",
  });
  const id = made.data.id;
  if (!id) throw new Error("Drive returned no file id");
  return {
    id,
    url: made.data.webViewLink ?? `https://docs.google.com/document/d/${id}/edit`,
    title,
    created: true,
  };
}
