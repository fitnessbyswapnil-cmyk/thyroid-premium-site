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
 * Script bridge running as him — see lib/drive for why not the service account
 * — inside her own folder in "Client Notes", found by her phone digits.
 *
 * Idempotent: a second tap returns the same doc rather than a second one, so
 * the button is safe to press on the phone and the laptop.
 *
 * The bridge is whichever is set up: the worker's env vars, or the pairing
 * "Connect Google Drive" stored (lib/bridge-settings liveBridgeConfig).
 *
 * Reply: { url, title, created }. Errors: { error, hint } — 503 when Drive is
 * not set up, 502 when the bridge refused or failed.
 *
 * Auth: x-admin-key, like the rest of /api/admin/*.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { ensureNotesDoc, bridgeHint, BridgeError } from "@/lib/drive";
import { liveBridgeConfig } from "@/lib/bridge-settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json(
      { error: "unauthorized", hint: "The admin key was not accepted. Log out and enter it again." },
      { status: 401 },
    );
  }

  // A missing setting is a setup problem, not a bad request — say which one,
  // so the fix does not need a trip through the logs.
  const cfg = await liveBridgeConfig();
  if (cfg.missing.length) {
    const e = new BridgeError("not_configured", cfg.missing.join(", "));
    return NextResponse.json({ error: e.code, hint: bridgeHint(e) }, { status: 503 });
  }

  let body: { name?: string; phone?: string; when?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json", hint: "The request was not valid JSON." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  if (!phone && !name) {
    return NextResponse.json(
      { error: "need_name_or_phone", hint: "This row has no name and no phone, so there is nothing to file the notes under." },
      { status: 400 },
    );
  }

  try {
    const doc = await ensureNotesDoc(
      { name, phone, when: String(body.when ?? "").trim() || new Date().toISOString() },
      cfg,
    );
    return NextResponse.json({ url: doc.url, title: doc.title, created: doc.created });
  } catch (err) {
    const e = err instanceof BridgeError ? err : new BridgeError("failed", err instanceof Error ? err.message : String(err));
    console.error("[call-notes] failed:", e.code, e.detail);
    return NextResponse.json({ error: e.code, hint: bridgeHint(e) }, { status: 502 });
  }
}
