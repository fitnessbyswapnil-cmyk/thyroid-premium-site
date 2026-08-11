/**
 * lib/lead-sheet.ts — SERVER-ONLY Google Sheets lead writer.
 *
 * Writes the FULL qualifying-flow lead (contact + all answers + UTMs + score +
 * tier) to the "Leads" tab, idempotently by email. Never import in a client
 * component (uses googleapis + server-only env).
 *
 * SAFETY CONTRACT (derived from the live Make automations):
 *  - Positional pins, fixed by automations that match columns by LETTER/INDEX:
 *      Timestamp → A (0)   lifecycle "created after launch" filter reads col A
 *      Name      → C (2)   welcome email greeting reads col C
 *      Email     → E (4)   Cal "mark Booked" matches the row by col E
 *      Status    → Q (16)  lifecycle filter reads col Q == "lead_captured"
 *  - RESERVED, never written here: R (17) Booking Status, S (18) Booking Date —
 *    owned by the Cal.com → Sheets Make scenario.
 *  - Every other field maps by HEADER NAME; unknown headers are APPENDED after
 *    the current last column (safely past the lifecycle "sent flag" columns), so
 *    no existing column is ever moved or renamed.
 *  - Update-or-append by email: same email updates its row (never touching the
 *    reserved/booking/flag columns); new email appends a fresh row.
 */
import { google } from "googleapis";

export const SHEET_NAME = "Leads";

// Columns the email-recipient/lifecycle/booking automations match by position.
const PIN = { timestamp: 0, name: 2, email: 4, status: 16 } as const;
// Booking columns owned by Make — we must NEVER write these.
export const RESERVED_INDEXES = new Set<number>([17, 18]);

export type LeadColumn = {
  key: string; // matches a key in LeadFields
  title: string; // header text (canonical; one-time sheet setup should match)
  pin?: number; // forced 0-based column index (automation contract)
  createOnly?: boolean; // written only when appending a new row, never on update
};

// Canonical column order (titles the one-time sheet setup should create). The
// writer still maps by NAME at runtime, so exact existing positions win; this is
// the order used only when a column has to be appended.
export const LEAD_COLUMNS: LeadColumn[] = [
  { key: "timestamp", title: "Timestamp", pin: PIN.timestamp, createOnly: true },
  { key: "leadId", title: "Lead ID" },
  { key: "name", title: "Name", pin: PIN.name },
  { key: "phone", title: "Phone" },
  { key: "email", title: "Email", pin: PIN.email, createOnly: true },
  { key: "city", title: "City" },
  { key: "age", title: "Age" }, // not collected by the form; kept for legacy layout
  { key: "goal", title: "Goal" },
  { key: "challenge", title: "Biggest Challenge" },
  { key: "diagnosis", title: "Diagnosis" },
  { key: "medication", title: "On Medication" },
  { key: "duration", title: "Struggle Duration" },
  { key: "profession", title: "Profession" },
  { key: "tried", title: "Tried Before" },
  { key: "spent", title: "Amount Spent" },
  { key: "commitment", title: "Commitment (1-10)" },
  { key: "timing", title: "Timing" },
  { key: "investment", title: "Investment Ability" },
  { key: "decisionMaker", title: "Decision Maker" },
  { key: "utm_source", title: "UTM Source" },
  { key: "utm_medium", title: "UTM Medium" },
  { key: "utm_campaign", title: "UTM Campaign" },
  { key: "utm_content", title: "UTM Content" },
  { key: "utm_term", title: "UTM Term" },
  { key: "fbclid", title: "FBclid" },
  { key: "visitor_id", title: "Visitor ID" },
  { key: "leadScore", title: "Lead Score" },
  { key: "leadTier", title: "Lead Tier" },
  { key: "status", title: "Status", pin: PIN.status, createOnly: true },
];

export type LeadFields = Record<string, string>;

