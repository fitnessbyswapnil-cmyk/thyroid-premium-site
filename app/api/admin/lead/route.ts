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

  // Newest match wins — a retake or resume writes later rows for the same woman.
  let idx = -1;
  for (let i = 1; i < all.length; i++) {
    const r = all[i] ?? [];
    const hitId = leadId && String(r[1] ?? "").trim() === leadId;
    const hitPhone = phone && String(r[3] ?? "").replace(/\D/g, "").slice(-10) === phone;
    if (hitId || hitPhone) idx = i;
  }
  if (idx < 0) return NextResponse.json({ found: false });

  const r = all[idx] ?? [];
  const fields: Record<string, string> = {};
  header.forEach((h, i) => {
    const v = String(r[i] ?? "").trim();
    if (!v) return;
    const key = h || `col_${i}`;
    fields[fields[key] ? `${key} (col ${i})` : key] = v;
  });
  return NextResponse.json({ found: true, row: idx + 1, fields });
}
