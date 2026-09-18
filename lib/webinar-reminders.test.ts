import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REMINDER_TEMPLATES,
  REMINDER_WINDOWS,
  WEBINAR_REMINDER_CAP,
  cohortKey,
  reminderCap,
  dueReminder,
  parseApprovedTemplates,
  planWebinarReminders,
  reminderParams,
  type WebinarReminderRow,
} from "./webinar-reminders.ts";

const START = "2026-09-24T14:30:00.000Z"; // 8:00 PM IST
const COHORT = cohortKey(START);
const at = (minutes: number) => Date.parse(START) + minutes * 60000;
const ALL = new Set(Object.values(REMINDER_TEMPLATES));

const row = (n: number, over: Partial<WebinarReminderRow> = {}): WebinarReminderRow => ({
  rowNumber: n,
  phone: "98765432" + String(n).padStart(2, "0"),
  status: "webinar_registered",
  webinarDate: COHORT,
  botCheck: "",
  stamp: "",
  ...over,
});

test("each reminder lands in its own window, at a decent hour, and nowhere else", () => {
  assert.equal(dueReminder(at(-27 * 60), START), "day"); // 5:00 PM the day before
  assert.equal(dueReminder(at(-24 * 60 - 1), START), "day");
  assert.equal(dueReminder(at(-24 * 60), START), null); // 8 PM the day before: window closed
  assert.equal(dueReminder(at(-95), START), "hour");
  assert.equal(dueReminder(at(-96), START), null);
  assert.equal(dueReminder(at(-41), START), "hour");
  assert.equal(dueReminder(at(-40), START), null);
  // A cron that fires seconds early still counts as live, not as nothing.
  assert.equal(dueReminder(at(-1), START), "live");
  assert.equal(dueReminder(at(-2), START), "live");
  assert.equal(dueReminder(at(-3), START), null);
  assert.equal(dueReminder(at(0), START), "live");
  assert.equal(dueReminder(at(44), START), "live");
  assert.equal(dueReminder(at(45), START), null);
  assert.equal(dueReminder(at(3 * 60), START), null); // 11 PM: never at night
  assert.equal(dueReminder(at(12.5 * 60), START), "replay"); // 8:30 AM next day
  assert.equal(dueReminder(at(16 * 60), START), null);
  assert.equal(dueReminder(at(0), "not a date"), null);
});

test("every window has spare runs, and reaches a full class at the paid cap", () => {
  // The cron fires every 15 minutes. Three runs a window means one can fail or
  // be skipped and the class is still reached.
  const runsIn = (from: number, to: number) => Math.floor((to - from) / 15);
  // 200 registrants is a full class. WEBINAR_REMINDER_CAP is 40 because a FREE
  // Cloudflare invocation allows 50 subrequests; on the paid plan the variable
  // WEBINAR_REMINDER_CAP is raised to 150 and every window then covers 200.
  const PAID_CAP = 150;
  for (const kind of ["day", "hour", "live", "replay"] as const) {
    const [from, to] = REMINDER_WINDOWS[kind];
    const runs = runsIn(from, to);
    assert.ok(runs >= 3, `${kind}: only ${runs} runs, no room for a failed one`);
    assert.ok(runs * PAID_CAP >= 200, `${kind}: ${runs} runs cannot reach a full class`);
  }
  assert.equal(WEBINAR_REMINDER_CAP, 40);
  // Windows must never overlap, or one reminder would hide another.
  const spans = Object.values(REMINDER_WINDOWS).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < spans.length; i++) assert.ok(spans[i][0] >= spans[i - 1][1], `overlap at ${i}`);
});

test("the cap can be raised by a Worker variable, within sane bounds", () => {
  assert.equal(reminderCap(undefined), WEBINAR_REMINDER_CAP);
  assert.equal(reminderCap("  150 "), 150);
  assert.equal(reminderCap("0"), WEBINAR_REMINDER_CAP);
  assert.equal(reminderCap("99999"), WEBINAR_REMINDER_CAP);
  assert.equal(reminderCap("abc"), WEBINAR_REMINDER_CAP);
});

