/**
 * lib/leads-header.ts — SERVER-ONLY. Reads row 1 of the Leads tab and adds
 * missing headers without rewriting the row.
 *
 * Two things went wrong together in /api/quiz-lead:
 *  - It read the header as `Leads!A1:BC1` (55 columns) on a sheet that runs to
 *    CS (97). "Budget" is in BD, so the route decided the column was missing.
 *  - It then "added" Budget by writing back the whole row it had read. That
 *    re-stamped every header cell on every quiz that carried a budget,
 *    including the stray "Q85" in A1 and "count=2 total=167" in Z1. It
 *    reached BD1 only because BC1 happened to be filled.
 *
 * Here the header is always read whole (`Leads!1:1`, however wide). A missing
 * header is written as ONE cell, after the last column in use. No existing
 * header cell is ever written. Repairing A1 or Z1 is a separate, owner-approved
 * job; this code leaves both exactly as it finds them.
 */
import { ensureGridColumns, headerCellRange, headerRowRange, type SheetsClient } from "./lead-sheet.ts";
import { findOrAddColumn } from "./turnstile.ts";

/** What she saw on screen, 0-100. Read by admin/today and admin/dashboard. */
export const THYROID_SCORE_HEADER = "Thyroid Score";
/** How many of the seven blockers her answers flagged. Same readers. */
export const BLOCKERS_HEADER = "Blockers";

/** All of row 1, trimmed. One entry per column up to the last filled one. */
export async function readHeaderRow(sheets: SheetsClient, spreadsheetId: string, sheetName: string): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: headerRowRange(sheetName) });
  const row = (res.data.values?.[0] ?? []) as unknown[];
  return row.map((h) => String(h ?? "").trim());
}

/** Writes ONE header cell. Widens the grid first, because writing past its last column fails. */
export async function writeHeaderCell(
  sheets: SheetsClient,
  spreadsheetId: string,
  sheetName: string,
  index: number,
  title: string,
): Promise<void> {
  await ensureGridColumns(sheets, spreadsheetId, sheetName, index);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: headerCellRange(sheetName, index),
    valueInputOption: "RAW",
    requestBody: { values: [[title]] },
  });
}

/**
 * Returns `place(title)`, which finds a column by its header name and adds the
 * header if the sheet has never had it.
 *
 * `header` is the row the caller already read. It is kept up to date in place,
 * so a second call in the same request appends after the first one, and the
 * caller's own name lookups see the new column. If the title is not in it, the
 * live row is read again before anything is written, so a column another
 * request added a moment ago is reused rather than duplicated.
 *
 * Returns -1 when the header cannot be written. That value is lost; the lead
 * is not.
 */
export function columnPlacer(opts: {
  sheets: SheetsClient;
  spreadsheetId: string;
  sheetName: string;
  header: string[];
}): (title: string) => Promise<number> {
  const { sheets, spreadsheetId, sheetName, header } = opts;
  return async (title: string) => {
    const at = await findOrAddColumn({
      known: header,
      title,
      readFullHeader: () => readHeaderRow(sheets, spreadsheetId, sheetName),
      writeHeaderCell: (index, t) => writeHeaderCell(sheets, spreadsheetId, sheetName, index, t),
    });
    if (at >= 0) header[at] = title;
    return at;
  };
}
