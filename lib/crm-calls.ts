/**
 * lib/crm-calls.ts — the "Calls" tab: one row per sales call.
 *
 * Why a separate tab and not more columns on Leads:
 *  - A lead can have more than one call (a reschedule, a second conversation
 *    with a husband on the line). Widening Leads would force the second call to
 *    overwrite the first, which is exactly the history worth keeping.
 *  - The Leads tab is under a positional contract with the Make automations
 *    (see lib/lead-sheet.ts). Nothing reads Calls except this app, so it can
 *    have a clean, name-mapped schema with no reserved columns.
 *
 * Key is the Cal.com booking uid — the same id used as the Meta Schedule
 * event_id and by /api/cal-webhook, so a call, a conversion and a booking all
 * agree on one identifier across every system.
 *
 * Nothing in here is written by hand. The webhook fills every column; the
 * `reviewed` flag exists only so the coach can mark a row he has corrected, and
 * a re-extraction never clobbers a row he has already reviewed.
 */
import { google } from "googleapis";

export const CALLS_SHEET = "Calls";

/** Column order used when the tab is created. Runtime mapping is by NAME. */
export const CALL_COLUMNS = [
  { key: "bookingUid", title: "Booking UID" },
  { key: "writtenAt", title: "Written At" },
  { key: "occurredAt", title: "Occurred At" },
  { key: "name", title: "Name" },
  { key: "email", title: "Email" },
  { key: "phone", title: "Phone" },
  { key: "attended", title: "Attended" },
  { key: "durationMin", title: "Duration Min" },
  { key: "coachTalkPct", title: "Coach Talk %" },
  { key: "pricePitched", title: "Price Pitched" },
  { key: "lowestPriceSaid", title: "Lowest Price Said" },
  { key: "discountOffered", title: "Discount Offered" },
  { key: "discountAt", title: "Discount At" },
  { key: "moneyMovedOnCall", title: "Money Moved On Call" },
  { key: "amountAgreed", title: "Amount Agreed" },
  { key: "objection", title: "Objection (real)" },
  { key: "excuse", title: "Excuse (stated)" },
  { key: "agreedCallbackAt", title: "Agreed Callback At" },
  { key: "summary", title: "Summary" },
  { key: "scorecardFailed", title: "Scorecard Failed" },
  { key: "scorecard", title: "Scorecard JSON" },
  { key: "fathomUrl", title: "Fathom URL" },
  { key: "extractedBy", title: "Extracted By" },
  { key: "reviewed", title: "Reviewed" },
] as const;

export type CallKey = (typeof CALL_COLUMNS)[number]["key"];
export type CallFields = Partial<Record<CallKey, string>>;

export const CALL_HEADER: string[] = CALL_COLUMNS.map((c) => c.title);

export type CallWritePlan = {
  action: "append" | "update" | "skip";
  /** 1-based sheet row, present for update. */
  rowNumber?: number;
  /** Full header row after any appends — written back when it grew. */
  header: string[];
  newHeaders: { index: number; title: string }[];
  appendRow?: string[];
  updateCells?: { index: number; value: string }[];
  /** Why a skip happened, for the log. */
  skipReason?: string;
};

const norm = (s: string) => String(s ?? "").trim().toLowerCase();

/**
 * PURE planner. Decides append vs update vs skip given the current header, any
 * existing row for this booking uid, and the extracted fields.
 *
 * `existingReviewed` is the guard that makes re-running the webhook safe: once
 * the coach has corrected a row by hand, a later re-extraction must not silently
 * overwrite his correction with the model's opinion.
 */
export function planCallWrite(opts: {
  header: string[];
  existingRowNumber?: number;
  existingReviewed?: boolean;
  fields: CallFields;
  /** Set when the coach explicitly asked for a re-extract. */
  force?: boolean;
}): CallWritePlan {
  const header = opts.header.length ? [...opts.header] : [...CALL_HEADER];

  if (opts.existingRowNumber && opts.existingReviewed && !opts.force) {
    return {
      action: "skip",
      header,
      newHeaders: [],
      skipReason: "row already reviewed by hand — refusing to overwrite",
    };
  }

  const index = new Map<string, number>();
  header.forEach((h, i) => index.set(norm(h), i));

  const newHeaders: { index: number; title: string }[] = [];
  for (const col of CALL_COLUMNS) {
    if (!index.has(norm(col.title))) {
      const at = header.length;
      header.push(col.title);
      index.set(norm(col.title), at);
      newHeaders.push({ index: at, title: col.title });
    }
  }

  const cellFor = (key: CallKey): { index: number; value: string } | null => {
    const col = CALL_COLUMNS.find((c) => c.key === key);
    if (!col) return null;
    const i = index.get(norm(col.title));
    if (i === undefined) return null;
    const v = opts.fields[key];
    return v === undefined ? null : { index: i, value: v };
  };

  if (opts.existingRowNumber) {
    const updateCells = CALL_COLUMNS.map((c) => cellFor(c.key)).filter(
      (c): c is { index: number; value: string } => c !== null,
    );
    return { action: "update", rowNumber: opts.existingRowNumber, header, newHeaders, updateCells };
  }

  const appendRow: string[] = new Array(header.length).fill("");
  for (const col of CALL_COLUMNS) {
    const cell = cellFor(col.key);
    if (cell) appendRow[cell.index] = cell.value;
  }
  return { action: "append", header, newHeaders, appendRow };
}

