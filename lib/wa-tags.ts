/**
 * lib/wa-tags.ts — SERVER-ONLY tags on a WhatsApp contact.
 *
 * One row per phone, not per message: a tag describes the person ("sent
 * reports", "call booked", "wants payment plan"), so it must survive every new
 * message she sends. Kept in the same spreadsheet as everything else, so there
 * is still no second database to run.
 *
 * Tab: "Tags", created on first write.
 *   A Phone (E.164 digits) · B Tags (comma-separated) · C Updated (ISO)
 *
 * Free text rather than a fixed list, deliberately. A tag vocabulary invented
 * up front is always wrong; the labels that matter show up after fifty calls.
 * A handful of suggestions are offered in the UI and can be ignored.
 */
import { google } from "googleapis";

export const TAGS_SHEET = "Tags";
const HEADER = ["Phone", "Tags", "Updated"];

/** Starting points only — any text is accepted. */
export const SUGGESTED_TAGS = [
  "sent reports",
  "wants payment plan",
  "needs spouse ok",
  "hot",
  "follow up",
  "no show",
  "paid",
  "not a fit",
];

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

async function ensureTab(sheets: ReturnType<typeof getSheets>["sheets"], spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === TAGS_SHEET);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: TAGS_SHEET } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAGS_SHEET}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADER] },
  });
}

const clean = (list: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = raw.trim().replace(/\s+/g, " ").slice(0, 24).toLowerCase();
    // Commas are the field separator, so a tag can never contain one.
    if (!t || t.includes(",") || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
};

/** Every phone that has tags. Empty map when the tab does not exist yet. */
export async function readTags(): Promise<Map<string, string[]>> {
  const { sheets, spreadsheetId } = getSheets();
  const map = new Map<string, string[]>();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${TAGS_SHEET}!A2:C`,
    });
    for (const r of (res.data.values as string[][]) ?? []) {
      const phone = String(r[0] ?? "").replace(/\D/g, "");
      if (!phone) continue;
      const tags = clean(String(r[1] ?? "").split(","));
      map.set(phone, tags);
    }
  } catch {
    return map; // tab not created yet
  }
  return map;
}

/**
 * Replace the whole tag set for one phone. Rewrites the row in place when it
 * exists so the sheet never grows a second row for the same contact.
 */
export async function setTags(phone: string, tags: string[]): Promise<string[]> {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return [];
  const next = clean(tags);

  const { sheets, spreadsheetId } = getSheets();
  await ensureTab(sheets, spreadsheetId);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TAGS_SHEET}!A2:C`,
  });
  const rows = (res.data.values as string[][]) ?? [];
  const at = rows.findIndex((r) => String(r[0] ?? "").replace(/\D/g, "") === digits);
  const values = [[digits, next.join(", "), new Date().toISOString()]];

  if (at >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TAGS_SHEET}!A${at + 2}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${TAGS_SHEET}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  }
  return next;
}
