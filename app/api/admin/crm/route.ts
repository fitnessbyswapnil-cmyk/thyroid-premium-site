/**
 * /api/admin/crm — the joined pipeline feed.
 *
 *   GET  → one record per WOMAN (lib/journey), however many rows and bookings
 *          she has: where she is now (state), how far she got (furthest stage,
 *          with inferred steps flagged), her next action, and — if she needs
 *          the coach — the same action item every tab shows.
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
import { checkAdminKey } from "../_lib";
import { budgetAnswer, scoreBooking } from "@/lib/lead-score";
import { writeCall, type CallFields } from "@/lib/crm-calls";
import { nextAction, type Stage } from "@/lib/crm-stage";
import { milestonesFor, missingCount, withinDays, type Milestone, type MsEvent } from "@/lib/crm-milestones";
import { coverageOf } from "@/lib/metrics";
import { loadJourneys } from "@/lib/journey-source";
import type { ActionItem, FunnelStage, Reached } from "@/lib/journey";

export const dynamic = "force-dynamic";

const isY = (s: string) => /^y(es)?$/i.test(String(s ?? "").trim());

const num = (s: string): number | null => {
  const n = parseFloat(String(s ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export type CrmRecord = {
  key: string;
  personId: string;
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
  /** Where she is now — current_state. Drives the working list. */
  stage: Stage;
  /** How far she ever got — furthest_stage_reached. Drives the funnel. */
  furthest: FunnelStage;
  reached: Reached;
  /** Stages set because a later one proved them, not because they were seen. */
  inferredStages: FunnelStage[];
  /** ISO date the daily job moved her to nurture; "" when she is not in it. */
  nurtureSince: string;
  nextAction: { label: string; urgency: string; reason: string };
  /** Set when she is on the one needs-action list (lib/journey). */
  action: ActionItem | null;
  /** Set when the tape says she agreed and no payment ever arrived. */
  agreedButUnpaid: boolean;
  /** What has and has not happened to her — three-state, see lib/crm-milestones. */
  milestones: Milestone[];
  /** How many milestones genuinely need action. */
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

