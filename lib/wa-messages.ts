/**
 * lib/wa-messages.ts — SERVER-ONLY store for WhatsApp conversations.
 *
 * Cloud API has no inbox. Incoming messages arrive as webhooks and are gone
 * unless something catches them, which is exactly the product a BSP sells for
 * ~Rs1,500/month. This is that inbox, kept in the spreadsheet the funnel
 * already uses so there is no new database to run or pay for.
 *
 * Tab: "Messages", created on first write.
 *   A Timestamp (ISO) · B Phone (E.164 digits) · C Direction (in|out)
 *   D Text · E Message ID · F Name · G Read (Y|"")
 *
 * Phone is the join key back to the Leads tab, so a thread can be shown beside
 * her Thyroid Score, blockers, budget and payment state — context no external
 * inbox could ever have.
 */
import { google } from "googleapis";

export const MESSAGES_SHEET = "Messages";
const HEADER = ["Timestamp", "Phone", "Direction", "Text", "Message ID", "Name", "Read"];

export type WaMessage = {
  ts: string;
  phone: string;
  direction: "in" | "out";
  text: string;
  messageId: string;
  name: string;
  read: boolean;
};

function getSheets() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!email || !key || !spreadsheetId) throw new Error("Missing Google Sheets env vars");
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { sheets: google.sheets({ version: "v4", auth }), spreadsheetId };
}

/** Create the Messages tab the first time anything is written. Idempotent. */
async function ensureTab(sheets: ReturnType<typeof getSheets>["sheets"], spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === MESSAGES_SHEET);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: MESSAGES_SHEET } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${MESSAGES_SHEET}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADER] },
  });
}

/**
 * Append one message. Throws on failure so the webhook can log it — a silently
 * dropped inbound message is a lost customer, so it must never fail quietly.
 */
export async function appendMessage(m: Omit<WaMessage, "read"> & { read?: boolean }): Promise<void> {
  const { sheets, spreadsheetId } = getSheets();
  await ensureTab(sheets, spreadsheetId);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${MESSAGES_SHEET}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        m.ts,
        m.phone,
        m.direction,
        // Sheets treats a leading = / + / - as a formula; a message starting
        // with one would render as #NAME? or worse, execute.
        /^[=+\-@]/.test(m.text) ? `'${m.text}` : m.text,
        m.messageId,
        m.name,
        m.read ? "Y" : "",
      ]],
    },
  });
}

/** Every message, oldest first. The dashboard groups them into threads. */
export async function readMessages(): Promise<WaMessage[]> {
  const { sheets, spreadsheetId } = getSheets();
  let rows: string[][] = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${MESSAGES_SHEET}!A2:G`,
    });
    rows = (res.data.values as string[][]) ?? [];
  } catch {
    return []; // tab not created yet — no conversations have happened
  }
  return rows
    .filter((r) => r[0] && r[1])
    .map((r) => ({
      ts: String(r[0] ?? ""),
      phone: String(r[1] ?? "").replace(/\D/g, ""),
      direction: String(r[2] ?? "in") === "out" ? "out" : "in",
      text: String(r[3] ?? "").replace(/^'/, ""),
      messageId: String(r[4] ?? ""),
      name: String(r[5] ?? ""),
      read: String(r[6] ?? "").toUpperCase() === "Y",
    }));
}

/** Mark every inbound message from one phone as read. Best-effort. */
export async function markThreadRead(phone: string): Promise<void> {
  const digits = phone.replace(/\D/g, "");
  const { sheets, spreadsheetId } = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${MESSAGES_SHEET}!A2:G`,
  });
  const rows = (res.data.values as string[][]) ?? [];
  const updates: { range: string; values: string[][] }[] = [];
  rows.forEach((r, i) => {
    if (String(r[1] ?? "").replace(/\D/g, "") === digits && String(r[6] ?? "").toUpperCase() !== "Y") {
      updates.push({ range: `${MESSAGES_SHEET}!G${i + 2}`, values: [["Y"]] });
    }
  });
  if (!updates.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: updates },
  });
}
