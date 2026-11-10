/**
 * /api/admin/automation — the switches in lib/automation-flags.
 *
 *   GET            -> 200 { flags, stored }      stored:false = no D1 here (every switch off)
 *   POST { key, on } -> 200 { flags, stored: true }
 *
 *   400 { error: "bad_json" | "unknown_flag" | "bad_value", hint }
 *   409 { error: "coming_later", hint }            followups_enabled / onboarding_enabled
 *   503 { error: "no_database" | "read_failed", hint, flags }   flags all off on these
 *   502 { error: "save_failed", hint }
 *
 * Every switch defaults OFF and a failed read is never shown as a real state:
 * the screen says the switches could not be read instead.
 *
 * Auth: x-admin-key, like the rest of /api/admin/*.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { COMING_LATER, NO_DATABASE_HINT, defaultFlags, isFlagKey, loadFlags, setFlag } from "@/lib/automation-flags";
import { getLedgerDb } from "@/lib/ledger";

export const dynamic = "force-dynamic";

const fail = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return fail(401, { error: "unauthorized", hint: "The admin key is missing or wrong." });
  try {
    const { flags, stored } = await loadFlags();
    return NextResponse.json(stored ? { flags, stored } : { flags, stored, hint: NO_DATABASE_HINT });
  } catch (err) {
    console.error("[admin/automation] read failed:", errText(err));
    return fail(503, { error: "read_failed", flags: defaultFlags(), hint: "The switches could not be read just now. Reload in a moment." });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return fail(401, { error: "unauthorized", hint: "The admin key is missing or wrong." });
  let body: { key?: unknown; on?: unknown };
  try {
    body = (await req.json()) as { key?: unknown; on?: unknown };
  } catch {
    return fail(400, { error: "bad_json", hint: "The request was not JSON." });
  }
  const key = body?.key;
  if (!isFlagKey(key)) return fail(400, { error: "unknown_flag", hint: `There is no switch called "${String(key ?? "")}".` });
  if (typeof body.on !== "boolean") return fail(400, { error: "bad_value", hint: "A switch is on or off: send true or false." });
  if (COMING_LATER.has(key) && body.on) {
    return fail(409, { error: "coming_later", hint: "This one is not built yet, so it stays off." });
  }

  // Checked first so "nowhere to save" is its own answer, not a generic failure.
  if (!(await getLedgerDb())) return fail(503, { error: "no_database", flags: defaultFlags(), hint: NO_DATABASE_HINT });
  try {
    await setFlag(key, body.on);
  } catch (err) {
    console.error(`[admin/automation] save failed key=${key}:`, errText(err));
    return fail(502, { error: "save_failed", hint: "The switch did not save. Press it again." });
  }
  try {
    const { flags, stored } = await loadFlags();
    console.log(`[admin/automation] ${key} -> ${body.on ? "on" : "off"}`);
    return NextResponse.json({ flags, stored });
  } catch (err) {
    console.error("[admin/automation] saved, but the read-back failed:", errText(err));
    return fail(503, { error: "read_failed", flags: defaultFlags(), hint: "Saved, but the switches could not be read back. Reload to see them." });
  }
}
