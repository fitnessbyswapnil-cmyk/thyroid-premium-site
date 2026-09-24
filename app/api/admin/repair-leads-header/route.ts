/**
 * POST /api/admin/repair-leads-header — undo one specific, dated mistake.
 *
 * WHAT WENT WRONG
 * The payment-reminder cron read the Leads sheet as `A1:BZ`, so the header it
 * saw stopped at 78 columns while the real sheet is 89 wide. It decides where
 * to append its bookkeeping columns from that truncated header, so on 24-Sep
 * the four new free-booking-nudge stamp columns were appended at indices
 * 78-81 — straight over four columns that already held data:
 *
 *   78  Quiz Tier      Best / Average / Worst
 *   79  Source Path    decode_nurture, ...        ← webinar reminder cron reads this
 *   80  Webinar Date   mc-20260924T143000Z        ← webinar reminder cron reads this
 *   81  Amount Agreed  20000 / 30000
 *
 * Only the HEADER cells were replaced; the column data below them survived,
 * except in the two rows that were stamped before this was caught.
 *
 * WHAT THIS DOES
 * Restores those four header names, and blanks only the cells this mistake
 * wrote. The stamp values are distinguishable from the real data with no
 * guessing: a "Y" in Quiz Tier or Webinar Date, and an ISO timestamp in Source
 * Path or Amount Agreed, cannot be anything but the bad write.
 *
 * It is idempotent and refuses to act unless it finds exactly the damage it
 * describes, so running it twice is a no-op and running it on a healthy sheet
 * changes nothing.
 *
 * Defaults to a dry run. Add ?apply=1 to write.
 * Auth: x-admin-key.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";
import { colLetter, ensureGridColumns } from "@/lib/lead-sheet";

export const dynamic = "force-dynamic";

/** index → the name that belongs there, and the title wrongly written over it. */
const DAMAGE = [
  { index: 78, correct: "Quiz Tier", wrong: "Free Nudge Sent", badCell: "Y" as const, moveTo: "Free Booking Nudge Sent" },
  { index: 79, correct: "Source Path", wrong: "Free Nudge At", badCell: "iso" as const, moveTo: "Free Booking Nudge At" },
  { index: 80, correct: "Webinar Date", wrong: "Free Nudge 2 Sent", badCell: "Y" as const, moveTo: "Free Booking Nudge 2 Sent" },
  { index: 81, correct: "Amount Agreed", wrong: "Free Nudge 2 At", badCell: "iso" as const, moveTo: "Free Booking Nudge 2 At" },
];

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const apply = new URL(req.url).searchParams.get("apply") === "1";

  const { sheets, sheetId } = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A1:DZ`,
  });
  const all: string[][] = (res.data.values as string[][]) ?? [];
  const header = (all[0] ?? []).map((h) => String(h ?? ""));
  const rows = all.slice(1);

  const headerFixes: { index: number; from: string; to: string }[] = [];
  const cellFixes: { a1: string; index: number; was: string; moveTo: string; sheetRow: number }[] = [];

  for (const d of DAMAGE) {
    if (header[d.index] === d.wrong) {
      headerFixes.push({ index: d.index, from: d.wrong, to: d.correct });
    } else if (header[d.index] !== d.correct) {
      // Neither the damage nor the repaired state: stop rather than guess.
      return NextResponse.json(
        {
          error: "unexpected_header",
          index: d.index,
          found: header[d.index] ?? null,
          expected: [d.wrong, d.correct],
          hint: "This route only repairs the exact 24-Sep damage it documents.",
        },
        { status: 409 },
      );
    }
    for (let i = 0; i < rows.length; i++) {
      const v = String(rows[i]?.[d.index] ?? "").trim();
      if (!v) continue;
      const isBad = d.badCell === "Y" ? v === "Y" : ISO.test(v);
      if (isBad) cellFixes.push({ a1: `${colLetter(d.index)}${i + 2}`, index: d.index, was: v, moveTo: d.moveTo, sheetRow: i + 2 });
    }
  }

  // Those stamps are the only record that these women were already messaged.
  // Blanking them without moving them would make every one of them eligible
  // again on the very next run, and she would receive the same nudge twice.
  // So the new columns are created here and the stamps are carried across in
  // the same write, rather than left to the cron.
  const newCols = new Map<string, number>();
  {
    let width = header.length;
    for (const d of DAMAGE) {
      const existing = header.findIndex((h) => h.trim() === d.moveTo);
      newCols.set(d.moveTo, existing >= 0 ? existing : width++);
    }
  }
  const carried = cellFixes.map((c) => ({
    a1: `${colLetter(newCols.get(c.moveTo) as number)}${c.sheetRow}`,
    value: c.was,
    column: c.moveTo,
  }));

  if (!apply) {
    return NextResponse.json({
      dryRun: true,
      headerWidth: header.length,
      headerFixes,
      cellFixes,
      newColumns: [...newCols].map(([title, index]) => ({ title, index, a1: colLetter(index) })),
      carried,
    });
  }

  const data: { range: string; values: string[][] }[] = [];
  if (headerFixes.length) {
    const next = [...header];
    for (const f of headerFixes) next[f.index] = f.to;
    // Only the damaged span, never the whole row: rewriting 1:1 wholesale is
    // what let a truncated read overwrite real columns in the first place.
    const from = Math.min(...headerFixes.map((f) => f.index));
    const to = Math.max(...headerFixes.map((f) => f.index));
    data.push({
      range: `${SHEET_NAME}!${colLetter(from)}1:${colLetter(to)}1`,
      values: [next.slice(from, to + 1)],
    });
  }
  for (const c of cellFixes) data.push({ range: `${SHEET_NAME}!${c.a1}`, values: [[""]] });
  // Header cells for the new columns, then the stamps themselves.
  for (const [title, index] of newCols) {
    if (header[index]?.trim() !== title) {
      data.push({ range: `${SHEET_NAME}!${colLetter(index)}1`, values: [[title]] });
    }
  }
  for (const c of carried) data.push({ range: `${SHEET_NAME}!${c.a1}`, values: [[c.value]] });

  // The grid is a fixed width; writing past its last column fails outright.
  const widest = Math.max(header.length - 1, ...[...newCols.values()]);
  if (widest > header.length - 1) {
    await ensureGridColumns(sheets, sheetId, SHEET_NAME, widest);
  }

  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
  }
  console.log(
    `[repair-leads-header] restored ${headerFixes.length} header(s), ` +
      `blanked ${cellFixes.length} cell(s), carried ${carried.length} stamp(s) to the new columns`,
  );
  return NextResponse.json({ applied: true, headerFixes, cellFixes, carried });
}
