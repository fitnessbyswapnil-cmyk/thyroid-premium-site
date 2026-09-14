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
import { fetchAllBookings, type CalBookingRecord } from "@/lib/cal-bookings";
import { readCalls, writeCall, type CallRow, type CallFields } from "@/lib/crm-calls";
import { deriveStage, nextAction, agreedButUnpaid, type Stage, type CallFacts } from "@/lib/crm-stage";
import { milestonesFor, missingCount, withinDays, type Milestone, type MsEvent } from "@/lib/crm-milestones";
import { readMessages } from "@/lib/wa-messages";
import { canonicalEmail } from "@/lib/owner-filter";
import { isTestIdentity, isWonRow, coverageOf } from "@/lib/metrics";

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
  /** A programme sale on any of her rows — lib/metrics' definition. */
  won: boolean;
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
    closedAmt: at("Closed ₹"),
    programmeValue: at("Programme Value"),
    ts: at("Timestamp"),
  };

  const out: SheetLead[] = [];
  // One woman who filled the form three times is one lead, not three. Later rows
  // win, because the sheet is append-ordered and the newest submission carries
  // the freshest phone number and payment state.
  //
  // Matched on email OR phone. A Cashfree payment row can carry only a phone
  // number — the Rs 30,000 sale on 11 Sep did — and keying on email alone
  // dropped that row entirely, so Pipeline showed the sale as unjudged while
  // every other tab counted it won.
  const byEmail = new Map<string, number>();
  const byPhone = new Map<string, number>();
  for (let r = 1; r < values.length; r++) {
    const row = values[r] ?? [];
    const get = (i: number) => (i >= 0 ? String(row[i] ?? "").trim() : "");
    const email = get(idx.email).toLowerCase();
    const phone10 = tail10(get(idx.phone));
    if (!email && phone10.length < 10) continue;
    // His own test submissions are not prospects — the one test rule, which
    // also knows his phone number (lib/metrics).
    if (isTestIdentity({ name: get(idx.name), email, phone: get(idx.phone) })) continue;

    const canon = email ? canonicalEmail(email) : "";
    const seenAt = (canon ? byEmail.get(canon) : undefined) ?? (phone10.length === 10 ? byPhone.get(phone10) : undefined);
    const lead = {
      row: r + 1,
      name: get(idx.name),
      email,
      phone: get(idx.phone),
      city: get(idx.city),
      paid: isY(get(idx.paid)) || (num(get(idx.paidAmount)) ?? 0) > 0,
      paidAmount: num(get(idx.paidAmount)),
      won: isWonRow({
        closedAmt: num(get(idx.closedAmt)),
        programmeValue: num(get(idx.programmeValue)),
        paidAmount: num(get(idx.paidAmount)),
      }),
      timestamp: get(idx.ts),
    };
    if (seenAt === undefined) {
      if (canon) byEmail.set(canon, out.length);
      if (phone10.length === 10) byPhone.set(phone10, out.length);
      out.push(lead);
    } else {
      // Keep whichever row actually paid — a later blank must never erase it —
      // and a programme sale on ANY of her rows keeps her won. A blank email or
      // phone on the newer row keeps the one already known.
      const prev = out[seenAt];
      const merged = prev.paid && !lead.paid ? { ...lead, paid: prev.paid, paidAmount: prev.paidAmount } : lead;
      out[seenAt] = {
        ...merged,
        name: merged.name || prev.name,
        email: merged.email || prev.email,
        phone: merged.phone || prev.phone,
        won: prev.won || lead.won,
      };
      if (canon) byEmail.set(canon, seenAt);
      if (phone10.length === 10) byPhone.set(phone10, seenAt);
    }
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
      // To ZZ, not BC: "Closed ₹" and "Programme Value" sit past column BC,
      // so a marked programme sale was invisible to this tab.
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!A1:ZZ` });
      return parseLeads((r.data.values as string[][]) ?? []);
    })(),
    // Every booking, as the headline metrics count them — not the newest 50.
    fetchAllBookings(),
    readCalls(),
    readMessages(),
  ]);

  if (sheetRes.status === "fulfilled") leads = sheetRes.value;
  else warnings.push(`leads sheet unavailable: ${String(sheetRes.reason).slice(0, 120)}`);
  if (bookingRes.status === "fulfilled") {
    // The source drops his own identity; the rest of the test rule (the "test"
    // keyword, placeholder emails, dummy numbers) is applied here.
    const all = bookingRes.value.bookings;
    bookings = all.filter((b) => !isTestIdentity({ name: b.name, email: b.email, phone: b.phone }));
    const keywordTests = all.length - bookings.length;
    // A silent zero is indistinguishable from a true zero, so say why.
    if (bookingRes.value.error) warnings.push(`No bookings loaded — ${bookingRes.value.error}`);
    // Say what was removed rather than quietly shrinking the pipeline.
    if (bookingRes.value.ownerTestsRemoved + keywordTests > 0) {
      warnings.push(`${bookingRes.value.ownerTestsRemoved + keywordTests} test bookings hidden.`);
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

  // How far back the ingest has actually reached. Only bookings at or after this
  // point can be judged for attendance; older ones are un-searched, not missed.
  const coverage = coverageOf(
    calls.map((c) => ({ bookingUid: c.bookingUid, occurredAt: c.occurredAt, attended: null, scorecard: null })),
  );
  const callDataSince = coverage.since ?? "";
  const callDataUntil = coverage.until ?? "";
  if (!callDataSince && bookings.length) {
    warnings.push("No call recordings ingested yet — attendance, price and follow-up are unknown rather than missed.");
  } else if (callDataSince) {
    const older = bookings.filter((b) => {
      const t0 = new Date(b.startIso).getTime();
      return !Number.isNaN(t0) && t0 < new Date(callDataSince).getTime();
    }).length;
    if (older) {
      warnings.push(
        `${older} bookings are older than the earliest ingested call (${new Date(callDataSince).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}) — their attendance is unknown, not missed. Run the backfill to judge them.`,
      );
    }
    // The other edge. If nothing has been ingested for a while, calls after the
    // last recording are unknown too — the ingest stopped, they were not missed.
    const lastIngest = new Date(callDataUntil).getTime();
    const after = bookings.filter((b) => {
      const t0 = new Date(b.startIso).getTime();
      return !b.cancelled && !Number.isNaN(t0) && t0 > lastIngest + 86_400_000 && t0 < now.getTime();
    }).length;
    if (after) {
      warnings.push(
        `${after} calls happened after the last ingested recording (${new Date(callDataUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}) — their attendance is unknown, not missed. Check the Fathom webhook, or run the backfill.`,
      );
    }
  }

  const leadByEmail = new Map(leads.filter((l) => l.email).map((l) => [canonicalEmail(l.email), l]));
  const leadByPhone = new Map(leads.filter((l) => tail10(l.phone).length === 10).map((l) => [tail10(l.phone), l]));
  const leadFor = (email: string, phone: string) =>
    (email ? leadByEmail.get(canonicalEmail(email)) : undefined) ?? (tail10(phone).length === 10 ? leadByPhone.get(tail10(phone)) : undefined);
  const callByUid = new Map(calls.map((c) => [c.bookingUid, c]));

  const records: CrmRecord[] = [];
  // Leads already shown against a booking, so the never-booked list below does
  // not repeat them.
  const shownLeads = new Set<SheetLead>();

  for (const b of bookings) {
    const lead = leadFor(b.email, b.phone);
    if (lead) shownLeads.add(lead);

    const c = callByUid.get(b.uid);
    const facts = toFacts(c, b.startIso);
    const score = scoreBooking(b.answers);

    const input = {
      hasBooking: !b.cancelled,
      bookingCancelled: b.cancelled,
      sessionStart: b.startIso || null,
      call: facts,
      callDataSince,
      callDataUntil,
      paid: lead?.paid ?? false,
      won: lead?.won ?? false,
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
      callDataSince,
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
    if (shownLeads.has(l)) continue;
    const input = { hasBooking: false, bookingCancelled: false, sessionStart: null, call: null, paid: l.paid, won: l.won, now };
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
