/**
 * One-time: color-code the Leads tab by Lead Tier (Best=green / Average=amber /
 * Worst=red). Whole data row is tinted via a CUSTOM_FORMULA keyed off the
 * "Lead Tier" column (found by header name, so column position doesn't matter).
 *
 * Reuses the app's service-account creds (read from env, never committed):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_SHEETS_ID
 *
 * RUN (repo root):  node scripts/setup-lead-tier-formatting.mjs
 *   (or: vercel env pull .env.local && node --env-file=.env.local scripts/setup-lead-tier-formatting.mjs)
 *
 * Re-running adds duplicate rules — run once. Safe: only adds conditional-format
 * rules; never edits data and never touches the booking columns.
 */
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || "1j4QLbVekw47vMZSm8RkhMbxHl-3nD9VCNT-RxYF7ScA";
const SHEET_NAME = "Leads";

const TIER_COLORS = {
  Best: "#B7E1CD", // green
  Average: "#FCE8B2", // amber
  Worst: "#F4C7C3", // red
};

function rgb(hex) {
  const h = hex.replace("#", "");
  return { red: parseInt(h.slice(0, 2), 16) / 255, green: parseInt(h.slice(2, 4), 16) / 255, blue: parseInt(h.slice(4, 6), 16) / 255 };
}
function colLetter(index) {
  let n = index + 1, s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function auth() {
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!client_email || !private_key) {
    console.error("STOP: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.");
    process.exit(2);
  }
  return new google.auth.GoogleAuth({ credentials: { client_email, private_key }, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

async function main() {
  const sheets = google.sheets({ version: "v4", auth: auth() });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))" });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
  if (!sheet) { console.error(`STOP: no "${SHEET_NAME}" tab.`); process.exit(1); }
  const sheetId = sheet.properties.sheetId;
  const { rowCount, columnCount } = sheet.properties.gridProperties;

  const headerRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!1:1` });
  const header = headerRes.data.values?.[0] ?? [];
  const tierIdx = header.findIndex((h) => String(h).trim().toLowerCase() === "lead tier");
  if (tierIdx < 0) { console.error('STOP: no "Lead Tier" header found — write at least one lead first.'); process.exit(1); }
  const tierCol = colLetter(tierIdx);

  // Whole-row tint over the data range, keyed off the Lead Tier column.
  const range = { sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: columnCount };
  const rule = (tier) => ({
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges: [range],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=$${tierCol}2="${tier}"` }] },
          format: { backgroundColor: rgb(TIER_COLORS[tier]) },
        },
      },
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [rule("Worst"), rule("Average"), rule("Best")] },
  });

  console.log(`Done. Row coloring keyed off Lead Tier (column ${tierCol}): Best=green, Average=amber, Worst=red.`);
}

main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });
