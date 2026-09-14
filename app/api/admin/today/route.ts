/**
 * GET /api/admin/today — the feed for the Today screen.
 *
 * Four blocks, in the order the coach reads them between calls:
 *   1. acquisition  — cost per Rs299 payer AND cost per programme client
 *   2. queue        — one merged action list, sorted by money at risk
 *   3. health       — did every automated message actually get DELIVERED
 *   4. capacity     — closes this month against the 7-client ceiling
 *
 * WHY THE SECOND COST NUMBER EXISTS
 * The Rs299 is a qualifier, not the product. Optimising it alone rewards cheap
 * payers who never buy the programme, so both numbers sit side by side and the
 * screen says so out loud when they diverge.
 *
 * WHY DELIVERY, NOT SENDS
 * A capped WhatsApp template returns a message id and then never arrives. Every
 * dashboard that counts sends reads healthy while nothing lands — which is how
 * the welcome message went 18 days unnoticed. This counts failures.
 *
 * Everything degrades rather than throws: an empty ad cache costs the spend
 * figures, not the page. Spend comes from D1 (lib/ads-cache), filled hourly.
 *
 * Auth: x-admin-key.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";
import { readMessages } from "@/lib/wa-messages";
import { isOwnerTest } from "@/lib/owner-filter";
import { summarize, windowFor, checklistSummary, coverageOf, attendanceOf, isTestIdentity, personKey } from "@/lib/metrics";
import { loadMetricsDataset } from "@/lib/metrics-source";
import { readCalls } from "@/lib/crm-calls";
import { fetchBookings } from "@/lib/cal-bookings";
import { draftMessage, draftWaLink } from "@/lib/draft-message";
import { decisionBadge, findColumn, type DecisionBadge } from "@/lib/decision-maker";
import { dmPresenceRate, type PresenceRecord } from "@/lib/dm-presence";
import { IS_TEST_MODE } from "../../create-cashfree-order/route";
import { cachedSpend } from "@/lib/ads-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CEILING = 7; // clients a month, one coach, no team

const col = (h: string[], t: string) => h.lastIndexOf(t);
const cell = (r: string[], i: number) => (i >= 0 ? String(r?.[i] ?? "").trim() : "");
const digits10 = (s: string) => s.replace(/\D/g, "").slice(-10);
const num = (s: string) => Number(String(s).replace(/[^\d.]/g, "")) || 0;

function parseWhen(s: string): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 0 = all time, shared with the other tabs through the range picker.
  const rawDays = Number(req.nextUrl.searchParams.get("days") ?? 14);
  const days = rawDays === 0 ? 0 : Math.min(3650, Math.max(1, Number.isFinite(rawDays) ? rawDays : 14));
  const now = Date.now();
  const since = days === 0 ? 0 : now - days * 86400000;

  const { sheets, sheetId } = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A1:BZ`,
  });
  const all = (res.data.values as string[][]) ?? [];
  const header = (all[0] ?? []).map((h) => String(h ?? "").trim());
  const rows = all.slice(1);

  const C = {
    ts: 0, leadId: 1, name: 2, phone: 3,
    paid: col(header, "Paid"),
    paidAt: col(header, "Paid At"),
    paidAmount: col(header, "Paid Amount"),
    bookingStatus: col(header, "Booking Status"),
    sessionDate: col(header, "Session Date"),
    showed: col(header, "Showed"),
    score: col(header, "Lead Score (/100)"),
    email: col(header, "Email"),
    programmeValue: col(header, "Programme Value"),
    programmeCollected: col(header, "Programme Collected"),
    programmeClosedAt: col(header, "Programme Closed At"),
    goal: col(header, "Main Goal"),
    thyroidScore: col(header, "Thyroid Score"),
    blockers: col(header, "Blockers"),
    struggles: col(header, "Weight Struggles"),
    challenge: col(header, "Biggest Challenge"),
    diagnosis: col(header, "Diagnosis"),
    medication: col(header, "On Medication"),
    duration: col(header, "Struggle Duration"),
    tried: col(header, "Tried Before"),
    city: col(header, "City"),
    budget: col(header, "Investment Ability"),
    // Who signs off, and whether that person will be on the call. Both are
    // resolved case-insensitively and both are allowed to be absent: "Decision
    // Maker" is missing on leads older than the question, and "Partner On
    // Call" is missing on every row written before the column existed. A -1
    // reads as an empty cell, which reads as "no badge".
    decisionMaker: findColumn(header, "Decision Maker"),
    partnerOnCall: findColumn(header, "Partner On Call"),
    // Marked by hand on this screen after the call. Absent until the first one
    // is marked, which is why every reader of it tolerates -1. Resolved with
    // the plain exact-match helper, not the tolerant one above: this column is
    // written by /api/admin/mark under a fixed title, never typed by hand.
    dmPresent: col(header, "DM Present"),
  };

  // ── Acquisition ───────────────────────────────────────────────────────────
  // Every count and sum here comes from lib/metrics — the same definitions,
  // the same dataset and the same window as Pipeline and Analytics. This block
  // used to call any payment of ₹5,000+ a programme close and count every
  // Paid = Y row as a consult payer, a third definition beside the other two
  // tabs' two. The owner's rules now: a win is ₹15,000+ or a sale marked here,
  // revenue is programme money collected, ₹299 fees are their own line.
  const { data: metricsData } = await loadMetricsDataset();
  const m = summarize(metricsData, windowFor(days, now), now);
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const month = summarize(metricsData, { from: monthStart.getTime(), to: now + 1 }, now);
  const consultPayers = m.consultFees.count;
  const programmeCloses = m.won;
  const contracted = m.contracted;
  const collected = m.revenue;
  const monthCloses = month.won;
  const heuristicUsed = false;
  const checklist = checklistSummary(metricsData.calls);

  // ── Calls to mark ─────────────────────────────────────────────────────────
  // Every call from the last 14 days whose slot has passed and that has no
  // recorded outcome. Recordings stopped arriving after 30 Aug, and the old
  // "Did she pay?" list only filled from recordings, so nothing was ever
  // marked. Marking here writes the Calls sheet — attendance plus the
  // checklist — which is exactly what show-up rate and "what you fail most"
  // read. It sends nothing to Meta; a payment still goes through /mark.
  const coverage = coverageOf(metricsData.calls);
  const judged = new Set(metricsData.calls.filter((c) => c.attended !== null).map((c) => c.bookingUid));
  const leadRowByPerson = new Map<string, number>();
  for (const l of metricsData.leads) {
    if (isTestIdentity(l)) continue;
    const k = personKey(l);
    if (k) leadRowByPerson.set(k, l.row); // newest row wins: append-ordered
  }
  const toMark = metricsData.bookings
    .filter((b) => !isTestIdentity(b) && !b.cancelled && !judged.has(b.uid))
    .map((b) => ({ b, state: attendanceOf(b, undefined, coverage, now), t: Date.parse(b.startAt) }))
    .filter(({ state, t }) => state !== "upcoming" && state !== "cancelled" && Number.isFinite(t) && now - t <= 14 * 86400000)
    .sort((a, b) => b.t - a.t)
    .slice(0, 20)
    .map(({ b }) => ({
      bookingUid: b.uid,
      name: b.name,
      phone: b.phone.replace(/\D/g, "").slice(-10),
      email: b.email,
      startAt: b.startAt,
      leadRow: leadRowByPerson.get(personKey(b)) ?? null,
    }));

  // From the D1 cache the hourly refresh keeps — never a live Windsor call.
  const { spend, asOf: spendAsOf } = await cachedSpend(since, now);
  const cpp = spend !== null && consultPayers > 0 ? Math.round(spend / consultPayers) : null;
  const cppc = spend !== null && programmeCloses > 0 ? Math.round(spend / programmeCloses) : null;

  // ── Queue ─────────────────────────────────────────────────────────────────
  type QRow = {
    name: string; phone: string; reason: string; kind: string;
    risk: number; when: string; leadId: string; wa: string;
    /** Only on an upcoming call, and only when her answers support one. */
    badge?: DecisionBadge;
  };
  const queue: QRow[] = [];
  const todayEnd = now + 86400000;

  for (const r of rows) {
    const name = cell(r, C.name);
    const phone = digits10(cell(r, C.phone));
    if (!name || phone.length !== 10) continue;
    // His own test rows would otherwise dominate a queue sorted by money at
    // risk, and a queue you have to mentally filter is one you stop reading.
    if (isOwnerTest({ name, email: cell(r, C.email) })) continue;
    if (/^(9{6,}|1234|0000)/.test(phone)) continue;
    const leadId = cell(r, C.leadId);
    const paid = cell(r, C.paid).toUpperCase() === "Y";
    const session = parseWhen(cell(r, C.sessionDate));
    const booked = !!session && !/cancel/i.test(cell(r, C.bookingStatus));
    const created = parseWhen(cell(r, C.ts));
    const score = num(cell(r, C.score));

    // The tap opens WhatsApp with the message already written, built from her
    // own answers and carrying the link back to her unpaid checkout. Typing it
    // fresh each time is the reason a queue stops getting worked.
    const wa = draftWaLink(phone, draftMessage({
      name, leadId,
      score: (Number(cell(r, C.thyroidScore)) || null)
        ?? (Number(cell(r, C.struggles).match(/Pattern score:\s*(\d{1,3})/i)?.[1]) || null),
      markers: (Number(cell(r, C.blockers)) || null)
        ?? (Number(cell(r, C.struggles).match(/\((\d)\s*\/\s*7\)/)?.[1]) || null),
      goal: cell(r, C.goal),
      challenge: cell(r, C.challenge),
      diagnosis: cell(r, C.diagnosis),
      medication: cell(r, C.medication),
      duration: cell(r, C.duration),
      tried: cell(r, C.tried),
    })) || `https://wa.me/91${phone}`;

    if (booked && session! >= now && session! <= todayEnd) {
      // Computed only for calls that are actually about to happen. It is two
      // regexes on two short cells, but this route runs under a 10ms CPU
      // budget and the sheet is thousands of rows long.
      const badge = decisionBadge(cell(r, C.decisionMaker), cell(r, C.partnerOnCall));
      queue.push({ name, phone, leadId, kind: "call_today", wa, risk: 30000,
        reason: "Call today", when: new Date(session!).toISOString(),
        ...(badge ? { badge } : {}) });
    } else if (paid && !booked) {
      queue.push({ name, phone, leadId, kind: "paid_not_booked", wa, risk: 20000,
        reason: "Paid, no slot chosen", when: cell(r, C.paidAt) });
    } else if (!paid && created !== null && now - created < 3 * 86400000 && score >= 57) {
      queue.push({ name, phone, leadId, kind: "hot_abandon", wa, risk: 5000,
        reason: `Abandoned checkout · score ${Math.round(score)}`, when: cell(r, C.ts) });
    }
  }
  queue.sort((a, b) => b.risk - a.risk || (a.when < b.when ? -1 : 1));

  // ── Decision-maker presence ───────────────────────────────────────────────
  // The scoreboard for the badges above. Of the consultations actually held in
  // the last fortnight, how many had the person who shares the decision on
  // them. A third today; the number worth reaching is seventy.
  const presence = dmPresenceRate(
    rows.map((r): PresenceRecord => ({
      sessionDate: cell(r, C.sessionDate),
      showed: cell(r, C.showed),
      dmPresent: cell(r, C.dmPresent),
    })),
    now,
  );

  // ── Automation health ─────────────────────────────────────────────────────
  // Delivery failures are mirrored into the thread as an outbound line starting
  // "[delivery failed]", so a family is unhealthy when failures follow sends.
  const dayAgo = new Date(now - 86400000).toISOString();
  let sent24 = 0, failed24 = 0;
  const byTemplate = new Map<string, { sent: number; failed: number; last: string }>();
  try {
    const msgs = await readMessages();
    for (const m of msgs) {
      if (m.direction !== "out" || m.ts < dayAgo) continue;
      const failed = /^\[delivery failed\]/i.test(m.text);
      const tpl = m.text.match(/^\[([a-z0-9_]+)\]/i)?.[1];
      if (failed) { failed24++; continue; }
      if (!tpl) continue;
      sent24++;
      const e = byTemplate.get(tpl) ?? { sent: 0, failed: 0, last: "" };
      e.sent++; if (m.ts > e.last) e.last = m.ts;
      byTemplate.set(tpl, e);
    }
  } catch { /* health degrades, page does not */ }

  // ── Decide ────────────────────────────────────────────────────────────────
  // The ONE thing no webhook can know: whether the programme money arrived.
  // It comes by UPI or bank transfer after the call, outside Cashfree, so
  // nothing fires. Everything else about the call — attendance, the price he
  // said, the real objection — Fathom already extracted, so this list carries
  // those forward and asks for the single missing fact.
  //
  // Marking it stamps the programme columns AND sends the Purchase to Meta,
  // which is what teaches the algorithm who an actual buyer looks like. A close
  // left unmarked is a lookalike seed thrown away.
  type Decide = {
    row: number; name: string; phone: string; email: string;
    pitched: number; objection: string; occurredAt: string; daysSince: number;
    /** "DM Present" as already marked — so the screen shows the answer back
     *  rather than offering the question again as if nothing happened. */
    dmPresent: string;
  };
  const decide: Decide[] = [];
  // Counts at each hop, returned as decideDebug. A join that silently produces
  // nothing is indistinguishable from "nothing to do", and this one already
  // failed twice that way.
  const dbg = { calls: 0, attended: 0, bookings: 0, uidHit: 0, leadHit: 0, settled: 0, ownerTest: 0, error: "" };
  try {
    // The Calls tab carries a bookingUid and no contact details, so the join
    // runs uid -> Cal.com booking -> attendee email/phone -> lead row. Matching
    // on name instead would be one collision away from recording a Rs 25,000
    // payment against the wrong woman.
    const [calls, bookingsRes] = await Promise.all([readCalls(), fetchBookings(100)]);
    dbg.calls = calls.length; dbg.bookings = bookingsRes.bookings.length;
    if (bookingsRes.error) dbg.error = String(bookingsRes.error).slice(0, 120);
    const bookingByUid = new Map(bookingsRes.bookings.map((b) => [b.uid, b]));

    const closedCol = col(header, "Closed \u20b9");
    const leadByPhone = new Map<string, number>();
    const leadByEmail = new Map<string, number>();
    rows.forEach((r, i) => {
      const p = digits10(cell(r, C.phone));
      const e = cell(r, C.email).toLowerCase();
      if (p.length === 10 && !leadByPhone.has(p)) leadByPhone.set(p, i);
      if (e && !leadByEmail.has(e)) leadByEmail.set(e, i);
    });

    const truthy = (v: unknown) => /^(1|y|yes|true)$/i.test(String(v ?? "").trim());

    for (const c of calls) {
      if (!truthy(c.attended)) continue;
      dbg.attended++;
      const uid = String(c.bookingUid ?? "").trim();
      const b = uid ? bookingByUid.get(uid) : undefined;
      if (b) dbg.uidHit++;
      const email = String(b?.email ?? c.email ?? "").trim().toLowerCase();
      const phone = digits10(String(b?.phone ?? c.phone ?? ""));
      const idx = (phone.length === 10 ? leadByPhone.get(phone) : undefined)
        ?? (email ? leadByEmail.get(email) : undefined);
      if (idx === undefined) continue;
      dbg.leadHit++;

      const r = rows[idx] ?? [];
      const name = cell(r, C.name) || String(b?.name ?? c.name ?? "");
      if (isOwnerTest({ name, email: cell(r, C.email) })) { dbg.ownerTest++; continue; }
      // Already settled — money recorded either way.
      if (num(cell(r, closedCol)) > 0 || num(cell(r, C.programmeValue)) > 0) { dbg.settled++; continue; }

      const occurredAt = String(c.occurredAt ?? b?.startIso ?? "");
      const when = parseWhen(occurredAt);
      decide.push({
        row: idx + 2, name, phone: digits10(cell(r, C.phone)) || phone,
        email: cell(r, C.email) || email,
        pitched: num(String(c.pricePitched ?? "")),
        objection: String(c.objection ?? ""),
        dmPresent: cell(r, C.dmPresent),
        occurredAt,
        daysSince: when === null ? 0 : Math.floor((now - when) / 86400000),
      });
    }
    decide.sort((a, b2) => a.daysSince - b2.daysSince);
  } catch (e) {
    dbg.error = e instanceof Error ? e.message : String(e);
    console.error("[today] decide list failed (swallowed):", dbg.error);
  }

  const health = [...byTemplate.entries()]
    .map(([name, v]) => ({ name, sent: v.sent, last: v.last }))
    .sort((a, b) => (a.last < b.last ? 1 : -1));

  return NextResponse.json({
    generatedAt: new Date(now).toISOString(),
    window: { days, since: new Date(since).toISOString() },
    // The headline numbers and the call checklist, from lib/metrics — the same
    // objects /api/admin/metrics returns to the other tabs.
    metrics: m,
    checklist,
    toMark,
    acquisition: {
      spend, consultPayers, programmeCloses, contracted, collected,
      costPerConsultPayer: cpp, costPerProgrammeClient: cppc,
      spendAvailable: spend !== null,
      spendAsOf,
    },
    queue: queue.slice(0, 25),
    dmPresence: presence,
    // True means Cashfree is charging Rs 1 while every page still reads Rs 299.
    // Left on by accident it costs roughly Rs 900/day and fills the calendar
    // with people who paid nothing — so the dashboard says so in red.
    testMode: IS_TEST_MODE,
    decide: decide.slice(0, 20),
    decideDebug: dbg,
    health: { sent24, failed24, byTemplate: health },
    capacity: { closed: monthCloses, ceiling: CEILING },
    caveats: [
      spend === null ? "No ad spend cached yet (the hourly refresh fills it), so no cost-per figures." : null,
      heuristicUsed
        ? "Some older rows have no Programme Value, so a payment of Rs 5,000 or more was read as a programme close for those."
        : null,
    ].filter(Boolean),
  });
}
