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
 *   BH Meta Sent   (audit trail for the programme conversion below)
 * Headers are (re)written on every call — idempotent. Nothing else in the
 * sheet is touched, so /api/leads and the Make scenarios are unaffected.
 *
 * MARKING A WIN ALSO TELLS META.
 * "closed" with a positive amount is the only moment the business learns that a
 * lead became a paying client. That signal never reached Meta, so the ad
 * account has been optimising for ₹299 call-buyers instead of ₹20,000 clients.
 * Marking a win now fires a Subscribe conversion carrying the real amount and
 * the attribution captured at her first ad click (see lib/meta-conversion.ts).
 *
 * The send is best-effort: a Meta outage must never lose the coach's sheet
 * write. The result is returned so the dashboard can show what happened.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";
import { sendProgramConversion, type ProgramConversionResult } from "@/lib/meta-conversion";

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

// Audit column for the programme conversion. Its presence is the durable
// "already sent" guard — re-marking the same win (a typo fix, a double click)
// must not send Meta a second sale.
const META_COL = "BH";
const META_HEADER = "Meta Sent";

/** Sheet header name → 0-based column index, preferring the rightmost match
 *  (the sheet carries legacy duplicates of some headers). */
function indexOf(header: string[], name: string): number {
  return header.map((h) => (h ?? "").trim().toLowerCase()).lastIndexOf(name.toLowerCase());
}

function cell(row: string[], i: number): string {
  return i >= 0 ? String(row[i] ?? "").trim() : "";
}

/**
 * Read the lead's row and fire the programme conversion.
 * Never throws — returns a status the dashboard can display.
 */
async function sendWinToMeta(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>["sheets"],
  sheetId: string,
  row: number,
  amount: number,
): Promise<{ status: string; detail?: ProgramConversionResult }> {
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges: [`${SHEET_NAME}!1:1`, `${SHEET_NAME}!${row}:${row}`],
  });
  const header = ((res.data.valueRanges?.[0]?.values?.[0] ?? []) as string[]).map((c) => String(c ?? ""));
  const values = ((res.data.valueRanges?.[1]?.values?.[0] ?? []) as string[]).map((c) => String(c ?? ""));
  if (values.length === 0) return { status: "row_empty" };

  const metaIdx = indexOf(header, META_HEADER);
  if (cell(values, metaIdx)) {
    return { status: "already_sent" };
  }

  const leadId = cell(values, indexOf(header, "Lead ID")) || `row${row}`;
  const tsRaw = cell(values, 0);
  const leadCreatedAtMs = tsRaw ? Date.parse(tsRaw) : NaN;

  const detail = await sendProgramConversion({
    seed: leadId,
    amount,
    name: cell(values, indexOf(header, "Name")) || cell(values, 2),
    phone: cell(values, indexOf(header, "Phone")) || cell(values, 3),
    email: cell(values, indexOf(header, "Email")) || cell(values, 4),
    city: cell(values, indexOf(header, "City")),
    fbclid: cell(values, indexOf(header, "FBclid")),
    visitorId: cell(values, indexOf(header, "Visitor ID")),
    leadCreatedAtMs: Number.isFinite(leadCreatedAtMs) ? leadCreatedAtMs : undefined,
    closedAtMs: Date.now(),
  });

  if (!detail.success) return { status: "capi_failed", detail };

  // Stamp the audit column only after Meta accepted the event, so a failure
  // leaves the win re-sendable rather than silently swallowed.
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `${SHEET_NAME}!${META_COL}1`, values: [[META_HEADER]] },
        {
          range: `${SHEET_NAME}!${META_COL}${row}`,
          values: [[`${new Date().toISOString()}|${detail.eventName}|${amount}|${detail.eventId}`]],
        },
      ],
    },
  });

  return { status: "sent", detail };
}

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

    // A closed win is the highest-value signal the business produces. Send it.
    let meta: { status: string; detail?: ProgramConversionResult } | undefined;
    const amount = field === "closed" ? parseFloat(value) : NaN;
    if (field === "closed" && Number.isFinite(amount) && amount > 0) {
      try {
        meta = await sendWinToMeta(sheets, sheetId, row, amount);
        console.log(`[admin/mark] programme conversion row=${row} amount=${amount} status=${meta.status}`, meta.detail ?? "");
      } catch (metaErr) {
        // Fail OPEN — the sheet write above already succeeded and must stand.
        meta = { status: "error" };
        console.error("[admin/mark] programme conversion threw (swallowed):", metaErr);
      }
    }

    return NextResponse.json({ ok: true, ...(meta ? { meta } : {}) });
  } catch (err) {
    console.error("[admin/mark]", err);
    return NextResponse.json({ error: "sheet_write_failed" }, { status: 500 });
  }
}
