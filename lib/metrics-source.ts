/**
 * SERVER ONLY. Loads the one dataset lib/metrics computes from.
 *
 * Three sources, read the same way for every tab:
 *  - the Leads sheet, by header NAME and wide enough to reach every column —
 *    the Analytics route read A:BC, and "Paid At" / "Programme Closed At" live
 *    past BC, so it could never date a payment;
 *  - EVERY Cal.com booking (fetchAllBookings), not a 50- or 100-row slice;
 *  - the Calls sheet (Fathom ingest + hand-ticked checklists).
 *
 * The raw dataset is cached per worker for a minute: each tab asks on load, and
 * the Cal.com pages are the slow part. Summaries are cheap and computed fresh.
 */
import { getSheetsClient, SHEET_NAME } from "@/app/api/admin/_lib";
import { fetchAllBookings } from "@/lib/cal-bookings";
import { readCalls } from "@/lib/crm-calls";
import type { CallRecord, Dataset, LeadRecord } from "./metrics.ts";

export type LoadedDataset = {
  data: Dataset;
  sources: {
    leadRows: number;
    bookings: number;
    calls: number;
    bookingsError: string;
    ownerTestBookingsDroppedAtSource: number;
    loadedAt: string;
  };
};

const TTL_MS = 60_000;
let cache: { at: number; value: LoadedDataset } | null = null;

const num = (v: string): number | null => {
  const cleaned = String(v ?? "").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

function parseScorecard(raw: string): Record<string, boolean> | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, { passed?: unknown } | boolean>;
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "boolean") out[k] = v;
      else if (v && typeof v === "object" && typeof v.passed === "boolean") out[k] = v.passed;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

async function loadLeads(): Promise<LeadRecord[]> {
  const { sheets, sheetId } = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!A1:ZZ` });
  const rows = (res.data.values as string[][]) ?? [];
  if (rows.length < 2) return [];
  const hdr = rows[0].map((h) => String(h ?? "").trim());
  // Rightmost occurrence: several headers exist twice from older layouts.
  const col = (name: string) => hdr.lastIndexOf(name);
  const C = {
    name: col("Name"), phone: col("Phone"), email: col("Email"),
    paid: col("Paid"), paidAmount: col("Paid Amount"), paidAt: col("Paid At"),
    closedAmt: col("Closed ₹"), closedAt: col("Programme Closed At"),
    programmeValue: col("Programme Value"), programmeCollected: col("Programme Collected"),
  };
  const cell = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  const out: LeadRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const createdAt = cell(r, 0);
    if (!createdAt && !cell(r, C.phone) && !cell(r, C.email)) continue;
    out.push({
      row: i + 1,
      createdAt,
      name: cell(r, C.name),
      phone: cell(r, C.phone),
      email: cell(r, C.email),
      paid: /^y(es)?$/i.test(cell(r, C.paid)),
      paidAmount: num(cell(r, C.paidAmount)),
      paidAt: cell(r, C.paidAt),
      closedAmt: num(cell(r, C.closedAmt)),
      closedAt: cell(r, C.closedAt),
      programmeValue: num(cell(r, C.programmeValue)),
      programmeCollected: num(cell(r, C.programmeCollected)),
    });
  }
  return out;
}

export async function loadMetricsDataset(force = false): Promise<LoadedDataset> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const [leads, bookingsRes, callRows] = await Promise.all([loadLeads(), fetchAllBookings(), readCalls()]);

  const calls: CallRecord[] = callRows
    .filter((c) => c.bookingUid)
    .map((c) => ({
      bookingUid: c.bookingUid,
      occurredAt: c.occurredAt,
      attended: /^y/i.test(c.attended) ? true : /^n/i.test(c.attended) ? false : null,
      scorecard: parseScorecard(c.scorecard),
      pricePitched: num(c.pricePitched),
      discountOffered: /^y/i.test(c.discountOffered),
    }));

  const value: LoadedDataset = {
    data: {
      leads,
      bookings: bookingsRes.bookings.map((b) => ({
        uid: b.uid,
        createdAt: b.createdAt,
        startAt: b.startIso,
        cancelled: b.cancelled,
        name: b.name,
        email: b.email,
        phone: b.phone,
      })),
      calls,
    },
    sources: {
      leadRows: leads.length,
      bookings: bookingsRes.bookings.length,
      calls: calls.length,
      bookingsError: bookingsRes.error,
      ownerTestBookingsDroppedAtSource: bookingsRes.ownerTestsRemoved,
      loadedAt: new Date().toISOString(),
    },
  };
  cache = { at: Date.now(), value };
  return value;
}
