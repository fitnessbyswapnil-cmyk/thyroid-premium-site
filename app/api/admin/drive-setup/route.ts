/**
 * /api/admin/drive-setup — "Connect Google Drive", the card at the top of Today.
 *
 *   GET            → { connected, source, folderConfigured, version }
 *   GET ?script=1  → { script }   the exact text of scripts/drive-bridge.gs
 *   POST { url }   → { connected: true, paired }
 *
 * WHY THE DASHBOARD DOES THE PAIRING
 * The manual set-up was: invent a secret, type it into the script's
 * properties, type it again onto the worker, paste the URL onto the worker,
 * redeploy. Three consoles, and a 64-character string typed twice on a phone.
 * Now he pastes one URL. The worker makes the secret and hands it to the script
 * itself, and the script adopts the first secret it is sent and refuses every
 * other afterwards (trust on first use, see pairBridge in lib/drive), so the
 * secret never passes through his hands or across his screen.
 *
 * A DIFFERENT URL GETS A NEW SECRET
 * The stored secret is reused only for the URL it was stored with. A different
 * URL may not be his script at all, and sending it the live secret would hand
 * whoever owns it the key to the one that is.
 *
 * The env set-up still wins over a stored pairing (resolveBridgeConfig in
 * lib/drive), so while DRIVE_BRIDGE_URL and DRIVE_BRIDGE_SECRET are set on the
 * worker this refuses to pair, rather than storing a pairing nothing reads.
 *
 * The status read is config only, never a call to the script: Today asks on
 * every load, and a cold Apps Script takes seconds to answer.
 *
 * Auth: x-admin-key, like the rest of /api/admin/*.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { pairBridge, BridgeError, NOTES_FOLDER_ENV, BRIDGE_URL_ENV, BRIDGE_SECRET_ENV } from "@/lib/drive";
import { liveBridgeConfig, saveBridgePairing } from "@/lib/bridge-settings";
import { DRIVE_BRIDGE_SOURCE, DRIVE_BRIDGE_VERSION } from "@/lib/drive-bridge-source";
import { appsScriptUrlProblem, connectHint, newBridgeSecret } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (req.nextUrl.searchParams.get("script") === "1") {
    // An empty copy would paste a blank Code.gs and fail later, far from here.
    if (!DRIVE_BRIDGE_SOURCE.trim()) {
      return NextResponse.json(
        { error: "script_missing", hint: "This build of the site has no copy of the script yet, so there is nothing to copy." },
        { status: 503 },
      );
    }
    return NextResponse.json({ script: DRIVE_BRIDGE_SOURCE }, { headers: { "cache-control": "no-store" } });
  }

  const cfg = await liveBridgeConfig();
  return NextResponse.json(
    {
      connected: cfg.source !== "none",
      source: cfg.source,
      folderConfigured: Boolean(cfg.folderId),
      version: DRIVE_BRIDGE_VERSION,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json", hint: "Paste the Web app URL and press Connect again." }, { status: 400 });
  }

  const url = String(body?.url ?? "").trim();
  const problem = appsScriptUrlProblem(url);
  if (problem) return NextResponse.json({ error: "bad_url", hint: problem }, { status: 400 });

  const cfg = await liveBridgeConfig();
  if (cfg.source === "env") {
    return NextResponse.json(
      {
        error: "env_configured",
        hint: `The worker's own settings already connect Drive (${BRIDGE_URL_ENV} and ${BRIDGE_SECRET_ENV}), and they win over anything saved here. Change them on the worker, or delete both to connect from here.`,
      },
      { status: 409 },
    );
  }
  // Pairing also proves the folder is readable, so with no folder it can only
  // fail. Say which setting is missing rather than letting the script say
  // "folder not found" about a folder nobody named.
  if (!cfg.folderId) {
    return NextResponse.json(
      { error: "not_configured", hint: `Not set on the worker: ${NOTES_FOLDER_ENV}` },
      { status: 503 },
    );
  }

  const secret = cfg.source === "stored" && cfg.url === url ? cfg.secret : newBridgeSecret();

  let paired: boolean;
  try {
    ({ paired } = await pairBridge({ url, secret, folderId: cfg.folderId }));
  } catch (err) {
    const e = err instanceof BridgeError ? err : new BridgeError("failed", err instanceof Error ? err.message : String(err));
    // Never the secret: the code and the script's own words are enough.
    console.error("[drive-setup] pair failed:", e.code, e.detail);
    return NextResponse.json({ error: e.code, hint: connectHint(e) }, { status: 502 });
  }

  try {
    await saveBridgePairing({ url, secret });
  } catch (err) {
    // The script has adopted a secret this site failed to keep, and it will
    // refuse any other. Clearing it on the script side is the only way back.
    console.error("[drive-setup] paired but not saved:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      {
        error: "save_failed",
        hint: "The script took the key but this site could not save it. In the Apps Script open Project Settings → Script Properties, delete SHARED_SECRET, then press Connect again.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ connected: true, paired });
}
