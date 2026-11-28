/**
 * GET /api/admin/today — the feed for the Today screen.
 *
 * Four blocks, in the order the coach reads them between calls:
 *   1. acquisition  — cost per Rs299 payer AND cost per programme client
 *   2. queue        — one merged action list, sorted by money at risk
 *   3. health       — did every automated message actually get DELIVERED
 *   4. capacity     — closes this month against the 7-client ceiling
 *   5. cards        — one journey card per woman on the screen (lib/next-action):
 *                     her steps and the ONE button for the next thing to do,
 *                     the tiles that are counts of those cards, and this
 *                     week's drop-off funnel. Every list above still goes out
 *                     unchanged; its rows also carry her card.
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
import { summarize, windowFor, checklistSummary, coverageOf, attendanceOf, isTestIdentity, personKey, identityKeys } from "@/lib/metrics";
import { loadJourneys } from "@/lib/journey-source";
import { readCalls } from "@/lib/crm-calls";
import { fetchBookings } from "@/lib/cal-bookings";
import { draftMessage, draftWaLink } from "@/lib/draft-message";
import { decisionBadge, findColumn } from "@/lib/decision-maker";
import { dmPresenceRate, type PresenceRecord } from "@/lib/dm-presence";
import { IS_TEST_MODE } from "../../create-cashfree-order/route";
import { cachedSpend } from "@/lib/ads-cache";
import { savedReportsForPhones } from "@/lib/report-save";
import { readMarks } from "@/lib/journey-marks";
import {
  buildCard, cardCounts, dropOffFunnel, dropStepOf, factsOf, inboxStats, inDropBar, sameIstDay, sortCards,
  type Badge, type ClientCard, type InboxEvent, type PaidAsk,
} from "@/lib/next-action";
import type { Journey } from "@/lib/journey";
import { readFlags } from "@/lib/automation-flags";
import { liveBridgeConfig } from "@/lib/bridge-settings";
import { DRIVE_BRIDGE_VERSION } from "@/lib/drive-bridge-source";
import { payLinkFor, readPaymentLinks } from "@/lib/payment-links";

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

  // Her thread with its words: the health block counts template sends and
  // failures from it, and the journey cards read who last wrote, and whether
  // the last message to her failed. One read for both, started first so it
  // runs while the sheet loads.
  const messagesP = readMessages().catch((e) => {
    console.error("[today] messages read failed (swallowed):", e instanceof Error ? e.message : String(e));
    return null;
  });

  const { sheets, sheetId } = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    // A1:DZ, not A1:BZ: the Leads sheet is ~93 columns wide, and a narrower
    // range silently drops every column past BZ.
    range: `${SHEET_NAME}!A1:DZ`,
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
  const J = await loadJourneys();
  const metricsData = J.loaded.data;
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

  // ── Needs me now ─────────────────────────────────────────────────────────
  // The ONE needs-action list (lib/journey): the same items and the same count
  // Pipeline and Analytics show, oldest wait first, overdue past 6 hours. This
  // screen used to build its own queue from sheet rows, sorted by money at risk,
  // so the three tabs gave three different counts. Here it only adds the
  // WhatsApp draft, written from her own answers.
  const rowAt = (sheetRow: number | null) => (sheetRow !== null && sheetRow >= 2 ? rows[sheetRow - 2] : undefined);
  // The draft itself, split out from the link: the dashboard can now SEND it
  // from the business number instead of only opening wa.me, and both paths read
  // this one function — a link and a send that said different things would be
  // worse than having only the link.
  const draftFor = (sheetRow: number | null, phoneRaw: string): string => {
    const phone = digits10(phoneRaw);
    const r = rowAt(sheetRow);
    if (!r || phone.length !== 10) return "";
    return draftMessage({
      name: cell(r, C.name), leadId: cell(r, C.leadId),
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
    });
  };
  const waFor = (sheetRow: number | null, phoneRaw: string) => {
    const phone = digits10(phoneRaw);
    if (phone.length !== 10) return "";
    const text = draftFor(sheetRow, phoneRaw);
    return (text ? draftWaLink(phone, text) : "") || `https://wa.me/91${phone}`;
  };
  const queue = J.needsAction.items.map((item) => ({
    name: item.name,
    phone: digits10(item.phone),
    kind: item.kind,
    reason: item.label,
    since: item.since,
    waitMin: item.waitMin,
    overdue: item.overdue,
    tone: item.tone,
    bookingUid: item.bookingUid,
    leadId: cell(rowAt(item.leadRow) ?? [], C.leadId),
    wa: item.kind === "mark_call" ? "" : waFor(item.leadRow, item.phone),
    // Same words the wa.me link carries, in plain text, so one tap can send
    // them from the business number she already knows.
    text: item.kind === "mark_call" ? "" : draftFor(item.leadRow, item.phone),
  }));

  // ── Calls in the next 24 hours ────────────────────────────────────────────
  // Not action items — the calendar has them — but this is where the pre-call
  // reminders and the decision-maker badge live.
  const callsToday = J.journeys
    .filter((j) => j.state === "booked" && j.booking && Date.parse(j.booking.startAt) >= now - 90 * 60_000 && Date.parse(j.booking.startAt) <= now + 86400000)
    .sort((a, b) => Date.parse(a.booking!.startAt) - Date.parse(b.booking!.startAt))
    .map((j) => {
      const r = rowAt(j.leadRow);
      const badge = r ? decisionBadge(cell(r, C.decisionMaker), cell(r, C.partnerOnCall)) : null;
      return {
        personId: j.id,
        name: j.name,
        phone: digits10(j.phone),
        when: j.booking!.startAt,
        bookingUid: j.booking!.uid,
        wa: waFor(j.leadRow, j.phone),
        ...(badge ? { badge } : {}),
      };
    });

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
    const msgs = (await messagesP) ?? [];
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
      if (isTestIdentity({ name, email: cell(r, C.email), phone: cell(r, C.phone) })) { dbg.ownerTest++; continue; }
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

  // ── Journey cards ─────────────────────────────────────────────────────────
  // One card per woman on this screen (lib/next-action): where she is in the
  // journey, and the ONE button for the next thing to do. The lists above stay
  // in the reply, unchanged; each of their rows now also carries her card, and
  // the screen renders the cards instead of four lists she could sit on at once.
  //
  // Who gets a card: everyone on the one action list, every call in the next
  // 24 hours or on today's date, every call still to mark or to settle; and,
  // only when a step of theirs is due, women whose call was in the last
  // fortnight (summary, thank-you, follow-ups), the newly won (onboarding) and
  // the booked (pre-call PDF, reminder).
  const DAY_MS = 86_400_000;
  const byId = new Map(J.journeys.map((j) => [j.id, j]));
  const byKey = new Map<string, Journey>();
  const byUid = new Map<string, Journey>();
  for (const j of J.journeys) {
    for (const k of j.keys) byKey.set(k, j);
    for (const b of j.person.bookings) byUid.set(b.uid, j);
  }
  const shown = new Set<string>();
  const maybe = new Set<string>();
  const queueAt = new Map(J.needsAction.items.map((item, index) => [item.personId, { item, index }]));
  for (const id of queueAt.keys()) shown.add(id);
  for (const c of callsToday) shown.add(c.personId);
  for (const t of toMark) {
    const j = byUid.get(t.bookingUid);
    if (j) shown.add(j.id);
  }
  const paidAsk = new Map<string, PaidAsk>();
  const decideKey = new Map<number, string>();
  for (const p of decide) {
    const j = identityKeys({ phone: p.phone, email: p.email }).map((k) => byKey.get(k)).find(Boolean);
    if (!j) continue;
    shown.add(j.id);
    decideKey.set(p.row, j.id);
    if (!paidAsk.has(j.id)) paidAsk.set(j.id, { row: p.row, pitched: p.pitched, objection: p.objection, daysSince: p.daysSince, dmPresent: p.dmPresent });
  }
  for (const j of J.journeys) {
    const start = Date.parse(j.booking?.startAt ?? "");
    const wonAt = Date.parse(j.reached.won?.at ?? "");
    if (!Number.isFinite(start)) {
      if (j.won && Number.isFinite(wonAt) && now - wonAt <= 14 * DAY_MS) maybe.add(j.id);
      continue;
    }
    if (!j.booking!.cancelled && sameIstDay(start, now)) shown.add(j.id);
    else if (j.call?.attended === true && now - start <= 14 * DAY_MS) maybe.add(j.id);
    else if (j.state === "booked" && start > now && start - now <= 7 * DAY_MS) maybe.add(j.id);
    else if (j.won && Number.isFinite(wonAt) && now - wonAt <= 14 * DAY_MS) maybe.add(j.id);
  }
  // "This week: where clients drop off": lib/journey's cohort, first sheet row in the last 7 days.
  const week = windowFor(7, now);
  const cohort = J.journeys.filter((j) => inDropBar({ drop: "lead", firstLeadAt: j.firstLeadAt }, "lead", week));

  // ONE marks read and ONE saved-reports read for every woman on this screen,
  // never one per row. A failure costs the steps they feed, not the page.
  const cardIds = new Set([...shown, ...maybe]);
  const phones = [
    ...new Set([...cardIds, ...cohort.map((j) => j.id)].map((id) => digits10(byId.get(id)?.phone ?? "")).filter((p) => p.length === 10)),
  ];
  const [marks, reports, flags, links] = await Promise.all([
    readMarks(phones),
    savedReportsForPhones(phones).catch((e) => {
      console.error("[today] saved reports lookup failed (swallowed):", e instanceof Error ? e.message : String(e));
      return new Map<string, { url: string; savedAt: number; count: number }>();
    }),
    // Every way of not knowing a flag reads as off: the one-click send then
    // falls back to "Send from your phone", never to an unapproved template.
    readFlags().catch(() => null),
    readPaymentLinks().catch(() => ({})),
  ]);
  const msgRows = await messagesP;
  const inbox = inboxStats(
    msgRows
      ? msgRows.map((m): InboxEvent => ({
          phone: m.phone,
          at: m.ts,
          dir: m.direction,
          manual: m.direction === "out" && !/^\[/.test(m.text ?? ""),
          failed: /^\[delivery failed\]/i.test(m.text ?? ""),
          template: (m.text ?? "").match(/^\[([a-z0-9_]+)\]/i)?.[1],
        }))
      : (metricsData.messages ?? []).map((m): InboxEvent => ({ phone: m.phone, at: m.at, dir: m.dir, manual: m.manual })),
  );
  const drafts = new Map<string, { text: string; wa: string }>();
  J.needsAction.items.forEach((item, i) => {
    const q = queue[i];
    if (q && (q.text || q.wa)) drafts.set(item.personId, { text: q.text, wa: q.wa });
  });
  const badges = new Map<string, Badge>();
  for (const c of callsToday) if (c.badge) badges.set(c.personId, c.badge);
  const ctx = {
    now,
    marks,
    reports,
    inbox,
    queue: queueAt,
    drafts,
    paidAsk,
    badges,
    payLink: (amount: number) => payLinkFor(amount, links),
    templates: { followups: !!flags?.followup_templates_approved, reminder: !!flags?.confirm_reminder_template_approved },
  };
  const built: ClientCard[] = [];
  for (const id of cardIds) {
    const j = byId.get(id);
    if (!j) continue;
    const card = buildCard(factsOf(j, ctx), now);
    if (shown.has(id) || card.primary || card.secondary.length) built.push(card);
  }
  const cards = sortCards(built);
  const cardOf = new Map(cards.map((c) => [c.key, c]));
  const dropBars = dropOffFunnel(cohort.map((j) => ({ drop: dropStepOf(factsOf(j, ctx)), firstLeadAt: j.firstLeadAt })), week);
  // Paid this week: lib/metrics' wins over the same seven days.
  const weekSummary = summarize(metricsData, week, now);

  const health = [...byTemplate.entries()]
    .map(([name, v]) => ({ name, sent: v.sent, last: v.last }))
    .sort((a, b) => (a.last < b.last ? 1 : -1));

  const reportOf = (phone: string) => {
    const r = reports.get(phone);
    return r ? { url: r.url, count: r.count } : null;
  };

  // Drive status rides in this feed so Today makes one request on load, not
  // two (each extra request can cost a cold isolate ~1.5 s of CPU). Config
  // only, never a call to the script: same as GET /api/admin/drive-setup.
  const bridge = await liveBridgeConfig().catch(() => null);
  const drive = bridge
    ? { connected: bridge.source !== "none", source: bridge.source, folderConfigured: Boolean(bridge.folderId), version: DRIVE_BRIDGE_VERSION }
    : null;

  return NextResponse.json({
    generatedAt: new Date(now).toISOString(),
    window: { days, since: new Date(since).toISOString() },
    // The headline numbers and the call checklist, from lib/metrics — the same
    // objects /api/admin/metrics returns to the other tabs.
    metrics: m,
    checklist,
    toMark: toMark.map((t) => ({ ...t, cardKey: byUid.get(t.bookingUid)?.id ?? "" })),
    acquisition: {
      spend, consultPayers, programmeCloses, contracted, collected,
      costPerConsultPayer: cpp, costPerProgrammeClient: cppc,
      spendAvailable: spend !== null,
      spendAsOf,
    },
    // The shared action list, whole — its count is the count on every tab.
    drive,
    queue: queue.map((q, i) => ({ ...q, report: reportOf(q.phone), card: cardOf.get(J.needsAction.items[i]?.personId ?? "") ?? null })),
    needsAction: { count: J.needsAction.count, overdue: J.needsAction.overdue },
    callsToday: callsToday.map((c) => ({ ...c, report: reportOf(c.phone), card: cardOf.get(c.personId) ?? null })),
    dmPresence: presence,
    // True means Cashfree is charging Rs 1 while every page still reads Rs 299.
    // Left on by accident it costs roughly Rs 900/day and fills the calendar
    // with people who paid nothing — so the dashboard says so in red.
    testMode: IS_TEST_MODE,
    decide: decide.slice(0, 20).map((p) => ({ ...p, cardKey: decideKey.get(p.row) ?? "" })),
    decideDebug: dbg,
    health: { sent24, failed24, byTemplate: health },
    capacity: { closed: monthCloses, ceiling: CEILING },
    // The journey view (lib/next-action): one card per woman, sorted by
    // urgency, the tiles that are counts of those cards, the drop-off funnel
    // for the last seven days, and lib/metrics' wins over the same days.
    cards,
    cardCounts: cardCounts(cards, now),
    dropFunnel: { days: 7, bars: dropBars },
    week: { won: weekSummary.won, revenue: weekSummary.revenue },
    caveats: [
      spend === null ? "No ad spend cached yet (the hourly refresh fills it), so no cost-per figures." : null,
      heuristicUsed
        ? "Some older rows have no Programme Value, so a payment of Rs 5,000 or more was read as a programme close for those."
        : null,
    ].filter(Boolean),
  });
}
