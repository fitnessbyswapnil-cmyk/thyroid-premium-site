/**
 * The quiz score for a Cal.com booking, found server-side.
 *
 * WHY. QualifiedSchedule is the signal that tells Meta which bookings came
 * from good leads, and it has never once fired. The score used to reach the
 * cal webhook only one way: quiz page -> this browser's storage ->
 * /session-booked -> Cal booking metadata `qscore` -> webhook. Every hop is a
 * place it can vanish — a different phone, cleared storage, a booking link
 * forwarded to her husband, a sheet read that returned the wrong row. When it
 * vanished, the webhook fell back to scanning Cal's booking-form answers,
 * which have been empty since those questions were removed on 08-Sep, so every
 * booking scored 0.
 *
 * The webhook already holds what it needs to ask the sheet directly: the lead
 * id Cal carries in metadata, and the phone and email she booked with. So it
 * asks. Metadata `qscore` still wins when present — it is the cheapest and
 * already correct — and this is what runs when it is not.
 *
 * Match order is strictest first. A lead id is exact. Phone and email are how
 * a woman who booked from a forwarded link is still found, and they only run
 * when there is no lead id to go on, so a known lead is never confused with a
 * namesake. Rows are merged the same way lib/lead-row-merge does it — newest
 * non-empty value per column — because one woman is routinely spread across
 * several rows by three different writers.
 */
import { mergeLeadRows } from "./lead-row-merge.ts";

/** A booking qualifies at this quiz score or above. Unchanged since QualifiedSchedule was introduced. */
export const QUALIFIED_MIN_SCORE = 45;

export type SheetCols = { leadId: number; phone: number; email: number; score: number };

export type Booker = { leadId?: string; phone?: string; email?: string };

export type ScoreMatch = { score: number; matchedBy: "leadId" | "phone" | "email"; rows: number[] };

const last10 = (s: string | undefined) => String(s ?? "").replace(/\D/g, "").slice(-10);
const lower = (s: string | undefined) => String(s ?? "").trim().toLowerCase();

/** A usable score is a whole positive number. "", "0", "abc" and "-3" are not. */
function asScore(v: string | undefined): number | null {
  const n = Number.parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param all  Every sheet row, header at index 0.
 * @param placeholderEmail  The address used when a woman gave none; never a match key.
 */
export function findBookingLeadScore(
  all: (string[] | undefined)[],
  who: Booker,
  cols: SheetCols,
  placeholderEmail = "",
): ScoreMatch | null {
  // 1. Lead id — exact, and the only key used when she has one.
  const leadId = String(who.leadId ?? "").trim();
  if (leadId) {
    const merged = mergeLeadRows(all, leadId, cols.leadId);
    const score = merged ? asScore(merged.cells[cols.score]) : null;
    return merged && score ? { score, matchedBy: "leadId", rows: merged.rows } : null;
  }

  // 2 and 3. Phone, then email. Gather every row that matches, oldest first,
  // and merge exactly as a lead-id match would.
  const byKey = (matchedBy: "phone" | "email", hit: (row: string[]) => boolean): ScoreMatch | null => {
    const rows: number[] = [];
    let score: number | null = null;
    for (let i = 1; i < all.length; i++) {
      const row = all[i];
      if (!row || !hit(row)) continue;
      rows.push(i + 1);
      const s = asScore(row[cols.score]);
      if (s) score = s; // newest non-empty wins
    }
    return score ? { score, matchedBy, rows } : null;
  };

  const phone = last10(who.phone);
  if (phone.length === 10) {
    const m = byKey("phone", (r) => last10(r[cols.phone]) === phone);
    if (m) return m;
  }

  const email = lower(who.email);
  if (email && email !== lower(placeholderEmail)) {
    const m = byKey("email", (r) => lower(r[cols.email]) === email);
    if (m) return m;
  }
  return null;
}

/** Locate the score column by header, rightmost occurrence, else the fallback. */
export function scoreColumn(header: string[], fallback = 52): number {
  const i = header.map((h) => String(h ?? "").trim()).lastIndexOf("Lead Score");
  return i >= 0 ? i : fallback;
}
