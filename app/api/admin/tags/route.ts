/**
 * /api/admin/tags
 *
 *   GET  — { tags: { [phone]: string[] }, suggested: string[] }
 *   POST — { phone, tags: string[] } replaces that contact's whole tag set.
 *
 * Auth: x-admin-key, same as the rest of /api/admin/*.
 *
 * POST replaces rather than merges so the UI can remove a tag by sending the
 * list without it — an add-only endpoint would need a second delete route and
 * could never express "she is no longer hot".
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { readTags, setTags, SUGGESTED_TAGS } from "@/lib/wa-tags";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const map = await readTags();
    return NextResponse.json({ tags: Object.fromEntries(map), suggested: SUGGESTED_TAGS });
  } catch (err) {
    console.error("[admin/tags] read failed:", err);
    return NextResponse.json({ tags: {}, suggested: SUGGESTED_TAGS, error: "read_failed" });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { phone?: string; tags?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").replace(/\D/g, "");
  if (phone.length < 10) return NextResponse.json({ error: "bad_phone" }, { status: 400 });

  const list = Array.isArray(body.tags) ? body.tags.map((t) => String(t)) : [];
  try {
    const saved = await setTags(phone, list);
    return NextResponse.json({ ok: true, phone, tags: saved });
  } catch (err) {
    console.error("[admin/tags] write failed:", err);
    return NextResponse.json({ error: "write_failed" }, { status: 502 });
  }
}