test("only approved templates are sent", () => {
  const plan = planWebinarReminders({ rows: [row(2)], nowMs: at(-60), startIso: START, approved: new Set() });
  assert.deepEqual(plan, { due: "hour", template: "webinar_reminder_1h", reason: "not_approved" });
  assert.deepEqual(parseApprovedTemplates(" webinar_reminder_1h, bad name ,webinar_live_now,"), new Set(["webinar_reminder_1h", "webinar_live_now"]));
});

test("only this cohort's verified registrants who have not had it yet", () => {
  const plan = planWebinarReminders({
    rows: [
      row(2),
      row(3, { webinarDate: cohortKey("2026-09-17T14:30:00.000Z") }),
      row(4, { status: "lead_captured" }),
      row(5, { botCheck: "unverified" }),
      row(6, { stamp: "2026-09-24T13:30:00.000Z" }),
      row(7, { phone: "12345" }),
    ],
    nowMs: at(-60),
    startIso: START,
    approved: ALL,
  });
  assert.equal(plan.reason, "ok");
  if (plan.reason !== "ok") return;
  assert.deepEqual(plan.candidates.map((c) => c.rowNumber), [2]);
  assert.deepEqual(plan.skipped, {
    otherStatus: 1, otherDate: 1, unverified: 1, alreadySent: 1, noPhone: 1, duplicatePhone: 0, overCap: 0,
  });
});

test("one woman, one message, whichever of her rows was stamped", () => {
  const same = "9876500000";
  const plan = planWebinarReminders({
    rows: [row(2, { phone: same }), row(3, { phone: "+91 " + same, stamp: "sent" }), row(4, { phone: "91" + "9876511111" }), row(5, { phone: "9876511111" })],
    nowMs: at(5),
    startIso: START,
    approved: ALL,
  });
  assert.equal(plan.reason, "ok");
  if (plan.reason !== "ok") return;
  assert.equal(plan.template, "webinar_live_now");
  assert.deepEqual(plan.candidates, [{ rowNumber: 4, phone: "9876511111" }]);
  assert.equal(plan.skipped.duplicatePhone, 2);
});

test("a run never sends more than the cap", () => {
  const rows = Array.from({ length: 5 }, (_, i) => row(i + 2));
  const plan = planWebinarReminders({ rows, nowMs: at(-60), startIso: START, approved: ALL, limit: 3 });
  assert.equal(plan.reason, "ok");
  if (plan.reason !== "ok") return;
  assert.equal(plan.candidates.length, 3);
  assert.equal(plan.skipped.overCap, 2);
});

test("the cohort key never looks like a date to Sheets", () => {
  assert.equal(COHORT, "mc-20260924T143000Z");
  assert.ok(Number.isNaN(Date.parse(COHORT)));
  // A raw ISO in the column (or a Sheets-formatted date) is a different cohort.
  const plan = planWebinarReminders({ rows: [row(2, { webinarDate: START })], nowMs: at(-60), startIso: START, approved: ALL });
  assert.equal(plan.reason === "ok" && plan.candidates.length, 0);
});

test("each template gets exactly the parameters its approved body declares", () => {
  const parts = { whenLong: "Thursday 24 September, 8:00 PM IST", time: "8:00 PM IST", replayHours: 48 };
  // Meta rejects a mismatched parameter count (#132000), so these are pinned.
  assert.deepEqual(reminderParams("day", parts), ["Thursday 24 September, 8:00 PM IST"]);
  assert.deepEqual(reminderParams("hour", parts), ["8:00 PM IST"]);
  assert.deepEqual(reminderParams("live", parts), ["Thursday 24 September, 8:00 PM IST"]);
  assert.deepEqual(reminderParams("replay", parts), ["Thursday 24 September, 8:00 PM IST", "48"]);
  for (const kind of ["day", "hour", "live", "replay"] as const) {
    for (const p of reminderParams(kind, parts)) assert.ok(p.trim().length > 0, kind);
  }
});
