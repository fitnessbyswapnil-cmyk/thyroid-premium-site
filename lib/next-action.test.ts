import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCard,
  cardCounts,
  dropOffFunnel,
  factsOf,
  followUpDueAt,
  followUpText,
  inboxStats,
  inDropBar,
  inJourneyBar,
  sendPath,
  sortCards,
  stepsOf,
  STEPS,
  ACTIONS,
  TEMPLATE_FOR,
  windowMinutesLeft,
  type CardFacts,
  type ClientCard,
  type InboxStats,
} from "./next-action.ts";
import { ACTION_LABEL, journeysOf, funnelOf, needsActionOf, type ActionItem, type ActionKind } from "./journey.ts";
import { replyWindow } from "./summary.ts";
import type { Dataset, LeadRecord, BookingRecord, CallRecord } from "./metrics.ts";

// Tue 10 Nov 2026, 14:00 IST.
const NOW = Date.parse("2026-11-10T08:30:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const iso = (t: number) => new Date(t).toISOString();
const PHONE = "9876543210";
const LINK = "https://payments.cashfree.com/forms/thyroid-20000";

const inbox = (o: Partial<InboxStats> = {}): InboxStats => ({ lastIn: 0, lastOut: 0, lastManualOut: 0, lastFailed: 0, lastReminder: 0, ...o });

function facts(o: Partial<CardFacts> = {}): CardFacts {
  return {
    key: `p:${PHONE}`,
    name: "Priya Sharma",
    phone: PHONE,
    email: "priya@example.com",
    stage: "new",
    reached: { new: { at: iso(NOW - 3 * DAY), inferred: false } },
    firstLeadAt: iso(NOW - 3 * DAY),
    booking: null,
    call: null,
    won: false,
    agreedButUnpaid: false,
    report: null,
    marks: {},
    inbox: inbox(),
    action: null,
    queueIndex: -1,
    draft: null,
    payLink: null,
    templates: { followups: false, reminder: false },
    paidAsk: null,
    badge: null,
    ...o,
  };
}

const booking = (start: number, o: Partial<NonNullable<CardFacts["booking"]>> = {}) => ({
  uid: "b1",
  startAt: iso(start),
  createdAt: iso(NOW - 2 * DAY),
  cancelled: false,
  ...o,
});
const heldCall = (start: number, o: Partial<NonNullable<CardFacts["call"]>> = {}) => ({
  attended: true,
  occurredAt: iso(start),
  pricePitched: null,
  amountAgreed: null,
  namedPrice: false,
  ...o,
});
const item = (kind: ActionKind, o: Partial<ActionItem> = {}): ActionItem => ({
  personId: `p:${PHONE}`,
  name: "Priya Sharma",
  phone: PHONE,
  leadRow: 5,
  bookingUid: "b1",
  kind,
  label: ACTION_LABEL[kind],
  since: iso(NOW - HOUR),
  waitMin: 60,
  overdue: false,
  tone: "amber",
  ...o,
});
const reached = (...stages: ("new" | "booked" | "attended" | "pitched" | "won")[]) =>
  Object.fromEntries(stages.map((s) => [s, { at: iso(NOW - 5 * DAY), inferred: false }]));
const stateOf = (c: ClientCard, key: string) => c.steps.find((s) => s.key === key)?.state;
const hintOf = (c: ClientCard, key: string) => c.steps.find((s) => s.key === key)?.hint ?? "";

// ── New leads ───────────────────────────────────────────────────────────────

test("a new lead on the action list gets the list's own verb, and its label as the reason", () => {
  const f = facts({ action: item("first_message"), queueIndex: 0, draft: { text: "Hi Priya, ...", wa: `https://wa.me/91${PHONE}?text=Hi` } });
  const c = buildCard(f, NOW);
  assert.equal(c.primary?.id, "lead_nudge");
  assert.equal(c.primary?.label, "Send first message");
  assert.equal(c.primary?.reason, ACTION_LABEL.first_message);
  assert.equal(c.primary?.queueKind, "first_message");
  assert.equal(c.primary?.send?.text, "Hi Priya, ...");
  assert.equal(c.rank, 2);
  assert.equal(stateOf(c, "lead"), "done");
  assert.equal(stateOf(c, "confirm"), "current");
  assert.match(hintOf(c, "confirm"), /Not booked yet/);
});

test("a new lead the list does not ask about has no button at all", () => {
  const c = buildCard(facts(), NOW);
  assert.equal(c.primary, null);
  assert.equal(c.rank, 6);
  assert.equal(c.urgency, "none");
});

// ── Before the call ─────────────────────────────────────────────────────────

test("booked, confirmed, no report, call in three days: nothing to do yet, and Report is never a miss", () => {
  const f = facts({ stage: "booked", reached: reached("new", "booked"), booking: booking(NOW + 3 * DAY), inbox: inbox({ lastIn: NOW - DAY }) });
  const c = buildCard(f, NOW);
  assert.equal(c.primary, null);
  assert.equal(c.rank, 4);
  assert.equal(stateOf(c, "confirm"), "done");
  assert.equal(stateOf(c, "report"), "todo");
  assert.equal(hintOf(c, "report"), "Not in yet");
  assert.equal(stateOf(c, "call"), "current");
  assert.equal(c.status.tone, "ok");
  assert.ok(!c.steps.some((s) => s.state === "missed"));
});

test("her report is in before the call: Make pre-call PDF, until the pre-call is sent", () => {
  const base = { stage: "booked" as const, booking: booking(NOW + DAY), inbox: inbox({ lastIn: NOW - HOUR }), report: { url: "https://drive/r", count: 1, savedAt: NOW - 2 * HOUR } };
  const c = buildCard(facts(base), NOW);
  assert.equal(c.primary?.id, "precall");
  assert.equal(c.primary?.label, "Make pre-call PDF");
  assert.match(c.context, /^Report arrived 2 hr ago · Call tomorrow/);
  const sent = buildCard(facts({ ...base, marks: { precall_sent: { at: NOW - 10 * MIN, url: "" } } }), NOW);
  assert.notEqual(sent.primary?.id, "precall");
  assert.match(hintOf(sent, "report"), /pre-call sent/);
});

test("unconfirmed and her call is today: Send reminder, at risk, by the path her window allows", () => {
  const start = NOW + 5 * HOUR;
  const base = { stage: "booked" as const, booking: booking(start) };
  const shut = buildCard(facts(base), NOW);
  assert.equal(shut.primary?.id, "reminder");
  assert.equal(shut.status.tone, "attention");
  assert.equal(shut.status.label, "Not confirmed");
  assert.equal(sendPath(shut.primary!.send!), "phone");
  assert.match(shut.primary!.send!.wa, /^https:\/\/wa\.me\/919876543210\?text=/);
  // His template, once Meta approved it and he said so.
  const tpl = buildCard(facts({ ...base, templates: { followups: false, reminder: true } }), NOW);
  assert.equal(sendPath(tpl.primary!.send!), "template");
  assert.deepEqual(tpl.primary!.send!.template, { name: TEMPLATE_FOR.reminder.name, params: ["Priya", "Tue, 10 Nov, 7:00 pm"] });
  // Already nudged by hand since she booked: no second reminder.
  const nudged = buildCard(facts({ ...base, inbox: inbox({ lastManualOut: NOW - HOUR, lastOut: NOW - HOUR }) }), NOW);
  assert.notEqual(nudged.primary?.id, "reminder");
});

// ── Around the call ─────────────────────────────────────────────────────────

test("the call-time window: Notes from 30 minutes before to the end, then Did she join", () => {
  const confirmedInbox = inbox({ lastIn: NOW - DAY });
  const at = (start: number) => buildCard(facts({ stage: "booked", booking: booking(start), inbox: confirmedInbox }), NOW);
  assert.equal(at(NOW + 20 * MIN).primary?.id, "notes_live");
  assert.equal(at(NOW + 20 * MIN).rank, 1);
  const during = at(NOW - 30 * MIN);
  assert.equal(during.primary?.id, "notes_live");
  assert.equal(during.status.label, "On the call");
  assert.equal(hintOf(during, "call"), "Now");
  // Ended, inside lib/journey's 90-minute grace: still "booked", already markable.
  const ended = at(NOW - 70 * MIN);
  assert.equal(ended.primary?.id, "mark_call");
  assert.equal(ended.primary?.kind, "mark_call");
  // Later today, nothing else to do: his notes Doc is the button.
  assert.equal(at(NOW + 3 * HOUR).primary?.id, "notes_today");
  // Tomorrow: not yet.
  assert.equal(at(NOW + DAY).primary, null);
});

test("a slot past with no outcome answers lib/journey's mark_call item, inline", () => {
  const f = facts({ stage: "unknown", booking: booking(NOW - 5 * HOUR), action: item("mark_call", { since: iso(NOW - 3.5 * HOUR) }), queueIndex: 3 });
  const c = buildCard(f, NOW);
  assert.equal(c.primary?.kind, "mark_call");
  assert.equal(c.primary?.queueKind, "mark_call");
  assert.equal(c.reason, ACTION_LABEL.mark_call);
  assert.equal(stateOf(c, "call"), "current");
  assert.equal(c.rank, 2.003);
});

test("cancelled and no-show: Offer new times, and the strip stops at the call that was missed", () => {
  for (const [stage, kind] of [["cancelled", "rebook_cancelled"], ["no_show", "rebook_no_show"]] as const) {
    const c = buildCard(facts({ stage, booking: booking(NOW - DAY, { cancelled: stage === "cancelled" }), action: item(kind), queueIndex: 0 }), NOW);
    assert.equal(c.primary?.id, "rebook");
    assert.equal(c.primary?.label, "Offer new times");
    assert.equal(c.reason, ACTION_LABEL[kind]);
    // The miss is where she is: the current step, saying what went wrong, and
    // never "Next: Report" pointing past it.
    assert.deepEqual(c.steps.filter((s) => s.state === "current").map((s) => s.key), ["call"]);
    assert.match(hintOf(c, "call"), stage === "cancelled" ? /^Cancelled/ : /^No-show yesterday/);
    assert.equal(stateOf(c, "report"), "todo");
    assert.equal(c.status.tone, "attention");
  }
});

// ── After the call: notes, then the summary within 30 minutes ───────────────

test("attended with no notes Doc: Open notes, with Say thanks one tap away", () => {
  const start = NOW - 2 * HOUR;
  const c = buildCard(facts({ stage: "attended", booking: booking(start), call: heldCall(start) }), NOW);
  assert.equal(c.primary?.id, "notes_after");
  assert.ok(c.secondary.some((a) => a.id === "thanks"));
  assert.equal(stateOf(c, "summary"), "current");
  assert.equal(hintOf(c, "summary"), "Notes first");
  // Never the primary, even when it is the only thing left.
  const later = buildCard(facts({ stage: "attended", booking: booking(NOW - 14 * HOUR), call: heldCall(NOW - 14 * HOUR) }), NOW);
  assert.equal(later.primary, null);
  assert.ok(later.secondary.some((a) => a.id === "thanks"));
});

test("notes made, no summary: Review and send summary, due 30 minutes after the call ends", () => {
  const start = NOW - 80 * MIN; // ended 20 min ago
  const notes = { notes_made: { at: start + 5 * MIN, url: "https://docs/d" } };
  const c = buildCard(facts({ stage: "attended", booking: booking(start), call: heldCall(start), marks: notes }), NOW);
  assert.equal(c.primary?.id, "summary");
  assert.equal(c.primary?.label, "Review and send summary");
  assert.equal(c.primary?.danger, undefined);
  assert.equal(c.summaryDue?.overdue, false);
  assert.equal(c.summaryDue?.at, iso(start + 90 * MIN));
  assert.equal(c.status.label, "Summary due in 10 min");
  assert.equal(c.rank, 1);
});

test("an overdue summary is the danger variant, top of the screen, and the step she is stuck at", () => {
  const start = NOW - 150 * MIN; // ended 90 min ago, due 60 min ago
  const c = buildCard(facts({ stage: "attended", booking: booking(start), call: heldCall(start), marks: { notes_made: { at: start, url: "" } } }), NOW);
  assert.equal(c.primary?.id, "summary");
  assert.equal(c.primary?.danger, true);
  assert.equal(c.rank, 0);
  assert.equal(c.status.tone, "attention");
  assert.equal(c.status.label, "Summary overdue 60 min");
  assert.equal(stateOf(c, "summary"), "current");
  assert.equal(hintOf(c, "summary"), "Overdue 60 min");
});

test("paid while her summary never went: a miss she has moved past, clay on the strip", () => {
  const start = NOW - 4 * HOUR;
  const c = buildCard(
    facts({
      stage: "won", won: true, reached: reached("new", "booked", "attended", "pitched", "won"),
      booking: booking(start), call: heldCall(start, { pricePitched: 20000 }), marks: { notes_made: { at: start, url: "" } },
    }),
    NOW,
  );
  assert.equal(stateOf(c, "summary"), "missed");
  assert.equal(stateOf(c, "paid"), "done");
  assert.equal(stateOf(c, "onboard"), "current");
  // Her summary is still the first thing to do: it is overdue.
  assert.equal(c.primary?.id, "summary");
  assert.ok(c.secondary.some((a) => a.id === "onboard"));
});

test("summary made but not sent: the same button opens the PDF made earlier", () => {
  const start = NOW - 100 * MIN;
  const marks = { notes_made: { at: start, url: "" }, summary_made: { at: NOW - 5 * MIN, url: "https://drive/pdf" } };
  const c = buildCard(facts({ stage: "attended", booking: booking(start), call: heldCall(start), marks }), NOW);
  assert.equal(c.primary?.pdfUrl, "https://drive/pdf");
  assert.match(hintOf(c, "summary"), /^Made, not sent/);
  assert.match(c.primary!.reason, /made/);
});

test("her window decides how the summary goes: open sends it, shut is from his phone", () => {
  const start = NOW - 100 * MIN;
  const marks = { notes_made: { at: start, url: "" } };
  const open = buildCard(facts({ stage: "attended", booking: booking(start), call: heldCall(start), marks, inbox: inbox({ lastIn: NOW - 3 * HOUR }) }), NOW);
  assert.equal(open.primary?.send?.windowOpen, true);
  const shut = buildCard(facts({ stage: "attended", booking: booking(start), call: heldCall(start), marks, inbox: inbox({ lastIn: NOW - 30 * HOUR }) }), NOW);
  assert.equal(shut.primary?.send?.windowOpen, false);
});

test("a summary sent for her FIRST call never ticks the summary of her second", () => {
  const start = NOW - 100 * MIN;
  const marks = { notes_made: { at: start, url: "" }, summary_sent: { at: NOW - 20 * DAY, url: "" } };
  const c = buildCard(facts({ stage: "attended", booking: booking(start), call: heldCall(start), marks }), NOW);
  assert.equal(c.primary?.id, "summary");
  assert.notEqual(stateOf(c, "summary"), "done");
});

test("an attended first call does not make a summary due before her second call happens", () => {
  const c = buildCard(
    facts({
      stage: "booked",
      reached: reached("new", "booked", "attended"),
      booking: booking(NOW + 2 * DAY),
      call: null,
      inbox: inbox({ lastIn: NOW - HOUR }),
      marks: { notes_made: { at: NOW - HOUR, url: "" } },
    }),
    NOW,
  );
  assert.equal(c.summaryDue, null);
  assert.notEqual(c.primary?.id, "summary");
  assert.equal(stateOf(c, "call"), "current");
});

test("calls from before the marks existed never flood the screen with overdue summaries", () => {
  // Attended last week, no notes_made mark: the review queue does not know it, so it stays quiet.
  const start = NOW - 6 * DAY;
  const c = buildCard(facts({ stage: "attended", booking: booking(start), call: heldCall(start) }), NOW);
  assert.equal(c.summaryDue, null);
  assert.notEqual(stateOf(c, "summary"), "missed");
});

// ── The offer and the three follow-ups ──────────────────────────────────────

const pitchedOn = (start: number, o: Partial<CardFacts> = {}) =>
  facts({
    stage: "pitched",
    reached: reached("new", "booked", "attended", "pitched"),
    booking: booking(start),
    call: heldCall(start, { pricePitched: 20000 }),
    marks: { notes_made: { at: start, url: "" }, summary_sent: { at: start + 70 * MIN, url: "https://drive/pdf" } },
    action: item("follow_up"),
    queueIndex: 1,
    ...o,
  });

test("summary sent on the call day: nothing to send until day 1, and the card says when", () => {
  const start = NOW - 4 * HOUR; // 10:00 IST today
  const c = buildCard(pitchedOn(start), NOW);
  assert.equal(c.primary, null);
  assert.equal(c.reason, "Follow-up 1 is due tomorrow.");
  assert.equal(stateOf(c, "summary"), "done");
  assert.equal(stateOf(c, "paid"), "current");
});

test("day 1: Send follow-up (day 1), carrying her Cashfree link, recorded as followup_1", () => {
  const start = NOW - DAY; // yesterday 14:00 IST
  const c = buildCard(pitchedOn(start, { payLink: LINK }), NOW);
  assert.equal(c.primary?.id, "followup");
  assert.equal(c.primary?.label, "Send follow-up (day 1)");
  assert.equal(c.primary?.mark, "followup_1");
  assert.equal(c.primary?.queueKind, "follow_up");
  assert.ok(c.primary!.send!.text.includes(LINK));
  assert.ok(c.primary!.send!.text.includes("₹20,000"));
  assert.ok(c.primary!.send!.text.includes("Your summary has the plan"));
  assert.equal(c.primary?.note, undefined);
  assert.equal(c.status.label, "Follow-up due");
});

test("no link saved for her price: the draft has none, and the card says to add it", () => {
  const c = buildCard(pitchedOn(NOW - DAY), NOW);
  assert.ok(!c.primary!.send!.text.includes("http"));
  assert.match(c.primary!.note ?? "", /Add your Cashfree link for ₹20,000/);
});

test("the follow-up template only with its flag on AND a link to put in it; otherwise the phone", () => {
  const start = NOW - DAY;
  const on = buildCard(pitchedOn(start, { payLink: LINK, templates: { followups: true, reminder: false } }), NOW);
  assert.deepEqual(on.primary?.send?.template, { name: "followup_day1_v1", params: ["Priya", LINK] });
  assert.equal(sendPath(on.primary!.send!), "template");
  const noLink = buildCard(pitchedOn(start, { templates: { followups: true, reminder: false } }), NOW);
  assert.equal(noLink.primary?.send?.template, null);
  assert.equal(sendPath(noLink.primary!.send!), "phone");
  // Her window open beats the template: the business number, free, no approval
  // needed. She wrote during the call (not after it, which would stop the
  // follow-ups), and day 1 starts at midnight, inside her 24 hours.
  const justPastMidnight = start + 10.5 * HOUR;
  const open = buildCard(
    pitchedOn(start, { payLink: LINK, templates: { followups: true, reminder: false }, inbox: inbox({ lastIn: start + 30 * MIN }) }),
    justPastMidnight,
  );
  assert.equal(open.primary?.id, "followup");
  assert.equal(sendPath(open.primary!.send!), "session");
});

test("day 3 and day 7, on his calendar; a missed day-1 is skipped rather than sent late", () => {
  const start = Date.parse("2026-11-07T08:30:00Z"); // Sat 7 Nov, 14:00 IST
  assert.equal(iso(followUpDueAt(start, 1)), "2026-11-07T18:30:00.000Z"); // Sun 8 Nov 00:00 IST
  assert.equal(iso(followUpDueAt(start, 2)), "2026-11-09T18:30:00.000Z"); // Tue 10 Nov 00:00 IST
  assert.equal(iso(followUpDueAt(start, 3)), "2026-11-13T18:30:00.000Z"); // Sat 14 Nov 00:00 IST
  const c = buildCard(pitchedOn(start), NOW);
  assert.equal(c.primary?.label, "Send follow-up (day 3)");
  assert.equal(c.primary?.mark, "followup_2");
  // Day 7: lib/crm-stage calls her lost after seven days, and the last follow-up still goes.
  const day7 = Date.parse("2026-11-14T05:00:00Z");
  const lost = buildCard(pitchedOn(start, { stage: "lost", action: null, queueIndex: -1, marks: { summary_sent: { at: start + HOUR, url: "" }, followup_2: { at: NOW, url: "" } } }), day7);
  assert.equal(lost.primary?.label, "Send follow-up (day 7)");
  assert.equal(lost.primary?.mark, "followup_3");
  // Sent by hand from the inbox after it fell due counts as sent.
  const typed = buildCard(pitchedOn(start, { inbox: inbox({ lastManualOut: NOW - HOUR, lastOut: NOW - HOUR }) }), NOW);
  assert.equal(typed.primary, null);
  assert.match(hintOf(typed, "paid"), /Follow-up 2 of 3 sent/);
});

test("follow-ups stop the moment she replies after the call, or pays", () => {
  const start = NOW - 3 * DAY;
  const replied = buildCard(pitchedOn(start, { inbox: inbox({ lastIn: NOW - 2 * HOUR }) }), NOW);
  assert.notEqual(replied.primary?.id, "followup");
  // Her window is open, so the button is to answer her.
  assert.equal(replied.primary?.id, "replied");
  assert.equal(replied.primary?.href, "/inbox");
  const quietReply = buildCard(pitchedOn(start, { inbox: inbox({ lastIn: start + 3 * HOUR }) }), NOW);
  assert.equal(quietReply.primary, null);
  assert.equal(quietReply.reason, "She wrote back after the call.");
  const paid = buildCard(pitchedOn(start, { stage: "won", won: true, reached: reached("new", "booked", "attended", "pitched", "won") }), NOW);
  assert.ok(![paid.primary, ...paid.secondary].some((a) => a?.id === "followup"));
});

test("follow-up words: plain, no exclamation marks, and only facts she was told", () => {
  for (const n of [1, 2, 3] as const) {
    for (const link of [LINK, null]) {
      for (const amount of [20000, null]) {
        const t = followUpText(n, { name: "priya sharma", amount, link, summarySent: false });
        assert.ok(!t.includes("!"), t);
        assert.ok(t.startsWith("Hi Priya,"), t);
        assert.ok(!t.includes("summary"), "no summary mentioned when none was sent");
        if (link && amount) assert.ok(t.includes(link));
        if (!amount) assert.ok(!t.includes("₹"));
      }
    }
  }
});

test("said yes, no payment: Send payment link now (it IS follow-up 1), then day 3 and 7", () => {
  const start = NOW - 3 * HOUR;
  const base = pitchedOn(start, { agreedButUnpaid: true, action: item("agreed_unpaid"), payLink: LINK, marks: { summary_sent: { at: start + HOUR, url: "" } } });
  const c = buildCard(base, NOW);
  assert.equal(c.primary?.id, "pay_link");
  assert.equal(c.primary?.label, "Send payment link");
  assert.equal(c.primary?.mark, "followup_1");
  assert.ok(c.primary!.send!.text.includes(LINK));
  assert.equal(c.status.label, "Agreed, not paid");
  const sent = buildCard({ ...base, marks: { ...base.marks, followup_1: { at: NOW - HOUR, url: "" } } }, NOW + 3 * DAY);
  assert.equal(sent.primary?.label, "Send follow-up (day 3)");
});

test("call held, no price recorded: lib/journey's send_price, after the summary", () => {
  const start = NOW - DAY;
  const c = buildCard(facts({ stage: "attended", booking: booking(start), call: heldCall(start), action: item("send_price"), queueIndex: 0, marks: { notes_made: { at: start, url: "" }, summary_sent: { at: start + HOUR, url: "" } } }), NOW);
  assert.equal(c.primary?.id, "send_price");
  assert.equal(c.reason, ACTION_LABEL.send_price);
});

test("Did she pay? is the button only when nothing else is owed", () => {
  const start = NOW - 10 * DAY;
  const ask = { row: 7, pitched: 20000, objection: "", daysSince: 10, dmPresent: "" };
  const c = buildCard(facts({ stage: "lost", booking: booking(start), call: heldCall(start, { pricePitched: 20000 }), paidAsk: ask, marks: { followup_3: { at: NOW - DAY, url: "" } } }), NOW);
  assert.equal(c.primary?.kind, "paid");
  assert.equal(c.rank, 5);
  assert.deepEqual(c.paidAsk, ask);
});

// ── Outcomes ────────────────────────────────────────────────────────────────

test("won: Mark onboarded, with Welcome from your phone beside it, never sent by itself", () => {
  const won = facts({ stage: "won", won: true, reached: reached("new", "booked", "attended", "pitched", "won"), inbox: inbox({ lastIn: NOW - HOUR }) });
  const c = buildCard(won, NOW);
  assert.equal(c.primary?.id, "onboard");
  assert.equal(c.primary?.mark, "onboarded");
  const welcome = c.secondary.find((a) => a.id === "welcome");
  assert.ok(welcome);
  // Her window is open, and it still only opens his phone.
  assert.equal(sendPath(welcome!.send!), "phone");
  assert.equal(stateOf(c, "paid"), "done");
  assert.equal(stateOf(c, "onboard"), "current");
  const done = buildCard({ ...won, marks: { onboarded: { at: NOW - HOUR, url: "" } } }, NOW);
  assert.equal(done.primary, null);
  assert.equal(done.status.tone, "ok");
  assert.equal(done.status.label, "Onboarded");
  assert.equal(stateOf(done, "onboard"), "done");
});

test("Onboard is on the strip only once she has paid", () => {
  assert.ok(!buildCard(facts(), NOW).steps.some((s) => s.key === "onboard"));
  assert.ok(buildCard(facts({ stage: "won", won: true }), NOW).steps.some((s) => s.key === "onboard"));
});

test("lost and nurture: no button, a quiet status", () => {
  const start = NOW - 20 * DAY;
  const lost = buildCard(facts({ stage: "lost", booking: booking(start), call: heldCall(start, { pricePitched: 20000 }) }), NOW);
  assert.equal(lost.primary, null);
  assert.equal(lost.status.label, "Lost");
  const nurture = buildCard(facts({ stage: "nurture" }), NOW);
  assert.equal(nurture.primary, null);
  assert.equal(nurture.status.label, "Nurture");
});

test("a message that never arrived shows as failed, until a later one gets through", () => {
  const failed = buildCard(facts({ stage: "booked", booking: booking(NOW + DAY), inbox: inbox({ lastOut: NOW - 3 * HOUR, lastFailed: NOW - 2 * HOUR }) }), NOW);
  assert.equal(failed.status.tone, "failed");
  const fixed = buildCard(facts({ stage: "booked", booking: booking(NOW + DAY), inbox: inbox({ lastOut: NOW - HOUR, lastFailed: NOW - 2 * HOUR }) }), NOW);
  assert.notEqual(fixed.status.tone, "failed");
});

// ── The send path ───────────────────────────────────────────────────────────

test("sendPath: window open → the business number; shut + template → template; else his phone", () => {
  const p = { text: "Hi", wa: "https://wa.me/91x", windowOpen: true, template: { name: "t", params: [] } };
  assert.equal(sendPath(p), "session");
  assert.equal(sendPath({ ...p, windowOpen: false }), "template");
  assert.equal(sendPath({ ...p, windowOpen: false, template: null }), "phone");
  // No words to send means there is nothing for the business number to send.
  assert.equal(sendPath({ ...p, text: "", template: null }), "phone");
  assert.equal(sendPath({ ...p, phoneOnly: true }), "phone");
});

test("her window is measured exactly as lib/summary and the inbox measure it", () => {
  const thread = [
    { phone: `91${PHONE}`, direction: "in" as const, ts: iso(NOW - 23 * HOUR - 20 * MIN) },
    { phone: `91${PHONE}`, direction: "out" as const, ts: iso(NOW - HOUR) },
  ];
  const stats = inboxStats(thread.map((m) => ({ phone: m.phone, at: m.ts, dir: m.direction, manual: true })));
  assert.equal(windowMinutesLeft(stats.get(PHONE)!.lastIn, NOW), replyWindow(thread, PHONE, NOW).minutesLeft);
  assert.equal(windowMinutesLeft(0, NOW), 0);
});

test("inboxStats: failures and his reminder template are told apart from ordinary sends", () => {
  const s = inboxStats([
    { phone: PHONE, at: iso(NOW - 5 * HOUR), dir: "out", manual: false, template: "booking_confirmed_free_v2" },
    { phone: PHONE, at: iso(NOW - 4 * HOUR), dir: "out", manual: false, failed: true },
    { phone: PHONE, at: iso(NOW - 3 * HOUR), dir: "out", manual: false, template: "confirm_reminder_v1" },
    { phone: PHONE, at: iso(NOW - 2 * HOUR), dir: "out", manual: true },
    { phone: PHONE, at: iso(NOW - HOUR), dir: "in" },
  ]).get(PHONE)!;
  assert.equal(s.lastFailed, NOW - 4 * HOUR);
  assert.equal(s.lastReminder, NOW - 3 * HOUR);
  assert.equal(s.lastManualOut, NOW - 2 * HOUR);
  assert.equal(s.lastOut, NOW - 2 * HOUR);
  assert.equal(s.lastIn, NOW - HOUR);
});

// ── Lists, order, counts ────────────────────────────────────────────────────

test("the strip and the actions are data-driven lists, in order", () => {
  assert.deepEqual(STEPS.map((s) => s.key), ["lead", "confirm", "report", "call", "summary", "paid", "onboard"]);
  assert.deepEqual(STEPS.map((s) => s.label), ["Lead", "Confirm", "Report", "Call", "Summary", "Paid", "Onboard"]);
  const pos = STEPS.map((s) => s.position);
  assert.deepEqual(pos, [...pos].sort((a, b) => a - b));
  assert.equal(ACTIONS[0].id, "summary");
  assert.deepEqual(ACTIONS.filter((a) => a.secondaryOnly).map((a) => a.id), ["thanks", "welcome"]);
  // Every step state is one of the kit's four.
  const states = new Set(stepsOf(facts({ stage: "no_show", booking: booking(NOW - DAY) }), NOW).map((s) => s.state));
  for (const s of states) assert.ok(["done", "current", "todo", "missed"].includes(s));
});

test("sorting: overdue summary, then the live call, then lib/journey's list in its own order", () => {
  const mk = (over: Partial<CardFacts>, name: string) => buildCard(facts({ ...over, name, key: name }), NOW);
  const overdueStart = NOW - 150 * MIN;
  const cards = [
    mk({ action: item("first_message"), queueIndex: 1 }, "Second on the list"),
    mk({ stage: "attended", booking: booking(overdueStart), call: heldCall(overdueStart), marks: { notes_made: { at: overdueStart, url: "" } } }, "Overdue summary"),
    mk({ stage: "booked", booking: booking(NOW + 10 * MIN), inbox: inbox({ lastIn: NOW - DAY }) }, "Live call"),
    mk({ action: item("hot_abandon"), queueIndex: 0 }, "First on the list"),
    mk({ stage: "booked", booking: booking(NOW + 3 * DAY), inbox: inbox({ lastIn: NOW - DAY }) }, "Later call"),
    mk({ stage: "nurture" }, "Nothing"),
  ];
  assert.deepEqual(sortCards(cards).map((c) => c.name), ["Overdue summary", "Live call", "First on the list", "Second on the list", "Later call", "Nothing"]);
});

test("the Today tiles that are counts of cards", () => {
  const start = NOW - 100 * MIN;
  const cards = [
    buildCard(facts({ stage: "booked", booking: booking(NOW + 2 * HOUR), key: "a" }), NOW),
    buildCard(facts({ stage: "attended", booking: booking(start), call: heldCall(start), marks: { notes_made: { at: start, url: "" } }, key: "b" }), NOW),
    buildCard(pitchedOn(NOW - DAY, { key: "c" }), NOW),
    buildCard(facts({ stage: "cancelled", booking: booking(NOW + HOUR, { cancelled: true }), key: "d" }), NOW),
  ];
  assert.deepEqual(cardCounts(cards, NOW), { callsToday: 2, summariesToSend: 1, followUpsDue: 1 });
});

// ── From journeys, and the drop-off funnel held to lib/journey's ───────────

let rowNo = 1;
const lead = (o: Partial<LeadRecord> & { phone: string }): LeadRecord => ({
  row: ++rowNo, createdAt: iso(NOW - 2 * DAY), name: "Anita Rao", email: "", paid: false, paidAmount: null, paidAt: "",
  closedAmt: null, closedAt: "", programmeValue: null, programmeCollected: null, ...o,
});
const bk = (o: Partial<BookingRecord> & { uid: string; phone: string }): BookingRecord => ({
  createdAt: iso(NOW - 4 * DAY), startAt: iso(NOW - 2 * DAY), cancelled: false, name: "Anita Rao", email: "", ...o,
});
const cl = (o: Partial<CallRecord> & { bookingUid: string }): CallRecord => ({ occurredAt: iso(NOW - 2 * DAY), attended: true, scorecard: null, ...o });

test("factsOf reads a real journey: her action item, marks, report, window and pay link", () => {
  const data: Dataset = {
    leads: [lead({ phone: "9000000301", name: "Meera Kulkarni" })],
    bookings: [bk({ uid: "u1", phone: "9000000301", name: "Meera Kulkarni" })],
    calls: [cl({ bookingUid: "u1", pricePitched: 25000, detail: { amountAgreed: "20000" } })],
    messages: [{ phone: "9000000301", at: iso(NOW - 2 * HOUR), dir: "in", manual: false, mediaType: "" }],
  };
  const journeys = journeysOf(data, { now: NOW });
  const na = needsActionOf(journeys, data, NOW);
  const j = journeys[0];
  const f = factsOf(j, {
    now: NOW,
    queue: new Map(na.items.map((it, index) => [it.personId, { item: it, index }])),
    marks: new Map([["9000000301", { summary_sent: { at: NOW - 2 * DAY + 2 * HOUR, url: "" } }]]),
    reports: new Map([["9000000301", { url: "https://drive/r", count: 2, savedAt: NOW - 3 * DAY }]]),
    inbox: inboxStats((data.messages ?? []).map((m) => ({ phone: m.phone, at: m.at, dir: m.dir, manual: m.manual }))),
    payLink: (amount) => (amount === 20000 ? LINK : null),
  });
  assert.equal(f.stage, "pitched");
  assert.equal(f.call?.amountAgreed, 20000);
  // The agreed amount beats the quoted one for the link: it is what she will pay.
  assert.equal(f.payLink, LINK);
  assert.equal(f.report?.count, 2);
  assert.equal(f.inbox.lastIn, NOW - 2 * HOUR);
  assert.equal(f.action?.kind, na.items[0]?.kind ?? undefined);
});

test("the drop-off funnel: each bar at most the one before, and Lead, Call, Paid are lib/journey's", () => {
  const data: Dataset = {
    leads: [
      lead({ phone: "9000000401" }),
      lead({ phone: "9000000402" }),
      lead({ phone: "9000000403" }),
      lead({ phone: "9000000404" }),
      lead({ phone: "9000000405", paidAmount: 20000, paid: true, paidAt: iso(NOW - DAY) }),
      lead({ phone: "9000000406", createdAt: iso(NOW - 40 * DAY) }), // outside the week
    ],
    bookings: [
      bk({ uid: "c2", phone: "9000000402" }),
      bk({ uid: "c3", phone: "9000000403" }),
      bk({ uid: "c4", phone: "9000000404" }),
      bk({ uid: "c5", phone: "9000000405" }),
    ],
    calls: [cl({ bookingUid: "c3" }), cl({ bookingUid: "c4", pricePitched: 20000 })],
    messages: [{ phone: "9000000402", at: iso(NOW - DAY), dir: "in", manual: false, mediaType: "" }],
  };
  const journeys = journeysOf(data, { now: NOW });
  const ctx = {
    now: NOW,
    inbox: inboxStats((data.messages ?? []).map((m) => ({ phone: m.phone, at: m.at, dir: m.dir }))),
    marks: new Map([["9000000404", { summary_sent: { at: NOW - 2 * DAY + 2 * HOUR, url: "" } }]]),
    reports: new Map([["9000000403", { url: "r", count: 1, savedAt: NOW - 3 * DAY }]]),
  };
  const cards = journeys.map((j) => buildCard(factsOf(j, ctx), NOW));
  const week = { from: NOW - 7 * DAY, to: NOW + 1 };
  const bars = dropOffFunnel(cards, week);
  assert.deepEqual(bars.map((b) => b.label), ["Lead", "Confirmed", "Report", "Call", "Summary", "Paid"]);
  for (let i = 1; i < bars.length; i++) assert.ok(bars[i].count <= bars[i - 1].count, `${bars[i].label} ≤ ${bars[i - 1].label}`);
  const journey = funnelOf(journeys, week);
  const n = (s: string) => journey.find((x) => x.stage === s)!.n;
  assert.equal(bars[0].count, n("new"));
  assert.equal(bars[3].count, n("attended"));
  assert.equal(bars[5].count, n("won"));
  assert.deepEqual(bars.map((b) => b.count), [5, 4, 3, 3, 2, 1]);
  // A bar's filter shows exactly the women it counts.
  for (const b of bars) assert.equal(cards.filter((c) => inDropBar(c, b.key as never, week)).length, b.count);
  // And Pipeline's bars (lib/journey's own stages) filter to exactly funnelOf's counts.
  for (const s of journey) assert.equal(cards.filter((c) => inJourneyBar(c, s.stage, week)).length, s.n);
});
