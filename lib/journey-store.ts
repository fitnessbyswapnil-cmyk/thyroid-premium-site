/**
 * lib/journey-store.ts — SERVER ONLY. Stored stages and nurture dates in D1
 * (thyroid-ledger, tables lead_journey and journey_runs,
 * migrations/0003_lead_journey.sql).
 *
 * Rows are keyed by the SHA-256 of an identity key, never the phone or email
 * itself. Degrades to "nothing stored" off Cloudflare, like lib/ledger.ts —
 * the tabs then show derived stages, which is everything but the ratchet and
 * the nurture dates.
 */
import { getLedgerDb } from "./ledger.ts";
import { FUNNEL_STAGES, type Journey, type Reached, type StoredJourney } from "./journey.ts";

export async function hashKey(key: string): Promise<string> {
  const bytes = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Every stored row, by identity key, for the keys asked about. */
export async function readStoredJourneys(keys: string[]): Promise<Map<string, StoredJourney>> {
  const out = new Map<string, StoredJourney>();
  const db = await getLedgerDb();
  if (!db || !keys.length) return out;
  try {
    const hashes = await Promise.all(keys.map(hashKey));
    const byHash = new Map(hashes.map((h, i) => [h, keys[i]]));
    // A few hundred rows: one full read is cheaper than hundreds of lookups.
    const res = await db.prepare("SELECT key_hash, reached_json, nurture_since FROM lead_journey").all<{
      key_hash: string;
      reached_json: string;
      nurture_since: number | null;
    }>();
    for (const r of res.results) {
      const key = byHash.get(r.key_hash);
      if (!key) continue;
      let reached: Reached = {};
      try {
        const parsed = JSON.parse(r.reached_json) as Reached;
        for (const s of FUNNEL_STAGES) if (parsed[s]) reached[s] = { at: String(parsed[s]!.at ?? ""), inferred: !!parsed[s]!.inferred };
      } catch {
        reached = {};
      }
      out.set(key, { reached, nurtureSince: r.nurture_since === null ? null : Number(r.nurture_since) });
    }
  } catch (err) {
    console.error("[journey-store] read failed:", err instanceof Error ? err.message : String(err));
  }
  return out;
}

export type RunSummary = {
  people: number;
  movedToNurture: number;
  released: number;
  inferredStages: number;
  dryRun: boolean;
};

/**
 * Write every journey's current marks. `nurtureSince` per journey is decided by
 * the caller (the cron) — moved today, kept, or released. Chunked batches.
 */
export async function writeJourneys(
  rows: { journey: Journey; nurtureSince: number | null }[],
  summary: RunSummary,
  now: number,
): Promise<{ ok: boolean; written: number; error?: string }> {
  const db = await getLedgerDb();
  if (!db) return { ok: false, written: 0, error: "no D1 binding (not on Cloudflare)" };
  try {
    const stmts = [];
    for (const { journey: j, nurtureSince } of rows) {
      const reachedJson = JSON.stringify(j.reached);
      const state = nurtureSince !== null ? "nurture" : j.state;
      for (const key of j.keys) {
        stmts.push(
          db
            .prepare(
              `INSERT INTO lead_journey (key_hash, reached_json, furthest_stage, current_state, nurture_since, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6)
               ON CONFLICT(key_hash) DO UPDATE SET reached_json = ?2, furthest_stage = ?3, current_state = ?4, nurture_since = ?5, updated_at = ?6`,
            )
            .bind(await hashKey(key), reachedJson, j.furthest, state, nurtureSince, now),
        );
      }
    }
    stmts.push(
      db
        .prepare(
          "INSERT INTO journey_runs (run_at, people, moved_to_nurture, released, inferred_stages, dry_run) VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        )
        .bind(now, summary.people, summary.movedToNurture, summary.released, summary.inferredStages),
    );
    for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
    return { ok: true, written: stmts.length - 1 };
  } catch (err) {
    return { ok: false, written: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
