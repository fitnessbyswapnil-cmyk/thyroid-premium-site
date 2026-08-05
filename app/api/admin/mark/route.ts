/**
 * POST /api/admin/mark
 *
 * Writes call outcomes and sequence state from the dashboard back to the
 * Leads sheet:
 *   { row, field: "showed",   value: "Y" | "N" }
 *   { row, field: "closed",   value: "<amount in ₹>" }
 *   { row, field: "meetlink", value: "<google meet / zoom URL>" }
 *   { row, field: "msg1" | "msg2" | "msg3", value: "Y" }   (sequence step sent)
 *
 * Columns appended AFTER every existing column (existing data ends at BA):
 *   BB Showed · BC Closed ₹ · BD Meet Link · BE Msg1 Sent · BF Msg2 Sent · BG Msg3 Sent
 * Headers are (re)written on every call — idempotent. Nothing else in the
 * sheet is touched, so /api/leads and the Make scenarios are unaffected.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";

export const dynamic = "force-dynamic";

const COLS = {
  showed: "BB",
  closed: "BC",
  meetlink: "BD",
  msg1: "BE",
  msg2: "BF",
  msg3: "BG",
} as const;
const HEADERS = {
  showed: "Showed",
  closed: "Closed ₹",
  meetlink: "Meet Link",
  msg1: "Msg1 Sent",
  msg2: "Msg2 Sent",
  msg3: "Msg3 Sent",
} as const;
type Field = keyof typeof COLS;
const FIELDS = Object.keys(COLS) as Field[];

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
  const field = FIELDS.includes(body.field as Field) ? (body.field as Field) : null;
  const value = (body.value ?? "").toString().slice(0, 300);
  // Row 1 is headers — never writable. Sanity-cap the range.
  if (!field || !Number.isInteger(row) || row < 2 || row > 100000) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (field === "showed" && value !== "Y" && value !== "N") {
    return NextResponse.json({ error: "bad_value" }, { status: 400 });
  }
  // Sequence steps store the SEND TIMESTAMP (ISO) so the dashboard can
  // compute speed-to-first-touch; legacy "Y" values remain valid.
  if (
    (field === "msg1" || field === "msg2" || field === "msg3") &&
    value !== "Y" &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(value)
  ) {
    return NextResponse.json({ error: "bad_value" }, { status: 400 });
  }
  if (field === "closed" && !/^\d{0,8}(\.\d{1,2})?$/.test(value)) {
    return NextResponse.json({ error: "bad_value" }, { status: 400 });
  }
  if (field === "meetlink" && value && !/^https?:\/\/\S+$/.test(value)) {
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