function parseScorecard(raw: string): Record<string, { passed: boolean; evidence: string }> | null {
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

  const warnings: string[] = [];
  let loaded;
  try {
    loaded = await loadJourneys();
  } catch (err) {
    return NextResponse.json({ records: [], warnings: [`pipeline unavailable: ${String(err).slice(0, 160)}`], generatedAt: new Date().toISOString() });
  }
  const { journeys, needsAction, pipeline, now: nowMs } = loaded;
  const { data, sources } = loaded.loaded;
  const now = new Date(nowMs);

  if (sources.bookingsError) warnings.push(`No bookings loaded — ${sources.bookingsError}`);
  const testBookings = data.bookings.length - journeys.reduce((n, j) => n + j.person.bookings.length, 0) + sources.ownerTestBookingsDroppedAtSource;
  if (testBookings > 0) warnings.push(`${testBookings} test bookings hidden.`);
  if (!sources.messages) warnings.push("whatsapp history unavailable — milestones and the action list will be partial");

  // How far back the ingest has actually reached — see lib/metrics attendanceOf.
  const coverage = coverageOf(data.calls);
  const realBookings = journeys.flatMap((j) => j.person.bookings);
  if (!coverage.since && realBookings.length) {
    warnings.push("No call recordings ingested yet — attendance, price and follow-up are unknown rather than missed.");
  } else if (coverage.since && coverage.until) {
    const since = Date.parse(coverage.since);
    const until = Date.parse(coverage.until);
    const older = realBookings.filter((b) => !b.cancelled && Date.parse(b.startAt) < since).length;
    if (older) {
      warnings.push(
        `${older} bookings are older than the earliest ingested call (${new Date(since).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}) — their attendance is unknown, not missed.`,
      );
    }
    const after = realBookings.filter((b) => {
      const t0 = Date.parse(b.startAt);
      return !b.cancelled && t0 > until + 86_400_000 && t0 < nowMs;
    }).length;
    if (after) {
      warnings.push(
        `${after} calls happened after the last ingested recording (${new Date(until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}) — their attendance is unknown, not missed. Check the Fathom webhook, or mark them on Today.`,
      );
    }
  }

  // Her message history, grouped by phone, for the milestone board.
  const eventsByPhone = new Map<string, MsEvent[]>();
  for (const m of data.messages ?? []) {
    const list = eventsByPhone.get(m.phone) ?? [];
    list.push({ at: m.at, kind: m.dir === "in" ? "message_in" : "message_out", mediaType: m.mediaType });
    eventsByPhone.set(m.phone, list);
  }
  const actionByPerson = new Map(needsAction.items.map((i) => [i.personId, i]));

  const records: CrmRecord[] = journeys.map((j) => {
    const b = j.booking;
    const c = j.call?.detail ?? null;
    const answers = (b?.answers ?? {}) as Record<string, unknown>;
    const score = b ? scoreBooking(answers) : { score: null, answered: 0 };
    const paidAmounts = j.person.rows.map((r) => r.paidAmount).filter((x): x is number => x !== null);
    const paidAmount = paidAmounts.length ? Math.max(...paidAmounts) : null;
    const paid = j.won || !!j.consultPaidAt;
    const events = j.keys.filter((k) => k.startsWith("p:")).flatMap((k) => eventsByPhone.get(k.slice(2)) ?? []);

    const stageInput = {
      hasBooking: !!b && !b.cancelled,
      bookingCancelled: !!b?.cancelled,
      sessionStart: b?.startAt || null,
      call: null,
      paid,
      won: j.won,
      now,
    };
    const action = nextAction(j.state, stageInput, {
      objection: c?.objection ?? "",
      excuse: c?.excuse ?? "",
      agreedCallbackAt: c?.agreedCallbackAt || null,
    });
    const ms = milestonesFor({
      hasBooking: !!b && !b.cancelled,
      cancelled: !!b?.cancelled,
      sessionStart: b?.startAt || null,
      call: c
        ? { attended: isY(c.attended), pricePitched: num(c.pricePitched), lowestPriceSaid: num(c.lowestPriceSaid), occurredAt: c.occurredAt || b?.startAt || "" }
        : null,
      paid,
      paidAmount,
      events,
      callDataSince: coverage.since ?? undefined,
      now,
    });

    return {
      key: j.id,
      personId: j.id,
      bookingUid: b?.uid ?? "",
      name: j.name,
      email: j.email,
      phone: j.phone,
      city: j.city,
      sessionStart: b?.startAt ?? "",
      cancelled: !!b?.cancelled,
      score: score.score,
      answered: score.answered,
      budget: b ? budgetAnswer(answers) : "",
      paid,
      paidAmount,
      stage: j.state,
      furthest: j.furthest,
      reached: j.reached,
      inferredStages: j.inferredStages,
      nurtureSince: j.state === "nurture" && j.nurtureSince ? new Date(j.nurtureSince).toISOString() : "",
      nextAction: action,
      action: actionByPerson.get(j.id) ?? null,
      agreedButUnpaid: j.agreedButUnpaid,
      milestones: ms,
      missing: missingCount(ms),
      recent: withinDays({ sessionStart: b?.startAt || null, events, now }, 3),
      call: c
        ? {
            attended: isY(c.attended),
            pricePitched: num(c.pricePitched),
            lowestPriceSaid: num(c.lowestPriceSaid),
            discountOffered: isY(c.discountOffered),
            discountAt: c.discountAt ?? "",
            objection: c.objection ?? "",
            excuse: c.excuse ?? "",
            agreedCallbackAt: c.agreedCallbackAt ?? "",
            summary: c.summary ?? "",
            scorecardFailed: num(c.scorecardFailed ?? ""),
            scorecard: parseScorecard(c.scorecard ?? ""),
            coachTalkPct: num(c.coachTalkPct ?? ""),
            fathomUrl: c.fathomUrl ?? "",
            reviewed: isY(c.reviewed ?? ""),
            occurredAt: c.occurredAt ?? "",
          }
        : null,
    };
  });

  return NextResponse.json({
    records,
    needsAction: { count: needsAction.count, overdue: needsAction.overdue },
    pipeline,
    warnings,
    generatedAt: now.toISOString(),
  });
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
