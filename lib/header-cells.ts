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
 * Callers check headerAppendRefusal (below) and widen the grid first
 * (lib/lead-sheet ensureGridColumns): Sheets refuses any write past the
 * tab's declared width.
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

/**
 * Single cells are only safe if they land past the real last column, and
 * "past the last column" is `header.length` of a read. On 24-Sep the read
 * was short. An empty `values` makes header.length 0, and the four payment
 * headers then land on A1..D1 (Timestamp, Lead ID, Name, Phone). A
 * blank-titled column at the end that holds data is also left out of the
 * read, and a header placed there takes over that column.
 *
 * The Leads tab has been at least 93 columns wide (A..CO) since 24-Sep-2026,
 * and on 28-Nov it is 97 (A..CS). A narrower read is a bad read, not a
 * narrower sheet.
 */
export const LEADS_MIN_WIDTH = 93;

/**
 * PURE. Why these headers must not be appended, or null when they may be.
 * Call it once with the header length alone (before any IO) and again with
 * `targetColumns`, each target column as read back (row 1 down), in
 * newHeaders order. Any value in a target column refuses the append.
 */
export function headerAppendRefusal(o: {
  headerLength: number;
  minWidth: number;
  newHeaders: { index: number; title: string }[];
  targetColumns?: unknown[][];
}): string | null {
  if (o.newHeaders.length === 0) return null;
  if (o.headerLength < o.minWidth) {
    return `the header read is ${o.headerLength} columns wide, narrower than the ${o.minWidth} the tab is known to have`;
  }
  const inside = o.newHeaders.find((h) => h.index < o.headerLength);
  if (inside) return `${colLetter(inside.index)}1 is inside the header`;
  if (o.targetColumns) {
    const k = o.newHeaders.findIndex((_, i) =>
      (o.targetColumns?.[i] ?? []).some((v) => String(v ?? "").trim() !== ""));
    if (k >= 0) return `column ${colLetter(o.newHeaders[k].index)} already holds data under a blank header`;
  }
  return null;
}
