/**
 * POST /api/admin/mark
 *
 * Writes call outcomes from the dashboard back to the Leads sheet:
 *   { row, field: "showed", value: "Y" | "N" }
 *   { row, field: "closed", value: "<amount in ₹>" }
 *
 * Uses two dedicated columns appended AFTER every existing column:
 *   BB = "Showed", BC = "Closed ₹"  (existing data ends at BA)
 * Headers are (re)written on every call — idempotent, and guarantees the
 * columns are labeled even on first use. Nothing else in the sheet is touched,
 * so /api/leads and the Make scenarios are unaffected.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";

export const dynamic = "force-dynamic";

const COLS = { showed: "BB", closed: "BC" } as const;
const HEADERS = { showed: "Showed", closed: "Closed ₹" } as const;

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { row?: number; field?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const row = Number(body.row);
  const field = body.field === "showed" || body.field === "closed" ? body.field : null;
  const value = (body.value ?? "").toString().slice(0, 20);
  // Row 1 is headers — never writable. Sanity-cap the range.
  if (!field || !Number.isInteger(row) || row < 2 || row > 100000) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (field === "showed" && value !== "Y" && value !== "N") {
    return NextResponse.json({ error: "bad_value" }, { status: 400 });
  }
  if (field === "closed" && !/^\d{0,8}(\.\d{1,2})?$/.test(value)) {
    return NextResponse.json({ error: "bad_value" }, { status: 400 });
  }
  try {
    const { sheets, sheetId } = await getSheetsClient();
    const colLetter = COLS[field];
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `${SHEET_NAME}!${colLetter}1`, values: [[HEADERS[field]]] },
          { range: `${SHEET_NAME}!${colLetter}${row}`, values: [[value]] },
        ],
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/mark]", err);
    return NextResponse.json({ error: "sheet_write_failed" }, { status: 500 });
  }
}
