/**
 * GET /api/admin/client-folder?phone=&name= — her folder in his Drive, made
 * if she has none yet, as { url }.
 *
 * The Drive button on a call row. Everything about one woman lives in that
 * folder (her notes Doc for each call, every report she sent, her summary
 * PDF), so one tap there answers "what do I have on her" before the call
 * starts, without searching Drive by a name she may have spelled three ways.
 *
 * Found by her phone digits, never her name (see lib/drive), which is why a
 * row with no phone number is refused rather than given a shared "nophone"
 * folder that every such woman would land in.
 *
 * Idempotent: the script finds-or-creates under a lock, so the phone and the
 * laptop tapping at once still make one folder.
 *
 * Auth: x-admin-key.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { clientFolder, bridgeHint, BridgeError, digits10 } from "@/lib/drive";
import { liveBridgeConfig } from "@/lib/bridge-settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const phone = digits10(req.nextUrl.searchParams.get("phone") ?? "");
  const name = (req.nextUrl.searchParams.get("name") ?? "").trim();
  if (phone.length !== 10) {
    return NextResponse.json(
      { error: "need_phone", hint: "Her folder is found by her phone number, and this row has none." },
      { status: 400 },
    );
  }

  try {
    const folder = await clientFolder({ name, phone }, await liveBridgeConfig());
    return NextResponse.json({ url: folder.url });
  } catch (err) {
    const e = err instanceof BridgeError ? err : new BridgeError("failed", err instanceof Error ? err.message : String(err));
    console.error("[client-folder] failed:", e.code, e.detail);
    // A missing setting is set-up, not a broken bridge: 503, like call-notes.
    return NextResponse.json({ error: e.code, hint: bridgeHint(e) }, { status: e.code === "not_configured" ? 503 : 502 });
  }
}
