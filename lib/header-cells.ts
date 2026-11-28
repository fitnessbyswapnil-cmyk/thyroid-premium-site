/**
 * lib/header-cells.ts — PURE. A missing header becomes one single-cell write
 * on row 1, never a rewrite of the whole row.
 *
 * Writing `Leads!1:1` with the full header array writes back every header the
 * caller happened to read. On 24-Sep-2026 a truncated read turned exactly that
 * into a silent overwrite of four live columns (Quiz Tier, Source Path, Webinar
 * Date, Amount Agreed), repaired by /api/admin/repair-leads-header. A header
 * cell written on its own can only ever touch the cell it names.
 *
 * Callers widen the grid first (lib/lead-sheet ensureGridColumns): Sheets
 * refuses any write past the tab's declared width.
 */
import { colLetter } from "./lead-sheet.ts";

export type HeaderCellWrite = { range: string; values: string[][] };

/** One `{range: "<Sheet>!<COL>1", values: [[title]]}` per appended header,
 *  ready for spreadsheets.values.batchUpdate. Empty in, empty out. */
export function headerCellWrites(
  sheetName: string,
  newHeaders: { index: number; title: string }[],
): HeaderCellWrite[] {
  return newHeaders.map((h) => ({
    range: `${sheetName}!${colLetter(h.index)}1`,
    values: [[h.title]],
  }));
}
