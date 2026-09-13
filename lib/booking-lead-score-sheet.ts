/**
 * SERVER ONLY. The Leads-sheet read behind lib/booking-lead-score.
 *
 * Shared by app/api/cal-webhook (which acts on it) and
 * app/api/admin/qualified-check (which shows what the webhook WOULD decide), so
 * the diagnostic can never drift from the real thing.
 *
 * Reads only the four columns it needs — lead id, phone, email, score — rather
 * than the whole grid. Whole-sheet reads take 3-9 s on the worker and this runs
 * on every booking.
 */
import { getSheetsClient } from "@/app/api/admin/_lib";
import { PLACEHOLDER_EMAIL } from "@/lib/server-tracking";
import { MATCH_COLUMNS, SHEET_NAME, colLetter } from "@/lib/lead-sheet";
import { findBookingLeadScore, scoreColumn, type Booker, type ScoreMatch } from "./booking-lead-score.ts";

export async function lookupSheetScore(who: Booker): Promise<ScoreMatch | null> {
  const { sheets, sheetId } = await getSheetsClient();
  const hdr = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!1:1` });
  const header = ((hdr.data.values?.[0] as string[]) ?? []).map((h) => String(h ?? ""));
  const cols = { ...MATCH_COLUMNS, score: scoreColumn(header) };
  const order = [cols.leadId, cols.phone, cols.email, cols.score];
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges: order.map((c) => `${SHEET_NAME}!${colLetter(c)}:${colLetter(c)}`),
    majorDimension: "COLUMNS",
  });
  const columns = (res.data.valueRanges ?? []).map((r) => ((r.values?.[0] as string[]) ?? []).map((v) => String(v ?? "")));
  const height = Math.max(0, ...columns.map((c) => c.length));
  // Sparse rows holding only these four columns, at their real indexes, so the
  // pure lookup reads them exactly as it would a full row.
  const all: string[][] = [];
  for (let r = 0; r < height; r++) {
    const row: string[] = [];
    order.forEach((c, k) => { row[c] = columns[k]?.[r] ?? ""; });
    all.push(row);
  }
  return findBookingLeadScore(all, who, cols, PLACEHOLDER_EMAIL);
}
