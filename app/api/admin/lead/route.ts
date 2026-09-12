/**
 * GET /api/admin/lead?leadId=dq_…   (or ?phone=9876543210)
 *
 * One lead's full row, every answered column by its header name. Built for call
 * prep: the dashboard maps a dozen columns and the public /api/leads/[id]
 * prefill route deliberately returns only contact fields, so there was no way to
 * see everything a woman told the quiz before speaking to her.
 *
 * Admin-only. Health answers are sensitive: this returns them to the coach and
 * logs nothing about their contents.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const leadId = (req.nextUrl.searchParams.get("leadId") ?? "").trim();
  const phone = (req.nextUrl.searchParams.get("phone") ?? "").replace(/\D/g, "").slice(-10);
  if (!leadId && phone.length !== 10) return NextResponse.json({ error: "leadId or phone required" }, { status: 400 });

  const { sheets, sheetId } = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!A1:BZ` });
  const all = (res.data.values as string[][]) ?? [];
  const header = (all[0] ?? []).map((h) => String(h ?? "").trim());

  // EVERY row she appears on, oldest to newest, newest non-empty value per
  // column. "Newest match wins" was the old rule and it hid things that matter
  // on a call: three writers touch this sheet — the quiz, the payment webhook
  // and the Cal.com Make scenario — and the last one to write is the booking,
  // which carries neither her score nor her payment. Reading only that row is
  // how a paid, Best-tier lead showed up here as unpaid and unscored.
  const rowsForLead: number[] = [];
  for (let i = 1; i < all.length; i++) {
    const r0 = all[i] ?? [];
    const hitId = leadId && String(r0[1] ?? "").trim() === leadId;
    const hitPhone = phone && String(r0[3] ?? "").replace(/\D/g, "").slice(-10) === phone;
    if (hitId || hitPhone) rowsForLead.push(i);
  }
  if (rowsForLead.length === 0) return NextResponse.json({ found: false });
  const idx = rowsForLead[rowsForLead.length - 1];

  const r: string[] = [];
  for (const i of rowsForLead) {
    const src = all[i] ?? [];
    for (let c = 0; c < src.length; c++) {
      const v = String(src[c] ?? "").trim();
      if (v !== "") r[c] = v;
    }
  }
  const fields: Record<string, string> = {};
  header.forEach((h, i) => {
    const v = String(r[i] ?? "").trim();
    if (!v) return;
    const key = h || `col_${i}`;
    fields[fields[key] ? `${key} (col ${i})` : key] = v;
  });
  // `rows` is deliberately visible: if it holds more than one number, this
  // woman is split across the sheet and the Make scenario appended rather than
  // matched. That is worth seeing rather than silently smoothing over.
  return NextResponse.json({ found: true, row: idx + 1, rows: rowsForLead.map((i) => i + 1), fields });
}
