/**
 * GET /api/admin/ledger — a quick look at the D1 ledger (lib/ledger.ts).
 *
 *   events / testEvents  Meta server events created in the last 7 days,
 *                        counted by event_name × status (sent | failed | dead).
 *   latestFailures       the 20 newest failed or dead events: name, id,
 *                        attempts, last error, times. No user data.
 *   payments             Cashfree payment totals: all time by status and
 *                        currency, and 'paid' in the last 7 days.
 *
 * Auth: x-admin-key (checkAdminKey). Answers 503 off Cloudflare, where there
 * is no LEDGER binding.
 *
 *   curl -s https://www.swapnilumbarkarfitness.in/api/admin/ledger -H "x-admin-key: $ADMIN_DASH_KEY"
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { getLedgerDb, ledgerSummary } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getLedgerDb();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "No LEDGER binding on this host. The ledger exists only on the Cloudflare worker." },
      { status: 503 },
    );
  }

  const summary = await ledgerSummary(db, Date.now());
  if (!summary) {
    return NextResponse.json({ ok: false, error: "Ledger query failed. See the worker logs ([ledger])." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...summary }, { headers: { "cache-control": "no-store" } });
}
