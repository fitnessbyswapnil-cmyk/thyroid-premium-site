/**
 * /api/admin/crm — the joined pipeline feed.
 *
 *   GET  → one record per booking (plus leads that never booked), with a stage
 *          and a next action DERIVED from four systems.
 *   POST → writes a Calls row. { bookingUid, fields, mode }.
 *          mode "correction" (default) = the coach fixing the extraction; stamps
 *          Reviewed=Y and is protected from every later automated write.
 *          mode "ingest" = an automated extraction creating the row; writes the
 *          full field set and deliberately does NOT stamp Reviewed.
 *
 * Auth: x-admin-key, same as the rest of /api/admin/*.
 *
 * The join, and who owns which truth:
 *   Cal.com  → the booking exists, when it is, whether she cancelled, and her
 *              qualifying answers (these live NOWHERE else — not in the sheet)
 *   Fathom   → whether the call happened and what was said (via the Calls tab)
 *   Cashfree → whether money arrived (Paid column on Leads)
 *   Sheet    → everything captured before the call
 *
 * Nothing here is authored by hand. `reviewed` is the one human bit, and it only
 * ever means "the coach has checked this row", never "the coach typed this row".
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";
import { budgetAnswer, scoreBooking } from "@/lib/lead-score";
import { fetchBookings, type CalBookingRecord } from "@/lib/cal-bookings";
import { readCalls, writeCall, type CallRow, type CallFields } from "@/lib/crm-calls";
import { deriveStage, nextAction, agreedButUnpaid, type Stage, type CallFacts } from "@/lib/crm-stage";
import { milestonesFor, missingCount, withinDays, type Milestone, type MsEvent } from "@/lib/crm-milestones";
import { readMessages } from "@/lib/wa-messages";
import { isOwnerTest } from "@/lib/owner-filter";

export const dynamic = "force-dynamic";

const norm = (s: string) => String(s ?? "").trim().toLowerCase();
const isY = (s: string) => /^y(es)?$/i.test(String(s ?? "").trim());
/** Indian numbers arrive with and without the 91 prefix — compare on the last 10. */
const tail10 = (s: string) => String(s ?? "").replace(/\D/g, "").slice(-10);

