/**
 * POST /api/admin/precall/extract — "Read her report" on the pre-call card.
 * Her newest saved blood report, read by Claude into marker rows that only
 * PRE-FILL the card's editable form. He checks them, then presses Generate,
 * and /api/admin/precall builds the PDF from what he confirmed. The PDF's
 * sentences stay the reviewed library's; the AI only copies values.
 *
 * Body: { name, phone }
 *   200 { markers: MarkerRow[], source: "ai", reportUrl, reportCount, model, document, hint, warnings[] }
 *   412 { error: "no_ai_key", hint: "Add the AI key" }   no ANTHROPIC_API_KEY on the worker (the owner sets it)
 *   404 { error: "no_report", hint, reportUrl? }          none saved, or WhatsApp no longer has the file
 *   413 / 415 her report is too large, or a kind the reader cannot open
 *   502 { error: "ai_failed" | "report_fetch_failed" | "report_lookup_failed", hint }
 *
 * Everything else lives in lib/precall-extract.ts, which the tests drive with
 * a stand-in client. Auth: x-admin-key, like the rest of /api/admin/*.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../../_lib";
import { extractPrecallMarkers } from "@/lib/precall-extract";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized", hint: "The admin key is missing or wrong." }, { status: 401 });
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json", hint: "The request was not JSON." }, { status: 400 });
  }
  const out = await extractPrecallMarkers({ phone: String(body.phone ?? "") });
  return NextResponse.json(out.body, { status: out.status });
}
