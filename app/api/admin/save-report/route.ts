/**
 * POST /api/admin/save-report — her WhatsApp report, into her Drive folder.
 *
 *   POST { mediaId, phone, name, messageId?, mime?, filename?, kind?, ts? }
 *        -> { saved, url?, created?, reason?, hint? }
 *   POST ?backfill=1
 *        -> { saved, skipped, remaining }
 *
 * The webhook already saves a funnel lead's report the moment it arrives
 * (lib/report-save). These are the two other ways in:
 *  - "Save to Drive" on an attachment in the inbox. He pressed it, so there is
 *    no lead check: a report from a number that is not on the Leads sheet yet
 *    is still hers.
 *  - The backfill: what leads sent in the last 30 days that is not in Drive
 *    yet, oldest first because those expire first, 8 per call. Workers Free
 *    allows 50 subrequests per invocation and one save costs about 5, so the
 *    dashboard calls again while `remaining` is above 0.
 *
 * A save that did not happen still answers with `saved: false` and a hint he
 * can act on, under a status that says what kind of failure it was.
 *
 * Auth: x-admin-key.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { backfillReports, saveReportFromWhatsApp } from "@/lib/report-save";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  bad_input: 400,
  not_configured: 503,
  whatsapp_not_configured: 503,
  no_ledger: 503,
  media_expired: 410,
  too_large: 413,
};

const str = (v: unknown) => (v == null ? "" : String(v).trim());

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized", hint: "The admin key is missing or wrong." }, { status: 401 });
  }

  if (req.nextUrl.searchParams.get("backfill") === "1") {
    const r = await backfillReports();
    if (r.error) return NextResponse.json({ error: r.error, hint: r.hint }, { status: STATUS[r.error] ?? 502 });
    if (r.saved || r.skipped) console.log(`[save-report] backfill saved=${r.saved} skipped=${r.skipped} remaining=${r.remaining}`);
    return NextResponse.json({ saved: r.saved, skipped: r.skipped, remaining: r.remaining, ...(r.hint ? { hint: r.hint } : {}) });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_json", hint: "Send the attachment as JSON." }, { status: 400 });
  }

  const r = await saveReportFromWhatsApp({
    mediaId: str(body.mediaId),
    phone: str(body.phone),
    name: str(body.name),
    messageId: str(body.messageId),
    mime: str(body.mime),
    filename: str(body.filename),
    kind: str(body.kind),
    ts: str(body.ts),
    requireLead: false,
  });
  if (r.saved) return NextResponse.json({ saved: true, url: r.url, created: r.created });
  return NextResponse.json(
    { saved: false, reason: r.reason, error: r.reason, hint: r.hint },
    { status: STATUS[r.reason] ?? 502 },
  );
}