export type LeadWritePlan = {
  action: "append" | "update";
  rowNumber?: number; // 1-based, for update
  newHeaders: { index: number; title: string }[];
  header: string[]; // full header row after any appends (for header write-back)
  appendRow?: string[];
  updateCells?: { index: number; value: string }[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * PURE planner — no IO. Given the current header row, whether the email already
 * exists (rowNumber), and the field values, decide exactly what to write.
 * Unit-tested in lib/lead-sheet.test.ts.
 */
export function planLeadWrite(opts: {
  header: string[];
  existingRowNumber?: number;
  fields: LeadFields;
}): LeadWritePlan {
  // The live Leads sheet always has at least A..S (booking cols R/S exist).
  // A narrower header means it's uninitialised — refuse rather than risk writing
  // appended data onto the reserved booking columns. Run the one-time setup first.
  if (opts.header.length < 19) {
    throw new Error(
      `lead-sheet: header has only ${opts.header.length} columns — run the one-time header setup (needs at least A..S) before writing.`,
    );
  }

  const header = [...opts.header];
  const headerIndex = new Map<string, number>();
  header.forEach((h, i) => headerIndex.set(norm(String(h)), i));

  const newHeaders: { index: number; title: string }[] = [];

  // Resolve each column to a concrete 0-based index.
  const resolved = LEAD_COLUMNS.map((col) => {
    let index: number;
    if (col.pin != null) {
      index = col.pin;
    } else {
      const found = headerIndex.get(norm(col.title));
      // A name match that lands on a reserved booking column is ignored — we
      // never write R/S — and the field is appended instead.
      if (found != null && !RESERVED_INDEXES.has(found)) {
        index = found;
      } else {
        index = header.length;
        header.push(col.title);
        headerIndex.set(norm(col.title), index);
        newHeaders.push({ index, title: col.title });
      }
    }
    return { col, index };
  });

  // Hard guard: nothing we write may target a reserved column.
  for (const { col, index } of resolved) {
    if (RESERVED_INDEXES.has(index)) {
      throw new Error(`lead-sheet: refusing to write reserved column ${index} (${col.key})`);
    }
  }

  const isUpdate = opts.existingRowNumber != null;

  if (isUpdate) {
    const updateCells = resolved
      .filter(({ col }) => !col.createOnly && opts.fields[col.key] != null && opts.fields[col.key] !== "")
      .map(({ col, index }) => ({ index, value: opts.fields[col.key] }));
    return {
      action: "update",
      rowNumber: opts.existingRowNumber,
      newHeaders,
      header,
      updateCells,
    };
  }

  // Append: build a full-width row, our values at their indexes, "" elsewhere.
  const width = header.length;
  const appendRow = new Array<string>(width).fill("");
  for (const { col, index } of resolved) {
    const v = opts.fields[col.key];
    if (v != null) appendRow[index] = v;
  }
  return { action: "append", newHeaders, header, appendRow };
}

// ── Payment → existing lead row matching ────────────────────────────────────────
// A payment must UPDATE the lead's row, never append a second one. Appending
// created two unlinked rows per paying customer, inflated the lead count, and
// left the dashboard with no way to show who had actually paid.

/** Columns the matcher searches, as laid out in the live Leads sheet. */
export const MATCH_COLUMNS = { leadId: 1, phone: 3, email: 4 } as const;

/** Indian mobiles arrive variously as 9876543210 / 919876543210 / +91 98765 43210
 *  and the sheet returns them as "9876543210.0". Compare the last 10 digits. */
function last10(v: string): string {
  return String(v ?? "").replace(/\.0$/, "").replace(/\D/g, "").slice(-10);
}

/**
 * PURE — given the Lead ID / Phone / Email columns (index 0 = header row),
 * return the 1-based row number of the lead this payment belongs to.
 *
 * Match order is strongest-signal-first: an exact Lead ID beats a phone match,
 * which beats an email match. Email is last because the funnel writes a shared
 * placeholder address when a real one isn't supplied — matching on it first
 * would attach payments to whichever lead happened to be earliest.
 */
export function findLeadRowNumber(opts: {
  leadIds?: string[];
  phones?: string[];
  emails?: string[];
  leadId?: string;
  phone?: string;
  email?: string;
  placeholderEmail?: string;
}): number | undefined {
  const { leadIds = [], phones = [], emails = [] } = opts;

  const wantLeadId = (opts.leadId ?? "").trim();
  if (wantLeadId) {
    for (let i = 1; i < leadIds.length; i++) {
      if (String(leadIds[i] ?? "").trim() === wantLeadId) return i + 1;
    }
  }

  const wantPhone = last10(opts.phone ?? "");
  if (wantPhone.length === 10) {
    for (let i = 1; i < phones.length; i++) {
      if (last10(String(phones[i] ?? "")) === wantPhone) return i + 1;
    }
  }

  const wantEmail = norm(opts.email ?? "");
  const placeholder = norm(opts.placeholderEmail ?? "");
  if (wantEmail && wantEmail !== placeholder) {
    for (let i = 1; i < emails.length; i++) {
      if (norm(String(emails[i] ?? "")) === wantEmail) return i + 1;
    }
  }

  return undefined;
}

/** PURE — resolve (appending if absent) the columns a payment writes.
 *  Never targets a reserved booking column. */
export function planPaymentColumns(header: string[], titles: string[]): {
  header: string[];
  indexes: Record<string, number>;
  newHeaders: { index: number; title: string }[];
} {
  const out = [...header];
  const index = new Map<string, number>();
  out.forEach((h, i) => index.set(norm(String(h ?? "")), i));

  const indexes: Record<string, number> = {};
  const newHeaders: { index: number; title: string }[] = [];

  for (const title of titles) {
    const found = index.get(norm(title));
    if (found != null && !RESERVED_INDEXES.has(found)) {
      indexes[title] = found;
    } else {
      const i = out.length;
      out.push(title);
      index.set(norm(title), i);
      newHeaders.push({ index: i, title });
      indexes[title] = i;
    }
  }
  return { header: out, indexes, newHeaders };
}

// ── 0-based column index → A1 letters ───────────────────────────────────────────
export function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ── IO wrapper ──────────────────────────────────────────────────────────────────

function getSheets() {
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!client_email || !private_key || !spreadsheetId) {
    throw new Error("Missing Google Sheets env vars (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_SHEETS_ID)");
  }
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { sheets: google.sheets({ version: "v4", auth }), spreadsheetId };
}

export type LeadWriteResult = { action: "append" | "update"; rowNumber?: number; addedHeaders: string[] };

/** Read header + existing email rows, plan, then write. Throws on failure so the
 *  caller can alert (no silent drops). */
export async function writeLeadRow(fields: LeadFields): Promise<LeadWriteResult> {
  const { sheets, spreadsheetId } = getSheets();

  // Header row.
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!1:1`,
    majorDimension: "ROWS",
  });
  const header = (headerRes.data.values?.[0] ?? []).map((c) => String(c ?? ""));

  // Existing row for this email (match on pinned Email column E).
  const email = norm(fields.email ?? "");
  let existingRowNumber: number | undefined;
  if (email) {
    const colRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!${colLetter(PIN.email)}:${colLetter(PIN.email)}`,
      majorDimension: "COLUMNS",
    });
    const emails = colRes.data.values?.[0] ?? [];
    for (let i = 1; i < emails.length; i++) {
      if (norm(String(emails[i] ?? "")) === email) {
        existingRowNumber = i + 1; // 1-based row number
        break;
      }
    }
  }

  const plan = planLeadWrite({ header, existingRowNumber, fields });

  // Write any appended headers first (rewrite full row 1 — preserves originals).
  if (plan.newHeaders.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!1:1`,
      valueInputOption: "RAW",
      requestBody: { values: [plan.header] },
    });
  }

  if (plan.action === "update" && plan.rowNumber) {
    if (plan.updateCells && plan.updateCells.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: plan.updateCells.map((c) => ({
            range: `${SHEET_NAME}!${colLetter(c.index)}${plan.rowNumber}`,
            values: [[c.value]],
          })),
        },
      });
    }
    return { action: "update", rowNumber: plan.rowNumber, addedHeaders: plan.newHeaders.map((h) => h.title) };
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [plan.appendRow ?? []] },
  });
  return { action: "append", addedHeaders: plan.newHeaders.map((h) => h.title) };
}
