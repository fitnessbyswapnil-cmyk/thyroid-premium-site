/**
 * POST /api/admin/call-notes — open (or create) the Google Doc he types his
 * call notes into, and hand back its URL.
 *
 * Body: { name, phone, when }  — straight off the dashboard's call row.
 *
 * One tap on the row, a Doc with his headings already in it, and the routine
 * that builds her consultation summary later knows exactly which doc belongs
 * to which call, because this created it. See lib/drive for why the system
 * names the doc instead of him.
 *
 * Idempotent: a second tap returns the same doc rather than a second one, so
 * the button is safe to press on the phone and the laptop.
 *
 * Auth: x-admin-key, like the rest of /api/admin/*.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { ensureNotesDoc, notesFolderId, NOTES_FOLDER_ENV } from "@/lib/drive";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // A missing folder id is a setup problem, not a bad request — say which env
  // var, so the fix does not need a trip through the logs.
  if (!notesFolderId()) {
    return NextResponse.json(
      { error: "not_configured", hint: `${NOTES_FOLDER_ENV} is not set on the worker` },
      { status: 503 },
    );
  }

  let body: { name?: string; phone?: string; when?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").trim();
  const when = String(body.when ?? "").trim();
  if (!phone && !body.name) {
    return NextResponse.json({ error: "need_name_or_phone" }, { status: 400 });
  }

  try {
    const doc = await ensureNotesDoc({
      name: String(body.name ?? "").trim(),
      phone,
      when: when || new Date().toISOString(),
    });
    return NextResponse.json(doc);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[call-notes] failed:", message);
    // The two failures worth telling apart on screen: the folder was never
    // shared with the service account, and everything else.
    const shared = /permission|not found|404|403/i.test(message);
    return NextResponse.json(
      {
        error: shared ? "no_folder_access" : "drive_failed",
        hint: shared
          ? "Share the Client Notes folder with GOOGLE_SERVICE_ACCOUNT_EMAIL as Editor"
          : message.slice(0, 200),
      },
      { status: 502 },
    );
  }
}
