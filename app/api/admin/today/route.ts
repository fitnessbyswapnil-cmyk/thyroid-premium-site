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
 * Everything degrades rather than throws: a missing WINDSOR_API_KEY costs the
 * spend figures, not the page.
 *
 * Auth: x-admin-key.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";
import { readMessages } from "@/lib/wa-messages";
import { isOwnerTest } from "@/lib/owner-filter";
import { readCalls } from "@/lib/crm-calls";

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

async function windsorSpend(from: Date, to: Date): Promise<number | null> {
  const key = process.env.WINDSOR_API_KEY;
  if (!key) return null;
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const url =
    `https://connectors.windsor.ai/facebook?api_key=${encodeURIComponent(key)}` +
    `&date_from=${d(from)}&date_to=${d(to)}&fields=date,spend`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: Array<{ spend?: string | number }> };
    return (j.data ?? []).reduce((s, r) => s + (parseFloat(String(r.spend ?? 0)) || 0), 0);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 7)));
  const now = Date.now();
  const since = now - days * 86400000;

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
    city: col(header, "City"),
    budget: col(header, "Investment Ability"),
  };

  // ── Acquisition ───────────────────────────────────────────────────────────
  // A consult payment is Paid=Y. A programme close is a payment materially
  // larger than the Rs299 gate — the sheet does not yet separate the two, so
  // the amount is the only signal available. Flagged in `caveats` rather than
  // hidden, because a blended number would read as certainty it has not earned.
  let consultPayers = 0;
  let programmeCloses = 0;
  let contracted = 0;
  let monthCloses = 0;
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  let collected = 0;
  let heuristicUsed = false;
  for (const r of rows) {
    if (isOwnerTest({ name: cell(r, C.name), email: cell(r, C.email) })) continue;
    if (cell(r, C.paid).toUpperCase() !== "Y") continue;

    const paidWhen = parseWhen(cell(r, C.paidAt)) ?? parseWhen(cell(r, C.ts));

    // Prefer the dedicated programme columns. Fall back to "a payment of 5,000
    // or more is a programme" only for rows written before those columns
    // existed — and say so on the page rather than presenting a guess as fact.
    const pv = num(cell(r, C.programmeValue));
    const pc = num(cell(r, C.programmeCollected));
    const pAt = parseWhen(cell(r, C.programmeClosedAt));
    const legacyAmt = num(cell(r, C.paidAmount));
    const isProgramme = pv > 0 || legacyAmt >= 5000;
    if (pv === 0 && legacyAmt >= 5000) heuristicUsed = true;

    const progValue = pv > 0 ? pv : legacyAmt;
    const progCollected = pc > 0 ? pc : progValue;
    const progWhen = pAt ?? paidWhen;

    if (paidWhen !== null && paidWhen >= since) consultPayers++;
    if (isProgramme && progWhen !== null && progWhen >= since) {
      programmeCloses++; contracted += progValue; collected += progCollected;
    }
    if (isProgramme && progWhen !== null && progWhen >= monthStart.getTime()) monthCloses++;
  }

  const spend = await windsorSpend(new Date(since), new Date(now));
  const cpp = spend !== null && consultPayers > 0 ? Math.round(spend / consultPayers) : null;
  const cppc = spend !== null && programmeCloses > 0 ? Math.round(spend / programmeCloses) : null;

  // ── Queue ─────────────────────────────────────────────────────────────────
  type QRow = {
    name: string; phone: string; reason: string; kind: string;
    risk: number; when: string; leadId: string;
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

    if (booked && session! >= now && session! <= todayEnd) {
      queue.push({ name, phone, leadId, kind: "call_today", risk: 30000,
        reason: "Call today", when: new Date(session!).toISOString() });
    } else if (paid && !booked) {
      queue.push({ name, phone, leadId, kind: "paid_not_booked", risk: 20000,
        reason: "Paid, no slot chosen", when: cell(r, C.paidAt) });
    } else if (!paid && created !== null && now - created < 3 * 86400000 && score >= 57) {
      queue.push({ name, phone, leadId, kind: "hot_abandon", risk: 5000,
        reason: `Abandoned checkout · score ${Math.round(score)}`, when: cell(r, C.ts) });
    }
  }
  queue.sort((a, b) => b.risk - a.risk || (a.when < b.when ? -1 : 1));

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
  };
  const decide: Decide[] = [];
  try {
    const calls = await readCalls();
    const byPhone = new Map<string, (typeof calls)[number]>();
    const byEmail = new Map<string, (typeof calls)[number]>();
    for (const c of calls) {
      if (String(c.attended ?? "").trim() !== "1") continue;
      const p = digits10(String(c.phone ?? ""));
      const e = String(c.email ?? "").trim().toLowerCase();
      if (p.length === 10) byPhone.set(p, c);
      if (e) byEmail.set(e, c);
    }
    const closedCol = col(header, "Closed \u20b9");
    rows.forEach((r, i) => {
      const name = cell(r, C.name);
      const email = cell(r, C.email);
      const phone = digits10(cell(r, C.phone));
      if (!name || isOwnerTest({ name, email })) return;
      const c = byPhone.get(phone) ?? (email ? byEmail.get(email.toLowerCase()) : undefined);
      if (!c) return;
      // Already settled — either marked closed, or a programme value recorded.
      if (num(cell(r, closedCol)) > 0 || num(cell(r, C.programmeValue)) > 0) return;
      const occurredAt = String(c.occurredAt ?? "");
      const when = parseWhen(occurredAt);
      decide.push({
        row: i + 2, name, phone, email,
        pitched: num(String(c.pricePitched ?? "")),
        objection: String(c.objection ?? ""),
        occurredAt,
        daysSince: when === null ? 0 : Math.floor((now - when) / 86400000),
      });
    });
    decide.sort((a, b) => a.daysSince - b.daysSince);
  } catch { /* no Calls tab yet — the rest of the page stands */ }

  const health = [...byTemplate.entries()]
    .map(([name, v]) => ({ name, sent: v.sent, last: v.last }))
    .sort((a, b) => (a.last < b.last ? 1 : -1));

  return NextResponse.json({
    generatedAt: new Date(now).toISOString(),
    window: { days, since: new Date(since).toISOString() },
    acquisition: {
      spend, consultPayers, programmeCloses, contracted, collected,
      costPerConsultPayer: cpp, costPerProgrammeClient: cppc,
      spendAvailable: spend !== null,
    },
    queue: queue.slice(0, 25),
    decide: decide.slice(0, 20),
    health: { sent24, failed24, byTemplate: health },
    capacity: { closed: monthCloses, ceiling: CEILING },
    caveats: [
      spend === null ? "WINDSOR_API_KEY is not set, so no spend and no cost-per figures." : null,
      heuristicUsed
        ? "Some older rows have no Programme Value, so a payment of Rs 5,000 or more was read as a programme close for those."
        : null,
    ].filter(Boolean),
  });
}
