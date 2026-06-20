/**
 * Optional backfill: compute Lead Score + Lead Tier for existing rows that have
 * answers but no score yet. Uses the SAME scoring model as the live route
 * (imported from lib/lead-scoring.ts), mapping sheet columns back to answers by
 * header name.
 *
 * Reuses the app's service-account creds (read from env, never committed):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_SHEETS_ID
 *
 * RUN (repo root, Node ≥ 22.6 for TS import):
 *   node --experimental-strip-types scripts/backfill-lead-scores.mjs           # only blank rows
 *   node --experimental-strip-types scripts/backfill-lead-scores.mjs --force   # recompute all
 *
 * Read-mostly: only writes the Lead Score / Lead Tier cells; never touches the
 * booking columns or any other data.
 */
import { google } from "googleapis";
import { scoreLead } from "../lib/lead-scoring.ts";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || "1j4QLbVekw47vMZSm8RkhMbxHl-3nD9VCNT-RxYF7ScA";
const SHEET_NAME = "Leads";
const FORCE = process.argv.includes("--force");

// Sheet header title → scoring answer key.
const COL_TO_KEY = {
  "goal": "goal",
  "biggest challenge": "challenge",
  "diagnosis": "diagnosis",
  "on medication": "medication",
  "struggle duration": "duration",
  "profession": "profession",
  "tried before": "tried",
  "amount spent": "spent",
  "commitment (1-10)": "commitment",
  "timing": "timing",
  "investment ability": "investment",
  "decision maker": "decisionMaker",
};

function colLetter(index) {
  let n = index + 1, s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function auth() {
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!client_email || !private_key) { console.error("STOP: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY."); process.exit(2); }
  return new google.auth.GoogleAuth({ credentials: { client_email, private_key }, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

async function main() {
  const sheets = google.sheets({ version: "v4", auth: auth() });

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A1:CZ` });
  const rows = res.data.values ?? [];
  if (rows.length < 2) { console.log("No data rows."); return; }

  const header = rows[0].map((h) => String(h).trim());
  const lower = header.map((h) => h.toLowerCase());
  const scoreIdx = lower.indexOf("lead score");
  const tierIdx = lower.indexOf("lead tier");
  if (scoreIdx < 0 || tierIdx < 0) { console.error('STOP: "Lead Score"/"Lead Tier" headers missing — write one lead via the form first.'); process.exit(1); }

  const data = [];
  let scored = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const hasScore = String(row[scoreIdx] ?? "").trim() !== "";
    if (hasScore && !FORCE) continue;

    const answers = {};
    for (let c = 0; c < header.length; c++) {
      const key = COL_TO_KEY[lower[c]];
      if (!key) continue;
      const raw = String(row[c] ?? "").trim();
      if (!raw) continue;
      if (key === "tried") answers[key] = raw.split(",").map((s) => s.trim()).filter(Boolean);
      else if (key === "commitment") answers[key] = Number(raw) || 0;
      else answers[key] = raw;
    }
    const { score, tier } = scoreLead(answers);
    const rowNum = r + 1;
    data.push({ range: `${SHEET_NAME}!${colLetter(scoreIdx)}${rowNum}`, values: [[String(score)]] });
    data.push({ range: `${SHEET_NAME}!${colLetter(tierIdx)}${rowNum}`, values: [[tier]] });
    scored++;
  }

  if (data.length === 0) { console.log("Nothing to backfill (all rows already scored). Use --force to recompute."); return; }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  console.log(`Backfilled ${scored} row(s) with Lead Score + Lead Tier${FORCE ? " (forced recompute)" : ""}.`);
}

main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });
