/**
 * lib/journey-marks.ts — SERVER ONLY. The steps of her journey that happen on
 * his side of the screen and that nothing else records: his notes Doc made,
 * her summary made and sent, the thank-you, the pre-call PDF, onboarding and
 * the three follow-ups. D1 (thyroid-ledger), table journey_marks,
 * migrations/0006_journey_marks.sql.
 *
 * WHY
 * The journey card (lib/next-action) shows one button for the next thing to
 * do, and the button after a call depends on exactly these facts: notes made
 * but no summary means "Review and send summary"; a summary sent means the
 * follow-ups start. The Doc and the PDF live in his Drive, which is reached
 * only through his Apps Script at a subrequest a question, so asking Drive
 * per card would spend a screen's whole subrequest budget on forty cards.
 * Here, every card on a screen is one query.
 *
 * ONE ROW PER WOMAN AND KIND
 * The latest time it happened, and the link that goes with it when there is
 * one (the notes Doc, the summary PDF). A later write without a link keeps
 * the earlier one: "Send from your phone" records summary_sent with no PDF,
 * and the card must still be able to open the PDF it is about.
 *
 * PRIVACY
 * phone_key is the SHA-256 of "p:" + her last 10 digits (lib/journey-store
 * hashKey), the key drive_files and lead_journey already use. Never the number.
 *
 * NEVER THROWS
 * A mark is bookkeeping. recordMark is called inside after(), and a D1 hiccup
 * there must cost a card one step, never a button its job. A read that fails
 * returns no marks, which only makes the cards offer a step again.
 *
 * Off Cloudflare (next dev, node --test, the Vercel copy) getLedgerDb() is
 * null: nothing is recorded and every read is empty.
 */
import { getLedgerDb, type D1Database } from "./ledger.ts";
import { hashKey } from "./journey-store.ts";

export type MarkKind =
  | "notes_made"
  | "summary_made"
  | "summary_sent"
  | "thank_you_sent"
  | "precall_made"
  | "precall_sent"
  | "onboarded"
  | "followup_1"
  | "followup_2"
  | "followup_3";

export const MARK_KINDS: readonly MarkKind[] = [
  "notes_made",
  "summary_made",
  "summary_sent",
  "thank_you_sent",
  "precall_made",
  "precall_sent",
  "onboarded",
  "followup_1",
  "followup_2",
  "followup_3",
];

export type Mark = { at: number; url: string };
export type Marks = Partial<Record<MarkKind, Mark>>;

export function isMarkKind(k: unknown): k is MarkKind {
  return typeof k === "string" && (MARK_KINDS as readonly string[]).includes(k);
}

/** Same schema as migrations/0006_journey_marks.sql (a test holds the two together). */
export const JOURNEY_MARKS_DDL = [
  `CREATE TABLE IF NOT EXISTS journey_marks (
    phone_key  TEXT NOT NULL,
    kind       TEXT NOT NULL,
    at         INTEGER NOT NULL,
    url        TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (phone_key, kind)
  )`,
];

/** For the tests only: the routes use the worker's binding and the real clock. */
export type MarksDeps = { db?: () => Promise<D1Database | null>; now?: () => number };

/** D1 caps bound parameters per query at 100. */
const IN_CHUNK = 50;
/** A read that has not answered by now is abandoned: the page renders without marks. */
const READ_TIMEOUT_MS = 2500;
const MAX_URL = 500;

const digits10 = (s: string) => String(s ?? "").replace(/\D/g, "").slice(-10);
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));
const params = (n: number) => Array.from({ length: n }, (_, i) => `?${i + 1}`).join(", ");

const ready = new WeakSet<D1Database>();

/**
 * Once per isolate (per binding), so the cards work before the migration is
 * applied. A failure is not remembered: the next call tries again.
 */
async function ensureTable(db: D1Database): Promise<void> {
  if (ready.has(db)) return;
  await db.batch(JOURNEY_MARKS_DDL.map((sql) => db.prepare(sql)));
  ready.add(db);
}

function within<T>(ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer in ${ms} ms`)), ms);
  });
  // Cleared either way, so a fast answer leaves no timer holding the isolate open.
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/**
 * That this happened for her, now. `url` is the file it made, when it made
 * one. Never throws, and a number that is not ten digits or a kind that is not
 * one of MARK_KINDS is ignored rather than stored.
 */
export async function recordMark(phone: string, kind: MarkKind, url?: string, deps: MarksDeps = {}): Promise<void> {
  try {
    const p = digits10(phone);
    if (p.length !== 10 || !isMarkKind(kind)) return;
    const db = await (deps.db ?? getLedgerDb)();
    if (!db) return;
    await ensureTable(db);
    const at = (deps.now ?? Date.now)();
    const link = String(url ?? "").trim().slice(0, MAX_URL);
    await db
      .prepare(
        `INSERT INTO journey_marks (phone_key, kind, at, url) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(phone_key, kind) DO UPDATE SET at = ?3,
           url = CASE WHEN ?4 <> '' THEN ?4 ELSE journey_marks.url END`,
      )
      .bind(await hashKey(`p:${p}`), kind, at, link)
      .run();
  } catch (err) {
    console.error(`[journey-marks] ${kind} write failed (swallowed):`, errText(err));
  }
}

/**
 * Every mark for every number asked about, keyed by the last 10 digits. One
 * call for a whole screen: the numbers are hashed, split into chunks of 50
 * bound parameters, and the chunks go to D1 in one batch.
 */
export async function readMarks(phones: string[], deps: MarksDeps = {}): Promise<Map<string, Marks>> {
  const out = new Map<string, Marks>();
  const unique = [...new Set(phones.map(digits10).filter((p) => p.length === 10))];
  if (!unique.length) return out;
  try {
    const db = await (deps.db ?? getLedgerDb)();
    if (!db) return out;
    const hashes = await Promise.all(unique.map((p) => hashKey(`p:${p}`)));
    const byKey = new Map(hashes.map((h, i) => [h, unique[i]]));
    await within(READ_TIMEOUT_MS, ensureTable(db));
    const keys = [...byKey.keys()];
    const statements = [];
    for (let i = 0; i < keys.length; i += IN_CHUNK) {
      const part = keys.slice(i, i + IN_CHUNK);
      statements.push(
        db.prepare(`SELECT phone_key, kind, at, url FROM journey_marks WHERE phone_key IN (${params(part.length)})`).bind(...part),
      );
    }
    const results = await within(
      READ_TIMEOUT_MS,
      db.batch<{ phone_key: string; kind: string; at: number; url: string }>(statements),
    );
    for (const res of results) {
      for (const r of res.results ?? []) {
        const phone = byKey.get(r.phone_key);
        if (!phone || !isMarkKind(r.kind)) continue;
        const marks = out.get(phone) ?? {};
        marks[r.kind] = { at: Number(r.at), url: String(r.url ?? "") };
        out.set(phone, marks);
      }
    }
  } catch (err) {
    console.error("[journey-marks] read failed (swallowed):", errText(err));
  }
  return out;
}
