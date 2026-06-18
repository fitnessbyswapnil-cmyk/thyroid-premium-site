/**
 * One-off: professional formatting + lead-score columns on the "Leads" sheet.
 *
 * Reuses the SAME service-account creds the app uses for Sheets:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY            (literal "\n" escapes are un-escaped, like the app)
 *   GOOGLE_SHEETS_ID             (optional — defaults to the id below)
 *
 * RUN (from repo root, where node_modules/googleapis lives):
 *   export GOOGLE_SERVICE_ACCOUNT_EMAIL=...     # or: vercel env pull .env.local
 *   export GOOGLE_PRIVATE_KEY='-----BEGIN...'   #     then: node --env-file=.env.local scripts/format-leads-sheet.mjs
 *   node scripts/format-leads-sheet.mjs
 *
 * Does NOT commit or print creds. Safe to delete after running.
 *
 * What it does, all in ONE atomic spreadsheets.batchUpdate (all-or-nothing — a
 * read-only service account fails here having changed NOTHING):
 *   1. Appends "Lead Score" + "Lead Band" AFTER the last USED column (never inserts
 *      mid-sheet, so existing numeric column indexes the Make scenarios use don't shift).
 *   2. Conditional formatting on Lead Band: Hot / Warm / Cold.
 *   3. Color scale on Lead Score: 0 -> 35 -> 70.
 *   4. Header row styled + frozen.
 *   5. Alternating row banding on the data range.
 */
import { google } from "googleapis";

const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_ID || "1j4QLbVekw47vMZSm8RkhMbxHl-3nD9VCNT-RxYF7ScA";
const SHEET_NAME = "Leads";

// hex -> Sheets API {red,green,blue} floats (0..1)
function rgb(hex) {
  const h = hex.replace("#", "");
  return {
    red: parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue: parseInt(h.slice(4, 6), 16) / 255,
  };
}

// 0-based column index -> A1 letter(s)
function colLetter(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function getAuth() {
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!client_email || !private_key) {
    console.error(
      "STOP: GOOGLE_SERVICE_ACCOUNT_EMAIL and/or GOOGLE_PRIVATE_KEY are not set.\n" +
        "      These are the same creds the app's /api/leads route uses. Export them\n" +
        "      (or `vercel env pull .env.local` then run with `node --env-file=.env.local`)."
    );
    process.exit(2);
  }
  return new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    // read+write — required for batchUpdate
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function main() {
  const sheets = google.sheets({ version: "v4", auth: getAuth() });

  // ── Read: locate the "Leads" tab + its grid, and the header row ──────────────
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount,frozenRowCount)))",
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
  if (!sheet) {
    console.error(`STOP: no tab named "${SHEET_NAME}" in spreadsheet ${SPREADSHEET_ID}.`);
    process.exit(1);
  }
  const sheetId = sheet.properties.sheetId;
  const grid = sheet.properties.gridProperties;
  const rowCount = grid.rowCount;
  let colCount = grid.columnCount;

  // Last USED column = number of non-empty header cells in row 1.
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!1:1`,
    majorDimension: "ROWS",
  });
  const header = headerRes.data.values?.[0] ?? [];
  const usedCols = header.length;
  if (usedCols === 0) {
    console.error("STOP: header row (row 1) is empty — refusing to guess the used range.");
    process.exit(1);
  }

  // Idempotency guard: if the last two headers are already ours, bail (re-run safe).
  const tail = header.slice(-2).map((c) => String(c).trim());
  if (tail[0] === "Lead Score" && tail[1] === "Lead Band") {
    console.log("Already applied: 'Lead Score' + 'Lead Band' are the last two headers. Nothing to do.");
    return;
  }

  const scoreCol = usedCols; // 0-based index of "Lead Score"
  const bandCol = usedCols + 1; // 0-based index of "Lead Band"
  const lastCol = bandCol; // new last column

  console.log(
    `"${SHEET_NAME}": used columns = ${usedCols} (A..${colLetter(usedCols - 1)}). ` +
      `Appending "Lead Score" -> ${colLetter(scoreCol)}, "Lead Band" -> ${colLetter(bandCol)}.`
  );

  const requests = [];

  // 0. Extend the grid only if it's not already wide enough (append at END — never insert).
  if (colCount < lastCol + 1) {
    requests.push({
      appendDimension: { sheetId, dimension: "COLUMNS", length: lastCol + 1 - colCount },
    });
  }

  // 1. Write the two new header labels.
  requests.push({
    updateCells: {
      start: { sheetId, rowIndex: 0, columnIndex: scoreCol },
      rows: [
        {
          values: [
            { userEnteredValue: { stringValue: "Lead Score" } },
            { userEnteredValue: { stringValue: "Lead Band" } },
          ],
        },
      ],
      fields: "userEnteredValue",
    },
  });

  // 2. Header row styling across ALL columns (incl. the two new ones).
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastCol + 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: rgb("#7D4F5A"),
          horizontalAlignment: "CENTER",
          textFormat: { bold: true, foregroundColor: rgb("#FBF8F3") },
        },
      },
      fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)",
    },
  });

  // 3. Freeze row 1.
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: "gridProperties.frozenRowCount",
    },
  });

  // 4. Conditional formatting on Lead Band (data rows only).
  const bandRange = { sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: bandCol, endColumnIndex: bandCol + 1 };
  const bandRule = (text, bg, fg, bold) => ({
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges: [bandRange],
        booleanRule: {
          condition: { type: "TEXT_EQ", values: [{ userEnteredValue: text }] },
          format: { backgroundColor: rgb(bg), textFormat: { bold, foregroundColor: rgb(fg) } },
        },
      },
    },
  });
  requests.push(bandRule("Hot", "#1E7E45", "#FFFFFF", true));
  requests.push(bandRule("Warm", "#C9A24B", "#FFFFFF", true));
  requests.push(bandRule("Cold", "#E0E0E0", "#555555", false));

  // 5. Color scale on Lead Score (data rows only).
  requests.push({
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: scoreCol, endColumnIndex: scoreCol + 1 }],
        gradientRule: {
          minpoint: { color: rgb("#F4C7C3"), type: "NUMBER", value: "0" },
          midpoint: { color: rgb("#FCE8B2"), type: "NUMBER", value: "35" },
          maxpoint: { color: rgb("#B7E1CD"), type: "NUMBER", value: "70" },
        },
      },
    },
  });

  // 6. Alternating row banding on the data range (white / #FBF8F3).
  requests.push({
    addBanding: {
      bandedRange: {
        range: { sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: lastCol + 1 },
        rowProperties: { firstBandColor: rgb("#FFFFFF"), secondBandColor: rgb("#FBF8F3") },
      },
    },
  });

  // ── Write: one atomic batchUpdate. 403 here == read-only SA, nothing changed. ──
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  } catch (err) {
    const code = err?.code || err?.response?.status;
    if (code === 403) {
      console.error(
        "STOP: service account has READ-ONLY access (403 PERMISSION_DENIED).\n" +
          "      Nothing was changed (batchUpdate is atomic). Grant it Editor on the sheet and re-run."
      );
      process.exit(1);
    }
    throw err;
  }

  console.log(
    `Done. Added "Lead Score" (${colLetter(scoreCol)}) and "Lead Band" (${colLetter(bandCol)}). ` +
      `No existing columns shifted — both were appended after the last used column.`
  );
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
