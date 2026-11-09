/**
 * POST /api/admin/call-notes — open (or create) the Google Doc he types his
 * call notes into, and hand back its URL.
 *
 * Body: { name, phone, when }  — straight off the dashboard row. `when` is
 * optional: a queue row has no booking time, and today's date is the right
 * one to file it under.
 *
 * One tap on the row, a Doc with his headings already in it, and the routine
 * that builds her consultation summary later knows exactly which doc belongs
 * to which call, because this created it. The Doc itself is made by the Apps
 * Script bridge running as him — see lib/drive for why not the service account.
 *
 * Idempotent: a second tap returns the same doc rather than a second one, so
 * the button is safe to press on the phone and the laptop.
 *
 * Auth: x-admin-key, like the rest of /api/admin/*.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { ensureNotesDoc, bridgeConfig, bridgeHint, BridgeError } from "@/lib/drive";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // A missing setting is a setup problem, not a bad request — say which one,
  // so the fix does not need a trip through the logs.
  const cfg = bridgeConfig();
  if (cfg.missing.length) {
    return NextResponse.json(
      { error: "not_configured", hint: `Not set on the worker: ${cfg.missing.join(", ")}` },
      { status: 503 },
    );
  }

  let body: { name?: string; phone?: string; when?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  if (!phone && !name) {
    return NextResponse.json({ error: "need_name_or_phone" }, { status: 400 });
  }

  try {
    const doc = await ensureNotesDoc(
      { name, phone, when: String(body.when ?? "").trim() || new Date().toISOString() },
      cfg,
    );
    return NextResponse.json(doc);
  } catch (err) {
    const e = err instanceof BridgeError ? err : new BridgeError("failed", err instanceof Error ? err.message : String(err));
    console.error("[call-notes] failed:", e.code, e.detail);
    return NextResponse.json({ error: e.code, hint: bridgeHint(e) }, { status: 502 });
  }
}