/** Row shape the CRM feed reads back. */
export type CallRow = { row: number } & Record<CallKey, string>;

export function parseCallRows(values: string[][]): CallRow[] {
  if (!values.length) return [];
  const header = values[0].map(norm);
  const at = (k: CallKey) => {
    const col = CALL_COLUMNS.find((c) => c.key === k)!;
    return header.indexOf(norm(col.title));
  };
  const idx = Object.fromEntries(CALL_COLUMNS.map((c) => [c.key, at(c.key)])) as Record<CallKey, number>;

  const out: CallRow[] = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r] ?? [];
    const uidIdx = idx.bookingUid;
    if (uidIdx < 0 || !String(row[uidIdx] ?? "").trim()) continue;
    const rec = { row: r + 1 } as CallRow;
    for (const c of CALL_COLUMNS) {
      const i = idx[c.key];
      (rec as Record<string, string | number>)[c.key] = i >= 0 ? String(row[i] ?? "").trim() : "";
    }
    out.push(rec);
  }
  return out;
}

// ── IO ──────────────────────────────────────────────────────────────────────

async function client() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  // GOOGLE_SHEETS_ID — the same name app/api/admin/_lib.ts has always used.
  // This module originally invented LEADS_SHEET_ID / GOOGLE_SHEET_ID, neither of
  // which exists, so the Calls tab reported sheets_not_configured on a project
  // where every other sheet read worked perfectly.
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!email || !rawKey || !sheetId) {
    const missing = [!email && "GOOGLE_SERVICE_ACCOUNT_EMAIL", !rawKey && "GOOGLE_PRIVATE_KEY", !sheetId && "GOOGLE_SHEETS_ID"]
      .filter(Boolean)
      .join(", ");
    throw new Error(`sheets_not_configured — missing ${missing}`);
  }
  const auth = new google.auth.JWT({
    email,
    key: rawKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { sheets: google.sheets({ version: "v4", auth }), sheetId };
}

/** Creates the Calls tab with its header if it does not exist yet. */
export async function ensureCallsSheet(): Promise<void> {
  const { sheets, sheetId } = await client();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === CALLS_SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: CALLS_SHEET } } }] },
    });
  }
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${CALLS_SHEET}!A1:BZ1` });
  if (!(cur.data.values?.[0]?.length)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${CALLS_SHEET}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [CALL_HEADER] },
    });
  }
}

export async function readCalls(): Promise<CallRow[]> {
  const { sheets, sheetId } = await client();
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${CALLS_SHEET}!A1:BZ` });
    return parseCallRows((res.data.values as string[][]) ?? []);
  } catch (err) {
    // Tab not created yet is a normal cold-start state, not an error.
    if (String(err).includes("Unable to parse range")) return [];
    throw err;
  }
}

export async function writeCall(fields: CallFields, opts: { force?: boolean } = {}): Promise<CallWritePlan> {
  const uid = (fields.bookingUid ?? "").trim();
  if (!uid) throw new Error("bookingUid required");

  await ensureCallsSheet();
  const { sheets, sheetId } = await client();

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${CALLS_SHEET}!A1:BZ` });
  const values = (res.data.values as string[][]) ?? [];
  const header = values[0] ?? [];
  const existing = parseCallRows(values).find((r) => r.bookingUid === uid);

  const plan = planCallWrite({
    header,
    existingRowNumber: existing?.row,
    existingReviewed: /^y(es)?$/i.test(existing?.reviewed ?? ""),
    fields,
    force: opts.force,
  });

  if (plan.action === "skip") return plan;

  if (plan.newHeaders.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${CALLS_SHEET}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [plan.header] },
    });
  }

  if (plan.action === "append" && plan.appendRow) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${CALLS_SHEET}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [plan.appendRow] },
    });
  } else if (plan.action === "update" && plan.rowNumber && plan.updateCells?.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: plan.updateCells.map((c) => ({
          range: `${CALLS_SHEET}!${colA1(c.index)}${plan.rowNumber}`,
          values: [[c.value]],
        })),
      },
    });
  }
  return plan;
}

/** 0-based column index → A1 letters (0→A, 25→Z, 26→AA). */
export function colA1(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