const num = (s: string): number | null => {
  const n = parseFloat(String(s ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

type SheetLead = {
  row: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  paid: boolean;
  paidAmount: number | null;
  timestamp: string;
};

/** Reads only the columns the CRM needs, by header NAME. */
function parseLeads(values: string[][]): SheetLead[] {
  if (values.length < 2) return [];
  const header = values[0].map(norm);
  const at = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(norm(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = {
    name: at("Name"),
    email: at("Email"),
    phone: at("Phone"),
    city: at("City"),
    paid: at("Paid"),
    paidAmount: at("Paid Amount"),
    ts: at("Timestamp"),
  };

  const out: SheetLead[] = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r] ?? [];
    const get = (i: number) => (i >= 0 ? String(row[i] ?? "").trim() : "");
    const email = get(idx.email).toLowerCase();
    if (!email) continue;
    // Same rule as the bookings: his own test submissions are not prospects.
    if (isOwnerTest({ name: get(idx.name), email })) continue;
    out.push({
      row: r + 1,
      name: get(idx.name),
      email,
      phone: get(idx.phone),
      city: get(idx.city),
      paid: isY(get(idx.paid)) || (num(get(idx.paidAmount)) ?? 0) > 0,
      paidAmount: num(get(idx.paidAmount)),
      timestamp: get(idx.ts),
    });
  }
  return out;
}

export type CrmRecord = {
  key: string;
  bookingUid: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  sessionStart: string;
  cancelled: boolean;
  score: number | null;
  answered: number;
  budget: string;
  paid: boolean;
  paidAmount: number | null;
  stage: Stage;
  nextAction: { label: string; urgency: string; reason: string };
  /** Set when the tape says she agreed and no payment ever arrived. */
  agreedButUnpaid: boolean;
  /** What has and has not happened to her — three-state, see lib/crm-milestones. */
  milestones: Milestone[];
  /** How many milestones genuinely need action. Drives the row's urgency. */
  missing: number;
  /** Whether she falls inside the 3-day board window. */
  recent: boolean;
  call: {
    attended: boolean;
    pricePitched: number | null;
    lowestPriceSaid: number | null;
    discountOffered: boolean;
    discountAt: string;
    objection: string;
    excuse: string;
    agreedCallbackAt: string;
    summary: string;
    scorecardFailed: number | null;
    scorecard: Record<string, { passed: boolean; evidence: string }> | null;
    coachTalkPct: number | null;
    fathomUrl: string;
    reviewed: boolean;
    occurredAt: string;
  } | null;
};

function toFacts(c: CallRow | undefined, sessionStart: string): CallFacts | null {
  if (!c) return null;
  return {
    attended: isY(c.attended),
    pricePitched: num(c.pricePitched),
    moneyMovedOnCall: isY(c.moneyMovedOnCall),
    occurredAt: c.occurredAt || sessionStart,
  };
}

function parseScorecard(raw: string): CrmRecord["call"] extends null ? null : Record<string, { passed: boolean; evidence: string }> | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Record<string, { passed: boolean; evidence: string }>;
    return p && typeof p === "object" ? p : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  let leads: SheetLead[] = [];
  let bookings: CalBookingRecord[] = [];
  let calls: CallRow[] = [];
  const warnings: string[] = [];

  // Each source degrades independently — one being down must not blank the page.
  const [sheetRes, bookingRes, callRes, msgRes] = await Promise.allSettled([
    (async () => {
      const { sheets, sheetId } = await getSheetsClient();
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!A1:BC` });
      return parseLeads((r.data.values as string[][]) ?? []);
    })(),
    fetchBookings(100),
    readCalls(),
    readMessages(),
  ]);

  if (sheetRes.status === "fulfilled") leads = sheetRes.value;
  else warnings.push(`leads sheet unavailable: ${String(sheetRes.reason).slice(0, 120)}`);
  if (bookingRes.status === "fulfilled") {
    bookings = bookingRes.value.bookings;
    // A silent zero is indistinguishable from a true zero, so say why.
    if (bookingRes.value.error) warnings.push(`No bookings loaded — ${bookingRes.value.error}`);
    // Say what was removed rather than quietly shrinking the pipeline.
    if (bookingRes.value.ownerTestsRemoved > 0) {
      warnings.push(`${bookingRes.value.ownerTestsRemoved} of your own test bookings hidden.`);
    }
  } else {
    warnings.push(`cal.com unavailable: ${String(bookingRes.reason).slice(0, 120)}`);
  }
  if (callRes.status === "fulfilled") calls = callRes.value;
  else warnings.push(`calls tab unavailable: ${String(callRes.reason).slice(0, 120)}`);

  // One read, grouped by phone — milestones need her message history, and doing
  // this per-lead would be a hundred reads of the same sheet.
  const eventsByPhone = new Map<string, MsEvent[]>();
  if (msgRes.status === "fulfilled") {
    for (const m of msgRes.value) {
      const k = tail10(m.phone);
      if (!k) continue;
      const list = eventsByPhone.get(k) ?? [];
      list.push({ at: m.ts, kind: m.direction === "in" ? "message_in" : "message_out", mediaType: m.mediaType || "" });
      eventsByPhone.set(k, list);
    }
  } else {
    warnings.push("whatsapp history unavailable — milestones will be partial");
  }

  // If the Calls tab has no rows at all, ingestion has never run, so a missing
  // recording says nothing about whether she turned up.
  const callDataAvailable = calls.length > 0;
  if (!callDataAvailable && bookings.length) {
    warnings.push("No call recordings ingested yet — attendance, price and follow-up are unknown rather than missed.");
  }

  const leadByEmail = new Map(leads.map((l) => [l.email, l]));
  const callByUid = new Map(calls.map((c) => [c.bookingUid, c]));

  const records: CrmRecord[] = [];
  const seenEmails = new Set<string>();

  for (const b of bookings) {
    const lead = b.email ? leadByEmail.get(b.email) : undefined;
    if (b.email) seenEmails.add(b.email);

    const c = callByUid.get(b.uid);
    const facts = toFacts(c, b.startIso);
    const score = scoreBooking(b.answers);

    const input = {
      hasBooking: !b.cancelled,
      bookingCancelled: b.cancelled,
      sessionStart: b.startIso || null,
      call: facts,
      callDataAvailable,
      paid: lead?.paid ?? false,
      now,
    };
    const stage = deriveStage(input);
    const objection = c?.objection ?? "";
    const action = nextAction(stage, input, {
      objection,
      excuse: c?.excuse ?? "",
      agreedCallbackAt: c?.agreedCallbackAt || null,
    });

    const evs = eventsByPhone.get(tail10(b.phone || lead?.phone || "")) ?? [];
    const msInput = {
      hasBooking: !b.cancelled,
      cancelled: b.cancelled,
      sessionStart: b.startIso || null,
      call: c
        ? {
            attended: isY(c.attended),
            pricePitched: num(c.pricePitched),
            lowestPriceSaid: num(c.lowestPriceSaid),
            occurredAt: c.occurredAt || b.startIso,
          }
        : null,
      paid: lead?.paid ?? false,
      paidAmount: lead?.paidAmount ?? null,
      events: evs,
      callDataAvailable,
      now,
    };
    const ms = milestonesFor(msInput);

    records.push({
      key: b.uid,
      bookingUid: b.uid,
      name: b.name || lead?.name || "",
      email: b.email || lead?.email || "",
      phone: b.phone || lead?.phone || "",
      city: lead?.city ?? "",
      sessionStart: b.startIso,
      cancelled: b.cancelled,
      score: score.score,
      answered: score.answered,
      budget: budgetAnswer(b.answers),
      paid: lead?.paid ?? false,
      paidAmount: lead?.paidAmount ?? null,
      stage,
      nextAction: action,
      agreedButUnpaid: agreedButUnpaid(input),
      milestones: ms,
      missing: missingCount(ms),
      recent: withinDays({ sessionStart: b.startIso || null, events: evs, now }, 3),
      call: c
        ? {
            attended: isY(c.attended),
            pricePitched: num(c.pricePitched),
            lowestPriceSaid: num(c.lowestPriceSaid),
            discountOffered: isY(c.discountOffered),
            discountAt: c.discountAt,
            objection,
            excuse: c.excuse,
            agreedCallbackAt: c.agreedCallbackAt,
            summary: c.summary,
            scorecardFailed: num(c.scorecardFailed),
            scorecard: parseScorecard(c.scorecard),
            coachTalkPct: num(c.coachTalkPct),
            fathomUrl: c.fathomUrl,
            reviewed: isY(c.reviewed),
            occurredAt: c.occurredAt,
          }
        : null,
    });
  }

  // Leads who are qualified but never booked — the top of the pipeline.
  for (const l of leads) {
    if (seenEmails.has(l.email)) continue;
    const input = { hasBooking: false, bookingCancelled: false, sessionStart: null, call: null, paid: l.paid, now };
    const stage = deriveStage(input);
    const evs = eventsByPhone.get(tail10(l.phone)) ?? [];
    const ms = milestonesFor({
      hasBooking: false,
      cancelled: false,
      sessionStart: null,
      call: null,
      paid: l.paid,
      paidAmount: l.paidAmount,
      events: evs,
      now,
    });
    records.push({
      key: `lead:${l.email}`,
      bookingUid: "",
      name: l.name,
      email: l.email,
      phone: l.phone,
      city: l.city,
      sessionStart: "",
      cancelled: false,
      score: null,
      answered: 0,
      budget: "",
      paid: l.paid,
      paidAmount: l.paidAmount,
      stage,
      nextAction: nextAction(stage, input),
      agreedButUnpaid: false,
      milestones: ms,
      missing: missingCount(ms),
      recent: withinDays({ sessionStart: null, events: evs, now }, 3),
      call: null,
    });
  }

  return NextResponse.json({ records, warnings, generatedAt: now.toISOString() });
}

/**
 * Two writers, one endpoint, distinguished by `mode`:
 *
 *   mode "correction" (default) — the coach fixing something the extraction got
 *     wrong. Stamps Reviewed=Y, which permanently protects the row from being
 *     overwritten by any later automated run.
 *
 *   mode "ingest" — an automated extraction writing a full row. Must NOT stamp
 *     Reviewed: doing so would freeze the row against every future improvement,
 *     including the Fathom webhook once it is switched on. An ingest is a
 *     first draft, not a verdict.
 *
 * The split matters because the same endpoint serves a person and a machine, and
 * only one of them is allowed to have the last word.
 */
export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { bookingUid?: string; fields?: Record<string, string>; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const bookingUid = String(body.bookingUid ?? "").trim();
  if (!bookingUid) return NextResponse.json({ error: "bookingUid required" }, { status: 400 });

  const ingest = body.mode === "ingest";
  const incoming = body.fields ?? {};

  // A correction may only touch the judgement fields. An ingest may write the
  // whole row, because it is creating it.
  const CORRECTABLE = [
    "attended",
    "pricePitched",
    "lowestPriceSaid",
    "discountOffered",
    "moneyMovedOnCall",
    "amountAgreed",
    "objection",
    "excuse",
    "agreedCallbackAt",
    "summary",
  ] as const;
  const INGEST_ONLY = [
    "occurredAt",
    "name",
    "email",
    "phone",
    "coachTalkPct",
    "discountAt",
    "scorecard",
    "scorecardFailed",
    "fathomUrl",
    "extractedBy",
  ] as const;

  const fields: CallFields = { bookingUid };
  if (!ingest) fields.reviewed = "Y";
  else fields.writtenAt = new Date().toISOString();

  const allowed: readonly string[] = ingest ? [...CORRECTABLE, ...INGEST_ONLY] : CORRECTABLE;
  for (const k of allowed) {
    if (typeof incoming[k] === "string") (fields as Record<string, string>)[k] = incoming[k];
  }

  try {
    // A correction forces past the Reviewed guard (the coach is the authority).
    // An ingest does not: a row the coach has already reviewed must survive it.
    const plan = await writeCall(fields, { force: !ingest });
    return NextResponse.json({ ok: true, action: plan.action, skipped: plan.skipReason ?? null });
  } catch (err) {
    console.error("[admin/crm] write failed:", err);
    return NextResponse.json({ error: "write_failed" }, { status: 502 });
  }
}
