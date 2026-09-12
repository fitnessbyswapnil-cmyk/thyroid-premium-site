/**
 * One woman, one state — assembled from however many rows the sheet holds for
 * her.
 *
 * WHY THIS EXISTS. A single lead can end up on more than one row, because
 * three different writers touch the Leads tab and only two of them are ours:
 *
 *   1. /api/quiz-lead writes her answers, her Lead Score and her tier.
 *   2. /api/cashfree-webhook stamps Paid / Paid Amount / Paid At.
 *   3. The Cal.com Make scenario writes the booking — and it APPENDS.
 *
 * Both of our readers used to take the LAST matching row, on the reasoning
 * that the newest row is her newest state. It is not: the newest row is the
 * newest WRITER, and the booking writer knows nothing about her score or her
 * payment. On 12-Sep that cost a real signal — /api/lead-status returned
 * `score: null` and `paid: false` for a woman who had scored "Best", paid, and
 * booked, because it was reading the booking row and ignoring the two before
 * it. With no score, /session-booked could not hand Cal.com a `qscore`, so the
 * cal webhook scored the booking 0 and QualifiedSchedule has never once fired.
 *
 * THE RULE: walk her rows oldest to newest and take the newest NON-EMPTY value
 * per column. Newer writers still win where they actually wrote something; a
 * later row that is blank in a column can no longer erase what an earlier row
 * knew. That is the whole fix, and it is deliberately a read-side one — we do
 * not control the third writer, so converging the rows themselves is not
 * something this code can promise.
 */

/** Where the Lead ID lives. Fixed by convention across every writer. */
export const LEAD_ID_COLUMN = 1;

export type MergedLead = {
  /** 1-based sheet row of her NEWEST row, for anything that writes back. */
  row: number;
  /** 1-based rows of every row that carried this lead id, oldest first. */
  rows: number[];
  /** Newest non-empty value per column. */
  cells: string[];
};

/**
 * @param all       Every row of the sheet INCLUDING the header at index 0.
 * @param leadId    The id to gather. Compared trimmed; empty never matches.
 * @param idColumn  Column holding the Lead ID (defaults to the convention).
 */
export function mergeLeadRows(
  all: (string[] | undefined)[],
  leadId: string,
  idColumn: number = LEAD_ID_COLUMN,
): MergedLead | null {
  const wanted = (leadId ?? "").trim();
  if (!wanted) return null;

  const rows: number[] = [];
  const cells: string[] = [];

  // Skip the header. Oldest first, so a later non-empty value overwrites an
  // earlier one and a later BLANK leaves the earlier one standing.
  for (let i = 1; i < all.length; i++) {
    const row = all[i];
    if (!row) continue;
    if (String(row[idColumn] ?? "").trim() !== wanted) continue;
    rows.push(i + 1);
    for (let c = 0; c < row.length; c++) {
      const value = String(row[c] ?? "").trim();
      if (value !== "") cells[c] = value;
    }
  }

  if (rows.length === 0) return null;
  for (let c = 0; c < cells.length; c++) if (cells[c] === undefined) cells[c] = "";
  return { row: rows[rows.length - 1], rows, cells };
}
